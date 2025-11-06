import { Entity, Relation } from '../types.js';

export interface QueryExpression {
  where?: string;
  sort?: string;
  limit?: number;
}

export interface IndexResult {
  entity: Entity;
  score?: number;
}

export interface IndexEvent {
  type: 'created' | 'updated' | 'deleted';
  entityName: string;
  timestamp: Date;
}

export interface IndexProvider {
  query(query: QueryExpression): Promise<IndexResult[]>;
  getEntity(name: string): Promise<Entity | null>;
  getRelations(entityName: string): Promise<Relation[]>;
  search(text: string): Promise<Entity[]>;
  watch(callback: (event: IndexEvent) => void): void;
  close(): Promise<void>;
}
