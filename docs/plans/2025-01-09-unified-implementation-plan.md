# Unified Implementation Plan: MCP Architecture + Knowledge Intelligence

**Date:** 2025-01-09
**Strategy:** MCP optimizations enable and accelerate functional improvements
**Timeline:** 3 weeks (21 days)

---

## Strategic Insight: Why MCP + Function Together

**The Synergy:**

1. **Tool Consolidation → Enables Complex Workflows**
   - Single `knowledge_graph` tool with operation parameter
   - Can add new operations without new tools
   - Makes bidirectional relations, inference, resolution all part of one coherent API

2. **Session State → Enables Temporal Analytics**
   - Cache graph once per session
   - Multi-turn exploration of temporal evolution
   - Incremental analytics (compute once, reuse)

3. **Resources → Enables Smart Navigation**
   - `obsidian://entity/{name}/relations` for graph traversal
   - `obsidian://analytics/centrality` for cached results
   - Supports temporal queries: `obsidian://entity/{name}/history?from=date`

4. **Prompts → Encodes Knowledge Workflows**
   - `/infer-relations` workflow uses all improvements
   - `/create-moc` leverages analytics + entity resolution
   - Domain expertise encoded once, reused forever

**Bottom Line:** MCP architecture creates the foundation that makes functional improvements more powerful and easier to implement.

---

## Three-Phase Implementation

### **Phase 1: MCP Architecture Foundation** (Week 1)

**Goal:** Build scalable foundation that accelerates all future improvements

#### **Task 1.1: Tool Consolidation (Days 1-2)**

**Current State:**
```
12 separate tools:
- create_entities, create_relations, add_observations
- delete_entities, delete_relations, delete_observations
- read_graph, search_nodes, open_nodes, query_vault
- analyze_graph, get_relation_properties
```

**New Architecture:**
```typescript
// Single consolidated tool
{
  name: "knowledge_graph",
  description: "Unified interface for all knowledge graph operations",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: [
          // Entity operations
          "create_entities", "delete_entities",
          "add_observations", "delete_observations",

          // Relation operations
          "create_relations", "delete_relations",

          // Query operations
          "read_graph", "search", "open_nodes",
          "query_vault", "get_properties"
        ],
        description: "Operation to perform"
      },
      params: {
        type: "object",
        description: "Operation-specific parameters"
      },
      session_id: {
        type: "string",
        description: "Optional session ID for stateful workflows"
      }
    },
    required: ["operation"]
  }
}

// Analytics remains separate (complex, stateful)
{
  name: "analytics",
  description: "Graph analytics with session-based caching",
  inputSchema: {
    type: "object",
    properties: {
      analysis_type: {
        type: "string",
        enum: ["centrality", "paths", "predictions", "temporal", "communities"]
      },
      params: { type: "object" },
      session_id: { type: "string" },
      continue: { type: "boolean", description: "Continue previous analysis" }
    }
  }
}
```

**Implementation:**
```typescript
// src/index.ts - Consolidated handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "knowledge_graph") {
    const operation = args.operation as string;
    const params = args.params as any;
    const sessionId = args.session_id as string | undefined;

    switch (operation) {
      case "create_entities":
        return await handleCreateEntities(params, sessionId);
      case "create_relations":
        return await handleCreateRelations(params, sessionId);
      // ... all other operations
    }
  }
});
```

**Files to Create/Modify:**
- Modify: `src/index.ts` (consolidate tool definitions and handlers)
- Create: `src/handlers/EntityHandlers.ts` (extract entity operation handlers)
- Create: `src/handlers/RelationHandlers.ts` (extract relation handlers)
- Create: `src/handlers/QueryHandlers.ts` (extract query handlers)

**Testing:**
- Verify all 12 operations work through consolidated tool
- Backward compatibility tests
- Token measurement (verify 78% reduction)

**Commit:** "refactor: consolidate 12 tools into knowledge_graph toolhost"

---

#### **Task 1.2: Session Management (Day 3)**

**Purpose:** Enable stateful workflows for temporal analytics and multi-turn exploration

