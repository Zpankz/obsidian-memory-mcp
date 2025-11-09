# Remaining Components Implementation Guide

**Purpose:** Detailed implementation plans for high-priority remaining components
**Context:** Core atomic architecture working, need semantic intelligence + optimization

---

## High Priority Components (Next 2 Weeks)

### **Component A: Semantic Relation Embeddings** 🧠

**Effort:** 3 days | **Priority:** CRITICAL | **Dependencies:** @xenova/transformers

**Purpose:** Enable meaning-based relation matching instead of string-only

**Implementation Steps:**

**Step 1: Install dependency**
```bash
npm install @xenova/transformers
```

**Step 2: Create SemanticRelationIndex**
**File:** `src/semantic/SemanticRelationIndex.ts`

```typescript
import { pipeline, Pipeline } from '@xenova/transformers';
import { Relation } from '../types.js';

export class SemanticRelationIndex {
  private model: Pipeline | null = null;
  private embeddingsCache = new Map<string, number[]>();

  async initialize() {
    console.error('Loading semantic model (one-time, ~50MB)...');
    this.model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.error('✓ Semantic model loaded');
  }

  async embed(relationType: string, qualification: string): Promise<number[]> {
    const key = `${relationType}.${qualification}`;
    if (this.embeddingsCache.has(key)) return this.embeddingsCache.get(key)!;

    const text = `${relationType} with ${qualification}`;
    const output = await this.model!(text, { pooling: 'mean', normalize: true });
    const embedding = Array.from(output.data as Float32Array);

    this.embeddingsCache.set(key, embedding);
    return embedding;
  }

  async findSimilar(relation: Relation, candidates: Relation[], threshold = 0.85) {
    const queryEmbed = await this.embed(relation.relationType, relation.qualification);
    let best = null;
    let bestSim = 0;

    for (const candidate of candidates) {
      const candEmbed = await this.embed(candidate.relationType, candidate.qualification);
      const sim = this.cosineSimilarity(queryEmbed, candEmbed);

      if (sim > bestSim && sim >= threshold) {
        bestSim = sim;
        best = candidate;
      }
    }

    return best ? { match: best, similarity: bestSim } : null;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }
}
```

**Step 3: Integrate into RelationEnhancer**
```typescript
// In src/integration/RelationEnhancer.ts
private semanticIndex = new SemanticRelationIndex();

async normalizeAndValidate(relation: Relation): Promise<NormalizedRelation> {
  await this.semanticIndex.initialize();

  // String normalization (existing)
  const stringNorm = validateAndNormalizeRelation(...);

  // Semantic matching (NEW)
  const allRelations = await this.getAllRelations();
  const semanticMatch = await this.semanticIndex.findSimilar(relation, allRelations);

  if (semanticMatch && semanticMatch.similarity > 0.85) {
    return {
      original: relation,
      normalized: semanticMatch.match,
      suggestions: { semantic: { ...semanticMatch, reason: `${(semanticMatch.similarity*100).toFixed(0)}% similar` } }
    };
  }

  return stringNorm;
}
```

**Testing:**
```typescript
// src/semantic/SemanticRelationIndex.test.ts
it('should find semantically similar relations', async () => {
  const index = new SemanticRelationIndex();
  await index.initialize();

  const newRel = { relationType: 'blocks', qualification: 'completely' };
  const existing = [
    { relationType: 'inhibits', qualification: 'competitive' },
    { relationType: 'enhances', qualification: 'partially' }
  ];

  const match = await index.findSimilar(newRel, existing);

  expect(match).not.toBeNull();
  expect(match!.match.relationType).toBe('inhibits');
  expect(match!.similarity).toBeGreaterThan(0.85);
});
```

---

### **Component B: Bidirectional Relation Inference** ⭐

**Effort:** 1 day | **Priority:** CRITICAL | **Dependencies:** None

**Purpose:** Auto-generate inverse relations

**Implementation Steps:**

**Step 1: Create BidirectionalEngine**
**File:** `src/inference/BidirectionalEngine.ts`

```typescript
interface RelationRule {
  forward: { type: string; qualification: string };
  inverse: { type: string; qualification: string };
  symmetric: boolean; // Same qualification both ways?
}

const RULES: RelationRule[] = [
  {
    forward: { type: 'influences', qualification: 'increases' },
    inverse: { type: 'influenced_by', qualification: 'increased_by' },
    symmetric: false
  },
  {
    forward: { type: 'modulates', qualification: 'antagonism' },
    inverse: { type: 'modulated_by', qualification: 'antagonism' },
    symmetric: true
  },
  // ... 20+ more rules
];

export class BidirectionalEngine {
  createPair(relation: Relation): Relation[] {
    const rule = RULES.find(r =>
      r.forward.type === relation.relationType &&
      r.forward.qualification === relation.qualification
    );

    if (!rule) return [relation];

    const inverse: Relation = {
      from: relation.to,
      to: relation.from,
      relationType: rule.inverse.type,
      qualification: rule.inverse.qualification
    };

    return [relation, inverse];
  }
}
```

**Step 2: Integrate into create_relations**
```typescript
case "create_relations": {
  const relations = params.relations;
  const bidirectional = params.bidirectional ?? true;

  // Normalize
  const normalized = await relationEnhancer.normalizeAndValidateMultiple(relations);

  // Create pairs (NEW)
  let toCreate = normalized.map(r => r.normalized);
  if (bidirectional) {
    const biEngine = new BidirectionalEngine();
    toCreate = toCreate.flatMap(r => biEngine.createPair(r));
  }

  const result = await storageManager.createRelations(toCreate);

  return { created: result.created, bidirectionalPairs: toCreate.length / 2 };
}
```

---

### **Component C: Semantic Weight Calculator** 📊

