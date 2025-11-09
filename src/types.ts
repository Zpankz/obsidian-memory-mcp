export interface Entity {
  name: string;
  entityType: string;
  observations: string[];
  metadata?: {
    atomic?: boolean;
    parent_references?: string[];
    created_from?: string;
    confidence?: number;
    inferred?: boolean;
    sources?: string[];
    vaultAliases?: string[];
    [key: string]: any;
  };
}

export interface Relation {
  from: string;
  to: string;
  relationType: string;
  qualification: string; // The qualitative relationship (e.g., "antagonism", "increases", "decreases")
}

export interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
}