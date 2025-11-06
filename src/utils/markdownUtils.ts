import matter from 'gray-matter';
import { Entity, Relation } from '../types.js';

interface MarkdownMetadata {
  entityType: string;
  created?: string;
  updated?: string;
}

interface ParsedMarkdown {
  metadata: MarkdownMetadata;
  name: string;
  observations: string[];
  relations: Array<{
    to: string;
    relationType: string;
    qualification: string;
  }>;
}

/**
 * Parse a markdown file content into structured data
 */
export function parseMarkdown(content: string, entityName: string): ParsedMarkdown {
  const parsed = matter(content);
  const metadata = parsed.data as MarkdownMetadata;

  // Extract observations from the content
  const observations: string[] = [];
  const relations: Array<{ to: string; relationType: string; qualification: string }> = [];

  // Parse relations from frontmatter (Dendron format: relationType.qualification)
  const metadataFields = new Set(['entityType', 'created', 'updated']);

  for (const [key, value] of Object.entries(parsed.data)) {
    // Skip standard metadata fields
    if (metadataFields.has(key)) continue;

    // Look for keys with format "relationType.qualification"
    const dotIndex = key.indexOf('.');
    if (dotIndex > 0 && Array.isArray(value)) {
      const relationType = key.substring(0, dotIndex);
      const qualification = key.substring(dotIndex + 1);

      // Parse wikilinks from the array
      for (const link of value) {
        if (typeof link === 'string') {
          const linkMatch = link.match(/\[\[([^\]]+)\]\]/);
          if (linkMatch) {
            relations.push({
              to: linkMatch[1],
              relationType: relationType,
              qualification: qualification
            });
          }
        }
      }
    }
  }

  // Split content into lines for processing
  const lines = parsed.content.split('\n');
  let inObservations = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for section headers
    if (trimmed === '## Observations' || trimmed === '### Observations') {
      inObservations = true;
      continue;
    } else if (trimmed.startsWith('##') || trimmed.startsWith('###')) {
      // Another section started
      inObservations = false;
    }

    // Extract observations (bullet points)
    if (inObservations && (trimmed.startsWith('- ') || trimmed.startsWith('* '))) {
      observations.push(trimmed.substring(2));
    }
  }

  return {
    metadata,
    name: entityName,
    observations,
    relations
  };
}

/**
 * Generate markdown content from an entity
 */
export function generateMarkdown(entity: Entity, relations: Relation[]): string {
  const now = new Date().toISOString().split('T')[0];

  // Prepare frontmatter with relations in Dendron format
  const frontmatter: any = {
    entityType: entity.entityType,
    created: now,
    updated: now
  };

  // Add relations to frontmatter using Dendron link ontology format
  const entityRelations = relations.filter(r => r.from === entity.name);
  if (entityRelations.length > 0) {
    // Group relations by type and qualification
    const relationsByTypeAndQual: { [key: string]: string[] } = {};
    for (const relation of entityRelations) {
      const dendronKey = `${relation.relationType}.${relation.qualification}`;
      if (!relationsByTypeAndQual[dendronKey]) {
        relationsByTypeAndQual[dendronKey] = [];
      }
      relationsByTypeAndQual[dendronKey].push(`[[${relation.to}]]`);
    }

    // Add grouped relations to frontmatter
    for (const [key, targets] of Object.entries(relationsByTypeAndQual)) {
      frontmatter[key] = targets;
    }
  }

  // Build content sections
  let content = matter.stringify('', frontmatter);

  // Add title
  content += `# ${entity.name}\n\n`;

  // Add observations
  if (entity.observations.length > 0) {
    content += `## Observations\n`;
    for (const observation of entity.observations) {
      content += `- ${observation}\n`;
    }
    content += '\n';
  }

  return content;
}

/**
 * Update the metadata section of a markdown file
 */
export function updateMetadata(content: string, updates: Partial<MarkdownMetadata>): string {
  const parsed = matter(content);
  const updatedData = { ...parsed.data, ...updates };
  
  // Update the 'updated' timestamp
  updatedData.updated = new Date().toISOString().split('T')[0];
  
  return matter.stringify(parsed.content, updatedData);
}

/**
 * Add a relation link to the content (in frontmatter using Dendron format)
 */
export function addRelationToContent(content: string, relation: Relation): string {
  const parsed = matter(content);
  const frontmatter: any = { ...parsed.data };

  // Create the Dendron-style key (relationType.qualification)
  const dendronKey = `${relation.relationType}.${relation.qualification}`;
  const newLink = `[[${relation.to}]]`;

  // Initialize the array if it doesn't exist
  if (!frontmatter[dendronKey]) {
    frontmatter[dendronKey] = [];
  } else if (!Array.isArray(frontmatter[dendronKey])) {
    // Convert to array if it's not already
    frontmatter[dendronKey] = [frontmatter[dendronKey]];
  }

  // Add the new link if it doesn't already exist
  if (!frontmatter[dendronKey].includes(newLink)) {
    frontmatter[dendronKey].push(newLink);
  }

  // Update the 'updated' timestamp
  frontmatter.updated = new Date().toISOString().split('T')[0];

  return matter.stringify(parsed.content, frontmatter);
}

/**
 * Remove a relation link from the content (from frontmatter using Dendron format)
 */
export function removeRelationFromContent(content: string, relation: Relation): string {
  const parsed = matter(content);
  const frontmatter: any = { ...parsed.data };

  // Create the Dendron-style key (relationType.qualification)
  const dendronKey = `${relation.relationType}.${relation.qualification}`;
  const linkToRemove = `[[${relation.to}]]`;

  // Remove the link if it exists
  if (frontmatter[dendronKey] && Array.isArray(frontmatter[dendronKey])) {
    frontmatter[dendronKey] = frontmatter[dendronKey].filter(
      (link: string) => link !== linkToRemove
    );

    // Remove the key entirely if the array is now empty
    if (frontmatter[dendronKey].length === 0) {
      delete frontmatter[dendronKey];
    }
  }

  // Update the 'updated' timestamp
  frontmatter.updated = new Date().toISOString().split('T')[0];

  return matter.stringify(parsed.content, frontmatter);
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}