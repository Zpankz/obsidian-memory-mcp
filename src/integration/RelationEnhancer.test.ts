import { RelationEnhancer } from './RelationEnhancer.js';
import { Relation } from '../types.js';
import { UnifiedIndex } from '../index/UnifiedIndex.js';
import { MCPMemoryIndexer } from '../index/MCPMemoryIndexer.js';
import * as path from 'path';

describe('RelationEnhancer', () => {
  it('should normalize relation types and qualifications', async () => {
    const memoryPath = path.join(__dirname, '../../test-fixtures/memory');
    const mcpIndex = await MCPMemoryIndexer.create(memoryPath);
    const unified = new UnifiedIndex(mcpIndex);

    const enhancer = new RelationEnhancer(unified);

    const relation: Relation = {
      from: 'A',
      to: 'B',
      relationType: 'affects',
      qualification: 'positive'
    };

    const result = await enhancer.normalizeAndValidate(relation);

    expect(result.normalized.relationType).toBe('influences');
    expect(result.normalized.qualification).toBe('increases');

    await unified.close();
  });
});
