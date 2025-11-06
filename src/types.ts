export interface Entity {
  name: string;
  entityType: string;
  observations: string[];
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