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
