# Datacore Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate datacore reactive data engine into MCP server for hybrid indexing (MCP memory + external vault), automatic metadata extraction, and graph analytics.

**Architecture:** Five-layer system with dual indexing (MCPMemoryIndexer + VaultScanner), unified query engine, metadata extraction pipeline, graph analytics engine (ArticleRank, communities, path finding, temporal analysis, link prediction), and enhanced MCP tools.

**Tech Stack:** TypeScript, datacore library, Node.js fs watchers, Levenshtein distance algorithm, graph algorithms (ArticleRank, Louvain, Dijkstra)

---

## Phase 1: Core Infrastructure (Tasks 1-10)

### Task 1: Create IndexProvider Interface

**Files:**
- Create: `src/index/IndexProvider.ts`
- Test: Not applicable (interface only)

**Step 1: Create interface file**

Create `src/index/IndexProvider.ts`:

```typescript
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
```

**Step 2: Verify TypeScript compilation**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/index/IndexProvider.ts
git commit -m "feat: add IndexProvider interface for dual indexing system"
```

---

### Task 2: Create MCPMemoryIndexer Stub

**Files:**
- Create: `src/index/MCPMemoryIndexer.ts`
- Test: `src/index/MCPMemoryIndexer.test.ts`

**Step 1: Write the failing test**

Create `src/index/MCPMemoryIndexer.test.ts`:

```typescript
import { MCPMemoryIndexer } from './MCPMemoryIndexer.js';
import { Entity } from '../types.js';
import * as path from 'path';

describe('MCPMemoryIndexer', () => {
  it('should create indexer with memory path', async () => {
    const memoryPath = path.join(__dirname, '../../test-fixtures/memory');
    const indexer = await MCPMemoryIndexer.create(memoryPath);

    expect(indexer).toBeDefined();
    await indexer.close();
  });

  it('should index entities from markdown files', async () => {
    const memoryPath = path.join(__dirname, '../../test-fixtures/memory');
    const indexer = await MCPMemoryIndexer.create(memoryPath);

    const entity = await indexer.getEntity('TestEntity');
    expect(entity).toBeDefined();
    expect(entity?.name).toBe('TestEntity');

    await indexer.close();
  });
});
```

**Step 2: Create test fixtures**

Create `test-fixtures/memory/TestEntity.md`:

```markdown
---
entityType: test
created: 2025-01-06
---

# TestEntity

## Observations
- Test observation 1
- Test observation 2
```

**Step 3: Run test to verify it fails**

Run: `npm test -- MCPMemoryIndexer.test.ts`
Expected: FAIL with "Cannot find module './MCPMemoryIndexer.js'"

**Step 4: Write minimal implementation**

Create `src/index/MCPMemoryIndexer.ts`:

```typescript
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
```

**Step 5: Run test to verify it passes**

Run: `npm test -- MCPMemoryIndexer.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/index/MCPMemoryIndexer.ts src/index/MCPMemoryIndexer.test.ts test-fixtures/memory/TestEntity.md
git commit -m "feat: implement MCPMemoryIndexer with basic indexing"
```

---

### Task 3: Create VaultScanner Stub

**Files:**
- Create: `src/index/VaultScanner.ts`
- Test: `src/index/VaultScanner.test.ts`

**Step 1: Write the failing test**

Create `src/index/VaultScanner.test.ts`:

```typescript
import { VaultScanner } from './VaultScanner.js';
import * as path from 'path';

describe('VaultScanner', () => {
  it('should create scanner with vault path', async () => {
    const vaultPath = path.join(__dirname, '../../test-fixtures/vault');
    const scanner = await VaultScanner.create(vaultPath);

    expect(scanner).toBeDefined();
    await scanner.close();
  });

  it('should scan entities from vault files', async () => {
    const vaultPath = path.join(__dirname, '../../test-fixtures/vault');
    const scanner = await VaultScanner.create(vaultPath);

    const entity = await scanner.getEntity('VaultNote');
    expect(entity).toBeDefined();
    expect(entity?.name).toBe('VaultNote');

    await scanner.close();
  });
});
```

**Step 2: Create test fixtures**

Create `test-fixtures/vault/VaultNote.md`:

```markdown
---
tags: [test, vault]
created: 2025-01-06
---

