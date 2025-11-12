# RPP Implementation Plan - Detailed Execution Guide

**Purpose:** Integrate Recursive Pareto Principle into existing knowledge graph
**Status:** Ready for implementation
**Estimated Effort:** 4 weeks (160 hours)
**Prerequisites:** All P0-P1 features complete (DONE)

---

## Overview

Transform current knowledge graph from implicit hierarchy to explicit RPP-compliant four-level system with:
- Layer classification (L0/L1/L2/L3)
- Pareto ratio validation (80/20 at each level)
- Generation constraint enforcement (2-3 children)
- Bidirectional derivation (bottom-up + top-down)
- Meta-graph extraction

---

## Phase 1: Foundation (Week 1, 40 hours)

### Task 1.1: Extend Entity Type (4 hours)

**File:** `src/types.ts`

**Changes:**
```typescript
export interface Entity {
  name: string;
  entityType: string;
  observations: string[];
  rppLevel?: 0 | 1 | 2 | 3; // NEW: Layer designation
  metadata?: {
    // Existing fields...
    atomic?: boolean;
    composite?: boolean;

    // NEW RPP fields:
    derivedFrom?: string[]; // Parent entities (upward)
    derives?: string[]; // Child entities (downward)
    rppMetrics?: {
      complexity: number; // 0-1, used for classification
      abstraction: number; // 0-1, higher = more abstract
      coverage: number; // How many children this covers
      childCount: number; // For generation constraint
    };
  };
}
```

**Testing:**
- Verify backward compatibility (rppLevel optional)
- Test entity creation with new fields
- Test serialization/deserialization

**Commit:** "feat: extend Entity type with RPP layer and derivation metadata"

---

### Task 1.2: Implement Layer Classifier (12 hours)

**File:** `src/rpp/LayerClassifier.ts`

**Algorithm:**
```typescript
class RPPLayerClassifier {
  /**
   * Classify entity into L0/L1/L2/L3 based on complexity and abstraction
   */
  classifyEntity(entity: Entity, graph: KnowledgeGraph): 0 | 1 | 2 | 3 {
    // Calculate metrics
    const complexity = this.calculateComplexity(entity);
    const abstraction = this.calculateAbstraction(entity, graph);
    const connectivity = this.calculateConnectivity(entity, graph);

    // Classification rules:
    // L0 (Meta): abstraction > 0.9, connectivity > 0.8 (schema patterns)
    // L1 (Atomic): abstraction > 0.6, complexity < 0.3 (simple principles)
    // L2 (Composite): abstraction 0.3-0.6, complexity 0.3-0.7 (combined concepts)
    // L3 (Detail): abstraction < 0.3, complexity variable (raw data)

    if (abstraction > 0.9 && connectivity > 0.8) return 0;
    if (abstraction > 0.6 && complexity < 0.3) return 1;
    if (abstraction >= 0.3 && abstraction <= 0.6) return 2;
    return 3;
  }

  private calculateComplexity(entity: Entity): number {
    // Based on: observation count, property count, relation count
    const obsCount = entity.observations.length;
    const propCount = entity.metadata?.yamlProperties ?
      Object.keys(entity.metadata.yamlProperties).length : 0;

    // Normalize to 0-1
    const complexityScore = (obsCount * 0.4 + propCount * 0.6) / 10;
    return Math.min(complexityScore, 1.0);
  }

  private calculateAbstraction(entity: Entity, graph: KnowledgeGraph): number {
    // Based on: how many entities reference this, how general the content is
    const references = graph.relations.filter(r => r.to === entity.name).length;
    const isGeneral = this.containsGeneralTerms(entity.observations.join(' '));

    return (references / graph.entities.length) * 0.6 + (isGeneral ? 0.4 : 0);
  }

  private calculateConnectivity(entity: Entity, graph: KnowledgeGraph): number {
    const degree = graph.relations.filter(
      r => r.from === entity.name || r.to === entity.name
    ).length;

    return degree / (graph.entities.length - 1); // Normalize by max possible
  }
}
```

**Testing:**
- Test with known L1 entities (atomic concepts)
- Test with known L3 entities (detailed observations)
- Test edge cases (single observation, no relations)
- Validate classification consistency

**Commit:** "feat: implement RPP layer classifier with complexity/abstraction metrics"

---

### Task 1.3: Implement Ratio Validator (8 hours)

**File:** `src/rpp/RPPValidator.ts`

