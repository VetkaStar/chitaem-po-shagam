/** Preserve the UTF-16 offsets used by the source contract, including repeated characters. */
export function textPositions(text: string) {
  let offset = 0;
  return Array.from(text, (character) => {
    const start = offset;
    offset += character.length;
    return { text: character, start, end: offset };
  });
}
