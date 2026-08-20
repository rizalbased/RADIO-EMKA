/**
 * Utility functions for text formatting and decoding HTML entities.
 */

export function decodeHtmlEntities(text: string | null | undefined): string {
  if (!text) return '';
  if (typeof text !== 'string') return String(text);

  // Fast path if text doesn't contain '&'
  if (!text.includes('&')) return text;

  let result = text;

  // Browser DOM parser approach for complete HTML5 entity support
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const decoded = doc.documentElement.textContent || doc.body.textContent;
      if (decoded) {
        result = decoded;
      }
    } catch {
      // Fallback below
    }
  }

  // Double-pass regex fallback to handle double-encoded or leftover entities (like &#39;, &#039;, &amp;#39;)
  return result
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x2F;/g, '/')
    .replace(/&#47;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

export function cleanSongTitle(title: string | null | undefined): string {
  if (!title) return '';
  const decoded = decodeHtmlEntities(title);
  // Remove unnecessary YouTube suffixes like "(Official Music Video)", "[Official Audio]" if desired, or keep intact
  return decoded.trim();
}
