/**
 * Atomic Entity Extractor
 * Detects peripheral concepts in observations and creates atomic entities
 */

import { Entity } from '../types.js';
import { ParsedProperty } from './YAMLObservationParser.js';

export interface AtomicCandidate {
  name: string;
  confidence: number;
  reason: string;
  sourceObservation: string;
  inferredType: string;
}

export class AtomicEntityExtractor {
  /**
   * Extract atomic entity candidates from parsed properties
   */
  extractAtomicEntities(parsedProperties: ParsedProperty[], parentEntity: Entity): AtomicCandidate[] {
    const candidates = new Map<string, AtomicCandidate>();

    for (const prop of parsedProperties) {
      // Extract wikilinks as atomic entity candidates
      for (const wikilink of prop.wikilinks) {
        const name = wikilink.replace(/\[\[|\]\]/g, '');

        if (this.shouldBeAtomic(name, prop, parentEntity)) {
          if (!candidates.has(name)) {
            candidates.set(name, {
              name,
              confidence: this.calculateAtomicConfidence(name, prop),
              reason: this.explainAtomicity(name, prop),
              sourceObservation: prop.sourceText,
              inferredType: this.inferTypeFromName(name)
            });
          }
        }
      }
    }

    return Array.from(candidates.values());
  }

  /**
   * Test if concept should be atomic entity
   */
  private shouldBeAtomic(name: string, prop: ParsedProperty, parentEntity: Entity): boolean {
    // Don't create atomic for parent entity itself
    if (name.toLowerCase() === parentEntity.name.toLowerCase()) {
      return false;
    }

    // Rule 1: Multi-word concepts are usually atomic
    if (name.split(' ').length > 1) return true;

    // Rule 2: Concepts in lists/arrays are usually atomic
    if (Array.isArray(prop.value)) return true;

    // Rule 3: Technical/scientific terms are atomic
    if (this.isTechnicalTerm(name)) return true;

    // Rule 4: Capitalized terms (proper nouns/abbreviations)
    if (/^[A-Z]/.test(name)) return true;

    return false;
  }

  /**
   * Calculate confidence that this should be atomic
   */
  private calculateAtomicConfidence(name: string, prop: ParsedProperty): number {
    let confidence = 0.5; // Base confidence

    // Boost for multi-word (compound concepts)
    if (name.split(' ').length > 1) confidence += 0.2;

    // Boost for capitalized (proper nouns/abbreviations)
    if (/^[A-Z]/.test(name)) confidence += 0.1;

    // Boost for technical suffixes
    if (/receptor|channel|enzyme|kinase|pathway|protein|domain|subunit$/i.test(name)) {
      confidence += 0.2;
    }

    // Boost if from high-confidence parse
    if (prop.confidence > 0.85) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * Explain why this should be atomic
   */
  private explainAtomicity(name: string, prop: ParsedProperty): string {
    const reasons: string[] = [];

    if (name.split(' ').length > 1) {
      reasons.push('compound concept');
    }

    if (this.isTechnicalTerm(name)) {
      reasons.push('technical term');
    }

    if (/^[A-Z]/.test(name)) {
      reasons.push('proper noun/abbreviation');
    }

    return reasons.join(', ') || 'referenced in structured property';
  }

  /**
   * Check if term appears technical/scientific
   */
  private isTechnicalTerm(name: string): boolean {
    const technicalSuffixes = [
      'receptor', 'channel', 'enzyme', 'kinase', 'phosphatase',
      'protein', 'peptide', 'neurotransmitter', 'pathway', 'cascade',
      'domain', 'subunit', 'complex', 'site', 'motif'
    ];

    const nameLower = name.toLowerCase();
    return technicalSuffixes.some(suffix => nameLower.endsWith(suffix));
  }

  /**
   * Infer entity type from name patterns
   */
  private inferTypeFromName(name: string): string {
    const nameLower = name.toLowerCase();

    // Proteins and components
    if (/receptor|channel|transporter|exchanger/i.test(name)) return 'protein';
    if (/kinase|phosphatase|enzyme|protease/i.test(name)) return 'enzyme';
    if (/subunit|domain/i.test(name)) return 'protein_component';

    // Molecules
    if (/neurotransmitter|hormone|peptide/i.test(name)) return 'molecule';
    if (/ion|cation|anion/i.test(name)) return 'ion';

    // Processes
    if (/pathway|cascade|signaling|transduction/i.test(name)) return 'pathway';
    if (/potentiation|depression|plasticity/i.test(name)) return 'process';

    // Structures
    if (/synapse|terminal|dendrite|axon/i.test(name)) return 'structure';

    // Generic
    return 'concept';
  }

  /**
   * Create atomic entity from candidate
   */
  async createAtomicEntity(candidate: AtomicCandidate, parentEntity: Entity): Promise<Entity> {
    return {
      name: candidate.name,
      entityType: candidate.inferredType,
      observations: [], // Will be populated when this entity is expanded
      metadata: {
        atomic: true,
        parent_references: [parentEntity.name],
        created_from: candidate.sourceObservation,
        confidence: candidate.confidence,
        inferred: true
      }
    };
  }

  /**
   * Create multiple atomic entities
   */
  async createAtomicEntities(candidates: AtomicCandidate[], parentEntity: Entity): Promise<Entity[]> {
    const entities: Entity[] = [];

    for (const candidate of candidates) {
      const atomic = await this.createAtomicEntity(candidate, parentEntity);
      entities.push(atomic);
    }

    return entities;
  }
}
