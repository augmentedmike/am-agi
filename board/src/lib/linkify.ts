const WRAPPED_RE = /\[\[(card|project|iteration):([0-9a-f-]{36})\]\]/gi;
const BARE_UUID_RE = /\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/g;

/**
 * Wraps bare UUIDs in text as [[card:UUID]] references.
 * Already-wrapped [[card:UUID]], [[project:UUID]], [[iteration:UUID]] references
 * are preserved as-is — no double-wrapping.
 */
export function linkifyUUIDs(text: string): string {
  // Protect already-wrapped references with placeholders
  const placeholders: string[] = [];
  const protected_ = text.replace(WRAPPED_RE, (match) => {
    const i = placeholders.length;
    placeholders.push(match);
    return `\x00SLOT${i}\x00`;
  });
  // Wrap bare UUIDs
  const linked = protected_.replace(BARE_UUID_RE, (_, uuid) => `[[card:${uuid}]]`);
  // Restore placeholders
  return linked.replace(/\x00SLOT(\d+)\x00/g, (_, i) => placeholders[Number(i)]);
}
