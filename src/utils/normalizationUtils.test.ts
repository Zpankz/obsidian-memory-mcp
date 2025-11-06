import {
  normalizeString,
  normalizeRelationType,
  normalizeQualification
} from './normalizationUtils.js';

describe('normalizationUtils defensive guards', () => {
  describe('normalizeString', () => {
    it('should handle undefined without crashing', () => {
      expect(() => normalizeString(undefined as any)).not.toThrow();
      expect(normalizeString(undefined as any)).toBe('');
    });

    it('should handle null without crashing', () => {
      expect(() => normalizeString(null as any)).not.toThrow();
      expect(normalizeString(null as any)).toBe('');
    });

    it('should handle empty string', () => {
      expect(normalizeString('')).toBe('');
    });
  });

  describe('normalizeRelationType', () => {
    it('should handle undefined without crashing', () => {
      expect(() => normalizeRelationType(undefined as any)).not.toThrow();
      expect(normalizeRelationType(undefined as any)).toBe('');
    });
  });

  describe('normalizeQualification', () => {
    it('should handle undefined without crashing', () => {
      expect(() => normalizeQualification(undefined as any)).not.toThrow();
      expect(normalizeQualification(undefined as any)).toBe('');
    });
  });
});