# VaultNote

This is a test vault note.

Related: [[TestEntity]]

#important
```

**Step 3: Run test to verify it fails**

Run: `npm test -- VaultScanner.test.ts`
Expected: FAIL with "Cannot find module './VaultScanner.js'"

**Step 4: Write minimal implementation**

Create `src/index/VaultScanner.ts`:

```typescript
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
```

**Step 5: Run test to verify it passes**

Run: `npm test -- VaultScanner.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/index/VaultScanner.ts src/index/VaultScanner.test.ts test-fixtures/vault/VaultNote.md
git commit -m "feat: implement VaultScanner for external vault indexing"
```

---

### Task 4: Create UnifiedIndex

**Files:**
- Create: `src/index/UnifiedIndex.ts`
- Test: `src/index/UnifiedIndex.test.ts`

**Step 1: Write the failing test**

Create `src/index/UnifiedIndex.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- UnifiedIndex.test.ts`
Expected: FAIL with "Cannot find module './UnifiedIndex.js'"

**Step 3: Write minimal implementation**

Create `src/index/UnifiedIndex.ts`:

```typescript
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
```

**Step 4: Run test to verify it passes**

Run: `npm test -- UnifiedIndex.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/index/UnifiedIndex.ts src/index/UnifiedIndex.test.ts
git commit -m "feat: implement UnifiedIndex for merging MCP and vault results"
```

---

### Task 5: Add Vault Auto-Detection

**Files:**
- Create: `src/config/VaultDiscovery.ts`
- Test: `src/config/VaultDiscovery.test.ts`

**Step 1: Write the failing test**

Create `src/config/VaultDiscovery.test.ts`:

```typescript
import { VaultDiscovery, DiscoveredVault } from './VaultDiscovery.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('VaultDiscovery', () => {
  it('should discover vaults in test fixtures', async () => {
    const discovery = new VaultDiscovery();
    const vaults = await discovery.scanForVaults();

    expect(Array.isArray(vaults)).toBe(true);
  });

  it('should identify .obsidian folders', async () => {
    const testVault = path.join(__dirname, '../../test-fixtures/vault');

    // Create .obsidian directory
    await fs.mkdir(path.join(testVault, '.obsidian'), { recursive: true });
    await fs.writeFile(
      path.join(testVault, '.obsidian', 'app.json'),
      JSON.stringify({ vaultName: 'Test Vault' })
    );

    const discovery = new VaultDiscovery();
    const vaults = await discovery.scanForVaults();

    const found = vaults.find(v => v.path.includes('test-fixtures/vault'));
    expect(found).toBeDefined();

    // Cleanup
    await fs.rm(path.join(testVault, '.obsidian'), { recursive: true });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- VaultDiscovery.test.ts`
Expected: FAIL with "Cannot find module './VaultDiscovery.js'"

**Step 3: Write minimal implementation**

Create `src/config/VaultDiscovery.ts`:

```typescript
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface DiscoveredVault {
  path: string;
  name: string;
  lastModified: Date;
}

export class VaultDiscovery {
  private searchPaths: string[];

  constructor() {
    this.searchPaths = [
      path.join(os.homedir(), 'Documents', 'Obsidian'),
      path.join(os.homedir(), 'Library', 'Mobile Documents', 'iCloud~md~obsidian'),
      path.join(os.homedir(), 'Dropbox', 'Obsidian'),
      os.homedir()
    ];
  }

  async scanForVaults(): Promise<DiscoveredVault[]> {
    const vaults: DiscoveredVault[] = [];

    for (const searchPath of this.searchPaths) {
      try {
        const found = await this.findObsidianVaults(searchPath);
        vaults.push(...found);
      } catch (error) {
        // Path doesn't exist or no permission
        continue;
      }
    }

    return vaults.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  }

  private async findObsidianVaults(dir: string, depth: number = 0): Promise<DiscoveredVault[]> {
    if (depth > 3) return []; // Limit recursion depth

    const vaults: DiscoveredVault[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const entryPath = path.join(dir, entry.name);

        // Check if this directory contains .obsidian
        if (entry.name === '.obsidian') continue;

        const obsidianPath = path.join(entryPath, '.obsidian');
        try {
          await fs.access(obsidianPath);

          // Found a vault
          const stats = await fs.stat(entryPath);
          const appJsonPath = path.join(obsidianPath, 'app.json');

          let vaultName = entry.name;
          try {
            const appJson = await fs.readFile(appJsonPath, 'utf-8');
            const config = JSON.parse(appJson);
            vaultName = config.vaultName || entry.name;
          } catch {
            // app.json doesn't exist or malformed
          }

          vaults.push({
            path: entryPath,
            name: vaultName,
            lastModified: stats.mtime
          });
        } catch {
          // No .obsidian directory, continue searching
          if (depth < 3) {
            const subVaults = await this.findObsidianVaults(entryPath, depth + 1);
            vaults.push(...subVaults);
          }
        }
      }
    } catch (error) {
      // Can't read directory
    }

    return vaults;
  }

  async selectVault(vaults: DiscoveredVault[]): Promise<string | null> {
    if (vaults.length === 0) {
      return null;
    }

    if (vaults.length === 1) {
      return vaults[0].path;
    }

    // Multiple vaults found, return the most recently modified
    return vaults[0].path;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- VaultDiscovery.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/config/VaultDiscovery.ts src/config/VaultDiscovery.test.ts
git commit -m "feat: implement vault auto-detection system"
```

---

## Phase 2: Metadata Extraction (Tasks 6-10)

### Task 6: Wikilink Extraction

**Files:**
- Create: `src/extraction/WikilinkExtractor.ts`
- Test: `src/extraction/WikilinkExtractor.test.ts`

**Step 1: Write the failing test**

Create `src/extraction/WikilinkExtractor.test.ts`:

```typescript
import { WikilinkExtractor } from './WikilinkExtractor.js';

describe('WikilinkExtractor', () => {
  it('should extract simple wikilinks', () => {
    const extractor = new WikilinkExtractor();
    const text = 'This mentions [[Target Entity]] in the text.';

    const links = extractor.extract(text);

    expect(links).toHaveLength(1);
    expect(links[0].target).toBe('Target Entity');
  });

  it('should extract wikilinks with aliases', () => {
    const extractor = new WikilinkExtractor();
    const text = 'This mentions [[Target|alias]] in the text.';

    const links = extractor.extract(text);

    expect(links).toHaveLength(1);
    expect(links[0].target).toBe('Target');
  });

  it('should extract multiple wikilinks', () => {
    const extractor = new WikilinkExtractor();
    const text = 'Mentions [[First]] and [[Second]] and [[Third]].';

    const links = extractor.extract(text);

    expect(links).toHaveLength(3);
    expect(links.map(l => l.target)).toEqual(['First', 'Second', 'Third']);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- WikilinkExtractor.test.ts`
Expected: FAIL with "Cannot find module './WikilinkExtractor.js'"

**Step 3: Write minimal implementation**

Create `src/extraction/WikilinkExtractor.ts`:

```typescript
export interface WikilinkMatch {
  target: string;
  context: string;
  confidence: number;
}

export class WikilinkExtractor {
  private wikilinkPattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

  extract(text: string): WikilinkMatch[] {
    const matches: WikilinkMatch[] = [];
    const contextRadius = 50; // characters around link

    let match;
    while ((match = this.wikilinkPattern.exec(text)) !== null) {
      const target = match[1].trim();
      const startPos = Math.max(0, match.index - contextRadius);
      const endPos = Math.min(text.length, match.index + match[0].length + contextRadius);
      const context = text.substring(startPos, endPos).trim();

      matches.push({
        target,
        context,
        confidence: 1.0 // Perfect match for explicit wikilinks
      });
    }

    return matches;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- WikilinkExtractor.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/extraction/WikilinkExtractor.ts src/extraction/WikilinkExtractor.test.ts
git commit -m "feat: implement wikilink extraction from text"
```

---

### Task 7: Tag Extraction

**Files:**
- Create: `src/extraction/TagExtractor.ts`
- Test: `src/extraction/TagExtractor.test.ts`

**Step 1: Write the failing test**

Create `src/extraction/TagExtractor.test.ts`:

```typescript
import { TagExtractor } from './TagExtractor.js';

describe('TagExtractor', () => {
  it('should extract simple tags', () => {
    const extractor = new TagExtractor();
    const text = 'This has #important and #urgent tags.';

    const tags = extractor.extract(text);

    expect(tags).toContain('important');
    expect(tags).toContain('urgent');
  });

  it('should extract nested tags', () => {
    const extractor = new TagExtractor();
    const text = 'Uses #category/subcategory/specific tag.';

    const tags = extractor.extract(text);

    expect(tags).toContain('category_subcategory_specific');
  });

  it('should normalize tags to lowercase with underscores', () => {
    const extractor = new TagExtractor();
    const text = '#MyTag and #Another-Tag';

    const tags = extractor.extract(text);

    expect(tags).toContain('mytag');
    expect(tags).toContain('another_tag');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- TagExtractor.test.ts`
Expected: FAIL with "Cannot find module './TagExtractor.js'"

**Step 3: Write minimal implementation**

Create `src/extraction/TagExtractor.ts`:

```typescript
export class TagExtractor {
  private tagPattern = /#([a-zA-Z0-9_/-]+)/g;

  extract(text: string): string[] {
    const tags: Set<string> = new Set();

    let match;
    while ((match = this.tagPattern.exec(text)) !== null) {
      const tag = this.normalizeTag(match[1]);
      tags.add(tag);
    }

    return Array.from(tags).sort();
  }

  private normalizeTag(tag: string): string {
    return tag
      .toLowerCase()
      .replace(/\//g, '_')
      .replace(/-/g, '_')
      .replace(/_+/g, '_');
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- TagExtractor.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/extraction/TagExtractor.ts src/extraction/TagExtractor.test.ts
git commit -m "feat: implement tag extraction and normalization"
```

---

### Task 8: Metadata Extraction Pipeline

**Files:**
- Create: `src/extraction/MetadataExtractionPipeline.ts`
- Test: `src/extraction/MetadataExtractionPipeline.test.ts`

**Step 1: Write the failing test**

Create `src/extraction/MetadataExtractionPipeline.test.ts`:

```typescript
import { MetadataExtractionPipeline } from './MetadataExtractionPipeline.js';
import { Entity } from '../types.js';

describe('MetadataExtractionPipeline', () => {
  it('should extract wikilinks from observations', async () => {
    const pipeline = new MetadataExtractionPipeline();

    const entity: Entity = {
      name: 'Test',
      entityType: 'test',
      observations: ['This mentions [[Target]] entity.']
    };

    const result = await pipeline.process(entity);

    expect(result.extractedMetadata.links).toHaveLength(1);
    expect(result.extractedMetadata.links[0].target).toBe('Target');
  });

  it('should extract tags from observations', async () => {
    const pipeline = new MetadataExtractionPipeline();

    const entity: Entity = {
      name: 'Test',
      entityType: 'test',
      observations: ['This has #important tag.']
    };

    const result = await pipeline.process(entity);

    expect(result.extractedMetadata.tags).toContain('important');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- MetadataExtractionPipeline.test.ts`
Expected: FAIL with "Cannot find module './MetadataExtractionPipeline.js'"

**Step 3: Write minimal implementation**

Create `src/extraction/MetadataExtractionPipeline.ts`:

```typescript
import { Entity } from '../types.js';
import { WikilinkExtractor, WikilinkMatch } from './WikilinkExtractor.js';
import { TagExtractor } from './TagExtractor.js';
import { DateTime } from 'luxon';

export interface SuggestedRelation {
  to: string;
  relationType: string;
  qualification: string;
  confidence: number;
  reason: string;
  sourceText: string;
}

export interface EnrichedEntity extends Entity {
  extractedMetadata: {
    links: WikilinkMatch[];
    tags: string[];
    dates: Record<string, DateTime>;
    properties: Record<string, any>;
    suggestedRelations: SuggestedRelation[];
  };
}

export class MetadataExtractionPipeline {
  private wikilinkExtractor: WikilinkExtractor;
  private tagExtractor: TagExtractor;

  constructor() {
    this.wikilinkExtractor = new WikilinkExtractor();
    this.tagExtractor = new TagExtractor();
  }

  async process(entity: Entity): Promise<EnrichedEntity> {
    const allText = entity.observations.join('\n');

    // Extract wikilinks
    const links = this.wikilinkExtractor.extract(allText);

    // Extract tags
    const tags = this.tagExtractor.extract(allText);

    // TODO: Extract dates
    const dates: Record<string, DateTime> = {};

    // TODO: Extract properties
    const properties: Record<string, any> = {};

    // TODO: Infer relations
    const suggestedRelations: SuggestedRelation[] = [];

    return {
      ...entity,
      extractedMetadata: {
        links,
        tags,
        dates,
        properties,
        suggestedRelations
      }
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- MetadataExtractionPipeline.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/extraction/MetadataExtractionPipeline.ts src/extraction/MetadataExtractionPipeline.test.ts
git commit -m "feat: implement metadata extraction pipeline"
```

---

## Phase 3: Graph Analytics (Tasks 9-15)

### Task 9: ArticleRank Centrality

**Files:**
- Create: `src/analytics/ArticleRank.ts`
- Test: `src/analytics/ArticleRank.test.ts`

**Step 1: Write the failing test**

Create `src/analytics/ArticleRank.test.ts`:

```typescript
import { ArticleRank } from './ArticleRank.js';
import { Entity, Relation } from '../types.js';

describe('ArticleRank', () => {
  it('should compute ArticleRank scores', () => {
    const entities: Entity[] = [
      { name: 'A', entityType: 'test', observations: [] },
      { name: 'B', entityType: 'test', observations: [] },
      { name: 'C', entityType: 'test', observations: [] }
    ];

    const relations: Relation[] = [
      { from: 'A', to: 'B', relationType: 'links', qualification: 'to' },
      { from: 'B', to: 'C', relationType: 'links', qualification: 'to' },
      { from: 'C', to: 'A', relationType: 'links', qualification: 'to' }
    ];

    const articleRank = new ArticleRank();
    const scores = articleRank.compute(entities, relations);

    expect(scores.get('A')).toBeGreaterThan(0);
    expect(scores.get('B')).toBeGreaterThan(0);
    expect(scores.get('C')).toBeGreaterThan(0);

    // All should have similar scores in this symmetric graph
    const scoresArray = Array.from(scores.values());
    const avg = scoresArray.reduce((a, b) => a + b, 0) / scoresArray.length;
    scoresArray.forEach(score => {
      expect(Math.abs(score - avg)).toBeLessThan(0.1);
    });
  });

  it('should give higher scores to entities with more incoming links', () => {
    const entities: Entity[] = [
      { name: 'Hub', entityType: 'test', observations: [] },
      { name: 'A', entityType: 'test', observations: [] },
      { name: 'B', entityType: 'test', observations: [] },
      { name: 'C', entityType: 'test', observations: [] }
    ];

    const relations: Relation[] = [
      { from: 'A', to: 'Hub', relationType: 'links', qualification: 'to' },
      { from: 'B', to: 'Hub', relationType: 'links', qualification: 'to' },
      { from: 'C', to: 'Hub', relationType: 'links', qualification: 'to' }
    ];

    const articleRank = new ArticleRank();
    const scores = articleRank.compute(entities, relations);

    const hubScore = scores.get('Hub')!;
    const aScore = scores.get('A')!;

    expect(hubScore).toBeGreaterThan(aScore);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- ArticleRank.test.ts`
Expected: FAIL with "Cannot find module './ArticleRank.js'"

**Step 3: Write minimal implementation**

Create `src/analytics/ArticleRank.ts`:

```typescript
import { Entity, Relation } from '../types.js';

export class ArticleRank {
  private dampingFactor: number;
  private maxIterations: number;
  private tolerance: number;

  constructor(dampingFactor: number = 0.85, maxIterations: number = 100, tolerance: number = 1e-6) {
    this.dampingFactor = dampingFactor;
    this.maxIterations = maxIterations;
    this.tolerance = tolerance;
  }

  compute(entities: Entity[], relations: Relation[]): Map<string, number> {
    const n = entities.length;
    if (n === 0) return new Map();

    // Initialize scores uniformly
    const scores = new Map<string, number>();
    const newScores = new Map<string, number>();
    const initialScore = 1.0 / n;

    for (const entity of entities) {
      scores.set(entity.name, initialScore);
      newScores.set(entity.name, initialScore);
    }

    // Build adjacency structure
    const outgoingLinks = new Map<string, string[]>();
    const incomingLinks = new Map<string, string[]>();

    for (const entity of entities) {
      outgoingLinks.set(entity.name, []);
      incomingLinks.set(entity.name, []);
    }

    for (const relation of relations) {
      outgoingLinks.get(relation.from)?.push(relation.to);
      incomingLinks.get(relation.to)?.push(relation.from);
    }

    // Compute out-degree for each node
    const outDegree = new Map<string, number>();
    for (const [node, links] of outgoingLinks) {
      outDegree.set(node, links.length);
    }

    // Iterate until convergence
    for (let iter = 0; iter < this.maxIterations; iter++) {
      let maxChange = 0;

      for (const entity of entities) {
        const name = entity.name;
        const incoming = incomingLinks.get(name) || [];

        // ArticleRank formula: AR(v) = (1-d)/N + d * Σ(AR(u) / C(u))
        // where C(u) is out-degree of u
        let sum = 0;
        for (const source of incoming) {
          const sourceScore = scores.get(source) || 0;
          const sourceOutDegree = outDegree.get(source) || 1; // Avoid division by zero
          sum += sourceScore / sourceOutDegree;
        }

        const newScore = (1 - this.dampingFactor) / n + this.dampingFactor * sum;
        newScores.set(name, newScore);

        const change = Math.abs(newScore - (scores.get(name) || 0));
        maxChange = Math.max(maxChange, change);
      }

      // Copy new scores to current scores
      for (const [name, score] of newScores) {
        scores.set(name, score);
      }

      // Check convergence
      if (maxChange < this.tolerance) {
        break;
      }
    }

    return scores;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- ArticleRank.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/analytics/ArticleRank.ts src/analytics/ArticleRank.test.ts
git commit -m "feat: implement ArticleRank centrality algorithm"
```

---

### Task 10: Graph Analytics Interface

**Files:**
- Create: `src/analytics/GraphAnalytics.ts`
- Test: `src/analytics/GraphAnalytics.test.ts`

**Step 1: Write interface and basic implementation**

Create `src/analytics/GraphAnalytics.ts`:

```typescript
import { Entity, Relation, KnowledgeGraph } from '../types.js';
import { ArticleRank } from './ArticleRank.js';
import { DateTime } from 'luxon';

export interface CentralityMetrics {
  inDegree: number;
  outDegree: number;
  totalDegree: number;
  articleRank: number;
  normalized: boolean;
}

export interface CentralityReport {
  metrics: Map<string, CentralityMetrics>;
  topEntities: Array<{ name: string; score: number }>;
}

export interface Path {
  entities: string[];
  relations: Relation[];
  length: number;
  weight: number;
}

export interface LinkPrediction {
  from: string;
  to: string;
  confidence: number;
  method: string;
  sharedNeighbors: string[];
  explanation: string;
}

export class GraphAnalytics {
  private articleRank: ArticleRank;

  constructor() {
    this.articleRank = new ArticleRank();
  }

  computeCentrality(entities: Entity[], relations: Relation[]): CentralityReport {
    const metrics = new Map<string, CentralityMetrics>();

    // Compute degrees
    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();

    for (const entity of entities) {
      inDegree.set(entity.name, 0);
      outDegree.set(entity.name, 0);
    }

    for (const relation of relations) {
      inDegree.set(relation.to, (inDegree.get(relation.to) || 0) + 1);
      outDegree.set(relation.from, (outDegree.get(relation.from) || 0) + 1);
    }

    // Compute ArticleRank
    const articleRankScores = this.articleRank.compute(entities, relations);

    // Build metrics
    for (const entity of entities) {
      const inDeg = inDegree.get(entity.name) || 0;
      const outDeg = outDegree.get(entity.name) || 0;
      const ar = articleRankScores.get(entity.name) || 0;

      metrics.set(entity.name, {
        inDegree: inDeg,
        outDegree: outDeg,
        totalDegree: inDeg + outDeg,
        articleRank: ar,
        normalized: true
      });
    }

    // Get top entities by ArticleRank
    const topEntities = Array.from(articleRankScores.entries())
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    return {
      metrics,
      topEntities
    };
  }

  findPath(from: string, to: string, relations: Relation[], maxHops: number = 5): Path | null {
    // Simple BFS for shortest path
    const queue: Array<{ node: string; path: string[]; relationPath: Relation[] }> = [
      { node: from, path: [from], relationPath: [] }
    ];
    const visited = new Set<string>([from]);

    // Build adjacency
    const adjacency = new Map<string, Array<{ to: string; relation: Relation }>>();
    for (const relation of relations) {
      if (!adjacency.has(relation.from)) {
        adjacency.set(relation.from, []);
      }
      adjacency.get(relation.from)!.push({ to: relation.to, relation });
    }

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.node === to) {
        return {
          entities: current.path,
          relations: current.relationPath,
          length: current.path.length - 1,
          weight: current.relationPath.length
        };
      }

      if (current.path.length >= maxHops + 1) {
        continue;
      }

      const neighbors = adjacency.get(current.node) || [];
      for (const { to: neighbor, relation } of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({
            node: neighbor,
            path: [...current.path, neighbor],
            relationPath: [...current.relationPath, relation]
          });
        }
      }
    }

    return null;
  }

  predictLinks(entity: string, entities: Entity[], relations: Relation[], topK: number = 10): LinkPrediction[] {
    // Simple common neighbor approach
    const predictions: LinkPrediction[] = [];

    // Build neighbor sets
    const neighbors = new Map<string, Set<string>>();
    for (const e of entities) {
      neighbors.set(e.name, new Set());
    }

    for (const relation of relations) {
      neighbors.get(relation.from)?.add(relation.to);
    }

    const entityNeighbors = neighbors.get(entity) || new Set();

    // For each non-connected entity, count common neighbors
    for (const other of entities) {
      if (other.name === entity) continue;
      if (entityNeighbors.has(other.name)) continue; // Already connected

      const otherNeighbors = neighbors.get(other.name) || new Set();
      const commonNeighbors = Array.from(entityNeighbors).filter(n => otherNeighbors.has(n));

      if (commonNeighbors.length > 0) {
        const confidence = commonNeighbors.length / Math.sqrt(entityNeighbors.size * otherNeighbors.size);

        predictions.push({
          from: entity,
          to: other.name,
          confidence,
          method: 'common_neighbor',
          sharedNeighbors: commonNeighbors,
          explanation: `${commonNeighbors.length} shared connections`
        });
      }
    }

    return predictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, topK);
  }
}
```

**Step 2: Write tests**

Create `src/analytics/GraphAnalytics.test.ts`:

```typescript
import { GraphAnalytics } from './GraphAnalytics.js';
import { Entity, Relation } from '../types.js';

describe('GraphAnalytics', () => {
  it('should compute centrality metrics', () => {
    const entities: Entity[] = [
      { name: 'A', entityType: 'test', observations: [] },
      { name: 'B', entityType: 'test', observations: [] },
      { name: 'C', entityType: 'test', observations: [] }
    ];

    const relations: Relation[] = [
      { from: 'A', to: 'B', relationType: 'links', qualification: 'to' },
      { from: 'B', to: 'C', relationType: 'links', qualification: 'to' }
    ];

    const analytics = new GraphAnalytics();
    const report = analytics.computeCentrality(entities, relations);

    expect(report.metrics.size).toBe(3);
    expect(report.topEntities.length).toBeGreaterThan(0);
  });

  it('should find shortest path', () => {
    const relations: Relation[] = [
      { from: 'A', to: 'B', relationType: 'links', qualification: 'to' },
      { from: 'B', to: 'C', relationType: 'links', qualification: 'to' }
    ];

    const analytics = new GraphAnalytics();
    const path = analytics.findPath('A', 'C', relations);

    expect(path).not.toBeNull();
    expect(path!.entities).toEqual(['A', 'B', 'C']);
    expect(path!.length).toBe(2);
  });

  it('should predict links based on common neighbors', () => {
    const entities: Entity[] = [
      { name: 'A', entityType: 'test', observations: [] },
      { name: 'B', entityType: 'test', observations: [] },
      { name: 'C', entityType: 'test', observations: [] },
      { name: 'D', entityType: 'test', observations: [] }
    ];

    const relations: Relation[] = [
      { from: 'A', to: 'B', relationType: 'links', qualification: 'to' },
      { from: 'C', to: 'B', relationType: 'links', qualification: 'to' }
    ];

    const analytics = new GraphAnalytics();
    const predictions = analytics.predictLinks('A', entities, relations, 5);

    // Should predict A -> C (common neighbor: B)
    const predictedC = predictions.find(p => p.to === 'C');
    expect(predictedC).toBeDefined();
    expect(predictedC!.sharedNeighbors).toContain('B');
  });
});
```

**Step 3: Run tests**

Run: `npm test -- GraphAnalytics.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/analytics/GraphAnalytics.ts src/analytics/GraphAnalytics.test.ts
git commit -m "feat: implement graph analytics with centrality and path finding"
```

---

## Execution Instructions

This plan should be executed using @superpowers:executing-plans with the following approach:

1. **Batch Size**: 2-3 tasks per batch (review between batches)
2. **Review Points**: After each phase (Core Infrastructure, Metadata Extraction, Graph Analytics)
3. **Testing**: Run full test suite after each task completion
4. **Commits**: Commit after each task as specified

**Phase 4 (Tool Integration) and Phase 5 (Configuration & Polish) will be planned in separate documents once core functionality is complete.**

## Success Criteria

- All tests passing
- TypeScript compilation successful
- No linting errors
- Code coverage > 80%
- Documentation complete for all public APIs
