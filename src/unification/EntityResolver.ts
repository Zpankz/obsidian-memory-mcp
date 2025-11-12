/**
 * Entity Resolution System
 * Detects and merges duplicate entities across MCP and external vault
 * Uses multi-signal similarity: name, type, shared links, observation content
 */

import { Entity } from '../types.js';
import { UnifiedIndex } from '../index/UnifiedIndex.js';
import { semanticIndex } from '../semantic/SemanticRelationIndex.js';

export interface DuplicateCandidate {
  existing: Entity;
  similarity: number;
  evidence: {
    nameMatch: number;      // Levenshtein similarity (0-1)
    typeMatch: boolean;     // entityType identical
    sharedLinks: string[];  // Common [[wikilinks]] in observations
    contentSimilarity: number; // Text overlap (0-1)
  };
  recommendation: 'merge' | 'link_as_alias' | 'keep_separate';
  confidence: number;
}

export interface MergeResult {
  mergedEntity: Entity;
  sources: string[]; // 'mcp', 'vault', or both
  observationsMerged: number;
  aliasesCreated: string[];
}

export class EntityResolver {
  constructor(private unifiedIndex: UnifiedIndex) {}

  /**
   * Find potential duplicate entities
   * Edge cases: empty observations, no wikilinks, identical names but different content
   */
  async findDuplicates(newEntity: Entity, threshold: number = 0.75): Promise<DuplicateCandidate[]> {
    const candidates: DuplicateCandidate[] = [];

    // Search for similar entities (fuzzy matching)
    const potentialDuplicates = await this.unifiedIndex.search(newEntity.name);

    for (const existing of potentialDuplicates) {
      // Skip exact name match (that's the entity itself)
      if (existing.name === newEntity.name) continue;

      // Calculate multi-signal similarity
      const nameMatch = this.levenshteinSimilarity(newEntity.name, existing.name);
      const typeMatch = newEntity.entityType === existing.entityType;

      // Extract wikilinks from observations
      const newLinks = this.extractWikilinks(newEntity.observations.join(' '));
      const existingLinks = this.extractWikilinks(existing.observations.join(' '));
      const sharedLinks = newLinks.filter(l => existingLinks.includes(l));

      // Calculate content similarity (Jaccard on words)
      const contentSimilarity = this.jaccardSimilarity(
        newEntity.observations.join(' '),
        existing.observations.join(' ')
      );

      // Weighted similarity score
      const similarity =
        (nameMatch * 0.30) +
        (typeMatch ? 0.20 : 0) +
        (sharedLinks.length / Math.max(newLinks.length, existingLinks.length, 1) * 0.25) +
        (contentSimilarity * 0.25);

      if (similarity >= threshold) {
        const recommendation = this.recommendAction(similarity, typeMatch);

        candidates.push({
          existing,
          similarity,
          evidence: {
            nameMatch,
            typeMatch,
            sharedLinks,
            contentSimilarity
          },
          recommendation,
          confidence: similarity
        });
      }
    }

    return candidates.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Recommend action based on similarity score
   */
  private recommendAction(similarity: number, typeMatch: boolean): 'merge' | 'link_as_alias' | 'keep_separate' {
    if (similarity >= 0.90 && typeMatch) {
      return 'merge'; // Very high similarity + same type = likely same entity
    } else if (similarity >= 0.75) {
      return 'link_as_alias'; // Moderate similarity = related but distinct
    } else {
      return 'keep_separate'; // Low similarity = different entities
    }
  }

  /**
   * Merge two entities
   * Edge cases: conflicting metadata, duplicate observations, different types
   */
  async mergeEntities(target: Entity, source: Entity): Promise<MergeResult> {
    // Merge observations (deduplicate)
    const mergedObservations = [...target.observations];
    let observationsMerged = 0;

    for (const sourceObs of source.observations) {
      // Check if observation already exists (fuzzy match to handle slight variations)
      const isDuplicate = mergedObservations.some(targetObs =>
        this.jaccardSimilarity(targetObs, sourceObs) > 0.90
      );

      if (!isDuplicate) {
        mergedObservations.push(sourceObs);
        observationsMerged++;
      }
    }

    // Merge metadata
    const mergedMetadata = {
      ...target.metadata,
      sources: [...new Set([
        ...(target.metadata?.sources || ['mcp']),
        ...(source.metadata?.sources || ['vault'])
      ])],
      vaultAliases: [...new Set([
        ...(target.metadata?.vaultAliases || []),
        source.name
      ])]
    };

    const mergedEntity: Entity = {
      name: target.name, // Target name takes precedence
      entityType: target.entityType, // Target type takes precedence
      observations: mergedObservations,
      metadata: mergedMetadata
    };

    return {
      mergedEntity,
      sources: mergedMetadata.sources,
      observationsMerged,
      aliasesCreated: mergedMetadata.vaultAliases
    };
  }

  /**
   * Levenshtein similarity (0-1, where 1 is identical)
   */
  private levenshteinSimilarity(a: string, b: string): number {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();

    if (aLower === bLower) return 1.0;

    const matrix: number[][] = [];
    const aLen = aLower.length;
    const bLen = bLower.length;

    for (let i = 0; i <= bLen; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= aLen; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= bLen; i++) {
      for (let j = 1; j <= aLen; j++) {
        if (bLower.charAt(i - 1) === aLower.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    const maxLength = Math.max(aLen, bLen);
    return 1.0 - (matrix[bLen][aLen] / maxLength);
  }

  /**
   * Jaccard similarity on words (0-1)
   */
  private jaccardSimilarity(a: string, b: string): number {
    const aWords = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const bWords = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));

    const intersection = new Set([...aWords].filter(w => bWords.has(w)));
    const union = new Set([...aWords, ...bWords]);

    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }

  /**
   * Extract wikilinks from text
   */
  private extractWikilinks(text: string): string[] {
    const pattern = /\[\[([^\]]+)\]\]/g;
    const links: string[] = [];
    let match;

    while ((match = pattern.exec(text)) !== null) {
      links.push(match[1]);
    }

    return links;
  }
}