**Implementation:**
```typescript
// src/session/SessionManager.ts
import { DateTime } from 'luxon';
import { KnowledgeGraph } from '../types.js';

interface AnalyticsSession {
  id: string;
  created: DateTime;
  lastAccessed: DateTime;
  cachedGraph: KnowledgeGraph | null;
  cachedAnalytics: Map<string, any>;
  history: Array<{
    operation: string;
    timestamp: DateTime;
    params: any;
    result: any;
  }>;
}

export class SessionManager {
  private sessions = new Map<string, AnalyticsSession>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup sessions older than 1 hour every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000);
  }

  getOrCreate(sessionId?: string): AnalyticsSession {
    if (!sessionId) {
      sessionId = crypto.randomUUID();
    }

    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        id: sessionId,
        created: DateTime.now(),
        lastAccessed: DateTime.now(),
        cachedGraph: null,
        cachedAnalytics: new Map(),
        history: []
      });
    }

    const session = this.sessions.get(sessionId)!;
    session.lastAccessed = DateTime.now();
    return session;
  }

  recordOperation(sessionId: string, operation: string, params: any, result: any) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.history.push({
        operation,
        timestamp: DateTime.now(),
        params,
        result
      });
    }
  }

  private cleanup() {
    const now = DateTime.now();
    for (const [id, session] of this.sessions) {
      const age = now.diff(session.lastAccessed, 'minutes').minutes;
      if (age > 60) {
        this.sessions.delete(id);
        console.error(`Cleaned up session ${id} (age: ${age.toFixed(0)} minutes)`);
      }
    }
  }

  close() {
    clearInterval(this.cleanupInterval);
  }
}

// Global instance
export const sessionManager = new SessionManager();
```

**Integration into analytics:**
```typescript
case "analytics": {
  const sessionId = args.session_id as string | undefined;
  const session = sessionManager.getOrCreate(sessionId);

  // Load graph once per session (cached)
  if (!session.cachedGraph) {
    session.cachedGraph = await storageManager.readGraph();
    console.error(`Session ${session.id}: Loaded graph (${session.cachedGraph.entities.length} entities)`);
  }

  // Use cached graph
  const graph = session.cachedGraph;

  // ... perform analysis

  // Record in history
  sessionManager.recordOperation(session.id, args.analysis_type, args.params, result);

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        ...result,
        session_id: session.id,
        cached: true
      })
    }]
  };
}
```

**Files:**
- Create: `src/session/SessionManager.ts`
- Modify: `src/index.ts` (integrate session management)

**Commit:** "feat: add session management for stateful analytics workflows"

---

#### **Task 1.3: Dynamic Resources (Day 4)**

**Purpose:** URI-based data access for graph navigation

**Implementation:**
```typescript
// src/index.ts - Add resource handler
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  // Resource 1: Individual entity
  const entityMatch = uri.match(/^obsidian:\/\/entity\/(.+)$/);
  if (entityMatch) {
    const name = entityMatch[1];
    const entity = await unifiedIndex.getEntity(name);

    if (!entity) {
      throw new Error(`Entity not found: ${name}`);
    }

    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(entity, null, 2)
      }]
    };
  }

  // Resource 2: Entity relations
  const relationsMatch = uri.match(/^obsidian:\/\/entity\/(.+)\/relations$/);
  if (relationsMatch) {
    const name = relationsMatch[1];
    const relations = await unifiedIndex.getRelations(name);

    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(relations, null, 2)
      }]
    };
  }

  // Resource 3: Graph schema
  if (uri === 'obsidian://graph/schema') {
    const graph = await storageManager.readGraph();
    const schema = {
      entityCount: graph.entities.length,
      relationCount: graph.relations.length,
      relationTypes: extractRelationTypes(graph.relations),
      qualifications: extractQualifications(graph.relations)
    };

    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(schema, null, 2)
      }]
    };
  }

  // Resource 4: Analytics cache
  const analyticsMatch = uri.match(/^obsidian:\/\/analytics\/session\/(.+)$/);
  if (analyticsMatch) {
    const sessionId = analyticsMatch[1];
    const session = sessionManager.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          sessionId: session.id,
          created: session.created.toISO(),
          history: session.history,
          cachedAnalytics: Array.from(session.cachedAnalytics.entries())
        }, null, 2)
      }]
    };
  }

  // Resource 5: Vault status
  if (uri === 'obsidian://vault/status') {
    const vaultConnected = unifiedIndex?.vaultIndex !== null;

    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          connected: vaultConnected,
          message: vaultConnected ? 'Vault index active' : 'No external vault connected'
        }, null, 2)
      }]
    };
  }

  throw new Error(`Unknown resource URI: ${uri}`);
});

// Declare resources capability
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "obsidian://entity/{name}",
        name: "Entity by name",
        description: "Get entity data by name",
        mimeType: "application/json"
      },
      {
        uri: "obsidian://entity/{name}/relations",
        name: "Entity relations",
        description: "Get all relations for an entity",
        mimeType: "application/json"
      },
      {
        uri: "obsidian://graph/schema",
        name: "Graph schema",
        description: "Get graph structure metadata",
        mimeType: "application/json"
      },
      {
        uri: "obsidian://analytics/session/{id}",
        name: "Analytics session",
        description: "Get cached analytics session data",
        mimeType: "application/json"
      },
      {
        uri: "obsidian://vault/status",
        name: "Vault connection status",
        description: "Check external vault connection",
        mimeType: "application/json"
      }
    ]
  };
});
```

