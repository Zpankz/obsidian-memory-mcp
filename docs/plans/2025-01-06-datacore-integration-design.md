# Datacore Integration Design

**Date**: 2025-01-06
**Status**: Design Phase Complete
**Architecture**: Dual Index + Smart Unification

## Executive Summary

This design integrates datacore (Obsidian's reactive data engine) into the MCP server to provide:
- Hybrid indexing: MCP memory directory + external Obsidian vault
- Automatic metadata extraction (wikilinks, tags, dates, tables, properties)
- Graph analytics (centrality, communities, path finding, temporal analysis, link prediction)
- Enhanced MCP tools with intelligent suggestions and cross-vault querying

## Architecture Overview

### Five-Layer System

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Tool Integration                      │
│  (create_entities, create_relations, search, analytics)     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   Metadata Extraction Pipeline               │
│  (wikilinks, tags, dates, tables, property inference)       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     Graph Analytics Engine                   │
│  (ArticleRank, communities, paths, temporal, predictions)   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Unified Query Engine                      │
│         (merges results, resolves cross-vault links)        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────┬──────────────────────────────────────┐
│   MCP Memory Index   │    External Vault Scanner            │
│   (datacore lib)     │    (filesystem + parsing)            │
└──────────────────────┴──────────────────────────────────────┘
```

## Layer 1: Dual Indexing System

### MCP Memory Indexer

**Purpose**: High-performance indexing of MCP-created markdown files

**Implementation**:
- Uses datacore's `Datastore` class as foundation
- In-memory B-tree index for fast lookups
- File watcher for real-time updates
- Full-text search capabilities

**Index Contents**:
- Entity names and types
- Frontmatter properties (including Dendron link ontology format)
- Observations and content
- Relations (relationType.qualification format)
- Metadata (created, updated timestamps)

**Location**: `~/Documents/Cline/MCP/obsidian-memory-mcp/memory/`

### External Vault Scanner

**Purpose**: Lightweight indexing of user's Obsidian vault

**Auto-Detection**:
```typescript
const searchPaths = [
  path.join(os.homedir(), 'Documents/Obsidian'),
  path.join(os.homedir(), 'Library/Mobile Documents/iCloud~md~obsidian'),
  path.join(os.homedir(), 'Dropbox/Obsidian'),
  os.homedir() // Scan for .obsidian folders
];
```

**Index Contents**:
- File paths and entity names
- Frontmatter properties
- Wikilinks (outgoing and backlinks)
- Tags (#tag format)
- Inline metadata (key:: value)

**Optimization**:
- Incremental updates via file watchers
- Configurable inclusion/exclusion patterns
- Lazy loading (build on first query)

### Unified Interface

```typescript
interface IndexProvider {
  query(query: QueryExpression): Promise<IndexResult[]>;
  getEntity(name: string): Promise<Entity | null>;
  getRelations(entityName: string): Promise<Relation[]>;
  search(text: string): Promise<Entity[]>;
  watch(callback: (event: IndexEvent) => void): void;
}

interface UnifiedIndex {
  mcpIndex: IndexProvider;
  vaultIndex?: IndexProvider;

  queryAll(query: QueryExpression): Promise<IndexResult[]>;
  resolveLinks(entity: Entity): Promise<Entity>;
}
```

**Cross-Vault Link Resolution**:
- Normalize entity names (lowercase, underscores)
- Check MCP index first (takes precedence)
- Fall back to vault index
- Maintain bidirectional link mapping

## Layer 2: Unified Query Engine

**Purpose**: Single API to query across both indexes

**Capabilities**:
- Merge results from MCP + vault indexes
- Resolve wikilinks across vaults
- Apply filters and sorting
- Handle datacore query expressions

**Query Flow**:
```
User Query
    ↓
Parse Expression (datacore syntax)
    ↓
Query MCP Index ──┬──→ Merge Results
Query Vault Index─┘    ↓
                    Resolve Cross-Links
                       ↓
                    Sort & Filter
                       ↓
                    Return Results
```

**Caching Strategy**:
```typescript
interface CacheLayer {
  queryCache: LRU<string, QueryResult>;        // 100 entries, 5 min TTL
  propertyCache: Map<string, PropertyList>;    // Invalidate on relation creation
  analyticsCache: Map<string, AnalyticsResult>; // Invalidate on graph change
  linkPredictions: LRU<string, Prediction[]>;  // 50 entries, 15 min TTL
}
```

## Layer 3: Metadata Extraction Pipeline

**Execution**: Automatic on entity/observation creation or update

### 1. Wikilink Detection

**Pattern**: `\[\[([^\]|]+)(?:\|[^\]]+)?\]\]`

**Process**:
- Extract all wikilinks from observations
- Match against entities in both indexes
- Fuzzy matching for partial matches (>85% similarity)
- Auto-create relations: `references.mentioned_in`

**Smart Matching**:
```typescript
interface WikilinkMatch {
  target: string;           // Matched entity name
  confidence: number;       // 0-1 similarity score
  context: string;          // Surrounding text
  suggestions?: string[];   // Alternative matches
}
```

### 2. Tag Extraction

**Formats**: `#tag`, `#nested/tag`

