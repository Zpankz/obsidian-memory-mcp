/**
 * YAML Observation Parser
 * Converts unstructured text observations into structured YAML properties
 */

export interface PropertyPath {
  category: string;      // Top-level: 'structure', 'activation', 'biophysics'
  subcategory?: string;  // Second-level: 'subunits', 'ligands'
  property: string;      // Final key: 'quaternary', 'conductance'
}

export interface ParsedProperty {
  path: PropertyPath;
  value: any;           // Scalar, object, or array
  wikilinks: string[];  // Extracted [[references]]
  confidence: number;   // Parse confidence (0-1)
  sourceText: string;   // Original observation
}

export class YAMLObservationParser {
  /**
   * Parse a single observation into structured properties
   */
  parseObservation(observation: string): ParsedProperty[] {
    const properties: ParsedProperty[] = [];

    // Pattern 1: "Subject is/has value" → Direct property
    const isPattern = /^(.+?)\s+(is|has|contains)\s+(.+)$/i;
    const isMatch = observation.match(isPattern);
    if (isMatch) {
      const [_, subject, verb, value] = isMatch;
      properties.push({
        path: {
          category: this.inferCategory(subject),
          property: this.normalizeKey(subject)
        },
        value: this.parseValue(value),
        wikilinks: this.extractWikilinks(value),
        confidence: 0.9,
        sourceText: observation
      });
    }

    // Pattern 2: "Property: value unit" → Typed property
    const colonPattern = /^(.+?):\s*(\d+(?:\.\d+)?)\s*(\w+)?$/;
    const colonMatch = observation.match(colonPattern);
    if (colonMatch) {
      const [_, key, numValue, unit] = colonMatch;
      properties.push({
        path: {
          category: this.inferCategory(key),
          property: this.normalizeKey(key)
        },
        value: unit ? { value: parseFloat(numValue), unit } : parseFloat(numValue),
        wikilinks: [],
        confidence: 1.0,
        sourceText: observation
      });
    }

    // Pattern 3: "Requires X and Y" → List property with references
    const requiresPattern = /requires?\s+(.+?)(?:\s+and\s+(.+?))?(?:\s+for\s+(.+?))?$/i;
    const requiresMatch = observation.match(requiresPattern);
    if (requiresMatch) {
      const items = [requiresMatch[1], requiresMatch[2]].filter(Boolean);
      const normalized = items.map(item => this.normalizeEntityName(item));
      const wikilinks = normalized.map(name => `[[${name}]]`);

      properties.push({
        path: {
          category: 'activation',
          property: 'required_ligands'
        },
        value: normalized,
        wikilinks,
        confidence: 0.85,
        sourceText: observation
      });
    }

    // Pattern 4: "Blocked by X at Y" → Block property
    const blockPattern = /blocked\s+by\s+(.+?)\s+at\s+(.+)$/i;
    const blockMatch = observation.match(blockPattern);
    if (blockMatch) {
      const [_, agent, condition] = blockMatch;
      const agentNormalized = this.normalizeEntityName(agent);

      properties.push({
        path: {
          category: 'biophysics',
          subcategory: 'block',
          property: 'agent'
        },
        value: {
          agent: `[[${agentNormalized}]]`,
          condition: this.parseValue(condition)
        },
        wikilinks: [`[[${agentNormalized}]]`],
        confidence: 0.8,
        sourceText: observation
      });
    }

    // Pattern 5: "Composed of X and Y" → Composition property
    const composedPattern = /composed\s+of\s+(.+?)(?:\s+and\s+(.+?))?$/i;
    const composedMatch = observation.match(composedPattern);
    if (composedMatch) {
      const items = [composedMatch[1], composedMatch[2]].filter(Boolean);
      const normalized = items.map(item => this.normalizeEntityName(item));
      const wikilinks = normalized.map(name => `[[${name}]]`);

      properties.push({
        path: {
          category: 'structure',
          property: 'components'
        },
        value: normalized,
        wikilinks,
        confidence: 0.85,
        sourceText: observation
      });
    }

    return properties;
  }

  /**
   * Build nested YAML structure from parsed properties
   */
  buildYAMLStructure(properties: ParsedProperty[]): any {
    const yaml: any = {};

    for (const prop of properties) {
      let current = yaml;

      // Navigate to category
      if (!current[prop.path.category]) {
        current[prop.path.category] = {};
      }
      current = current[prop.path.category];

      // Navigate to subcategory if exists
      if (prop.path.subcategory) {
        if (!current[prop.path.subcategory]) {
          current[prop.path.subcategory] = {};
        }
        current = current[prop.path.subcategory];
      }

      // Set final property
      current[prop.path.property] = prop.value;
    }

    return yaml;
  }

  /**
   * Extract all wikilinks from all properties
   */
  extractAllWikilinks(properties: ParsedProperty[]): string[] {
    const allWikilinks = new Set<string>();

    for (const prop of properties) {
      for (const wikilink of prop.wikilinks) {
        const cleaned = wikilink.replace(/\[\[|\]\]/g, '');
        allWikilinks.add(cleaned);
      }
    }

    return Array.from(allWikilinks);
  }

  /**
   * Infer YAML category from text content
   */
  private inferCategory(text: string): string {
    const textLower = text.toLowerCase();

    const categories: { [key: string]: string[] } = {
      structure: ['structure', 'composition', 'subunit', 'domain', 'topology', 'quaternary', 'composed'],
      activation: ['activation', 'requires', 'binding', 'ligand', 'agonist', 'activates'],
      biophysics: ['conductance', 'voltage', 'current', 'permeability', 'block', 'channel'],
      function: ['function', 'role', 'mediates', 'regulates', 'critical', 'involved'],
      localization: ['localization', 'located', 'expressed', 'distribution', 'found']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(kw => textLower.includes(kw))) {
        return category;
      }
    }

    return 'properties'; // Default category
  }

  /**
   * Normalize text to YAML key format
   */
  private normalizeKey(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Normalize entity name for consistency
   */
  private normalizeEntityName(text: string): string {
    return text
      .trim()
      .replace(/^the\s+/i, '')
      .replace(/\s+/g, ' ');
  }

  /**
   * Parse value (detect types, extract wikilinks)
   */
  private parseValue(text: string): any {
    const trimmed = text.trim();

    // Number
    if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
      return parseFloat(trimmed);
    }

    // Number with unit
    const unitMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(\w+)$/);
    if (unitMatch) {
      return {
        value: parseFloat(unitMatch[1]),
        unit: unitMatch[2]
      };
    }

    // Just return as string
    return trimmed;
  }

  /**
   * Extract [[wikilinks]] from text
   */
  private extractWikilinks(text: string): string[] {
    const pattern = /\[\[([^\]]+)\]\]/g;
    const links: string[] = [];

    let match;
    while ((match = pattern.exec(text)) !== null) {
      links.push(match[0]); // Include brackets for consistency
    }

    return links;
  }
}
