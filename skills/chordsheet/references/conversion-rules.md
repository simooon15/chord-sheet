# ChordSheet conversion rules

## Package contract

The authoritative contract is `../assets/chordsheet.schema.json`. A package is a ZIP whose root contains exactly one `chordsheet.json`; embedded originals are stored under `sources/`. Package data uses UTF-8 JSON and `formatVersion: "1.0.0"`.

When packaging in the ChordSheet project, use its validator before and after ZIP creation. It checks field schema, global ID uniqueness, source and voicing references, grapheme-anchor ordering and bounds, rhythm consistency, package paths, and source presence.

## Alignment and review

For a lyrics line, `graphemeOffset: 0` is immediately before its first grapheme, and the total grapheme count is the end boundary. Events must be stored in ascending anchor order; two events cannot share an anchor. A visual chord above a word goes before the grapheme where that word begins, not after its preceding whitespace unless the source clearly places it there.

### Required character-level anchoring procedure

For a PDF render or image, treat the left edge of the chord's root letter as an alignment marker. It must be mapped to one exact grapheme boundary in the lyric line; do not first reduce the position to a word, a whitespace run, or a visual column.

1. Establish the canonical lyric text for the visual line. Use copied text for spelling when available; otherwise transcribe the visual lyric line. Split it into Unicode graphemes.
2. Read the visual lyric line character by character and map each visible glyph to its canonical grapheme index. This preserves a chord change inside a word, including Chinese characters, combining marks, and emoji.
3. For each chord above that lyric line, locate the glyph whose left edge is aligned with the chord root letter's left edge. Persist the boundary immediately before that glyph as `anchor.graphemeOffset`.
4. If the root letter falls visually between two lyric glyphs, choose the boundary visually closest to its left edge and record `review.confidence: "medium"` with `unclearSource`. If it lands in whitespace, use the boundary at that exact whitespace position rather than snapping to the next word.
5. Check every anchor against the original visual line after converting it. A chord may be `high` / `confirmed` only when its root-letter-to-glyph pairing was directly checked. Do not promote an inferred word-level placement to high confidence.

Example: if an `Am` chord's `A` is vertically aligned with the `a` in `Heart`, the anchor is the boundary before that `a` (`Heart` → offset `2`), not the start of `Heart` (`0`) and not the preceding space. The stored value is the grapheme offset; the image coordinate remains optional evidence only.

When several lyric words or chords are close together, make the mapping one chord at a time. Preserve the source's intended character-level relationship even when the generated score uses a different font, size, screen width, or line wrap.

For plain text that contains a chord line above a lyric line, perform the same mapping before trimming or normalizing whitespace: use the first character of each chord token and the lyric character in the same source column to choose the grapheme boundary. If copied text has already lost that layout, it cannot prove a character-level position; infer the most likely boundary and mark the event `low` / `unreviewed` with `inferred` rather than pretending that word-level alignment is confirmed.

Use review states deliberately:

| Situation | Required review data |
|---|---|
| Text and visual source agree | `high` / `confirmed` when directly checked |
| Likely but not fully checked | `medium` / `unreviewed` with a useful note when needed |
| Conflict, blurred location, or inference | `low` / `unreviewed` plus `positionConflict`, `contentConflict`, `unclearSource`, `inferred`, or `other` |
| A user has manually corrected it | `corrected`; use `high` or `medium` confidence according to evidence |

For image/PDF-derived lyrics, a whole line is not ready for `confirmed` status until every chord in it has passed the character-level anchoring check above. Mark only the ambiguous events for review; do not shift neighbouring confirmed events to make an uncertain one fit.

The renderer’s review indicator is intentionally quiet. It is a review queue, not a visible warning on every line.

## Sources and evidence

`copiedText` normally carries exact lyric/chord content. `image` and `pdf` normally carry layout. Use `evidence` on uncertain or important chord events when it helps trace a decision: identify the source, optional PDF page, and an optional normalized `region` (`x`, `y`, `width`, `height`, each 0–1). Regions document evidence; they never replace anchors.

If an original is not embedded, keep its manifest record with `embedded: false` and omit `path`. If it is embedded, use a safe relative `sources/` path and, where practical, provide a SHA-256 digest.

## Keys, transposition, and Capo

The reading tool transposes at display time. Emit chord symbols in the untransposed corrected base score. It changes only a leading root and a final `/Note` bass; it must preserve suffixes such as `m`, `maj7`, `sus2`, parentheses, extensions, and `C6/9`.

Capo is a manual reader setting. Do not recommend or calculate a capo. If the written key is known, the reader derives the sounding key from written key + display transposition + capo.

## Guitar diagrams

For each verified voicing, `tuning`, `frets`, and optional `fingers` use the same lowest-string-to-highest-string order. `null` means muted, `0` open, and positive numbers are absolute frets. A source-derived diagram should identify the source page or diagram in `verification.reference` and use `method: "sourceDiagram"`.

Never convert a diagram’s appearance into guessed fret data. If string/fret positions cannot be read accurately, leave the voicing out and mention it in the conversion note. After a chord is transposed, do not reuse a base-score shape unless an independently verified voicing exists for the displayed chord.
