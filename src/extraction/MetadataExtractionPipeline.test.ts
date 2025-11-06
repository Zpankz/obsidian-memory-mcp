import { MetadataExtractionPipeline } from './MetadataExtractionPipeline.js';
import { Entity } from '../types.js';

describe('MetadataExtractionPipeline', () => {
  it('should extract wikilinks from observations', async () => {
    const pipeline = new MetadataExtractionPipeline();

    const entity: Entity = {
      name: 'Test',
      entityType: 'test',
      observations: ['This mentions [[Target]] entity.']
    };

    const result = await pipeline.process(entity);

    expect(result.extractedMetadata.links).toHaveLength(1);
    expect(result.extractedMetadata.links[0].target).toBe('Target');
  });

  it('should extract tags from observations', async () => {
    const pipeline = new MetadataExtractionPipeline();

    const entity: Entity = {
      name: 'Test',
      entityType: 'test',
      observations: ['This has #important tag.']
    };

    const result = await pipeline.process(entity);

    expect(result.extractedMetadata.tags).toContain('important');
  });
});
