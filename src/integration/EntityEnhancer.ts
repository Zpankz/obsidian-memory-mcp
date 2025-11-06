import { Entity } from '../types.js';
import { UnifiedIndex } from '../index/UnifiedIndex.js';
import { MetadataExtractionPipeline, EnrichedEntity } from '../extraction/MetadataExtractionPipeline.js';

export class EntityEnhancer {
  private unifiedIndex: UnifiedIndex;
  private extractionPipeline: MetadataExtractionPipeline;

  constructor(unifiedIndex: UnifiedIndex) {
    this.unifiedIndex = unifiedIndex;
    this.extractionPipeline = new MetadataExtractionPipeline();
  }

  async enhance(entity: Entity): Promise<EnrichedEntity> {
    // Extract metadata from observations
    const enriched = await this.extractionPipeline.process(entity);

    // TODO: Validate wikilink targets exist
    // TODO: Suggest related entities from vault
    // TODO: Check for similar entity names

    return enriched;
  }

  async enhanceMultiple(entities: Entity[]): Promise<EnrichedEntity[]> {
    const enriched: EnrichedEntity[] = [];

    for (const entity of entities) {
      enriched.push(await this.enhance(entity));
    }

    return enriched;
  }
}
