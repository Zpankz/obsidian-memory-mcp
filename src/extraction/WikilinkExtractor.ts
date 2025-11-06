export interface WikilinkMatch {
  target: string;
  context: string;
  confidence: number;
}

export class WikilinkExtractor {
  private wikilinkPattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

  extract(text: string): WikilinkMatch[] {
    const matches: WikilinkMatch[] = [];
    const contextRadius = 50; // characters around link

    let match;
    while ((match = this.wikilinkPattern.exec(text)) !== null) {
      const target = match[1].trim();
      const startPos = Math.max(0, match.index - contextRadius);
      const endPos = Math.min(text.length, match.index + match[0].length + contextRadius);
      const context = text.substring(startPos, endPos).trim();

      matches.push({
        target,
        context,
        confidence: 1.0 // Perfect match for explicit wikilinks
      });
    }

    return matches;
  }
}