**Effort:** 2 days | **Priority:** HIGH | **Dependencies:** None

**Purpose:** Calculate unique information in each relation for pruning

**File:** `src/optimization/SemanticWeightCalculator.ts`

**Formula:**
```
weight = (novelty × 0.4) + (directness × 0.2) + (specificity × 0.2) + (salience × 0.2)

novelty: Is information unique or inferable from alternate paths?
directness: Is connection direct or multi-hop?
specificity: How specific is the qualification?
salience: How strongly supported by observations?
```

**Key Methods:**
```typescript
calculateNovelty(relation, graph): number {
  const alternatePaths = findAllPaths(relation.from, relation.to, maxHops: 3);
  if (alternatePaths.length === 0) return 1.0; // Novel

  // Check if direct provides unique info
  return this.uniqueInformation(relation, alternatePaths);
}

shouldPrune(relation, graph, threshold = 0.4): boolean {
  const weight = this.calculateWeight(relation, graph);
  if (weight >= threshold) return false; // Keep

  if (this.isUnintuitive(relation, graph)) return false; // Keep unintuitive

  return true; // Prune
}
```

---

### **Component D: Entity Resolution** 🔗

**Effort:** 3 days | **Priority:** HIGH | **Dependencies:** Component A (embeddings)

**Purpose:** Detect and merge duplicate entities across MCP + vault

**File:** `src/unification/EntityResolver.ts`

**Multi-Signal Similarity:**
```typescript
class EntityResolver {
  async findDuplicates(newEntity: Entity): Promise<DuplicateCandidate[]> {
    const candidates = await unifiedIndex.search(newEntity.name);

    return candidates.map(existing => ({
      existing,
      similarity: this.calculateSimilarity(newEntity, existing),
      evidence: {
        nameMatch: levenshtein(newEntity.name, existing.name),
        typeMatch: newEntity.entityType === existing.entityType,
        sharedLinks: intersection(newLinks, existingLinks),
        embeddingSim: await semanticSimilarity(observations)
      }
    })).filter(c => c.similarity > 0.75);
  }

  calculateSimilarity(a, b): number {
    return (nameMatch * 0.3) + (typeMatch ? 0.2 : 0) + (sharedLinks * 0.25) + (embedding * 0.25);
  }
}
```

---

### **Component E: Small-World Optimizer** 🌐

**Effort:** 3 days | **Priority:** MEDIUM | **Dependencies:** Component C (weight calculator)

**Purpose:** Maintain optimal network topology

**File:** `src/optimization/SmallWorldOptimizer.ts`

**Key Functionality:**
```typescript
class SmallWorldOptimizer {
  async optimize(graph): Promise<OptimizationResult> {
    // 1. Calculate metrics
    const metrics = this.calculateMetrics(graph);

    // 2. Prune low-weight local connections
    const pruneable = graph.relations.filter(r =>
      weightCalc.shouldPrune(r, graph) && this.isLocalConnection(r)
    );

    // 3. Add strategic bridges between communities
    const communities = this.detectCommunities(graph);
    const bridges = this.proposeBridges(communities, graph);

    // 4. Return optimization plan
    return { relationsToPrune: pruneable, bridgesToAdd: bridges, metrics };
  }

  calculateMetrics(graph): NetworkMetrics {
    return {
      clustering: this.clusteringCoefficient(graph),
      pathLength: this.averagePathLength(graph),
      degree: this.averageDegree(graph),
      smallWorldness: (C/C_random) / (L/L_random)
    };
  }
}
```

---

## Implementation Sequence Recommendation

### **Phase A: Semantic Intelligence (1 week)**
1. Semantic Embeddings (3 days) - Foundation
2. Bidirectional Relations (1 day) - Quick win
3. Semantic Weight Calculator (2 days) - Enables pruning

**Value:** Intelligent matching + auto-inverse + quality filtering

### **Phase B: Network Optimization (1 week)**
4. Entity Resolution (3 days) - Unify knowledge
5. Small-World Optimizer (3 days) - Topology optimization
6. Integration testing (1 day)

**Value:** Unified knowledge + optimal network structure

### **Phase C: Advanced Features (Optional)**
7. Temporal versioning
8. Property taxonomy
9. MCP architecture optimizations

---

## Quick Reference: What's Done vs What's Needed

| Component | Status | Tests | Priority | Effort |
|-----------|--------|-------|----------|--------|
| YAML Parser | ✅ DONE | 8/8 | - | - |
| Atomic Extractor | ✅ DONE | 5/5 | - | - |
| EntityEnhancer Integration | ✅ DONE | 1/1 | - | - |
| Markdown Generation | ✅ DONE | - | - | - |
| Semantic Embeddings | ⏳ TODO | 0/0 | CRITICAL | 3d |
| Bidirectional Relations | ⏳ TODO | 0/0 | CRITICAL | 1d |
| Semantic Weight Calc | ⏳ TODO | 0/0 | HIGH | 2d |
| Entity Resolution | ⏳ TODO | 0/0 | HIGH | 3d |
| Small-World Optimizer | ⏳ TODO | 0/0 | MEDIUM | 3d |
| Temporal Versioning | ⏳ TODO | 0/0 | MEDIUM | 2d |
| Property Taxonomy | ⏳ TODO | 0/0 | MEDIUM | 4d |
| Tool Consolidation | ⏳ TODO | 0/0 | LOW | 2d |
| Resources/Prompts | ⏳ TODO | 0/0 | LOW | 1d |

**Total Remaining:** ~20 days

---

## Recommended Next Action

**Option 1:** Continue with Phase A (Semantic Intelligence) - 1 week
**Option 2:** Merge prototype now, continue later
**Option 3:** Implement only critical components (embeddings + bidirectional) - 4 days

User decides based on timeline and priorities.
