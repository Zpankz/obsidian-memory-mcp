import { GraphAnalytics } from './GraphAnalytics.js';
import { Entity, Relation } from '../types.js';

describe('GraphAnalytics', () => {
  it('should compute centrality metrics', () => {
    const entities: Entity[] = [
      { name: 'A', entityType: 'test', observations: [] },
      { name: 'B', entityType: 'test', observations: [] },
      { name: 'C', entityType: 'test', observations: [] }
    ];

    const relations: Relation[] = [
      { from: 'A', to: 'B', relationType: 'links', qualification: 'to' },
      { from: 'B', to: 'C', relationType: 'links', qualification: 'to' }
    ];

    const analytics = new GraphAnalytics();
    const report = analytics.computeCentrality(entities, relations);

    expect(report.metrics.size).toBe(3);
    expect(report.topEntities.length).toBeGreaterThan(0);
  });

  it('should find shortest path', () => {
    const relations: Relation[] = [
      { from: 'A', to: 'B', relationType: 'links', qualification: 'to' },
      { from: 'B', to: 'C', relationType: 'links', qualification: 'to' }
    ];

    const analytics = new GraphAnalytics();
    const path = analytics.findPath('A', 'C', relations);

    expect(path).not.toBeNull();
    expect(path!.entities).toEqual(['A', 'B', 'C']);
    expect(path!.length).toBe(2);
  });

  it('should predict links based on common neighbors', () => {
    const entities: Entity[] = [
      { name: 'A', entityType: 'test', observations: [] },
      { name: 'B', entityType: 'test', observations: [] },
      { name: 'C', entityType: 'test', observations: [] },
      { name: 'D', entityType: 'test', observations: [] }
    ];

    const relations: Relation[] = [
      { from: 'A', to: 'B', relationType: 'links', qualification: 'to' },
      { from: 'C', to: 'B', relationType: 'links', qualification: 'to' }
    ];

    const analytics = new GraphAnalytics();
    const predictions = analytics.predictLinks('A', entities, relations, 5);

    // Should predict A -> C (common neighbor: B)
    const predictedC = predictions.find(p => p.to === 'C');
    expect(predictedC).toBeDefined();
    expect(predictedC!.sharedNeighbors).toContain('B');
  });
});