**Validation Logic:**
```typescript
interface RPPValidationReport {
  compliant: boolean;
  ratios: {
    l1ToL2: { actual: number; target: [2, 3]; compliant: boolean };
    l1ToL3: { actual: number; target: [6, 9]; compliant: boolean };
    l2ToL3: { actual: number; target: [9, 12]; compliant: boolean };
  };
  generationConstraint: {
    average: number;
    target: [2, 3];
    violations: Array<{ entity: string; children: number }>;
  };
  paretoCompliance: {
    l0ToL1: { coverage: number; nodeRatio: number; compliant: boolean };
    l1ToL2: { coverage: number; nodeRatio: number; compliant: boolean };
    l2ToL3: { coverage: number; nodeRatio: number; compliant: boolean };
  };
  warnings: string[];
  recommendations: string[];
}

class RPPValidator {
  validate(graph: KnowledgeGraph): RPPValidationReport {
    const layerCounts = this.countByLayer(graph);

    // Check ratios
    const l1ToL2 = layerCounts.l1 / layerCounts.l2;
    const l1ToL3 = layerCounts.l1 / layerCounts.l3;
    const l2ToL3 = layerCounts.l2 / layerCounts.l3;

    // Check generation constraint
    const childCounts = this.analyzeChildrenPerNode(graph);

    // Check Pareto coverage
    const paretoCompliance = this.validateParetoCompliance(graph);

    return {
      compliant: this.isCompliant(l1ToL2, l1ToL3, l2ToL3, childCounts, paretoCompliance),
      ratios: {...},
      generationConstraint: {...},
      paretoCompliance,
      warnings: this.generateWarnings(...),
      recommendations: this.generateRecommendations(...)
    };
  }
}
```

**Testing:**
- Test with compliant graph (meets all ratios)
- Test with violations (too many/few at each level)
- Test with edge cases (empty levels, single entity)
- Validate warning generation

**Commit:** "feat: implement RPP ratio and constraint validator"

---

### Task 1.4: Integration into Tool (8 hours)

**File:** `src/handlers/UnifiedToolHandler.ts`

**Add New Analytics Subfunction:**
```typescript
case 'rpp_validate': {
  const graph = await this.storageManager.readGraph();

  // Classify all entities first (if not already classified)
  const classifier = new RPPLayerClassifier();
  for (const entity of graph.entities) {
    if (!entity.rppLevel) {
      entity.rppLevel = classifier.classifyEntity(entity, graph);
    }
  }

  // Validate RPP compliance
  const validator = new RPPValidator();
  const report = validator.validate(graph);

  return {
    validation: report,
    layerDistribution: this.getLayerDistribution(graph),
    compliance: report.compliant ? 'COMPLIANT' : 'VIOLATIONS_FOUND',
    suggestions: report.recommendations
  };
}
```

**Testing:**
- Test RPP validation operation
- Verify response format
- Test with various graph states

**Commit:** "feat: add RPP validation to analytics operations"

---

### Task 1.5: Week 1 Integration Testing (8 hours)

**Create:** `src/rpp/RPP.test.ts`

**Test Scenarios:**
- Simple 3-level graph (L1, L2, L3)
- Graph with all 4 levels
- Graph violating ratios
- Graph with generation constraint violations
- Empty graph
- Single-entity graph

**Commit:** "test: comprehensive RPP validation test suite"

---

## Phase 2: Pareto Extraction (Week 2, 40 hours)

### Task 2.1: L3→L2 Extraction (Detail to Concept) (12 hours)

**File:** `src/rpp/ParetoExtractor.ts`

**Algorithm:**
```typescript
extractConcepts(details: Entity[]): Entity[] {
  // 1. Cluster details by similarity (semantic + structural)
  const clusters = this.clusterBySimilarity(details, threshold: 0.7);

  // 2. For each cluster, create concept entity
  const concepts: Entity[] = [];
  for (const cluster of clusters) {
    // Select most representative or create composite
    const concept = this.createConceptFromCluster(cluster);
    concept.rppLevel = 2;
    concept.metadata = {
      derivedFrom: cluster.map(d => d.name),
      rppMetrics: {
        coverage: cluster.length / details.length,
        childCount: cluster.length
      }
    };

    concepts.push(concept);
  }

  // 3. Validate 80/20: concepts.length ≈ 0.20 * details.length
  const targetCount = Math.ceil(details.length * 0.2);
  if (concepts.length > targetCount) {
    // Merge most similar concepts until target reached
    return this.mergeToParetoTarget(concepts, targetCount);
  }

  return concepts;
}
```

