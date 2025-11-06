import { IndexProvider, QueryExpression, IndexResult, IndexEvent } from './IndexProvider.js';
import { Entity, Relation } from '../types.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import { parseMarkdown } from '../utils/markdownUtils.js';

export class MCPMemoryIndexer implements IndexProvider {
  private memoryPath: string;
  private entities: Map<string, Entity> = new Map();
  private relations: Map<string, Relation[]> = new Map();

  private constructor(memoryPath: string) {
    this.memoryPath = memoryPath;
  }

  static async create(memoryPath: string): Promise<MCPMemoryIndexer> {
    const indexer = new MCPMemoryIndexer(memoryPath);
    await indexer.buildIndex();
    return indexer;
  }

  private async buildIndex(): Promise<void> {
    try {
      const files = await fs.readdir(this.memoryPath);
      const mdFiles = files.filter(f => f.endsWith('.md'));

      for (const file of mdFiles) {
        const filePath = path.join(this.memoryPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const entityName = path.basename(file, '.md');

        const parsed = parseMarkdown(content, entityName);

        const entity: Entity = {
          name: entityName,
          entityType: parsed.metadata.entityType || 'unknown',
          observations: parsed.observations
        };

        this.entities.set(entityName, entity);

        const entityRelations = parsed.relations.map(rel => ({
          from: entityName,
          to: rel.to,
          relationType: rel.relationType,
          qualification: rel.qualification
        }));

        this.relations.set(entityName, entityRelations);
      }
    } catch (error) {
      // Directory doesn't exist or empty
    }
  }

  async query(query: QueryExpression): Promise<IndexResult[]> {
    const results: IndexResult[] = [];
    for (const entity of this.entities.values()) {
      results.push({ entity });
    }
    return results.slice(0, query.limit || 100);
  }

  async getEntity(name: string): Promise<Entity | null> {
    return this.entities.get(name) || null;
  }

  async getRelations(entityName: string): Promise<Relation[]> {
    return this.relations.get(entityName) || [];
  }

  async search(text: string): Promise<Entity[]> {
    const results: Entity[] = [];
    const searchLower = text.toLowerCase();

    for (const entity of this.entities.values()) {
      if (entity.name.toLowerCase().includes(searchLower) ||
          entity.entityType.toLowerCase().includes(searchLower) ||
          entity.observations.some(o => o.toLowerCase().includes(searchLower))) {
        results.push(entity);
      }
    }

    return results;
  }

  watch(callback: (event: IndexEvent) => void): void {
    // TODO: Implement file watcher
  }

  async close(): Promise<void> {
    // Cleanup resources
  }
}
