/**
 * Bidirectional Relation Engine
 * Automatically generates inverse relations using grammatical transformation rules
 */

import { Relation } from '../types.js';

export interface RelationRule {
  forward: { type: string; qualification: string };
  inverse: { type: string; qualification: string };
  symmetric: boolean; // true if qualification is same both ways
}

/**
 * Bidirectional relation transformation rules
 * Based on grammatical voice transformation and domain knowledge
 */
export const BIDIRECTIONAL_RULES: RelationRule[] = [
  // Causal relations (asymmetric qualifications)
  {
    forward: { type: 'influences', qualification: 'increases' },
    inverse: { type: 'influenced_by', qualification: 'increased_by' },
    symmetric: false
  },
  {
    forward: { type: 'influences', qualification: 'decreases' },
    inverse: { type: 'influenced_by', qualification: 'decreased_by' },
    symmetric: false
  },

  // Modulation (symmetric qualifications often)
  {
    forward: { type: 'modulates', qualification: 'antagonism' },
    inverse: { type: 'modulated_by', qualification: 'antagonism' },
    symmetric: true
  },
  {
    forward: { type: 'modulates', qualification: 'agonism' },
    inverse: { type: 'modulated_by', qualification: 'agonism' },
    symmetric: true
  },
  {
    forward: { type: 'modulates', qualification: 'activation' },
    inverse: { type: 'modulated_by', qualification: 'activation' },
    symmetric: true
  },

  // Inhibition (often symmetric)
  {
    forward: { type: 'inhibits', qualification: 'competitive' },
    inverse: { type: 'inhibited_by', qualification: 'competitive' },
    symmetric: true
  },
  {
    forward: { type: 'inhibits', qualification: 'non_competitive' },
    inverse: { type: 'inhibited_by', qualification: 'non_competitive' },
    symmetric: true
  },
  {
    forward: { type: 'inhibits', qualification: 'antagonism' },
    inverse: { type: 'inhibited_by', qualification: 'antagonism' },
    symmetric: true
  },

  // Binding (symmetric)
  {
    forward: { type: 'binds', qualification: 'agonism' },
    inverse: { type: 'bound_by', qualification: 'agonism' },
    symmetric: true
  },
  {
    forward: { type: 'binds', qualification: 'orthosteric' },
    inverse: { type: 'bound_by', qualification: 'orthosteric' },
    symmetric: true
  },

  // Regulation (asymmetric)
  {
    forward: { type: 'regulates', qualification: 'positive' },
    inverse: { type: 'regulated_by', qualification: 'positive' },
    symmetric: true
  },
  {
    forward: { type: 'regulates', qualification: 'negative' },
    inverse: { type: 'regulated_by', qualification: 'negative' },
    symmetric: true
  },

  // Hierarchical (asymmetric)
  {
    forward: { type: 'is_a', qualification: 'instance' },
    inverse: { type: 'has_instance', qualification: 'member' },
    symmetric: false
  },
  {
    forward: { type: 'part_of', qualification: 'component' },
    inverse: { type: 'has_part', qualification: 'composed_of' },
    symmetric: false
  },

  // Requirements (asymmetric)
  {
    forward: { type: 'requires', qualification: 'co_agonist' },
    inverse: { type: 'required_by', qualification: 'co_agonist_for' },
    symmetric: false
  },
  {
    forward: { type: 'requires', qualification: 'dependency' },
    inverse: { type: 'required_by', qualification: 'depended_on_by' },
    symmetric: false
  },

  // Conducts/Permeates (symmetric)
  {
    forward: { type: 'conducts', qualification: 'permeates' },
    inverse: { type: 'conducted_by', qualification: 'permeates_through' },
    symmetric: false
  },

  // Blocks (often symmetric)
  {
    forward: { type: 'blocked_by', qualification: 'voltage_dependent' },
    inverse: { type: 'blocks', qualification: 'voltage_dependent' },
    symmetric: true
  }
];

export class BidirectionalEngine {
  /**
   * Create bidirectional pair for a relation if rule exists
   */
  createRelationPair(relation: Relation): Relation[] {
    const rule = this.findRule(relation.relationType, relation.qualification);

    if (!rule) {
      return [relation]; // No rule found, single direction only
    }

    const inverse: Relation = {
      from: relation.to,
      to: relation.from,
      relationType: rule.inverse.type,
      qualification: rule.inverse.qualification
    };

    return [relation, inverse];
  }

  /**
   * Create pairs for multiple relations
   */
  createMultiplePairs(relations: Relation[]): Relation[] {
    const allRelations: Relation[] = [];

    for (const relation of relations) {
      const pair = this.createRelationPair(relation);
      allRelations.push(...pair);
    }

    return allRelations;
  }

  /**
   * Find matching bidirectional rule
   */
  private findRule(relationType: string, qualification: string): RelationRule | null {
    return BIDIRECTIONAL_RULES.find(rule =>
      rule.forward.type === relationType &&
      rule.forward.qualification === qualification
    ) || null;
  }

  /**
   * Check if relation type has bidirectional rule
   */
  hasBidirectionalRule(relationType: string, qualification: string): boolean {
    return this.findRule(relationType, qualification) !== null;
  }

  /**
   * Get all supported bidirectional relation types
   */
  getSupportedRelations(): Array<{ forward: string; inverse: string }> {
    return BIDIRECTIONAL_RULES.map(rule => ({
      forward: `${rule.forward.type}.${rule.forward.qualification}`,
      inverse: `${rule.inverse.type}.${rule.inverse.qualification}`
    }));
  }
}