**How Resources Enable Functional Improvements:**
- Temporal queries: `obsidian://entity/NMDAR/history?from=2025-01-01`
- Cached analytics: `obsidian://analytics/session/{id}` avoids re-computation
- Graph navigation: Tools can return URIs, model fetches details as needed

**Files:**
- Modify: `src/index.ts` (add resource handlers)

**Commit:** "feat: add dynamic resources for graph navigation"

---

#### **Task 1.4: Workflow Prompts (Day 5)**

**Purpose:** Encode domain workflows that use functional improvements

**Implementation:**
```typescript
// src/index.ts - Add prompts
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "infer-relations",
        description: "Analyze entity observations and suggest missing relations",
        arguments: [
          {
            name: "entity",
            description: "Entity name to analyze",
            required: true
          },
          {
            name: "confidence_threshold",
            description: "Minimum confidence for suggestions (0-1, default: 0.7)",
            required: false
          }
        ]
      },
      {
        name: "resolve-duplicates",
        description: "Find and merge duplicate entities across MCP and vault",
        arguments: [
          {
            name: "similarity_threshold",
            description: "Minimum similarity score (0-1, default: 0.85)",
            required: false
          }
        ]
      },
      {
        name: "explore-entity",
        description: "Multi-turn exploration: entity → relations → neighbors → analytics",
        arguments: [
          {
            name: "entity",
            description: "Starting entity name",
            required: true
          },
          {
            name: "depth",
            description: "Exploration depth (default: 2)",
            required: false
          }
        ]
      }
    ]
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "infer-relations") {
    const entity = args?.entity || "unknown";
    const threshold = args?.confidence_threshold || 0.7;

    return {
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Infer missing relations for entity: "${entity}"

Workflow:
1. Get entity: knowledge_graph({ operation: "open_nodes", params: { names: ["${entity}"] } })
2. Analyze observations for implicit relations (pattern matching)
3. Check against existing relations to avoid duplicates
4. Return suggestions with confidence > ${threshold}
5. Ask user to confirm before creating

Focus on extracting:
- Causal relations (increases, decreases)
- Interaction relations (binds, modulates)
- Hierarchical relations (is_a, part_of)`
        }
      }]
    };
  }

  if (name === "resolve-duplicates") {
    const threshold = args?.similarity_threshold || 0.85;

    return {
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Find and resolve duplicate entities

Workflow:
1. Get all entities: knowledge_graph({ operation: "read_graph" })
2. For each MCP entity, search vault for potential duplicates
3. Compute similarity using:
   - Name similarity (Levenshtein)
   - Type matching
   - Shared wikilinks
   - Context overlap
4. Present candidates with similarity > ${threshold}
5. For each candidate, offer: [merge] [link as alias] [keep separate]
6. Execute user choice`
        }
      }]
    };
  }

  if (name === "explore-entity") {
    const entity = args?.entity || "unknown";
    const depth = args?.depth || 2;

    return {
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Multi-turn entity exploration: "${entity}"

Session-based workflow (use same session_id across steps):

1. **Get entity data**
   knowledge_graph({ operation: "open_nodes", params: { names: ["${entity}"] }, session_id })

2. **Get relations**
   Resource: obsidian://entity/${entity}/relations

3. **Analyze centrality**
   analytics({ analysis_type: "centrality", session_id })

4. **Find connected entities** (depth ${depth})
   For each relation target, recurse ${depth} levels

5. **Build neighborhood map**
   Visualize as hierarchical structure

6. **Suggest insights**
   - Is this a hub? (high degree centrality)
   - Strongest connections?
   - Predicted missing links?`
        }
      }]
    };
  }

  throw new Error(`Unknown prompt: ${name}`);
});
```

**How Prompts Enable Functional Improvements:**
- `/infer-relations` → Uses relation inference engine (functional improvement)
- `/resolve-duplicates` → Uses entity resolution (functional improvement)
- `/explore-entity` → Uses sessions + resources + analytics (MCP + functional synergy)

**Files:**
- Modify: `src/index.ts` (add prompt handlers)

**Commit:** "feat: add workflow prompts for knowledge operations"

---

### **Phase 2: Functional Improvements** (Week 2)

**Goal:** Knowledge graph intelligence using MCP foundation

#### **Task 2.1: Bidirectional Relation Inference (Day 6)**

**Leverages:** Consolidated knowledge_graph tool (Phase 1)

**Implementation:**
```typescript
// src/inference/BidirectionalEngine.ts
interface RelationRule {
  forward: { type: string; qualification: string };
  inverse: { type: string; qualification: string };
  symmetric: boolean; // Same qualification both ways?
}

