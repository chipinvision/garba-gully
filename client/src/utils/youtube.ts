/**
 * youtube.ts
 * Utilities for validating YouTube playlist URLs and extracting playlist IDs.
 */

/**
 * Extracts a playlist ID from a YouTube playlist URL.
 * Accepts:
 * - https://www.youtube.com/playlist?list=PL...
 * - https://youtube.com/playlist?list=PL...
 * - https://www.youtube.com/watch?v=...&list=PL...
 * - https://youtu.be/...&list=PL...
 * - URLs with additional query params (index, si, feature, etc.)
 *
 * Returns the playlist ID string if valid, or null if invalid.
 */
export function extractPlaylistId(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Check if the input itself is a bare playlist ID (starts with PL, RD, OL, etc.)
  if (/^(PL|RD|OL|FL|UU|LL)[a-zA-Z0-9_-]{10,}$/i.test(trimmed)) {
    return trimmed;
  }

  // 2. Check for list= parameter via Regex
  const listParamMatch = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (listParamMatch && listParamMatch[1] && isValidPlaylistId(listParamMatch[1])) {
    return listParamMatch[1];
  }

  // 3. Try standard URL parsing
  try {
    const urlStr = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(urlStr);
    const listId = url.searchParams.get('list');
    if (listId && isValidPlaylistId(listId)) {
      return listId;
    }
  } catch {
    // URL parsing failed
  }

  return null;
}

/**
 * Validates playlist ID format (alphanumeric, underscores, hyphens, min length 8)
 */
export function isValidPlaylistId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[a-zA-Z0-9_-]{8,64}$/.test(id);
}
