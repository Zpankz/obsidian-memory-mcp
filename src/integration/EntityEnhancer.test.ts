import { EntityEnhancer } from './EntityEnhancer.js';
import { Entity } from '../types.js';
import { UnifiedIndex } from '../index/UnifiedIndex.js';
import { MCPMemoryIndexer } from '../index/MCPMemoryIndexer.js';
import * as path from 'path';

describe('EntityEnhancer', () => {
  it('should extract metadata from entity observations', async () => {
    const memoryPath = path.join(__dirname, '../../test-fixtures/memory');
    const mcpIndex = await MCPMemoryIndexer.create(memoryPath);
    const unified = new UnifiedIndex(mcpIndex);

    const enhancer = new EntityEnhancer(unified);

    const entity: Entity = {
      name: 'NewEntity',
      entityType: 'test',
      observations: ['This mentions [[TestEntity]] and has #important tag.']
    };

    const enriched = await enhancer.enhance(entity);

    expect(enriched.extractedMetadata.links).toHaveLength(1);
    expect(enriched.extractedMetadata.links[0].target).toBe('TestEntity');
    expect(enriched.extractedMetadata.tags).toContain('important');

    await unified.close();
  });
});
