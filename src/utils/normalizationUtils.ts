/**
 * Normalization and standardization utilities for relation types and qualifications
 */

// Common synonyms for relation types (map variants to canonical form)
const RELATION_TYPE_SYNONYMS: { [key: string]: string } = {
  // Action types
  'affects': 'influences',
  'impacts': 'influences',
  'changes': 'modulates',
  'alters': 'modulates',
  'controls': 'regulates',
  'governs': 'regulates',
  'blocks': 'inhibits',
  'prevents': 'inhibits',
  'suppresses': 'inhibits',
  'enhances': 'potentiates',
  'amplifies': 'potentiates',
  'boosts': 'potentiates',
  'binds_to': 'binds',
  'interacts_with': 'interacts',
  'connects_to': 'interacts',
};

// Common synonyms for qualifications (map variants to canonical form)
const QUALIFICATION_SYNONYMS: { [key: string]: string } = {
  // Positive effects
  'positive': 'increases',
  'upregulates': 'increases',
  'elevates': 'increases',
  'enhances': 'increases',
  'promotes': 'increases',
  'stimulates': 'increases',
  'activation': 'activates',
  'agonist': 'agonism',
  'agonistic': 'agonism',

  // Negative effects
  'negative': 'decreases',
  'downregulates': 'decreases',
  'reduces': 'decreases',
  'diminishes': 'decreases',
  'inhibition': 'inhibits',
  'antagonist': 'antagonism',
  'antagonistic': 'antagonism',

  // Competitive/non-competitive
  'competitive_inhibition': 'competitive',
  'noncompetitive': 'non-competitive',
  'uncompetitive': 'non-competitive',

  // Direct/indirect
  'directly': 'direct',
  'indirectly': 'indirect',
};

/**
 * Normalize a string: lowercase, trim, replace spaces/dashes with underscores
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Normalize a relation type using synonym mapping
 */
export function normalizeRelationType(relationType: string): string {
  const normalized = normalizeString(relationType);
  return RELATION_TYPE_SYNONYMS[normalized] || normalized;
}

/**
 * Normalize a qualification using synonym mapping
 */
export function normalizeQualification(qualification: string): string {
  const normalized = normalizeString(qualification);
  return QUALIFICATION_SYNONYMS[normalized] || normalized;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity ratio between two strings (0-1, where 1 is identical)
 */
function similarityRatio(a: string, b: string): number {
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1.0;

  const distance = levenshteinDistance(a, b);
  return 1.0 - distance / maxLength;
}

/**
 * Find the most similar string from a list
 */
export function findMostSimilar(
  target: string,
  candidates: string[],
  threshold: number = 0.8
): { match: string | null; similarity: number } {
  if (candidates.length === 0) {
    return { match: null, similarity: 0 };
  }

  const normalizedTarget = normalizeString(target);
  let bestMatch: string | null = null;
  let bestSimilarity = 0;

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeString(candidate);
    const similarity = similarityRatio(normalizedTarget, normalizedCandidate);

    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = candidate;
    }
  }

  // Only return a match if it meets the threshold
  if (bestSimilarity >= threshold) {
    return { match: bestMatch, similarity: bestSimilarity };
  }

  return { match: null, similarity: bestSimilarity };
}

/**
 * Extract all unique relation types from a set of relations
 */
export function extractRelationTypes(relations: Array<{ relationType: string }>): string[] {
  const types = new Set<string>();
  for (const rel of relations) {
    types.add(rel.relationType);
  }
  return Array.from(types).sort();
}

/**
 * Extract all unique qualifications from a set of relations
 */
export function extractQualifications(relations: Array<{ qualification: string }>): string[] {
  const qualifications = new Set<string>();
  for (const rel of relations) {
    qualifications.add(rel.qualification);
  }
  return Array.from(qualifications).sort();
}

/**
 * Validate and normalize a relation, suggesting alternatives if needed
 */
export function validateAndNormalizeRelation(
  relationType: string,
  qualification: string,
  existingTypes: string[],
  existingQualifications: string[]
): {
  normalizedRelationType: string;
  normalizedQualification: string;
  relationTypeSuggestion?: string;
  qualificationSuggestion?: string;
} {
  const normalizedRelationType = normalizeRelationType(relationType);
  const normalizedQualification = normalizeQualification(qualification);

  const result: {
    normalizedRelationType: string;
    normalizedQualification: string;
    relationTypeSuggestion?: string;
    qualificationSuggestion?: string;
  } = {
    normalizedRelationType,
    normalizedQualification,
  };

  // Check if the normalized type matches an existing one closely
  const typeMatch = findMostSimilar(normalizedRelationType, existingTypes, 0.85);
  if (typeMatch.match && typeMatch.match !== normalizedRelationType) {
    result.relationTypeSuggestion = typeMatch.match;
  }

  // Check if the normalized qualification matches an existing one closely
  const qualMatch = findMostSimilar(normalizedQualification, existingQualifications, 0.85);
  if (qualMatch.match && qualMatch.match !== normalizedQualification) {
    result.qualificationSuggestion = qualMatch.match;
  }

  return result;
}
