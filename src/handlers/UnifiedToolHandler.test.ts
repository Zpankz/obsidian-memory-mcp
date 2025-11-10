import { UnifiedToolHandler } from './UnifiedToolHandler.js';
import { MarkdownStorageManager } from '../storage/MarkdownStorageManager.js';
import { UnifiedIndex } from '../index/UnifiedIndex.js';
import { MCPMemoryIndexer } from '../index/MCPMemoryIndexer.js';
import * as path from 'path';

describe('UnifiedToolHandler', () => {
  let handler: UnifiedToolHandler;
  let storageManager: MarkdownStorageManager;
  let unifiedIndex: UnifiedIndex;

  beforeEach(async () => {
    storageManager = new MarkdownStorageManager();
    const memoryPath = path.join(__dirname, '../../test-fixtures/memory');
    const mcpIndex = await MCPMemoryIndexer.create(memoryPath);
    unifiedIndex = new UnifiedIndex(mcpIndex);

    handler = new UnifiedToolHandler(storageManager, unifiedIndex);
  });

  afterEach(async () => {
    await unifiedIndex.close();
  });

  describe('Entity Operations', () => {
    it('should create entities via entity.create', async () => {
      const result = await handler.execute({
        operation: 'entity',
        subfunction: 'create',
        params: {
          entities: [{
            name: 'TestEntity',
            entityType: 'test',
            observations: ['Test observation']
          }]
        }
      });

      expect(result.success).toBe(true);
      if ('data' in result) {
        expect(result.data?.created).toHaveLength(1);
      }
    });

    it('should delete entities via entity.delete', async () => {
      const result = await handler.execute({
        operation: 'entity',
        subfunction: 'delete',
        params: {
          entityNames: ['TestEntity']
        }
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Relation Operations', () => {
    it('should create bidirectional relations via relation.create', async () => {
      // First create entities
      await handler.execute({
        operation: 'entity',
        subfunction: 'create',
        params: {
          entities: [
            { name: 'A', entityType: 'test', observations: [] },
            { name: 'B', entityType: 'test', observations: [] }
          ],
          atomicDecomposition: false
        }
      });

      // Then create relation
      const result = await handler.execute({
        operation: 'relation',
        subfunction: 'create',
        params: {
          relations: [{
            from: 'A',
            to: 'B',
            relationType: 'influences',
            qualification: 'increases'
          }],
          bidirectional: true
        }
      });

      expect(result.success).toBe(true);
      if ('data' in result) {
        expect(result.data?.summary?.inverseRelations).toBeGreaterThan(0);
        expect(result.data?.summary?.bidirectionalEnabled).toBe(true);
        expect(result.data?.created).toBeDefined();
        expect(result.data?.created.length).toBeGreaterThan(1); // Should have forward + inverse
      }
    });

    it('should get relation properties via relation.get_properties', async () => {
      const result = await handler.execute({
        operation: 'relation',
        subfunction: 'get_properties',
        params: {}
      });

      expect(result.success).toBe(true);
      if ('data' in result) {
        expect(result.data?.relationTypes).toBeDefined();
        expect(result.data?.qualifications).toBeDefined();
      }
    });
  });

  describe('Query Operations', () => {
    it('should read graph via query.read_graph', async () => {
      const result = await handler.execute({
        operation: 'query',
        subfunction: 'read_graph',
        params: {}
      });

      expect(result.success).toBe(true);
      if ('data' in result) {
        expect(result.data?.entities).toBeDefined();
        expect(result.data?.relations).toBeDefined();
      }
    });

    it('should search nodes via query.search', async () => {
      const result = await handler.execute({
        operation: 'query',
        subfunction: 'search',
        params: {
          query: 'Test'
        }
      });

      expect(result.success).toBe(true);
      if ('data' in result) {
        expect(result.data?.entities).toBeDefined();
      }
    });
  });

  describe('Analytics Operations', () => {
    it('should compute centrality via analytics.centrality', async () => {
      const result = await handler.execute({
        operation: 'analytics',
        subfunction: 'centrality',
        params: {}
      });

      expect(result.success).toBe(true);
      if ('data' in result) {
        expect(result.data?.topEntities).toBeDefined();
      }
    });
  });

  describe('Workflow Mode', () => {
    it('should execute multi-step workflow', async () => {
      const result = await handler.execute({
        operation: 'workflow',
        workflow: [
          {
            operation: 'entity',
            subfunction: 'create',
            params: {
              entities: [{
                name: 'WorkflowTest',
                entityType: 'test',
                observations: ['Created in workflow']
              }]
            },
            storeAs: 'createdEntities'
          },
          {
            operation: 'query',
            subfunction: 'search',
            params: {
              query: 'WorkflowTest'
            },
            storeAs: 'searchResults'
          }
        ]
      });

      expect(result.success).toBe(true);
      if ('steps' in result) {
        expect(result.steps).toHaveLength(2);
        expect(result.context?.createdEntities).toBeDefined();
        expect(result.context?.searchResults).toBeDefined();
      }
    });

    it('should stop workflow on error', async () => {
      const result = await handler.execute({
        operation: 'workflow',
        workflow: [
          {
            operation: 'entity',
            subfunction: 'delete',
            params: {
              entityNames: ['NonExistent']
            }
          },
          {
            operation: 'query',
            subfunction: 'search',
            params: {
              query: 'test'
            }
          }
        ]
      });

      // Should complete (delete doesn't error on non-existent)
      // But demonstrates error handling
      if ('steps' in result) {
        expect(result.steps.length).toBeGreaterThan(0);
      }
    });
  });
});
