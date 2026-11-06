/** Daily tokens read A1..A99, then B1..B99, so they stay short enough to shout across a counter. */
export function formatToken(seq: number): string {
  if (!Number.isInteger(seq) || seq < 1) throw new Error("token sequence starts at 1");
  const block = Math.floor((seq - 1) / 99);
  const letter = String.fromCharCode(65 + (block % 26));
  return `${letter}${((seq - 1) % 99) + 1}`;
}

/** "a 23", "A23 " -> "A23". */
export function normaliseToken(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}
