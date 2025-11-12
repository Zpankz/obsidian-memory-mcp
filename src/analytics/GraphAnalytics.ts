import { Entity, Relation, KnowledgeGraph } from '../types.js';
import { ArticleRank } from './ArticleRank.js';
import { DateTime } from 'luxon';

export interface CentralityMetrics {
  inDegree: number;
  outDegree: number;
  totalDegree: number;
  articleRank: number;
  normalized: boolean;
}

export interface CentralityReport {
  metrics: Map<string, CentralityMetrics>;
  topEntities: Array<{ name: string; score: number }>;
}

export interface Path {
  entities: string[];
  relations: Relation[];
  length: number;
  weight: number;
}

export interface LinkPrediction {
  from: string;
  to: string;
  confidence: number;
  method: string;
  sharedNeighbors: string[];
  explanation: string;
}

export interface CommunityMap {
  communities: Map<string, string[]>; // communityId → entityNames
  entityCommunity: Map<string, string>; // entityName → communityId
  communityCount: number;
}

export class GraphAnalytics {
  private articleRank: ArticleRank;

  constructor() {
    this.articleRank = new ArticleRank();
  }

  /**
   * Detect communities using label propagation algorithm
   */
  detectCommunities(entities: Entity[], relations: Relation[], maxIterations: number = 100): CommunityMap {
    // Initialize: each node is its own community
    const labels = new Map<string, string>();
    for (const entity of entities) {
      labels.set(entity.name, entity.name);
    }

    // Build adjacency (bidirectional)
    const neighbors = new Map<string, Set<string>>();
    for (const entity of entities) {
      neighbors.set(entity.name, new Set());
    }
    for (const rel of relations) {
      neighbors.get(rel.from)?.add(rel.to);
      neighbors.get(rel.to)?.add(rel.from); // Bidirectional
    }

    // Iterate until convergence
    let changed = true;
    let iteration = 0;

    while (changed && iteration < maxIterations) {
      changed = false;
      iteration++;

      for (const entity of entities) {
        const neighborLabels = new Map<string, number>();
        const entityNeighbors = neighbors.get(entity.name) || new Set();

        for (const neighbor of entityNeighbors) {
          const label = labels.get(neighbor);
          if (label) {
            neighborLabels.set(label, (neighborLabels.get(label) || 0) + 1);
          }
        }

        if (neighborLabels.size > 0) {
          const mostCommon = Array.from(neighborLabels.entries())
            .sort((a, b) => b[1] - a[1])[0][0];

          if (labels.get(entity.name) !== mostCommon) {
            labels.set(entity.name, mostCommon);
            changed = true;
          }
        }
      }
    }

    // Build community groups
    const communities = new Map<string, string[]>();
    for (const [entityName, communityLabel] of labels) {
      if (!communities.has(communityLabel)) {
        communities.set(communityLabel, []);
      }
      communities.get(communityLabel)!.push(entityName);
    }

    return {
      communities,
      entityCommunity: labels,
      communityCount: communities.size
    };
  }

  computeCentrality(entities: Entity[], relations: Relation[]): CentralityReport {
    const metrics = new Map<string, CentralityMetrics>();

    // Compute degrees
    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();

    for (const entity of entities) {
      inDegree.set(entity.name, 0);
      outDegree.set(entity.name, 0);
    }

    for (const relation of relations) {
      inDegree.set(relation.to, (inDegree.get(relation.to) || 0) + 1);
      outDegree.set(relation.from, (outDegree.get(relation.from) || 0) + 1);
    }

    // Compute ArticleRank
    const articleRankScores = this.articleRank.compute(entities, relations);

    // Build metrics
    for (const entity of entities) {
      const inDeg = inDegree.get(entity.name) || 0;
      const outDeg = outDegree.get(entity.name) || 0;
      const ar = articleRankScores.get(entity.name) || 0;

      metrics.set(entity.name, {
        inDegree: inDeg,
        outDegree: outDeg,
        totalDegree: inDeg + outDeg,
        articleRank: ar,
        normalized: true
      });
    }

    // Get top entities by ArticleRank
    const topEntities = Array.from(articleRankScores.entries())
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    return {
      metrics,
      topEntities
    };
  }

  findPath(from: string, to: string, relations: Relation[], maxHops: number = 5): Path | null {
    // Simple BFS for shortest path
    const queue: Array<{ node: string; path: string[]; relationPath: Relation[] }> = [
      { node: from, path: [from], relationPath: [] }
    ];
    const visited = new Set<string>([from]);

    // Build adjacency
    const adjacency = new Map<string, Array<{ to: string; relation: Relation }>>();
    for (const relation of relations) {
      if (!adjacency.has(relation.from)) {
        adjacency.set(relation.from, []);
      }
      adjacency.get(relation.from)!.push({ to: relation.to, relation });
    }

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.node === to) {
        return {
          entities: current.path,
          relations: current.relationPath,
          length: current.path.length - 1,
          weight: current.relationPath.length
        };
      }

      if (current.path.length >= maxHops + 1) {
        continue;
      }

      const neighbors = adjacency.get(current.node) || [];
      for (const { to: neighbor, relation } of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({
            node: neighbor,
            path: [...current.path, neighbor],
            relationPath: [...current.relationPath, relation]
          });
        }
      }
    }

    return null;
  }

  predictLinks(entity: string, entities: Entity[], relations: Relation[], topK: number = 10): LinkPrediction[] {
    // Adamic-Adar Index - better for sparse graphs than common neighbors
    const predictions: LinkPrediction[] = [];

    // Build degree map (count total connections for each entity)
    const degree = new Map<string, number>();
    for (const e of entities) {
      degree.set(e.name, 0);
    }
    for (const rel of relations) {
      degree.set(rel.from, (degree.get(rel.from) || 0) + 1);
      degree.set(rel.to, (degree.get(rel.to) || 0) + 1);
    }

    // Build neighbor sets (bidirectional - consider both directions for prediction)
    const neighbors = new Map<string, Set<string>>();
    for (const e of entities) {
      neighbors.set(e.name, new Set());
    }
    for (const relation of relations) {
      neighbors.get(relation.from)?.add(relation.to);
      neighbors.get(relation.to)?.add(relation.from); // Bidirectional
    }

    const entityNeighbors = neighbors.get(entity) || new Set();

    // For each non-connected entity, compute Adamic-Adar score
    for (const other of entities) {
      if (other.name === entity) continue;
      if (entityNeighbors.has(other.name)) continue; // Already connected

      const otherNeighbors = neighbors.get(other.name) || new Set();
      const commonNeighbors = Array.from(entityNeighbors).filter(n => otherNeighbors.has(n));

      if (commonNeighbors.length > 0) {
        // Adamic-Adar: sum of 1/log(degree(neighbor))
        let adamicAdarScore = 0;
        for (const neighbor of commonNeighbors) {
          const neighborDegree = degree.get(neighbor) || 1;
          if (neighborDegree > 1) {
            adamicAdarScore += 1.0 / Math.log(neighborDegree);
          } else {
            // Edge case: degree-1 nodes get weight of 1.0
            adamicAdarScore += 1.0;
          }
        }

        predictions.push({
          from: entity,
          to: other.name,
          confidence: adamicAdarScore,
          method: 'adamic_adar',
          sharedNeighbors: commonNeighbors,
          explanation: `Adamic-Adar score: ${adamicAdarScore.toFixed(3)} via ${commonNeighbors.length} common neighbors`
        });
      }
    }

    return predictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, topK);
  }
}
