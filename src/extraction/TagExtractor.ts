export class TagExtractor {
  private tagPattern = /#([a-zA-Z0-9_/-]+)/g;

  extract(text: string): string[] {
    const tags: Set<string> = new Set();

    let match;
    while ((match = this.tagPattern.exec(text)) !== null) {
      const tag = this.normalizeTag(match[1]);
      tags.add(tag);
    }

    return Array.from(tags).sort();
  }

  private normalizeTag(tag: string): string {
    return tag
      .toLowerCase()
      .replace(/\//g, '_')
      .replace(/-/g, '_')
      .replace(/_+/g, '_');
  }
}