const BIDIRECTIONAL_RULES: RelationRule[] = [
  {
    forward: { type: 'influences', qualification: 'increases' },
    inverse: { type: 'influenced_by', qualification: 'increased_by' },
    symmetric: false
  },
  {
    forward: { type: 'modulates', qualification: 'antagonism' },
    inverse: { type: 'modulated_by', qualification: 'antagonism' },
    symmetric: true // Antagonism is symmetric
  },
  {
    forward: { type: 'binds', qualification: 'agonism' },
    inverse: { type: 'bound_by', qualification: 'agonism' },
    symmetric: true
  },
  {
    forward: { type: 'is_a', qualification: 'instance' },
    inverse: { type: 'has_instance', qualification: 'member' },
    symmetric: false // Hierarchical
  }
];

export class BidirectionalEngine {
  createRelationPair(relation: Relation): Relation[] {
    // Find matching rule
    const rule = BIDIRECTIONAL_RULES.find(r =>
      r.forward.type === relation.relationType &&
      r.forward.qualification === relation.qualification
    );

    if (!rule) {
      return [relation]; // No rule, single direction only
    }

    // Create inverse
    const inverse: Relation = {
      from: relation.to,
      to: relation.from,
      relationType: rule.inverse.type,
      qualification: rule.inverse.qualification
    };

    return [relation, inverse];
  }

