import { UnifiedIndex } from './UnifiedIndex.js';
import { MCPMemoryIndexer } from './MCPMemoryIndexer.js';
import { VaultScanner } from './VaultScanner.js';
import * as path from 'path';

describe('UnifiedIndex', () => {
  it('should create unified index with both indexes', async () => {
    const memoryPath = path.join(__dirname, '../../test-fixtures/memory');
    const vaultPath = path.join(__dirname, '../../test-fixtures/vault');

    const mcpIndex = await MCPMemoryIndexer.create(memoryPath);
    const vaultIndex = await VaultScanner.create(vaultPath);

    const unified = new UnifiedIndex(mcpIndex, vaultIndex);

    expect(unified).toBeDefined();

    await unified.close();
  });

  it('should query across both indexes', async () => {
    const memoryPath = path.join(__dirname, '../../test-fixtures/memory');
    const vaultPath = path.join(__dirname, '../../test-fixtures/vault');

    const mcpIndex = await MCPMemoryIndexer.create(memoryPath);
    const vaultIndex = await VaultScanner.create(vaultPath);

    const unified = new UnifiedIndex(mcpIndex, vaultIndex);

    const results = await unified.queryAll({});
    expect(results.length).toBeGreaterThan(0);

    await unified.close();
  });

  it('should prioritize MCP index over vault', async () => {
    const memoryPath = path.join(__dirname, '../../test-fixtures/memory');
    const vaultPath = path.join(__dirname, '../../test-fixtures/vault');

    const mcpIndex = await MCPMemoryIndexer.create(memoryPath);
    const vaultIndex = await VaultScanner.create(vaultPath);

    const unified = new UnifiedIndex(mcpIndex, vaultIndex);

    const entity = await unified.getEntity('TestEntity');
    expect(entity).toBeDefined();
    expect(entity?.entityType).toBe('test'); // From MCP, not vault

    await unified.close();
  });
});
