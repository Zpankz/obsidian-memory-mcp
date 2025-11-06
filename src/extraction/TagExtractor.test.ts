import { TagExtractor } from './TagExtractor.js';

describe('TagExtractor', () => {
  it('should extract simple tags', () => {
    const extractor = new TagExtractor();
    const text = 'This has #important and #urgent tags.';

    const tags = extractor.extract(text);

    expect(tags).toContain('important');
    expect(tags).toContain('urgent');
  });

  it('should extract nested tags', () => {
    const extractor = new TagExtractor();
    const text = 'Uses #category/subcategory/specific tag.';

    const tags = extractor.extract(text);

    expect(tags).toContain('category_subcategory_specific');
  });

  it('should normalize tags to lowercase with underscores', () => {
    const extractor = new TagExtractor();
    const text = '#MyTag and #Another-Tag';

    const tags = extractor.extract(text);

    expect(tags).toContain('mytag');
    expect(tags).toContain('another_tag');
  });
});
