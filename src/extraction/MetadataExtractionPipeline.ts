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

    // NEW: Infer relations from extracted wikilinks
    const suggestedRelations: SuggestedRelation[] = [];

    for (const link of links) {
      // Infer relation type from context
      const relationType = this.inferRelationTypeFromContext(link.context);

      suggestedRelations.push({
        to: link.target,
        relationType: relationType.type,
        qualification: relationType.qualification,
        confidence: link.confidence * relationType.confidence,
        reason: `Mentioned via [[wikilink]]: ${link.context.substring(0, 50)}...`,
        sourceText: link.context
      });
    }

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

  /**
   * Infer relation type from context around wikilink
   */
  private inferRelationTypeFromContext(context: string): {
    type: string;
    qualification: string;
    confidence: number;
  } {
    const contextLower = context.toLowerCase();

    // Pattern matching for common contexts
    if (/\bby\s+\[\[/.test(contextLower)) {
      return { type: 'authored_by', qualification: 'creator', confidence: 0.85 };
    }
    if (/\buses\s+\[\[/.test(contextLower)) {
      return { type: 'uses', qualification: 'applies', confidence: 0.80 };
    }
    if (/\btreats?\s+\[\[/.test(contextLower)) {
      return { type: 'treats', qualification: 'therapeutic', confidence: 0.90 };
    }
    if (/\bdiagnosed\s+with\s+\[\[/.test(contextLower)) {
      return { type: 'diagnosed_with', qualification: 'condition', confidence: 0.90 };
    }
    if (/\bin\s+\[\[/.test(contextLower)) {
      return { type: 'located_in', qualification: 'spatial', confidence: 0.75 };
    }
    if (/\bpublished\s+in\s+\[\[/.test(contextLower)) {
      return { type: 'published_in', qualification: 'venue', confidence: 0.85 };
    }
    if (/\bstudied\s+\[\[|\bresearch.*\[\[/.test(contextLower)) {
      return { type: 'studies', qualification: 'research_topic', confidence: 0.75 };
    }
    if (/\baffects?\s+\[\[/.test(contextLower)) {
      return { type: 'influences', qualification: 'affects', confidence: 0.70 };
    }

    // Default: generic mention
    return { type: 'mentions', qualification: 'referenced_in', confidence: 0.60 };
  }
}
