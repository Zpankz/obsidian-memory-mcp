import { AtomicEntityExtractor } from './AtomicEntityExtractor.js';
import { Entity } from '../types.js';
import { ParsedProperty } from './YAMLObservationParser.js';

describe('AtomicEntityExtractor', () => {
  let extractor: AtomicEntityExtractor;
  let parentEntity: Entity;

  beforeEach(() => {
    extractor = new AtomicEntityExtractor();
    parentEntity = {
      name: 'NMDAR',
      entityType: 'protein',
      observations: []
    };
  });

  describe('extractAtomicEntities', () => {
    it('should extract wikilinks as atomic candidates', () => {
      const props: ParsedProperty[] = [
        {
          path: { category: 'activation', property: 'ligands' },
          value: ['glutamate', 'glycine'],
          wikilinks: ['[[glutamate]]', '[[glycine]]'],
          confidence: 0.85,
          sourceText: 'Requires glutamate and glycine'
        }
      ];

      const candidates = extractor.extractAtomicEntities(props, parentEntity);

      expect(candidates).toHaveLength(2);
      expect(candidates.map(c => c.name)).toContain('glutamate');
      expect(candidates.map(c => c.name)).toContain('glycine');
    });

    it('should assign confidence scores to candidates', () => {
      const props: ParsedProperty[] = [
        {
          path: { category: 'structure', property: 'subunits' },
          value: [],
          wikilinks: ['[[GluN1 subunit]]'], // Multi-word + technical suffix
          confidence: 0.9,
          sourceText: 'Contains GluN1 subunit'
        }
      ];

      const candidates = extractor.extractAtomicEntities(props, parentEntity);

      expect(candidates[0].confidence).toBeGreaterThan(0.7);
      expect(candidates[0].reason).toContain('compound concept');
    });

    it('should infer entity types from names', () => {
      const props: ParsedProperty[] = [
        {
          path: { category: 'activation', property: 'ligands' },
          value: [],
          wikilinks: ['[[NMDA receptor]]', '[[GluN2B subunit]]', '[[calcium pathway]]'],
          confidence: 0.85,
          sourceText: ''
        }
      ];

      const candidates = extractor.extractAtomicEntities(props, parentEntity);

      const receptor = candidates.find(c => c.name === 'NMDA receptor');
      const subunit = candidates.find(c => c.name === 'GluN2B subunit');
      const pathway = candidates.find(c => c.name === 'calcium pathway');

      expect(receptor?.inferredType).toBe('protein');
      expect(subunit?.inferredType).toBe('protein_component');
      expect(pathway?.inferredType).toBe('pathway');
    });

    it('should not create atomic for parent entity itself', () => {
      const props: ParsedProperty[] = [
        {
          path: { category: 'function', property: 'role' },
          value: [],
          wikilinks: ['[[NMDAR]]'], // Same as parent
          confidence: 0.9,
          sourceText: 'NMDAR is critical'
        }
      ];

      const candidates = extractor.extractAtomicEntities(props, parentEntity);

      expect(candidates).toHaveLength(0);
    });
  });

  describe('createAtomicEntity', () => {
    it('should create atomic entity with metadata', async () => {
      const candidate = {
        name: 'glutamate',
        confidence: 0.8,
        reason: 'technical term',
        sourceObservation: 'Requires glutamate',
        inferredType: 'molecule'
      };

      const atomic = await extractor.createAtomicEntity(candidate, parentEntity);

      expect(atomic.name).toBe('glutamate');
      expect(atomic.entityType).toBe('molecule');
      expect(atomic.metadata?.atomic).toBe(true);
      expect(atomic.metadata?.parent_references).toContain('NMDAR');
    });
  });
});
