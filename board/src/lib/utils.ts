/**
 * Truncates a string to `max` characters (inclusive). If the string exceeds
 * `max` characters, it is cut at `max` and an ellipsis (…) is appended.
 *
 * @param title - The string to truncate.
 * @param max   - Maximum character count (default 100).
 * @returns The original string when ≤ max chars, otherwise first `max` chars + "…".
 */
export function truncateTitle(title: string, max = 100): string {
  if (title.length <= max) return title;
  return title.slice(0, max) + '…';
}
