import { WikilinkExtractor } from './WikilinkExtractor.js';

describe('WikilinkExtractor', () => {
  it('should extract simple wikilinks', () => {
    const extractor = new WikilinkExtractor();
    const text = 'This mentions [[Target Entity]] in the text.';

    const links = extractor.extract(text);

    expect(links).toHaveLength(1);
    expect(links[0].target).toBe('Target Entity');
  });

  it('should extract wikilinks with aliases', () => {
    const extractor = new WikilinkExtractor();
    const text = 'This mentions [[Target|alias]] in the text.';

    const links = extractor.extract(text);

    expect(links).toHaveLength(1);
    expect(links[0].target).toBe('Target');
  });

  it('should extract multiple wikilinks', () => {
    const extractor = new WikilinkExtractor();
    const text = 'Mentions [[First]] and [[Second]] and [[Third]].';

    const links = extractor.extract(text);

    expect(links).toHaveLength(3);
    expect(links.map(l => l.target)).toEqual(['First', 'Second', 'Third']);
  });
});
