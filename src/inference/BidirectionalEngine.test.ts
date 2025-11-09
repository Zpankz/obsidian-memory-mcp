import { BidirectionalEngine } from './BidirectionalEngine.js';
import { Relation } from '../types.js';

describe('BidirectionalEngine', () => {
  let engine: BidirectionalEngine;

  beforeEach(() => {
    engine = new BidirectionalEngine();
  });

  describe('createRelationPair', () => {
    it('should create inverse for influences.increases', () => {
      const relation: Relation = {
        from: 'dopamine',
        to: 'reward',
        relationType: 'influences',
        qualification: 'increases'
      };

      const pair = engine.createRelationPair(relation);

      expect(pair).toHaveLength(2);
      expect(pair[0]).toEqual(relation); // Original
      expect(pair[1].from).toBe('reward');
      expect(pair[1].to).toBe('dopamine');
      expect(pair[1].relationType).toBe('influenced_by');
      expect(pair[1].qualification).toBe('increased_by');
    });

    it('should create symmetric inverse for modulates.antagonism', () => {
      const relation: Relation = {
        from: 'drug',
        to: 'receptor',
        relationType: 'modulates',
        qualification: 'antagonism'
      };

      const pair = engine.createRelationPair(relation);

      expect(pair).toHaveLength(2);
      expect(pair[1].relationType).toBe('modulated_by');
      expect(pair[1].qualification).toBe('antagonism'); // Symmetric
    });

    it('should handle hierarchical relations (is_a)', () => {
      const relation: Relation = {
        from: 'NMDAR',
        to: 'glutamate_receptor',
        relationType: 'is_a',
        qualification: 'instance'
      };

      const pair = engine.createRelationPair(relation);

      expect(pair).toHaveLength(2);
      expect(pair[1].relationType).toBe('has_instance');
      expect(pair[1].qualification).toBe('member');
    });

    it('should return single relation if no rule exists', () => {
      const relation: Relation = {
        from: 'A',
        to: 'B',
        relationType: 'unknown_type',
        qualification: 'unknown_qual'
      };

      const pair = engine.createRelationPair(relation);

      expect(pair).toHaveLength(1);
      expect(pair[0]).toEqual(relation);
    });
  });

  describe('createMultiplePairs', () => {
    it('should create pairs for multiple relations', () => {
      const relations: Relation[] = [
        { from: 'A', to: 'B', relationType: 'influences', qualification: 'increases' },
        { from: 'B', to: 'C', relationType: 'modulates', qualification: 'antagonism' }
      ];

      const pairs = engine.createMultiplePairs(relations);

      expect(pairs).toHaveLength(4); // 2 original + 2 inverses
    });
  });

  describe('hasBidirectionalRule', () => {
    it('should return true for relations with rules', () => {
      expect(engine.hasBidirectionalRule('influences', 'increases')).toBe(true);
      expect(engine.hasBidirectionalRule('modulates', 'antagonism')).toBe(true);
    });

    it('should return false for relations without rules', () => {
      expect(engine.hasBidirectionalRule('unknown', 'type')).toBe(false);
    });
  });

  describe('getSupportedRelations', () => {
    it('should return all supported bidirectional relations', () => {
      const supported = engine.getSupportedRelations();

      expect(supported.length).toBeGreaterThan(10);
      expect(supported).toContainEqual({
        forward: 'influences.increases',
        inverse: 'influenced_by.increased_by'
      });
    });
  });
});
