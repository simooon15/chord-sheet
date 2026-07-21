const fallbackSegments = (text) => Array.from(text);

/**
 * Splits a lyric into Unicode graphemes. The fallback retains predictable
 * behavior on older engines, while supported browsers use Intl.Segmenter.
 * @param {string} text
 * @returns {string[]}
 */
export function splitGraphemes(text) {
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter("und", { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (item) => item.segment);
  }
  return fallbackSegments(text);
}

/** @param {string} text */
export function graphemeCount(text) {
  return splitGraphemes(text).length;
}
