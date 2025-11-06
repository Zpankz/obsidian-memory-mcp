import { Relation } from '../types.js';
import { UnifiedIndex } from '../index/UnifiedIndex.js';
import {
  extractRelationTypes,
  extractQualifications,
  validateAndNormalizeRelation
} from '../utils/normalizationUtils.js';

export interface NormalizedRelation {
  original: Relation;
  normalized: Relation;
  suggestions?: {
    relationType?: string;
    qualification?: string;
  };
}

export class RelationEnhancer {
  private unifiedIndex: UnifiedIndex;

  constructor(unifiedIndex: UnifiedIndex) {
    this.unifiedIndex = unifiedIndex;
  }

  async normalizeAndValidate(relation: Relation): Promise<NormalizedRelation> {
    // Get existing properties from MCP index
    const mcpRelations = await this.unifiedIndex.getRelations(relation.from);
    const existingTypes = extractRelationTypes(mcpRelations);
    const existingQualifications = extractQualifications(mcpRelations);

    // TODO: Also get properties from vault index

    // Validate and normalize
    const validation = validateAndNormalizeRelation(
      relation.relationType,
      relation.qualification,
      existingTypes,
      existingQualifications
    );

    const normalized: Relation = {
      from: relation.from,
      to: relation.to,
      relationType: validation.normalizedRelationType,
      qualification: validation.normalizedQualification
    };

    const result: NormalizedRelation = {
      original: relation,
      normalized
    };

    // Apply suggestions if found
    if (validation.relationTypeSuggestion || validation.qualificationSuggestion) {
      result.suggestions = {};
      if (validation.relationTypeSuggestion) {
        result.suggestions.relationType = validation.relationTypeSuggestion;
        normalized.relationType = validation.relationTypeSuggestion;
      }
      if (validation.qualificationSuggestion) {
        result.suggestions.qualification = validation.qualificationSuggestion;
        normalized.qualification = validation.qualificationSuggestion;
      }
    }

    return result;
  }

  async normalizeAndValidateMultiple(relations: Relation[]): Promise<NormalizedRelation[]> {
    const results: NormalizedRelation[] = [];

    for (const relation of relations) {
      results.push(await this.normalizeAndValidate(relation));
    }

    return results;
  }
}
