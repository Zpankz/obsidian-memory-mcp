import { MCPMemoryIndexer } from './MCPMemoryIndexer.js';
import { Entity } from '../types.js';
import * as path from 'path';

describe('MCPMemoryIndexer', () => {
  it('should create indexer with memory path', async () => {
    const memoryPath = path.join(__dirname, '../../test-fixtures/memory');
    const indexer = await MCPMemoryIndexer.create(memoryPath);

    expect(indexer).toBeDefined();
    await indexer.close();
  });

  it('should index entities from markdown files', async () => {
    const memoryPath = path.join(__dirname, '../../test-fixtures/memory');
    const indexer = await MCPMemoryIndexer.create(memoryPath);

    const entity = await indexer.getEntity('TestEntity');
    expect(entity).toBeDefined();
    expect(entity?.name).toBe('TestEntity');

    await indexer.close();
  });
});
