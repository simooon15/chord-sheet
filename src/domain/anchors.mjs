import { splitGraphemes } from "./graphemes.mjs";

/** @param {string} before @param {string} after */
export function findGraphemeChange(before, after) {
  const oldParts = splitGraphemes(before);
  const newParts = splitGraphemes(after);
  let start = 0;
  while (start < oldParts.length && start < newParts.length && oldParts[start] === newParts[start]) start += 1;

  let oldEnd = oldParts.length;
  let newEnd = newParts.length;
  while (oldEnd > start && newEnd > start && oldParts[oldEnd - 1] === newParts[newEnd - 1]) {
    oldEnd -= 1;
    newEnd -= 1;
  }
  return { start, oldEnd, newEnd, delta: newEnd - oldEnd };
}

/** @param {unknown} review */
function positionConflictReview(review) {
  const previous = review && typeof review === "object" ? review : {};
  const previousReasons = Array.isArray(previous.reasons) ? previous.reasons : [];
  return {
    ...previous,
    confidence: "low",
    status: "unreviewed",
    reasons: [...new Set([...previousReasons, "positionConflict"])]
  };
}

/**
 * Updates lyric anchors after one controlled-text edit. Chords inside the
 * replaced range collapse to the edit start and are marked for review.
 * @param {Array<any>} chords
 * @param {string} before
 * @param {string} after
 */
export function transformAnchorsAfterTextEdit(chords, before, after) {
  const change = findGraphemeChange(before, after);
  if (change.start === change.oldEnd && change.start === change.newEnd) return chords;
  return chords.map((chord) => {
    const offset = chord.anchor.graphemeOffset;
    if (offset < change.start) return chord;
    if (offset > change.oldEnd) {
      return { ...chord, anchor: { ...chord.anchor, graphemeOffset: offset + change.delta } };
    }
    return {
      ...chord,
      anchor: { ...chord.anchor, graphemeOffset: change.start },
      review: positionConflictReview(chord.review)
    };
  });
}

/** @param {any} chord @param {number} graphemeOffset */
export function moveChordAnchor(chord, graphemeOffset) {
  const priorReasons = chord.review?.reasons ?? [];
  return {
    ...chord,
    anchor: { ...chord.anchor, graphemeOffset },
    review: {
      ...chord.review,
      confidence: chord.review?.confidence === "low" ? "medium" : chord.review?.confidence ?? "high",
      status: "corrected",
      ...(priorReasons.length ? { reasons: priorReasons } : {})
    }
  };
}
