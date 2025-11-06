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