  createMultiplePairs(relations: Relation[]): Relation[] {
    const allRelations: Relation[] = [];

    for (const relation of relations) {
      const pair = this.createRelationPair(relation);
      allRelations.push(...pair);
    }

    return allRelations;
  }
}
```

**Integration:**
```typescript
// In knowledge_graph handler for create_relations operation
case "create_relations": {
  const relations = params.relations as Relation[];
  const bidirectional = params.bidirectional ?? true; // Default: auto-create inverses

  // Normalize (existing)
  const relationEnhancer = new RelationEnhancer(unifiedIndex!);
  const normalized = await relationEnhancer.normalizeAndValidateMultiple(relations);

  // Create bidirectional pairs (NEW)
  let relationsToCreate = normalized.map(r => r.normalized);

  if (bidirectional) {
    const bidirectionalEngine = new BidirectionalEngine();
    relationsToCreate = bidirectionalEngine.createMultiplePairs(relationsToCreate);
  }

  // Create all relations
  const result = await storageManager.createRelations(relationsToCreate);

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        created: result.created,
        bidirectionalPairs: bidirectional ? result.created.length / 2 : 0,
        normalization: normalized
      }, null, 2)
    }]
  };
}
```

**Files:**
- Create: `src/inference/BidirectionalEngine.ts`
- Create: `src/inference/BidirectionalEngine.test.ts`
- Modify: `src/handlers/RelationHandlers.ts`

**Tests:**
```typescript
describe('BidirectionalEngine', () => {
  it('should create inverse for influences.increases', () => {
    const engine = new BidirectionalEngine();
    const relation = {
      from: 'dopamine',
      to: 'reward',
      relationType: 'influences',
      qualification: 'increases'
    };

    const pair = engine.createRelationPair(relation);

    expect(pair).toHaveLength(2);
    expect(pair[1].from).toBe('reward');
    expect(pair[1].to).toBe('dopamine');
    expect(pair[1].relationType).toBe('influenced_by');
    expect(pair[1].qualification).toBe('increased_by');
  });
});
```

**Commit:** "feat: implement bidirectional relation inference"

---

#### **Task 2.2: Relation Inference from Observations (Days 7-8)**

**Leverages:** Consolidated knowledge_graph tool, can return structured suggestions

**Implementation:**
```typescript
// src/inference/ObservationAnalyzer.ts
interface InferencePattern {
  pattern: RegExp;
  relationType: string;
  qualification: string;
  extractTarget: (match: RegExpMatchArray) => string;
  confidence: number;
}

const RELATION_PATTERNS: InferencePattern[] = [
  {
    pattern: /(\w+)\s+increases\s+(?:the\s+)?(\w+)/i,
    relationType: 'influences',
    qualification: 'increases',
    extractTarget: (match) => match[2],
    confidence: 0.75
  },
  {
    pattern: /(\w+)\s+decreases\s+(?:the\s+)?(\w+)/i,
    relationType: 'influences',
    qualification: 'decreases',
    extractTarget: (match) => match[2],
    confidence: 0.75
  },
  {
    pattern: /binds?\s+to\s+(?:the\s+)?(\w+)/i,
    relationType: 'binds',
    qualification: 'agonism',
    extractTarget: (match) => match[1],
    confidence: 0.7
  },
  {
    pattern: /inhibits?\s+(?:the\s+)?(\w+)/i,
    relationType: 'inhibits',
    qualification: 'competitive',
    extractTarget: (match) => match[1],
    confidence: 0.7
  },
  {
    pattern: /activates?\s+(?:the\s+)?(\w+)/i,
    relationType: 'modulates',
    qualification: 'activation',
    extractTarget: (match) => match[1],
    confidence: 0.7
  },
  {
    pattern: /blocks?\s+(?:the\s+)?(\w+)/i,
    relationType: 'inhibits',
    qualification: 'antagonism',
    extractTarget: (match) => match[1],
    confidence: 0.65
  },
  {
    pattern: /is\s+a\s+(?:type\s+of\s+)?(\w+)/i,
    relationType: 'is_a',
    qualification: 'instance',
    extractTarget: (match) => match[1],
    confidence: 0.8
  }
];

export class ObservationAnalyzer {
  inferRelations(entity: Entity, existingRelations: Relation[]): SuggestedRelation[] {
    const suggestions: SuggestedRelation[] = [];
    const allText = entity.observations.join(' ');

    for (const pattern of RELATION_PATTERNS) {
      const matches = allText.matchAll(new RegExp(pattern.pattern, 'gi'));

      for (const match of matches) {
        try {
          const target = pattern.extractTarget(match);

          // Skip if relation already exists
          const exists = existingRelations.some(r =>
            r.from === entity.name &&
            r.to === target &&
            r.relationType === pattern.relationType
          );

          if (exists) continue;

          suggestions.push({
            to: target,
            relationType: pattern.relationType,
            qualification: pattern.qualification,
            confidence: pattern.confidence,
            reason: `Pattern matched: "${match[0]}"`,
            sourceText: match[0]
          });
        } catch (error) {
          // Pattern extraction failed, skip
          continue;
        }
      }
    }

    // Deduplicate suggestions
    return this.deduplicateSuggestions(suggestions);
  }

