import { IndexProvider, QueryExpression, IndexResult, IndexEvent } from './IndexProvider.js';
import { Entity, Relation } from '../types.js';

export class UnifiedIndex {
  private mcpIndex: IndexProvider;
  private vaultIndex: IndexProvider | null;

  constructor(mcpIndex: IndexProvider, vaultIndex?: IndexProvider | null) {
    this.mcpIndex = mcpIndex;
    this.vaultIndex = vaultIndex || null;
  }

  async queryAll(query: QueryExpression): Promise<IndexResult[]> {
    const mcpResults = await this.mcpIndex.query(query);

    if (!this.vaultIndex) {
      return mcpResults;
    }

    const vaultResults = await this.vaultIndex.query(query);

    // Merge results, MCP takes precedence
    const mcpNames = new Set(mcpResults.map(r => r.entity.name));
    const uniqueVaultResults = vaultResults.filter(r => !mcpNames.has(r.entity.name));

    return [...mcpResults, ...uniqueVaultResults];
  }

  async getEntity(name: string): Promise<Entity | null> {
    // Check MCP first (takes precedence)
    const mcpEntity = await this.mcpIndex.getEntity(name);
    if (mcpEntity) {
      return mcpEntity;
    }

    // Fall back to vault
    if (this.vaultIndex) {
      return await this.vaultIndex.getEntity(name);
    }

    return null;
  }

  async getRelations(entityName: string): Promise<Relation[]> {
    const mcpRelations = await this.mcpIndex.getRelations(entityName);

    if (!this.vaultIndex) {
      return mcpRelations;
    }

    const vaultRelations = await this.vaultIndex.getRelations(entityName);

    return [...mcpRelations, ...vaultRelations];
  }

  async search(text: string): Promise<Entity[]> {
    const mcpResults = await this.mcpIndex.search(text);

    if (!this.vaultIndex) {
      return mcpResults;
    }

    const vaultResults = await this.vaultIndex.search(text);

    // Merge and deduplicate
    const mcpNames = new Set(mcpResults.map(e => e.name));
    const uniqueVaultResults = vaultResults.filter(e => !mcpNames.has(e.name));

    return [...mcpResults, ...uniqueVaultResults];
  }

  async close(): Promise<void> {
    await this.mcpIndex.close();
    if (this.vaultIndex) {
      await this.vaultIndex.close();
    }
  }
}
