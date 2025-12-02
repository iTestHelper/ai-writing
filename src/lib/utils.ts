export function cn(...inputs: Array<string | undefined | false | null>) {
  return inputs.filter(Boolean).join(" ");
}

/**
 * Counts the number of words in a text string.
 * Words are defined as sequences of characters separated by whitespace.
 * Empty strings and strings with only whitespace return 0.
 */
export function countWords(text: string): number {
  if (!text || typeof text !== "string") return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}