  private deduplicateSuggestions(suggestions: SuggestedRelation[]): SuggestedRelation[] {
    const seen = new Set<string>();
    const unique: SuggestedRelation[] = [];

    for (const suggestion of suggestions) {
      const key = `${suggestion.to}:${suggestion.relationType}:${suggestion.qualification}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(suggestion);
      }
    }

    return unique.sort((a, b) => b.confidence - a.confidence);
  }
}
```

**Integration into EntityEnhancer:**
```typescript
// src/integration/EntityEnhancer.ts
async enhance(entity: Entity): Promise<EnrichedEntity> {
  // Existing metadata extraction
  const enriched = await this.extractionPipeline.process(entity);

  // NEW: Infer relations from observation text
  const existingRelations = await this.unifiedIndex.getRelations(entity.name);
  const observationAnalyzer = new ObservationAnalyzer();
  const inferredRelations = observationAnalyzer.inferRelations(entity, existingRelations);

  enriched.extractedMetadata.suggestedRelations.push(...inferredRelations);

  return enriched;
}
```

**Files:**
- Create: `src/inference/ObservationAnalyzer.ts`
- Create: `src/inference/ObservationAnalyzer.test.ts`
- Modify: `src/integration/EntityEnhancer.ts`

**Tests:**
```typescript
it('should infer influences.increases from observation text', () => {
  const analyzer = new ObservationAnalyzer();
  const entity = {
    name: 'dopamine',
    entityType: 'neurotransmitter',
    observations: ['dopamine increases reward processing']
  };

  const suggestions = analyzer.inferRelations(entity, []);

  expect(suggestions).toContainEqual({
    to: 'reward',
    relationType: 'influences',
    qualification: 'increases',
    confidence: 0.75,
    reason: expect.stringContaining('Pattern matched')
  });
});
```

**Commit:** "feat: implement relation inference from observation patterns"

---

#### **Task 2.3: Semantic Relation Embeddings (Days 9-10)**

**Leverages:** Consolidated tool makes adding semantic layer easier

**Implementation:**
```typescript
// src/semantic/SemanticRelationIndex.ts
import { pipeline, Pipeline } from '@xenova/transformers';

export class SemanticRelationIndex {
  private model: Pipeline | null = null;
  private embeddingsCache = new Map<string, number[]>();
  private initialized = false;

  async initialize() {
    if (this.initialized) return;

    console.error('Loading semantic model (one-time, ~50MB)...');
    this.model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    this.initialized = true;
    console.error('✓ Semantic model loaded');
  }

  async embed(relationType: string, qualification: string, context: string = ''): Promise<number[]> {
    await this.initialize();

    const key = `${relationType}.${qualification}`;

    if (this.embeddingsCache.has(key)) {
      return this.embeddingsCache.get(key)!;
    }

    const text = `${relationType} with ${qualification}${context ? ': ' + context : ''}`;
    const output = await this.model!(text, { pooling: 'mean', normalize: true });
    const embedding = Array.from(output.data as Float32Array);

    this.embeddingsCache.set(key, embedding);
    return embedding;
  }

  async findMostSimilar(
    relationType: string,
    qualification: string,
    candidateRelations: Relation[],
    threshold: number = 0.85
  ): Promise<{ match: Relation; similarity: number } | null> {
    await this.initialize();

    const queryEmbedding = await this.embed(relationType, qualification);

    let bestMatch: Relation | null = null;
    let bestSimilarity = 0;

    for (const candidate of candidateRelations) {
      const candidateEmbedding = await this.embed(candidate.relationType, candidate.qualification);
      const similarity = this.cosineSimilarity(queryEmbedding, candidateEmbedding);

      if (similarity > bestSimilarity && similarity >= threshold) {
        bestSimilarity = similarity;
        bestMatch = candidate;
      }
    }

    return bestMatch ? { match: bestMatch, similarity: bestSimilarity } : null;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
  }
}

// Global instance (lazy-initialized)
export const semanticIndex = new SemanticRelationIndex();
```

**Integration into RelationEnhancer:**
```typescript
// src/integration/RelationEnhancer.ts
async normalizeAndValidate(relation: Relation): Promise<NormalizedRelation> {
  // Step 1: String normalization (existing)
  const stringNormalized = validateAndNormalizeRelation(...);

  // Step 2: Semantic matching (NEW)
  const allRelations = await this.getAllRelationsFromGraph();

  const semanticMatch = await semanticIndex.findMostSimilar(
    stringNormalized.normalizedRelationType,
    stringNormalized.normalizedQualification,
    allRelations,
    0.85
  );

  if (semanticMatch) {
    return {
      original: relation,
      normalized: semanticMatch.match,
      suggestions: {
        ...stringNormalized.suggestions,
        semantic: {
          relationType: semanticMatch.match.relationType,
          qualification: semanticMatch.match.qualification,
          similarity: semanticMatch.similarity,
          reason: `Semantically similar to existing (${(semanticMatch.similarity * 100).toFixed(0)}%)`
        }
      }
    };
  }

  return stringNormalized;
}
```

**Dependencies:**
```bash
npm install @xenova/transformers
```

**Files:**
- Create: `src/semantic/SemanticRelationIndex.ts`
- Create: `src/semantic/SemanticRelationIndex.test.ts`
- Modify: `src/integration/RelationEnhancer.ts`

**Commit:** "feat: add semantic relation embeddings for intelligent matching"

---

#### **Task 2.4: Context-Aware Metadata Extraction (Day 11)**

**Leverages:** Unified index, resources for vault data

**Implementation:**
```typescript
// src/extraction/ContextAwareEnricher.ts
export class ContextAwareEnricher {
  constructor(private unifiedIndex: UnifiedIndex) {}

  async enrichWithVaultContext(entity: Entity): Promise<{
    suggestedTags: string[];
    suggestedType?: string;
    suggestedRelations: Array<{
      relationType: string;
      qualification: string;
      confidence: number;
      reason: string;
    }>;
  }> {
    // Find similar entities in vault
    const similar = await this.unifiedIndex.search(entity.name);

    if (similar.length === 0) {
      return { suggestedTags: [], suggestedRelations: [] };
    }

    // Aggregate tags from similar entities
    const tagFrequency = new Map<string, number>();
    for (const sim of similar) {
      // Extract tags from vault entities (if they have them)
      const tags = this.extractTagsFromEntity(sim);
      for (const tag of tags) {
        tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1);
      }
    }

    // Suggest tags appearing in >50% of similar entities
    const suggestedTags = Array.from(tagFrequency.entries())
      .filter(([tag, count]) => count / similar.length > 0.5)
      .map(([tag, count]) => tag)
      .sort();

    // Aggregate relation patterns
    const relationPatterns = new Map<string, number>();
    for (const sim of similar) {
      const relations = await this.unifiedIndex.getRelations(sim.name);
      for (const rel of relations) {
        const key = `${rel.relationType}.${rel.qualification}`;
        relationPatterns.set(key, (relationPatterns.get(key) || 0) + 1);
      }
    }

    // Suggest relations appearing in >60% of similar entities
    const suggestedRelations = Array.from(relationPatterns.entries())
      .filter(([pattern, count]) => count / similar.length > 0.6)
      .map(([pattern, count]) => {
        const [relationType, qualification] = pattern.split('.');
        return {
          relationType,
          qualification,
          confidence: count / similar.length,
          reason: `${count}/${similar.length} similar entities have this relation type`
        };
      });

    return {
      suggestedTags,
      suggestedRelations
    };
  }
}
```

**Integration:**
```typescript
// In EntityEnhancer
async enhance(entity: Entity): Promise<EnrichedEntity> {
  const enriched = await this.extractionPipeline.process(entity);

  // NEW: Vault context enrichment
  const contextEnricher = new ContextAwareEnricher(this.unifiedIndex);
  const vaultContext = await contextEnricher.enrichWithVaultContext(entity);

  enriched.extractedMetadata.suggestedTags = vaultContext.suggestedTags;
  enriched.extractedMetadata.suggestedRelations.push(
    ...vaultContext.suggestedRelations.map(sr => ({
      to: 'unknown', // Will need user to specify target
      relationType: sr.relationType,
      qualification: sr.qualification,
      confidence: sr.confidence,
      reason: sr.reason,
      sourceText: 'vault_pattern'
    }))
  );

  return enriched;
}
```

**Files:**
- Create: `src/extraction/ContextAwareEnricher.ts`
- Modify: `src/integration/EntityEnhancer.ts`

**Commit:** "feat: add vault-informed metadata suggestions"

---

### **Phase 3: Advanced Intelligence** (Week 3)

#### **Task 3.1: Temporal Knowledge Versioning (Days 12-14)**

**Leverages:** Sessions for temporal queries, resources for time-series data

[Full implementation as specified in previous documents]

**Key Integration:**
- Resource: `obsidian://entity/{name}/history?from=date&to=date`
- Analytics: `temporal` analysis type uses session cache

**Commit:** "feat: add temporal observation versioning and decay models"

---

#### **Task 3.2: Entity Resolution (Days 15-17)**

**Leverages:** Semantic embeddings (#2.3), prompts for workflow

[Full implementation as specified]

**Key Integration:**
- Prompt: `/resolve-duplicates` orchestrates multi-step workflow
- Uses semantic similarity for context matching

**Commit:** "feat: implement intelligent entity resolution across vaults"

---

#### **Task 3.3: Self-Organizing Taxonomy (Days 18-21)**

**Leverages:** Semantic embeddings, sessions, resources

[Full implementation as specified]

**Key Integration:**
- Resource: `obsidian://ontology/relations` for hierarchy visualization
- Session: Taxonomy recomputed in background, cached per session

**Commit:** "feat: add self-learning property taxonomy from usage patterns"

---

## Combined Benefits Matrix

| Improvement | Functional Value | MCP Architecture Enabler |
|-------------|------------------|--------------------------|
| **Bidirectional Relations** | 50% effort reduction | Toolhost enables clean integration |
| **Relation Inference** | 30% auto-extraction | Structured responses with suggestions |
| **Context-Aware Metadata** | Vault-informed suggestions | Resources for vault data access |
| **Semantic Embeddings** | Meaning-based matching | N/A (pure functional) |
| **Temporal Versioning** | Knowledge evolution | Sessions for temporal queries |
| **Entity Resolution** | Unified knowledge | Prompts for workflow orchestration |
| **Property Taxonomy** | Self-organizing ontology | Resources for hierarchy viz |

---

## Implementation Sequence

**Week 1: MCP Foundation**
- Days 1-2: Tool consolidation → Enables all future work
- Day 3: Session management → Enables temporal queries
- Day 4: Resources → Enables graph navigation
- Day 5: Prompts → Enables workflows

**Week 2: Knowledge Intelligence**
- Day 6: Bidirectional relations → Uses consolidated tool
- Days 7-8: Relation inference → Uses structured responses
- Days 9-10: Semantic embeddings → Foundation for resolution
- Day 11: Context-aware metadata → Uses vault resources

**Week 3: Advanced Features**
- Days 12-14: Temporal versioning → Uses sessions
- Days 15-17: Entity resolution → Uses semantics + prompts
- Days 18-21: Property taxonomy → Uses all previous work

---

## Success Criteria

**After Week 1 (MCP Foundation):**
- ✅ 12 tools → 1 knowledge_graph tool (78% token reduction)
- ✅ Session-based analytics working
- ✅ 5 resources accessible via URIs
- ✅ 3 workflow prompts functional

**After Week 2 (Knowledge Intelligence):**
- ✅ Bidirectional: Create A→B, get B→A automatically
- ✅ Inference: 30% of relations extracted from observations
- ✅ Semantic: 92% accuracy matching similar relations
- ✅ Context: Vault-informed tag/relation suggestions

**After Week 3 (Advanced):**
- ✅ Temporal: Query knowledge evolution over time
- ✅ Resolution: 90% accuracy detecting duplicates
- ✅ Taxonomy: 3+ level hierarchy learned from usage

**Ready to proceed with full implementation?**
