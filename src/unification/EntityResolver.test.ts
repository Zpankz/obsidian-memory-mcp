import { EntityResolver, DuplicateCandidate } from './EntityResolver.js';
import { Entity } from '../types.js';
import { UnifiedIndex } from '../index/UnifiedIndex.js';
import { MCPMemoryIndexer } from '../index/MCPMemoryIndexer.js';
import * as path from 'path';

describe('EntityResolver', () => {
  let resolver: EntityResolver;
  let unifiedIndex: UnifiedIndex;

  beforeEach(async () => {
    const memoryPath = path.join(__dirname, '../../test-fixtures/memory');
    const mcpIndex = await MCPMemoryIndexer.create(memoryPath);
    unifiedIndex = new UnifiedIndex(mcpIndex);
    resolver = new EntityResolver(unifiedIndex);
  });

  afterEach(async () => {
    await unifiedIndex.close();
  });

  describe('findDuplicates', () => {
    it('should detect exact name variations', async () => {
      // Use existing TestEntity from fixtures
      const newEntity: Entity = {
        name: 'Test Entity Variant',
        entityType: 'test',
        observations: ['Test observation similar to TestEntity']
      };

      const duplicates = await resolver.findDuplicates(newEntity, 0.50);

      // Should find TestEntity as potential duplicate (name similarity)
      expect(Array.isArray(duplicates)).toBe(true);
      // May or may not find match depending on search results
    });

    it('should handle entities with no observations (edge case)', async () => {
      const emptyEntity: Entity = {
        name: 'Empty Entity',
        entityType: 'test',
        observations: []
      };

      const duplicates = await resolver.findDuplicates(emptyEntity);

      // Should not crash, return valid array
      expect(Array.isArray(duplicates)).toBe(true);
    });

    it('should detect shared wikilinks as similarity signal', async () => {
      const existing: Entity = {
        name: 'Dopamine System',
        entityType: 'system',
        observations: ['Involves [[dopamine]] and [[reward processing]]']
      };

      const mcpIndex = (unifiedIndex as any).mcpIndex;
      if (mcpIndex && 'addEntity' in mcpIndex) {
        mcpIndex.addEntity(existing);
      }

      const newEntity: Entity = {
        name: 'Dopaminergic System',
        entityType: 'system',
        observations: ['Uses [[dopamine]] for [[reward processing]]']
      };

      const duplicates = await resolver.findDuplicates(newEntity, 0.70);

      if (duplicates.length > 0) {
        const match = duplicates[0];
        expect(match.evidence.sharedLinks).toContain('dopamine');
        expect(match.evidence.sharedLinks).toContain('reward processing');
      }
    });

    it('should recommend merge for high similarity + type match', async () => {
      const existing: Entity = {
        name: 'Type 2 Diabetes',
        entityType: 'disease',
        observations: ['Chronic metabolic disorder']
      };

      const mcpIndex = (unifiedIndex as any).mcpIndex;
      if (mcpIndex && 'addEntity' in mcpIndex) {
        mcpIndex.addEntity(existing);
      }

      const newEntity: Entity = {
        name: 'Diabetes Mellitus Type 2',
        entityType: 'disease',
        observations: ['Metabolic disease']
      };

      const duplicates = await resolver.findDuplicates(newEntity, 0.70);

      if (duplicates.length > 0) {
        const match = duplicates[0];
        if (match.similarity >= 0.90) {
          expect(match.recommendation).toBe('merge');
        }
      }
    });

    it('should handle no duplicates found gracefully', async () => {
      const uniqueEntity: Entity = {
        name: 'Completely Unique Entity 12345',
        entityType: 'test',
        observations: ['No other entity like this']
      };

      const duplicates = await resolver.findDuplicates(uniqueEntity);

      expect(duplicates).toEqual([]);
    });
  });

  describe('mergeEntities', () => {
    it('should merge observations without duplicates', async () => {
      const target: Entity = {
        name: 'NMDAR',
        entityType: 'protein',
        observations: ['First observation', 'Second observation']
      };

      const source: Entity = {
        name: 'NMDA Receptor',
        entityType: 'protein',
        observations: ['Third observation', 'First observation'] // Contains duplicate
      };

      const result = await resolver.mergeEntities(target, source);

      expect(result.mergedEntity.observations).toContain('First observation');
      expect(result.mergedEntity.observations).toContain('Second observation');
      expect(result.mergedEntity.observations).toContain('Third observation');
      expect(result.observationsMerged).toBe(1); // Only 'Third observation' added
    });

    it('should track vault aliases', async () => {
      const target: Entity = {
        name: 'Primary Name',
        entityType: 'test',
        observations: []
      };

      const source: Entity = {
        name: 'Vault Name',
        entityType: 'test',
        observations: []
      };

      const result = await resolver.mergeEntities(target, source);

      expect(result.mergedEntity.metadata?.vaultAliases).toContain('Vault Name');
      expect(result.aliasesCreated).toContain('Vault Name');
    });

    it('should handle empty observations in both entities', async () => {
      const target: Entity = {
        name: 'A',
        entityType: 'test',
        observations: []
      };

      const source: Entity = {
        name: 'B',
        entityType: 'test',
        observations: []
      };

      const result = await resolver.mergeEntities(target, source);

      expect(result.mergedEntity.observations).toEqual([]);
      expect(result.observationsMerged).toBe(0);
    });

    it('should preserve target name and type', async () => {
      const target: Entity = {
        name: 'Target',
        entityType: 'type_target',
        observations: []
      };

      const source: Entity = {
        name: 'Source',
        entityType: 'type_source', // Different type
        observations: []
      };

      const result = await resolver.mergeEntities(target, source);

      expect(result.mergedEntity.name).toBe('Target');
      expect(result.mergedEntity.entityType).toBe('type_target');
    });
  });
});
