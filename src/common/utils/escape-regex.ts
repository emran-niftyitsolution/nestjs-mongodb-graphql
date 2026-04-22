/**
 * Escapes a string for use as a literal in a MongoDB `$regex` pattern
 * (avoids ReDoS / accidental pattern injection from user input).
 */
export function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
