/**
 * Cleans up malformed markdown content from web scraping
 * Handles issues like broken links, orphaned patterns, and social media noise
 */
export function cleanMarkdownContent(markdown: string, baseUrl?: string): string {
    if (!markdown) return '';

    // Parse base URL for resolving relative links
    let origin = '';
    if (baseUrl) {
        try {
            const urlObj = new URL(baseUrl);
            origin = urlObj.origin;
        } catch {
            // If URL parsing fails, just use empty origin
        }
    }

    let cleaned = markdown;

    // Fix relative links: [text](/path) -> [text](https://domain.com/path)
    if (origin) {
        cleaned = cleaned.replace(/\]\(\/([^)]+)\)/g, `](${origin}/$1)`);
    }

    // Remove orphaned link patterns like "](/path)" at the start of a line or after whitespace
    cleaned = cleaned.replace(/(?:^|\s)\]\([^)]*\)/gm, '');

    // Remove empty links: [](url) or []()
    cleaned = cleaned.replace(/\[\]\([^)]*\)/g, '');

    // Remove broken image references with empty alt text
    cleaned = cleaned.replace(/!\[\]\([^)]*\)/g, '');

    // Remove standalone bracket patterns that look broken
    cleaned = cleaned.replace(/^\[$/gm, '');
    cleaned = cleaned.replace(/^\]$/gm, '');

    // Clean up multiple consecutive newlines (more than 2)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Remove lines that are just numbers (like engagement counts: "60", "437", "2K")
    cleaned = cleaned.replace(/^[\d,.]+[KMB]?$/gm, '');

    // Remove lines that look like social media metrics (e.g., "774K775K")
    cleaned = cleaned.replace(/^[\d,.]+[KMB]?[\d,.]+[KMB]?$/gm, '');

    // Clean up resulting empty lines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Trim whitespace
    cleaned = cleaned.trim();

    return cleaned;
}

/**
 * Converts markdown to plain readable text
 * Strips all formatting, links, images, etc. for a clean reading experience
 */
export function markdownToPlainText(markdown: string): string {
    if (!markdown) return '';

    let text = markdown;

    // Remove images: ![alt](url) -> nothing
    text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');

    // Convert links to just the text: [text](url) -> text
    text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

    // Remove reference-style links: [text][ref] -> text
    text = text.replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1');

    // Remove link definitions: [ref]: url
    text = text.replace(/^\[[^\]]*\]:\s*.*$/gm, '');

    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, '');

    // Convert headers to plain text (remove # symbols)
    text = text.replace(/^#{1,6}\s+/gm, '');

    // Remove bold/italic markers
    text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '$1'); // ***bold italic***
    text = text.replace(/\*\*([^*]+)\*\*/g, '$1');     // **bold**
    text = text.replace(/\*([^*]+)\*/g, '$1');         // *italic*
    text = text.replace(/___([^_]+)___/g, '$1');       // ___bold italic___
    text = text.replace(/__([^_]+)__/g, '$1');         // __bold__
    text = text.replace(/_([^_]+)_/g, '$1');           // _italic_

    // Remove strikethrough
    text = text.replace(/~~([^~]+)~~/g, '$1');

    // Remove inline code backticks
    text = text.replace(/`([^`]+)`/g, '$1');

    // Remove code blocks (fenced)
    text = text.replace(/```[\s\S]*?```/g, '');

    // Remove code blocks (indented) - lines starting with 4 spaces or tab
    text = text.replace(/^(?: {4}|\t).*$/gm, '');

    // Remove blockquote markers
    text = text.replace(/^>\s?/gm, '');

    // Remove horizontal rules
    text = text.replace(/^[-*_]{3,}$/gm, '');

    // Remove list markers (unordered)
    text = text.replace(/^[\s]*[-*+]\s+/gm, '');

    // Remove list markers (ordered)
    text = text.replace(/^[\s]*\d+\.\s+/gm, '');

    // Remove orphaned brackets and parentheses
    text = text.replace(/\[\]/g, '');
    text = text.replace(/\(\)/g, '');

    // Remove lines that are just numbers (social media metrics)
    text = text.replace(/^[\d,.]+[KMB]?$/gm, '');
    text = text.replace(/^[\d,.]+[KMB]?[\d,.]+[KMB]?$/gm, '');

    // Clean up multiple spaces
    text = text.replace(/ {2,}/g, ' ');

    // Clean up multiple newlines
    text = text.replace(/\n{3,}/g, '\n\n');

    // Trim each line
    text = text.split('\n').map(line => line.trim()).join('\n');

    // Remove empty lines at start/end
    text = text.trim();

    return text;
}
