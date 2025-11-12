/**
 * Self-Organizing Property Taxonomy
 * Learns hierarchical structure from relation co-occurrence patterns
 * Discovers that "modulates" is parent of "activates"/"inhibits" automatically
 */

import { Relation } from '../types.js';

export interface PropertyNode {
  property: string;          // e.g., "modulates"
  level: number;            // 0=root, 1=category, 2=subcategory
  parent: string | null;    // e.g., "influences"
  children: string[];       // e.g., ["activates", "inhibits"]
  usageCount: number;       // How many times this property appears
  targetOverlap: Map<string, number>; // Jaccard similarity with other properties
}

export class PropertyTaxonomy {
  /**
   * Learn taxonomy from relation graph using co-occurrence patterns
   * Edge cases: Single relation type, disconnected properties, circular dependencies
   */
  async learnFromGraph(relations: Relation[], minUsage: number = 3): Promise<Map<string, PropertyNode>> {
    const taxonomy = new Map<string, PropertyNode>();

    // Step 1: Build target overlap matrix
    const targetMap = new Map<string, Set<string>>();

    for (const rel of relations) {
      const key = `${rel.relationType}.${rel.qualification}`;
      if (!targetMap.has(key)) {
        targetMap.set(key, new Set());
      }
      targetMap.get(key)!.add(rel.to);
    }

    // Filter out rare properties (usage < minUsage)
    const commonProperties = Array.from(targetMap.entries())
      .filter(([_, targets]) => targets.size >= minUsage);

    if (commonProperties.length === 0) {
      // Edge case: No properties meet minimum usage
      return taxonomy;
    }

    // Step 2: Compute Jaccard similarity for all property pairs
    const similarities = new Map<string, Map<string, number>>();

    for (const [prop1, targets1] of commonProperties) {
      similarities.set(prop1, new Map());

      for (const [prop2, targets2] of commonProperties) {
        if (prop1 === prop2) continue;

        const intersection = new Set([...targets1].filter(t => targets2.has(t)));
        const union = new Set([...targets1, ...targets2]);

        const jaccard = intersection.size / union.size;
        similarities.get(prop1)!.set(prop2, jaccard);
      }
    }

    // Step 3: Hierarchical clustering
    // Properties with high Jaccard (>0.4) are related
    // Within clusters, identify parent (broader usage) vs children (specific usage)

    const clusters = this.agglomerativeClustering(similarities, 0.4);

    // Step 4: Build hierarchy
    let currentLevel = 1;

    for (const cluster of clusters) {
      if (cluster.length === 1) {
        // Singleton - top-level property
        const prop = cluster[0];
        taxonomy.set(prop, {
          property: prop,
          level: currentLevel,
          parent: null,
          children: [],
          usageCount: targetMap.get(prop)?.size || 0,
          targetOverlap: similarities.get(prop) || new Map()
        });
      } else {
        // Multi-property cluster - identify parent-child relationships
        const parent = this.identifyParent(cluster, targetMap);

        taxonomy.set(parent, {
          property: parent,
          level: currentLevel,
          parent: null,
          children: cluster.filter(p => p !== parent),
          usageCount: targetMap.get(parent)?.size || 0,
          targetOverlap: similarities.get(parent) || new Map()
        });

        for (const child of cluster) {
          if (child !== parent) {
            taxonomy.set(child, {
              property: child,
              level: currentLevel + 1,
              parent,
              children: [],
              usageCount: targetMap.get(child)?.size || 0,
              targetOverlap: similarities.get(child) || new Map()
            });
          }
        }
      }
    }

    return taxonomy;
  }

  /**
   * Agglomerative clustering based on Jaccard similarity
   */
  private agglomerativeClustering(
    similarities: Map<string, Map<string, number>>,
    threshold: number
  ): string[][] {
    const clusters: string[][] = [];
    const assigned = new Set<string>();

    for (const [prop1, sims] of similarities) {
      if (assigned.has(prop1)) continue;

      const cluster: string[] = [prop1];
      assigned.add(prop1);

      // Find all properties similar to prop1
      for (const [prop2, similarity] of sims) {
        if (!assigned.has(prop2) && similarity >= threshold) {
          cluster.push(prop2);
          assigned.add(prop2);
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  /**
   * Identify parent property in cluster (most general/broadly used)
   */
  private identifyParent(cluster: string[], targetMap: Map<string, Set<string>>): string {
    // Parent = property with most targets (broadest usage)
    let maxTargets = 0;
    let parent = cluster[0];

    for (const prop of cluster) {
      const targetCount = targetMap.get(prop)?.size || 0;
      if (targetCount > maxTargets) {
        maxTargets = targetCount;
        parent = prop;
      }
    }

    return parent;
  }

  /**
   * Get all descendants of a property (recursive)
   */
  getDescendants(property: string, taxonomy: Map<string, PropertyNode>): string[] {
    const node = taxonomy.get(property);
    if (!node) return [];

    const descendants: string[] = [];

    for (const child of node.children) {
      descendants.push(child);
      descendants.push(...this.getDescendants(child, taxonomy));
    }

    return descendants;
  }

  /**
   * Get all ancestors of a property (recursive)
   */
  getAncestors(property: string, taxonomy: Map<string, PropertyNode>): string[] {
    const node = taxonomy.get(property);
    if (!node || !node.parent) return [];

    const ancestors: string[] = [node.parent];
    ancestors.push(...this.getAncestors(node.parent, taxonomy));

    return ancestors;
  }
}