**Edge Cases:**
- Less than 5 details (can't meaningfully cluster)
- All details identical (create single concept)
- No similarity above threshold (each detail becomes concept)

**Testing:**
- 10 details → 2 concepts (check coverage)
- 100 details → ~20 concepts
- Identical details → 1 concept
- Dissimilar details → fallback behavior

**Commit:** "feat: implement L3→L2 Pareto extraction with clustering"

---

### Task 2.2: L2→L1 Extraction (Concept to Atomic) (12 hours)

**File:** `src/rpp/ParetoExtractor.ts` (extend)

**Algorithm:**
```typescript
extractAtomicPrinciples(concepts: Entity[]): Entity[] {
  // 1. Identify fundamental patterns across concepts
  const patterns = this.identifyRecurringPatterns(concepts);

  // 2. Extract atomic principles
  const atomic: Entity[] = [];
  for (const pattern of patterns) {
    const principle = this.createAtomicPrinciple(pattern);
    principle.rppLevel = 1;
    principle.metadata = {
      derivedFrom: pattern.occurrences.map(c => c.name),
      rppMetrics: {
        coverage: pattern.occurrences.length / concepts.length,
        childCount: pattern.occurrences.length
      }
    };

    atomic.push(principle);
  }

  // 3. Validate ratios: atomic.length = concepts.length / 2-3
  const targetRange = [Math.ceil(concepts.length / 3), Math.ceil(concepts.length / 2)];
  if (atomic.length < targetRange[0]) {
    // Need more atomic principles - lower abstraction threshold
  }

  return atomic;
}
```

**Testing:**
- 10 concepts → 3-5 atomic principles
- Patterns correctly identified
- Ratio compliance checked

**Commit:** "feat: implement L2→L1 atomic principle extraction"

---

### Task 2.3: L1→L0 Meta-Graph Extraction (12 hours)

**File:** `src/rpp/ParetoExtractor.ts` (extend)

**Algorithm:**
```typescript
extractMetaGraph(atomic: Entity[]): Entity[] {
  // 1. Perform abductive generalization
  const metaPatterns = this.abductiveGeneralization(atomic);

  // 2. Create meta-schema entities
  const meta: Entity[] = [];
  for (const pattern of metaPatterns) {
    const schema = this.createMetaSchema(pattern);
    schema.rppLevel = 0;
    schema.metadata = {
      derivedFrom: pattern.instances.map(a => a.name),
      rppMetrics: {
        coverage: pattern.instances.length / atomic.length,
        childCount: pattern.instances.length
      }
    };

    meta.push(schema);
  }

  // 3. Deductive validation
  for (const metaEntity of meta) {
    if (!this.deductivelyValid(metaEntity, atomic)) {
      // Meta-schema doesn't properly generalize atomics
      // Refine or discard
    }
  }

  return meta;
}
```

**Testing:**
- Generalization correctness
- Deductive validation
- Meta-schemas are truly general

**Commit:** "feat: implement L1→L0 meta-graph extraction with abductive generalization"

---

### Task 2.4: Week 2 Integration (4 hours)

**Add Tool Operation:**
```typescript
case 'rpp_extract': {
  const mode = params.mode as 'L3_to_L2' | 'L2_to_L1' | 'L1_to_L0' | 'full';
  const graph = await this.storageManager.readGraph();
  const extractor = new ParetoExtractor();

  if (mode === 'full') {
    // Extract all levels sequentially
    const concepts = extractor.extractConcepts(getLevel3Entities(graph));
    const atomic = extractor.extractAtomicPrinciples(concepts);
    const meta = extractor.extractMetaGraph(atomic);

    return { concepts, atomic, meta, validation: validator.validate(...) };
  }
  // ... handle specific modes
}
```

**Commit:** "feat: integrate Pareto extraction into knowledge_graph tool"

---

## Phase 3: Bidirectional Derivation (Week 3, 40 hours)

### Task 3.1: Bottom-Up Reconstruction (16 hours)

**File:** `src/rpp/BidirectionalDerivation.ts`

**Algorithm:**
```typescript
class BidirectionalDerivation {
  /**
   * Reconstruct hierarchy from raw observations (L3 up to L0)
   */
  async reconstructFromObservations(observations: string[]): Promise<{
    details: Entity[];    // L3
    concepts: Entity[];   // L2
    atomic: Entity[];     // L1
    meta: Entity[];       // L0
  }> {
    const extractor = new ParetoExtractor();

    // L3: Create detail entities
    const details = observations.map((obs, idx) => ({
      name: `detail_${idx}`,
      entityType: 'observation',
      observations: [obs],
      rppLevel: 3 as const
    }));

    // L3 → L2
    const concepts = extractor.extractConcepts(details);

    // L2 → L1
    const atomic = extractor.extractAtomicPrinciples(concepts);

    // L1 → L0
    const meta = extractor.extractMetaGraph(atomic);

    // Validate ratios
    const validator = new RPPValidator();
    const validation = validator.validate({
      entities: [...details, ...concepts, ...atomic, ...meta],
      relations: this.deriveRelations(...)
    });

    if (!validation.compliant) {
      // Iteratively refine until compliant
      return await this.refineUntilCompliant(details, concepts, atomic, meta);
    }

    return { details, concepts, atomic, meta };
  }
}
```

**Edge Cases:**
- Single observation (can't cluster)
- Very similar observations (collapse to 1 concept)
- Very diverse observations (many concepts, may violate ratio)

**Testing:**
- 10 observations → validate ratios
- 100 observations → validate ratios
- Single observation → graceful handling

**Commit:** "feat: implement bottom-up RPP reconstruction from observations"

---

### Task 3.2: Top-Down Decomposition (16 hours)

**File:** `src/rpp/BidirectionalDerivation.ts` (extend)

**Algorithm:**
```typescript
/**
 * Decompose meta-schema down to details (L0 down to L3)
 */
async decomposeFromSchema(metaSchema: Entity[]): Promise<{
  meta: Entity[];       // L0
  atomic: Entity[];     // L1
  concepts: Entity[];   // L2
  details: Entity[];    // L3
}> {
  // L0 → L1: Instantiate schema patterns as atomic principles
  const atomic = this.instantiateAtomicPrinciples(metaSchema);

  // L1 → L2: Combine atoms (2-3 at a time) into concepts
  const concepts = this.combineIntoComposites(atomic, targetRatio: 2.5);

  // L2 → L3: Specialize concepts into details
  const details = this.specializeToDetails(concepts);

  // Validate ratios
  const validator = new RPPValidator();
  // ... validation logic

  return { meta: metaSchema, atomic, concepts, details };
}
```

**Testing:**
- Schema → full hierarchy
- Validate 2-3 children constraint
- Check coverage percentages

**Commit:** "feat: implement top-down RPP decomposition from schema"

---

### Task 3.3: Bidirectional Reconciliation (8 hours)

**File:** `src/rpp/BidirectionalDerivation.ts` (extend)

**Algorithm:**
```typescript
/**
 * Merge bottom-up and top-down results, resolve conflicts
 */
async reconcile(
  bottomUp: RPPGraph,
  topDown: RPPGraph
): Promise<RPPGraph> {
  const unified: RPPGraph = { entities: [], relations: [] };

  // For each level, merge entities
  for (const level of [0, 1, 2, 3]) {
    const buEntities = bottomUp.entities.filter(e => e.rppLevel === level);
    const tdEntities = topDown.entities.filter(e => e.rppLevel === level);

    // Find overlaps and conflicts
    const merged = this.mergeWithConflictResolution(buEntities, tdEntities);
    unified.entities.push(...merged);
  }

  // Derive relations from derivation metadata
  unified.relations = this.deriveRelationsFromHierarchy(unified.entities);

  return unified;
}
```

**Testing:**
- Matching entities (same from both directions)
- Conflicting entities (different interpretations)
- Missing entities (only in one direction)

**Commit:** "feat: implement bidirectional RPP reconciliation"

---

## Phase 4: Integration & Optimization (Week 4, 40 hours)

### Task 4.1: Integrate into Entity Creation (12 hours)

**Modify:** `src/integration/EntityEnhancer.ts`

**Add RPP Classification:**
```typescript
async enhance(entity: Entity, options): Promise<EnrichedEntity> {
  // Existing enhancement...

  // NEW: RPP classification
  if (options?.enableRPP) {
    const classifier = new RPPLayerClassifier();
    const graph = await this.unifiedIndex.queryAll({});

    entity.rppLevel = classifier.classifyEntity(entity, graph);

    // If creating L2/L3, check if should derive L1/L0
    if (entity.rppLevel >= 2) {
      const shouldExtract = await this.shouldExtractPrinciples(entity, graph);
      if (shouldExtract) {
        // Suggest Pareto extraction
        enriched.rppSuggestions = {
          extractPrinciples: true,
          estimatedL1Entities: Math.ceil(1 / 2.5)
        };
      }
    }
  }

  return enriched;
}
```

**Commit:** "feat: integrate RPP classification into entity creation"

---

### Task 4.2: Add Automatic Derivation (16 hours)

**Create:** `src/rpp/AutoDerivation.ts`

**Automatic Upward Derivation:**
```typescript
class AutoDerivation {
  /**
   * Automatically derive parent entities when ratios exceed thresholds
   */
  async checkAndDerive(graph: KnowledgeGraph): Promise<{
    derived: Entity[];
    updated: Entity[];
  }> {
    const validator = new RPPValidator();
    const report = validator.validate(graph);

    const derived: Entity[] = [];

    // If too many L3 entities without L2 parents
    if (report.ratios.l2ToL3.actual > 12) {
      const extractor = new ParetoExtractor();
      const l3Entities = graph.entities.filter(e => e.rppLevel === 3);
      const newConcepts = extractor.extractConcepts(l3Entities);
      derived.push(...newConcepts);
    }

    // If too many L2 without L1
    if (report.ratios.l1ToL2.actual < 2) {
      const l2Entities = graph.entities.filter(e => e.rppLevel === 2);
      const newAtomic = extractor.extractAtomicPrinciples(l2Entities);
      derived.push(...newAtomic);
    }

    return { derived, updated: [] };
  }
}
```

**Commit:** "feat: implement automatic derivation to maintain RPP ratios"

---

### Task 4.3: Small-World Validation (8 hours)

**Extend:** `src/analytics/GraphAnalytics.ts`

**Add RPP-Aware Metrics:**
```typescript
validateSmallWorldWithRPP(graph: KnowledgeGraph): {
  clustering: number; // Target: 0.4-0.6
  pathLength: number; // Target: 3-5
  smallWorldness: number; // Target: >3
  rppCompliant: boolean;
  recommendations: string[];
} {
  const metrics = this.calculateMetrics(graph);

  // Check if RPP structure supports small-world
  // L0/L1 should be hubs (high degree)
  // L2/L3 should be spokes (moderate degree)
  // Cross-level bridges should exist

  return {
    ...metrics,
    rppCompliant: this.validateRPPSmallWorld(graph),
    recommendations: this.suggestBridges(graph)
  };
}
```

**Commit:** "feat: add RPP-aware small-world validation"

---

### Task 4.4: Final Integration Testing (4 hours)

**End-to-End Tests:**
- Create 50 observations
- Extract upward to L0
- Validate all ratios
- Check small-world properties
- Verify generation constraints
- Test bidirectional derivation

**Commit:** "test: comprehensive RPP end-to-end integration tests"

---

## Implementation Notes

### Critical Considerations

**Backward Compatibility:**
- rppLevel is optional (existing entities work without it)
- Can run RPP classification on existing graph
- Non-RPP operations continue working

**Performance:**
- Pareto extraction is expensive (clustering)
- Run as background task or on-demand
- Cache results per graph state

**User Control:**
- RPP classification can be disabled
- Auto-derivation can be opt-in
- Validation is informational, not blocking

### Integration with Existing Features

**Synergies:**
- Entity resolution helps merge similar L2/L3 nodes
- Property taxonomy informs L1 atomic principles
- Community detection identifies clusters for L2 extraction
- Semantic weighting determines what to prune

---

## Success Criteria

**After Implementation:**
- [ ] All entities classified into L0/L1/L2/L3
- [ ] Ratios within ±15% of targets
- [ ] Generation constraint: avg 2-3 children
- [ ] 80% coverage verified at each level
- [ ] Small-world properties maintained
- [ ] Bidirectional derivation converges
- [ ] All existing tests pass
- [ ] 20+ new RPP tests pass
- [ ] Documentation complete

---

## Estimated Complexity

**Development:** 160 hours (4 weeks)
**Testing:** 40 hours (1 week)
**Documentation:** 20 hours
**Total:** 220 hours (~5-6 weeks for complete RPP integration)

**Recommendation:** Implement in phases, validate thoroughly at each step

---

**This plan provides complete specification for RPP integration. A fresh session can start implementation following this guide.**
