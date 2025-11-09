import { Entity } from '../types.js';
import { UnifiedIndex } from '../index/UnifiedIndex.js';
import { MetadataExtractionPipeline, EnrichedEntity } from '../extraction/MetadataExtractionPipeline.js';
import { YAMLObservationParser, ParsedProperty } from '../structuring/YAMLObservationParser.js';
import { AtomicEntityExtractor, AtomicCandidate } from '../structuring/AtomicEntityExtractor.js';

export interface AtomicDecompositionResult {
  coreEntity: Entity;
  atomicEntities: Entity[];
  yamlProperties: any;
  atomicCandidates: AtomicCandidate[];
}

export interface EnhancedEntityWithAtomic extends EnrichedEntity {
  atomicDecomposition?: AtomicDecompositionResult;
}

export class EntityEnhancer {
  private unifiedIndex: UnifiedIndex;
  private extractionPipeline: MetadataExtractionPipeline;
  private yamlParser: YAMLObservationParser;
  private atomicExtractor: AtomicEntityExtractor;

  constructor(unifiedIndex: UnifiedIndex) {
    this.unifiedIndex = unifiedIndex;
    this.extractionPipeline = new MetadataExtractionPipeline();
    this.yamlParser = new YAMLObservationParser();
    this.atomicExtractor = new AtomicEntityExtractor();
  }

  async enhance(entity: Entity, options?: { enableAtomicDecomposition?: boolean }): Promise<EnhancedEntityWithAtomic> {
    // Extract metadata from observations (existing)
    const enriched = await this.extractionPipeline.process(entity);

    // NEW: Atomic decomposition
    if (options?.enableAtomicDecomposition && entity.observations.length > 0) {
      const decomposition = await this.performAtomicDecomposition(entity);
      (enriched as EnhancedEntityWithAtomic).atomicDecomposition = decomposition;
    }

    return enriched as EnhancedEntityWithAtomic;
  }

  async performAtomicDecomposition(entity: Entity): Promise<AtomicDecompositionResult> {
    // Step 1: Parse observations into YAML properties
    const allProperties: ParsedProperty[] = [];

    for (const observation of entity.observations) {
      const props = this.yamlParser.parseObservation(observation);
      allProperties.push(...props);
    }

    // Step 2: Build YAML structure
    const yamlProperties = this.yamlParser.buildYAMLStructure(allProperties);

    // Step 3: Extract atomic entity candidates
    const atomicCandidates = this.atomicExtractor.extractAtomicEntities(allProperties, entity);

    // Step 4: Create atomic entities (filter out existing ones)
    const atomicEntities: Entity[] = [];

    for (const candidate of atomicCandidates) {
      // Check if entity already exists
      const existing = await this.unifiedIndex.getEntity(candidate.name);

      if (!existing) {
        const atomic = await this.atomicExtractor.createAtomicEntity(candidate, entity);
        atomicEntities.push(atomic);
      }
    }

    // Step 5: Create core entity with YAML properties
    const coreEntity: Entity = {
      ...entity,
      observations: [], // Observations converted to YAML
      metadata: {
        ...entity.metadata,
        structuredYAML: true,
        yamlProperties
      }
    };

    return {
      coreEntity,
      atomicEntities,
      yamlProperties,
      atomicCandidates
    };
  }

  async enhanceMultiple(entities: Entity[], options?: { enableAtomicDecomposition?: boolean }): Promise<EnhancedEntityWithAtomic[]> {
    const enriched: EnhancedEntityWithAtomic[] = [];

    for (const entity of entities) {
      enriched.push(await this.enhance(entity, options));
    }

    return enriched;
  }
}