**Process**:
- Parse all hash tags
- Normalize: lowercase, replace `/` with `_`
- Add to entity frontmatter: `tags: ['tag1', 'tag2']`
- Optional: create tag entities with `relates_to.tagged` relations

### 3. Temporal Extraction

**Library**: luxon (datacore's date library)

**Formats Supported**:
- ISO 8601: `2025-01-06T10:30:00`
- Natural language: "yesterday", "next week", "in 3 days"
- Durations: "2 hours", "30 minutes"

**Storage**:
```yaml
created: '2025-01-06T10:30:00'
updated: '2025-01-06T18:30:00'
dueDate: '2025-01-13T09:00:00'
```

### 4. Structured Data Parsing

**Inline Metadata**:
```
key:: value
author:: John Doe
priority:: high
```

**Markdown Tables**:
```markdown
| Name  | Value | Type    |
|-------|-------|---------|
| speed | 100   | numeric |
```
→ Converted to: `properties: [{ name: 'speed', value: 100, type: 'numeric' }]`

**YAML Frontmatter**:
- Parse all existing frontmatter
- Merge with extracted metadata
- Preserve user-defined properties

### 5. Property Inference

**Semantic Pattern Detection**:
- "X increases Y" → `influences.increases`
- "X decreases Y" → `influences.decreases`
- "X is a Y" → `is_a.instance`
- "X inhibits Y" → `inhibits.competitive` or `inhibits.non_competitive`
- "X modulates Y" → `modulates.[inferred_qualification]`

**Output Format**:
```typescript
interface SuggestedRelation {
  to: string;
  relationType: string;
  qualification: string;
  confidence: number;      // 0-1 score
  reason: string;          // Explanation
  sourceText: string;      // Original text that triggered inference
}
```

**Confidence Threshold**: Only suggest if confidence > 0.7 (configurable)

### Complete Output

```typescript
interface EnrichedEntity extends Entity {
  extractedMetadata: {
    links: Array<{
      target: string;
      context: string;
      confidence: number;
    }>;
    tags: string[];
    dates: Record<string, DateTime>;
    properties: Record<string, any>;
    suggestedRelations: SuggestedRelation[];
  };
}
```

## Layer 4: Graph Analytics Engine

### 1. Centrality Analysis

**ArticleRank Centrality**
- Improved PageRank variant for knowledge graphs
- Weights contributions from entities with fewer outgoing links higher
- Formula: `AR(v) = (1-d)/N + d * Σ(AR(u) / C(u))` where C(u) = out-degree
- Damping factor: 0.85 (configurable)
- Converges faster than PageRank on sparse graphs

**Degree Centrality**
```typescript
interface CentralityMetrics {
  inDegree: number;        // Incoming relations
  outDegree: number;       // Outgoing relations
  totalDegree: number;     // Combined
  articleRank: number;     // AR score (0-1)
  normalized: boolean;     // Divided by max possible
}
```

**Betweenness Centrality**
- Uses Brandes' algorithm (O(nm) complexity)
- Identifies "bridge" entities connecting communities
- Important for understanding information flow

**Use Cases**:
- Identify most important/influential entities
- Find hub entities (high degree)
- Discover brokers (high betweenness)

### 2. Community Detection

**Louvain Method** (Primary)
- Fast modularity optimization
- Hierarchical: detects communities at multiple scales
- O(n log n) complexity

**Label Propagation** (Fallback for large graphs)
- Near-linear time complexity
- Less accurate but very fast

**Output**:
```typescript
interface CommunityMap {
  communities: Map<string, string[]>;  // communityId → entityNames
  modularity: number;                   // Quality metric (0-1)
  levels: number;                       // Hierarchy depth
  entityCommunity: Map<string, string>; // entityName → communityId
}
```

**Use Cases**:
- Discover thematic clusters
- Identify isolated subgraphs
- Guide entity organization

### 3. Path Finding

**Shortest Path** (Dijkstra)
```typescript
interface Path {
  entities: string[];           // [A, B, C, D]
  relations: Relation[];        // Edges traversed
  length: number;               // Number of hops
  weight: number;               // Cumulative edge weights
}
```

**All Paths Enumeration**
- DFS with cycle detection
- Max depth configurable (default: 5 hops)
- Returns all unique paths

**Relationship Chains**
- Trace indirect influences
- Example: A→B→C shows how A affects C through B

**Edge Weights** (configurable):
```typescript
const relationWeights = {
  'causes': 1.0,
  'influences': 1.2,
  'relates_to': 2.0,
  'mentions': 3.0
};
```

### 4. Temporal Analysis

**Time-Series Views**
```typescript
interface TemporalQuery {
  startDate: DateTime;
  endDate: DateTime;
  aggregation: 'day' | 'week' | 'month';
}

interface TemporalSnapshot {
  timestamp: DateTime;
  entities: Entity[];
  relations: Relation[];
  addedRelations: Relation[];    // New since last snapshot
  removedRelations: Relation[];  // Deleted since last snapshot
}
```

**Evolution Tracking**:
- Neighborhood changes over time
- Relation creation/deletion rates
- Entity growth patterns

**Decay Functions**:
```typescript
// Recent connections weighted higher
weight(relation) = baseWeight * exp(-λ * daysSinceCreation)
```

### 5. Link Prediction

**Collaborative Filtering**
- "Entities similar to X also connect to Y"
- Cosine similarity on relation vectors

**Common Neighbor Score**
```typescript
score(A, B) = |neighbors(A) ∩ neighbors(B)| / sqrt(|neighbors(A)| * |neighbors(B)|)
```

**Preferential Attachment**
- High-degree entities attract more connections
- `score(A, B) = degree(A) * degree(B)`

**Output**:
```typescript
interface LinkPrediction {
  from: string;
  to: string;
  confidence: number;           // 0-1 score
  method: string;               // 'collaborative' | 'common_neighbor' | 'preferential'
  sharedNeighbors: string[];    // Supporting evidence
  explanation: string;
}
```

### Analytics API

```typescript
interface GraphAnalytics {
  computeCentrality(entities: Entity[]): CentralityReport;
  detectCommunities(minSize?: number): CommunityMap;
  findPath(from: string, to: string, maxHops?: number): Path[];
  findAllPaths(from: string, to: string, maxHops?: number): Path[];
  predictLinks(entity: string, topK: number): LinkPrediction[];
  temporalSnapshot(date: DateTime): KnowledgeGraph;
  temporalEvolution(start: DateTime, end: DateTime): TemporalSnapshot[];
}
```

### Performance Optimizations

**Incremental Updates**:
- New relation → recompute ArticleRank only for affected subgraph
- Community detection → only re-run if >5% structure change
- Path cache invalidation → only affected entity pairs

**Background Processing**:
- Analytics refresh every 5 minutes (configurable)
- Run in worker thread to avoid blocking
- Results cached with smart invalidation

**Thresholds**:
- Skip analytics on graphs < 10 entities
- Community detection requires ≥ 20 entities
- Link prediction needs ≥ 50 relations

## Layer 5: MCP Tool Integration

### Enhanced Tools

#### 1. create_entities

**Pre-Creation Checks**:
```typescript
async function enhanceCreateEntities(entities: Entity[]) {
  for (const entity of entities) {
    // Check for similar existing entities
    const similar = await unifiedIndex.search(entity.name);
    const fuzzyMatches = similar.filter(e =>
      similarity(e.name, entity.name) > 0.85
    );

    if (fuzzyMatches.length > 0) {
      return {
        warning: "Similar entities found",
        suggestions: fuzzyMatches.map(e => e.name)
      };
    }

    // Extract metadata from observations
    const extracted = await extractionPipeline.process(entity);

    // Query vault for related entities
    const related = await vaultIndex.search(entity.name);

    return {
      entity,
      enrichedMetadata: extracted,
      vaultMatches: related
    };
  }
}
```

**Post-Creation**:
- Update MCP index
- Trigger analytics refresh if needed
- Return enriched entity with suggestions

#### 2. create_relations

**Pre-Creation**:
```typescript
async function enhanceCreateRelations(relations: Relation[]) {
  for (const relation of relations) {
    // Normalize using existing properties
    const existingTypes = await storageManager.getExistingRelationTypes();
    const existingQuals = await storageManager.getExistingQualifications();

    // Add vault properties to consideration
    const vaultTypes = await vaultIndex.getRelationTypes();
    const vaultQuals = await vaultIndex.getQualifications();

    const allTypes = [...existingTypes, ...vaultTypes];
    const allQuals = [...existingQuals, ...vaultQuals];

    const normalized = validateAndNormalizeRelation(
      relation.relationType,
      relation.qualification,
      allTypes,
      allQuals
    );

    // Check if relation exists in vault
    const vaultHas = await vaultIndex.hasRelation(relation);

    return {
      normalized,
      vaultMatch: vaultHas,
      suggestions: normalized.suggestions
    };
  }
}
```

**Post-Creation**:
- Incremental centrality update
- Check if forms community bridge
- Return graph impact metrics

#### 3. read_graph / search_nodes

**Query Enhancement**:
```typescript
async function enhanceSearch(query: string) {
  // Use datacore query syntax
  const results = await unifiedIndex.queryAll({
    where: query,  // "tags CONTAINS 'neuroscience'"
    sort: "articleRank DESC",
    limit: 100
  });

  // Enrich with analytics
  const enriched = results.map(entity => ({
    ...entity,
    centrality: analyticsCache.get(entity.name),
    community: communityMap.get(entity.name),
    predictedLinks: linkPredictions.get(entity.name)
  }));

  return enriched;
}
```

**Advanced Filters**:
- `WHERE articleRank > 0.05` - High influence entities
- `WHERE community = "C1"` - Specific community
- `WHERE created > date("2025-01-01")` - Recent entities

#### 4. get_relation_properties

**Vault-Aware Properties**:
```typescript
async function getRelationProperties() {
  const mcpTypes = await storageManager.getExistingRelationTypes();
  const mcpQuals = await storageManager.getExistingQualifications();

  const vaultTypes = await vaultIndex.getRelationTypes();
  const vaultQuals = await vaultIndex.getQualifications();

  // Compute statistics
  const typeStats = computeFrequency([...mcpTypes, ...vaultTypes]);
  const qualStats = computeFrequency([...mcpQuals, ...vaultQuals]);

  return {
    relationTypes: {
      mcp: mcpTypes,
      vault: vaultTypes,
      unified: [...new Set([...mcpTypes, ...vaultTypes])],
      statistics: typeStats
    },
    qualifications: {
      mcp: mcpQuals,
      vault: vaultQuals,
      unified: [...new Set([...mcpQuals, ...vaultQuals])],
      statistics: qualStats
    },
    recommendations: {
      canonical: findCanonicalForms(typeStats, qualStats),
      commonPatterns: identifyPatterns(typeStats, qualStats)
    }
  };
}
```

### New Tools

#### analyze_graph

```typescript
{
  name: "analyze_graph",
  description: "Run graph analytics and return insights about the knowledge graph structure",
  inputSchema: {
    type: "object",
    properties: {
      analysisType: {
        type: "string",
        enum: ["centrality", "communities", "paths", "temporal", "predictions"],
        description: "Type of analysis to perform"
      },
      entityName: {
        type: "string",
        description: "Entity name (required for path/prediction analysis)"
      },
      targetEntity: {
        type: "string",
        description: "Target entity (required for path analysis)"
      },
      timeRange: {
        type: "object",
        properties: {
          start: { type: "string", format: "date-time" },
          end: { type: "string", format: "date-time" }
        },
        description: "Date range for temporal analysis"
      },
      options: {
        type: "object",
        description: "Analysis-specific options (minCommunitySize, maxHops, topK, etc.)"
      }
    },
    required: ["analysisType"]
  }
}
```

**Example Calls**:
```typescript
// Centrality analysis
analyze_graph({ analysisType: "centrality" })
→ Returns top 20 entities by ArticleRank

// Find communities
analyze_graph({
  analysisType: "communities",
  options: { minSize: 5 }
})
→ Returns community map with entities grouped

// Find path
analyze_graph({
  analysisType: "paths",
  entityName: "NMDAR",
  targetEntity: "synaptic_plasticity"
})
→ Returns shortest path and all paths up to 5 hops

// Predict links
analyze_graph({
  analysisType: "predictions",
  entityName: "dopamine",
  options: { topK: 10 }
})
→ Returns top 10 predicted connections

// Temporal evolution
analyze_graph({
  analysisType: "temporal",
  timeRange: {
    start: "2025-01-01T00:00:00",
    end: "2025-01-06T23:59:59"
  }
})
→ Returns snapshots showing graph evolution
```

#### query_vault

```typescript
{
  name: "query_vault",
  description: "Query external Obsidian vault using datacore expressions",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Datacore query expression (e.g., 'WHERE tags CONTAINS \"neuroscience\"')"
      },
      includeContent: {
        type: "boolean",
        description: "Include file contents in results (default: false)"
      },
      linkToMCP: {
        type: "boolean",
        description: "Suggest connections to MCP entities (default: true)"
      },
      limit: {
        type: "number",
        description: "Max results to return (default: 50)"
      }
    },
    required: ["query"]
  }
}
```

**Example Calls**:
```typescript
// Find notes by tag
query_vault({
  query: 'WHERE tags CONTAINS "neuroscience"',
  limit: 20
})

// Complex query
query_vault({
  query: 'WHERE file.ctime > date("2025-01-01") AND (tags CONTAINS "important" OR priority = "high")',
  includeContent: true,
  linkToMCP: true
})
→ Returns vault notes with suggested links to MCP entities

// Property search
query_vault({
  query: 'WHERE author = "John Doe" AND status = "published"'
})
```

## Configuration System

### Auto-Detection Flow

```typescript
async function initializeDatacore() {
  console.log("Initializing datacore integration...");

  // 1. Initialize MCP memory indexer (always)
  const mcpIndex = await MCPMemoryIndexer.create(memoryPath);
  console.log("✓ MCP memory indexer ready");

  // 2. Discover external vaults
  const vaults = await VaultDiscovery.scanForVaults();
  console.log(`Found ${vaults.length} Obsidian vault(s)`);

  let vaultIndex: VaultIndexer | null = null;

  if (vaults.length === 1) {
    // Auto-select single vault
    vaultIndex = await VaultIndexer.create(vaults[0].path);
    console.log(`✓ Connected to vault: ${vaults[0].name}`);
  } else if (vaults.length > 1) {
    // Present choice via MCP
    const selected = await promptUserVaultSelection(vaults);
    if (selected) {
      vaultIndex = await VaultIndexer.create(selected.path);
      console.log(`✓ Connected to vault: ${selected.name}`);
    }
  } else {
    console.log("⚠ No external vault found, operating in MCP-only mode");
  }

  // 3. Create unified index
  const unifiedIndex = new UnifiedIndex(mcpIndex, vaultIndex);

  // 4. Start background processes
  await startFileWatchers(mcpIndex, vaultIndex);
  await cacheInitialProperties(unifiedIndex);

  // 5. Compute initial analytics (background)
  scheduleAnalyticsRefresh(unifiedIndex);

  console.log("✓ Datacore integration ready");
  return unifiedIndex;
}
```

### Configuration File

**Location**: `.mcp-datacore-config.json` (auto-generated)

```json
{
  "version": "1.0",
  "mcpMemoryPath": "~/Documents/Cline/MCP/obsidian-memory-mcp/memory",
  "externalVault": {
    "path": "/Users/username/Documents/Obsidian/MyVault",
    "enabled": true,
    "lastScanned": "2025-01-06T18:30:00Z",
    "fileCount": 1247,
    "entityCount": 892
  },
  "analytics": {
    "enabled": true,
    "refreshInterval": 300,
    "articlerankDamping": 0.85,
    "articlerankIterations": 20,
    "communityAlgorithm": "louvain",
    "minCommunitySize": 3,
    "computeThreshold": 10,
    "pathMaxHops": 5
  },
  "extraction": {
    "autoLinkWikilinks": true,
    "extractTags": true,
    "extractDates": true,
    "parseTables": true,
    "inferRelations": true,
    "inferenceConfidenceThreshold": 0.7
  },
  "normalization": {
    "similarityThreshold": 0.85,
    "preferVaultProperties": true,
    "autoApplySuggestions": false
  },
  "performance": {
    "queryCacheSize": 100,
    "queryCacheTTL": 300,
    "analyticsCacheTTL": 900,
    "predictionCacheSize": 50,
    "lazyLoadVault": true,
    "incrementalAnalytics": true
  }
}
```

## Error Handling & Resilience

### Graceful Degradation

```typescript
class DatacoreIntegration {
  private mcpIndex: MCPMemoryIndexer;
  private vaultIndex: VaultIndexer | null;
  private analytics: GraphAnalytics | null;

  async query(expr: string): Promise<Result[]> {
    try {
      // Try unified query
      return await this.unifiedIndex.queryAll(expr);
    } catch (error) {
      if (error instanceof VaultIndexError) {
        // Vault index failed, fall back to MCP only
        console.warn("Vault index unavailable, using MCP index only");
        return await this.mcpIndex.query(expr);
      }
      throw error;
    }
  }

  async getAnalytics(type: string): Promise<AnalyticsResult> {
    if (!this.analytics) {
      return {
        error: "Analytics disabled or unavailable",
        fallback: true
      };
    }

    try {
      return await this.analytics.compute(type);
    } catch (error) {
      console.error("Analytics failed:", error);
      return {
        error: "Analytics computation failed",
        fallback: true
      };
    }
  }
}
```

### Error Types

```typescript
class VaultNotFoundError extends Error {
  constructor(path: string) {
    super(`Vault not found at: ${path}`);
  }
}

class IndexCorruptionError extends Error {
  constructor(indexPath: string) {
    super(`Index corrupted: ${indexPath}. Rebuilding...`);
  }
}

class AnalyticsTimeoutError extends Error {
  constructor(operation: string, timeout: number) {
    super(`Analytics operation '${operation}' timed out after ${timeout}ms`);
  }
}

class ExtractionError extends Error {
  constructor(entity: string, reason: string) {
    super(`Metadata extraction failed for ${entity}: ${reason}`);
  }
}
```

### Recovery Strategies

**Index Corruption**:
```typescript
async function handleCorruptedIndex(indexPath: string) {
  console.warn(`Index corrupted at ${indexPath}, rebuilding...`);

  // 1. Backup corrupted index
  await fs.rename(indexPath, `${indexPath}.corrupted`);

  // 2. Scan markdown files
  const files = await findMarkdownFiles(memoryPath);

  // 3. Rebuild index from files
  const newIndex = await rebuildFromFiles(files);

  console.log(`✓ Index rebuilt with ${newIndex.size} entities`);
  return newIndex;
}
```

**Watcher Crash**:
```typescript
async function handleWatcherFailure() {
  console.warn("File watcher crashed, falling back to periodic scan");

  // Fallback to polling every 30 seconds
  setInterval(async () => {
    await rescanDirectory(memoryPath);
  }, 30000);
}
```

**Analytics Timeout**:
```typescript
async function computeWithTimeout<T>(
  operation: () => Promise<T>,
  timeout: number = 10000
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new AnalyticsTimeoutError("operation", timeout)), timeout)
    )
  ]);
}
```

## Performance Optimizations

### Lazy Loading Strategy

```typescript
class LazyVaultIndex implements IndexProvider {
  private index: VaultIndexer | null = null;
  private loading: Promise<VaultIndexer> | null = null;

  async query(expr: string): Promise<Result[]> {
    // Build index on first query
    if (!this.index && !this.loading) {
      this.loading = this.buildIndex();
    }

    if (this.loading) {
      this.index = await this.loading;
      this.loading = null;
    }

    return this.index!.query(expr);
  }

  private async buildIndex(): Promise<VaultIndexer> {
    console.log("Building vault index (first query)...");
    const start = Date.now();
    const index = await VaultIndexer.create(this.vaultPath);
    console.log(`✓ Vault index built in ${Date.now() - start}ms`);
    return index;
  }
}
```

### Incremental Analytics

```typescript
class IncrementalAnalytics {
  private lastGraphHash: string;
  private lastCentrality: CentralityReport;

  async computeCentrality(graph: KnowledgeGraph): Promise<CentralityReport> {
    const currentHash = hashGraph(graph);

    if (currentHash === this.lastGraphHash) {
      // No changes, return cached
      return this.lastCentrality;
    }

    const changes = detectChanges(this.lastGraphHash, currentHash);

    if (changes.affectedNodes < graph.entities.length * 0.05) {
      // < 5% affected, incremental update
      console.log("Incremental centrality update");
      this.lastCentrality = await this.updateAffectedNodes(
        this.lastCentrality,
        changes.affectedNodes
      );
    } else {
      // > 5% affected, full recomputation
      console.log("Full centrality recomputation");
      this.lastCentrality = await computeArticleRank(graph);
    }

    this.lastGraphHash = currentHash;
    return this.lastCentrality;
  }
}
```

### Cache Invalidation

```typescript
interface CacheInvalidation {
  onEntityCreated(entity: Entity): void {
    // Invalidate query cache entries mentioning entity
    this.queryCache.invalidateMatching(entity.name);

    // Don't invalidate analytics (entity not connected yet)
  }

  onRelationCreated(relation: Relation): void {
    // Invalidate queries mentioning either entity
    this.queryCache.invalidateMatching(relation.from);
    this.queryCache.invalidateMatching(relation.to);

    // Invalidate property cache
    this.propertyCache.clear();

    // Invalidate analytics for affected subgraph
    this.analyticsCache.invalidateSubgraph([relation.from, relation.to]);

    // Invalidate link predictions for both entities
    this.predictionCache.delete(relation.from);
    this.predictionCache.delete(relation.to);
  }

  onEntityDeleted(entity: Entity): void {
    // Clear everything related to entity
    this.queryCache.invalidateMatching(entity.name);
    this.analyticsCache.invalidateSubgraph([entity.name]);
    this.predictionCache.delete(entity.name);
  }
}
```

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
- [ ] Implement IndexProvider interface
- [ ] Create MCPMemoryIndexer using datacore library
- [ ] Build VaultScanner with file watching
- [ ] Implement UnifiedIndex with merge logic
- [ ] Add cross-vault link resolution

### Phase 2: Metadata Extraction (Week 2)
- [ ] Wikilink detection and matching
- [ ] Tag extraction and normalization
- [ ] Temporal parsing (luxon integration)
- [ ] Structured data parsing (tables, inline metadata)
- [ ] Property inference with NLP patterns

### Phase 3: Graph Analytics (Week 3)
- [ ] ArticleRank implementation
- [ ] Betweenness centrality (Brandes' algorithm)
- [ ] Community detection (Louvain method)
- [ ] Path finding (Dijkstra)
- [ ] Link prediction algorithms

### Phase 4: Tool Integration (Week 4)
- [ ] Enhance create_entities
- [ ] Enhance create_relations
- [ ] Enhance read_graph / search_nodes
- [ ] Enhance get_relation_properties
- [ ] Implement analyze_graph tool
- [ ] Implement query_vault tool

### Phase 5: Configuration & Polish (Week 5)
- [ ] Vault auto-detection
- [ ] Configuration file generation
- [ ] Error handling and recovery
- [ ] Performance optimization
- [ ] Cache implementation
- [ ] Documentation and examples

## Testing Strategy

### Unit Tests
- IndexProvider implementations
- Metadata extraction functions
- Normalization utilities
- Analytics algorithms
- Cache invalidation logic

### Integration Tests
- MCP index ↔ Vault index interaction
- Query merging and link resolution
- End-to-end metadata extraction
- Analytics on sample graphs
- Tool enhancement workflows

### Performance Tests
- Index build time (100, 1000, 10000 files)
- Query response time
- Analytics computation time
- Memory usage under load
- Cache hit rates

### Edge Cases
- Empty vault
- Corrupted markdown files
- Circular relations
- Missing wikilink targets
- Conflicting entity names across vaults

## Success Criteria

1. **Functionality**
   - ✓ Hybrid indexing (MCP + vault) working
   - ✓ All metadata extraction working
   - ✓ All analytics algorithms implemented
   - ✓ All tools enhanced with datacore

2. **Performance**
   - Index build: < 5 seconds for 1000 files
   - Query response: < 100ms (cached), < 500ms (uncached)
   - Analytics: < 2 seconds for 100 entities
   - Memory: < 200MB for 10,000 indexed files

3. **Reliability**
   - Graceful degradation on vault unavailable
   - Auto-recovery from index corruption
   - No crashes on malformed markdown
   - Cache consistency maintained

4. **Usability**
   - Automatic vault detection
   - Zero manual configuration required
   - Clear error messages
   - Helpful suggestions in responses

## Future Enhancements

- **Visual Graph Export**: Generate graph visualizations (DOT, GraphML)
- **Advanced NLP**: Use transformer models for better property inference
- **Multi-Vault Support**: Index multiple vaults simultaneously
- **Real-time Collaboration**: Detect changes from other Obsidian instances
- **Query Language**: Custom DSL for complex graph queries
- **Export/Import**: Backup and restore indexes
- **Web UI**: Optional web dashboard for analytics visualization

## Conclusion

This design provides a comprehensive integration of datacore into the MCP server, enabling:
- Seamless hybrid indexing across MCP memory and external Obsidian vaults
- Intelligent metadata extraction that automatically enriches entities
- Sophisticated graph analytics for discovering patterns and insights
- Enhanced MCP tools that leverage the full power of the knowledge graph

The architecture is designed for performance, reliability, and extensibility, with clear error handling and graceful degradation when components are unavailable.
