import { Entity, Relation } from '../types.js';

export class ArticleRank {
  private dampingFactor: number;
  private maxIterations: number;
  private tolerance: number;

  constructor(dampingFactor: number = 0.85, maxIterations: number = 100, tolerance: number = 1e-6) {
    this.dampingFactor = dampingFactor;
    this.maxIterations = maxIterations;
    this.tolerance = tolerance;
  }

  compute(entities: Entity[], relations: Relation[]): Map<string, number> {
    const n = entities.length;
    if (n === 0) return new Map();

    // Initialize scores uniformly
    const scores = new Map<string, number>();
    const newScores = new Map<string, number>();
    const initialScore = 1.0 / n;

    for (const entity of entities) {
      scores.set(entity.name, initialScore);
      newScores.set(entity.name, initialScore);
    }

    // Build adjacency structure
    const outgoingLinks = new Map<string, string[]>();
    const incomingLinks = new Map<string, string[]>();

    for (const entity of entities) {
      outgoingLinks.set(entity.name, []);
      incomingLinks.set(entity.name, []);
    }

    for (const relation of relations) {
      outgoingLinks.get(relation.from)?.push(relation.to);
      incomingLinks.get(relation.to)?.push(relation.from);
    }

    // Compute out-degree for each node
    const outDegree = new Map<string, number>();
    for (const [node, links] of outgoingLinks) {
      outDegree.set(node, links.length);
    }

    // Iterate until convergence
    for (let iter = 0; iter < this.maxIterations; iter++) {
      let maxChange = 0;

      for (const entity of entities) {
        const name = entity.name;
        const incoming = incomingLinks.get(name) || [];

        // ArticleRank formula: AR(v) = (1-d)/N + d * Σ(AR(u) / C(u))
        // where C(u) is out-degree of u
        let sum = 0;
        for (const source of incoming) {
          const sourceScore = scores.get(source) || 0;
          const sourceOutDegree = outDegree.get(source) || 1; // Avoid division by zero
          sum += sourceScore / sourceOutDegree;
        }

        const newScore = (1 - this.dampingFactor) / n + this.dampingFactor * sum;
        newScores.set(name, newScore);

        const change = Math.abs(newScore - (scores.get(name) || 0));
        maxChange = Math.max(maxChange, change);
      }

      // Copy new scores to current scores
      for (const [name, score] of newScores) {
        scores.set(name, score);
      }

      // Check convergence
      if (maxChange < this.tolerance) {
        break;
      }
    }

    return scores;
  }
}
