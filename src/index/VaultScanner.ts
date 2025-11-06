import { IndexProvider, QueryExpression, IndexResult, IndexEvent } from './IndexProvider.js';
import { Entity, Relation } from '../types.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import matter from 'gray-matter';

export class VaultScanner implements IndexProvider {
  private vaultPath: string;
  private entities: Map<string, Entity> = new Map();

  private constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
  }

  static async create(vaultPath: string): Promise<VaultScanner> {
    const scanner = new VaultScanner(vaultPath);
    await scanner.scanVault();
    return scanner;
  }

  private async scanVault(): Promise<void> {
    try {
      const files = await fs.readdir(this.vaultPath);
      const mdFiles = files.filter(f => f.endsWith('.md'));

      for (const file of mdFiles) {
        const filePath = path.join(this.vaultPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = matter(content);
        const entityName = path.basename(file, '.md');

        const entity: Entity = {
          name: entityName,
          entityType: (parsed.data.entityType as string) || 'note',
          observations: []
        };

        this.entities.set(entityName, entity);
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
    return [];
  }

  async search(text: string): Promise<Entity[]> {
    const results: Entity[] = [];
    const searchLower = text.toLowerCase();

    for (const entity of this.entities.values()) {
      if (entity.name.toLowerCase().includes(searchLower)) {
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
