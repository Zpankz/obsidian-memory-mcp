/**
 * Tests for critical bugs identified in user testing
 */

import { UnifiedToolHandler } from './UnifiedToolHandler.js';
import { MarkdownStorageManager } from '../storage/MarkdownStorageManager.js';
import { UnifiedIndex } from '../index/UnifiedIndex.js';
import { MCPMemoryIndexer } from '../index/MCPMemoryIndexer.js';
import * as path from 'path';

describe('Critical Bug Fixes', () => {
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

  describe('Bug #1: Observations not returned in queries', () => {
    it('should return observations in query.search results', async () => {
      // Create entity with observations
      await handler.execute({
        operation: 'entity',
        subfunction: 'create',
        params: {
          entities: [{
            name: 'ObservationTest',
            entityType: 'test',
            observations: ['First observation', 'Second observation'],
            atomicDecomposition: false
          }]
        }
      });

      // Search for it
      const searchResult = await handler.execute({
        operation: 'query',
        subfunction: 'search',
        params: { query: 'ObservationTest' }
      });

      expect(searchResult.success).toBe(true);
      if ('data' in searchResult) {
        const entities = searchResult.data?.entities;
        expect(entities).toBeDefined();
        expect(entities.length).toBeGreaterThan(0);

        const entity = entities[0];
        expect(entity.observations).toBeDefined();
        expect(entity.observations.length).toBeGreaterThan(0);
        expect(entity.observations).toContain('First observation');
      }
    });

    it('should return observations in query.open results', async () => {
      // Create entity
      await handler.execute({
        operation: 'entity',
        subfunction: 'create',
        params: {
          entities: [{
            name: 'OpenTest',
            entityType: 'test',
            observations: ['Test observation content'],
            atomicDecomposition: false
          }]
        }
      });

      // Open it
      const openResult = await handler.execute({
        operation: 'query',
        subfunction: 'open',
        params: { names: ['OpenTest'] }
      });

      expect(openResult.success).toBe(true);
      if ('data' in openResult) {
        const entities = openResult.data?.entities;
        expect(entities).toBeDefined();
        expect(entities[0].observations).toBeDefined();
        expect(entities[0].observations.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Bug #2: Inconsistent parameter naming', () => {
    it('should accept observations parameter for delete_observations', async () => {
      // Create entity with observations
      await handler.execute({
        operation: 'entity',
        subfunction: 'create',
        params: {
          entities: [{
            name: 'DeleteObsTest',
            entityType: 'test',
            observations: ['Keep this', 'Delete this'],
            atomicDecomposition: false
          }]
        }
      });

      // Delete observation using consistent parameter name
      const deleteResult = await handler.execute({
        operation: 'entity',
        subfunction: 'delete_observations',
        params: {
          observations: [{
            entityName: 'DeleteObsTest',
            observations: ['Delete this']
          }]
        }
      });

      expect(deleteResult.success).toBe(true);
    });
  });
});
