/**
 * Semantic Relation Index
 * Embeds relations in 384-dimensional semantic space for intelligent matching
 */

import { pipeline, Pipeline } from '@xenova/transformers';
import { Relation } from '../types.js';

export class SemanticRelationIndex {
  private model: Pipeline | null = null;
  private embeddingsCache = new Map<string, number[]>();
  private initialized = false;

  /**
   * Initialize the semantic model (one-time, ~50MB download)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.error('Loading semantic model (one-time, ~50MB)...');
    this.model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    this.initialized = true;
    console.error('✓ Semantic model loaded');
  }

  /**
   * Embed a relation into 384-dimensional vector space
   */
  async embed(relationType: string, qualification: string, context: string = ''): Promise<number[]> {
    await this.initialize();

    const key = `${relationType}.${qualification}`;

    if (this.embeddingsCache.has(key)) {
      return this.embeddingsCache.get(key)!;
    }

    const text = `${relationType} with ${qualification}${context ? ': ' + context : ''}`;
    const output = await this.model!(text, { pooling: 'mean', normalize: true });
    const embedding = Array.from(output.data as Float32Array);

    this.embeddingsCache.set(key, embedding);
    return embedding;
  }

  /**
   * Find most semantically similar relation from candidates
   */
  async findMostSimilar(
    relationType: string,
    qualification: string,
    candidateRelations: Relation[],
    threshold: number = 0.85
  ): Promise<{ match: Relation; similarity: number } | null> {
    await this.initialize();

    const queryEmbedding = await this.embed(relationType, qualification);

    let bestMatch: Relation | null = null;
    let bestSimilarity = 0;

    for (const candidate of candidateRelations) {
      const candidateEmbedding = await this.embed(candidate.relationType, candidate.qualification);
      const similarity = this.cosineSimilarity(queryEmbedding, candidateEmbedding);

      if (similarity > bestSimilarity && similarity >= threshold) {
        bestSimilarity = similarity;
        bestMatch = candidate;
      }
    }

    return bestMatch ? { match: bestMatch, similarity: bestSimilarity } : null;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  /**
   * Clear the embeddings cache
   */
  clearCache(): void {
    this.embeddingsCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.embeddingsCache.size,
      keys: Array.from(this.embeddingsCache.keys())
    };
  }
}

// Global singleton instance
export const semanticIndex = new SemanticRelationIndex();
