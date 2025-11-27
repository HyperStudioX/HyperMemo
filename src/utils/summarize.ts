export function summarizeText(text: string, sentenceCount = 3): string {
  if (!text?.trim()) return '';
  const normalized = text
    .replace(/\s+/g, ' ')
    .replace(/([.!?])(?=[^\s])/g, '$1 ')
    .trim();
  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  return sentences.slice(0, sentenceCount).join(' ');
}

export function extractTags(text: string, maxTags = 5): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 4);
  const unique = Array.from(new Set(words));
  return unique.slice(0, maxTags);
}
