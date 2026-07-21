---
name: chordsheet
description: Convert supplied chord-and-lyric text, score screenshots, and/or a correctly laid-out PDF into one validated, editable ChordSheet `.chordsheet` package. Use when a user wants clean playable guitar lead sheets with recoverable lyric-to-chord alignment, manual downstream editing, transposition, and only traceable guitar diagrams.
---

# ChordSheet Builder

Create a portable ChordSheet package from one or more source materials. The local ChordSheet reader is deliberately not an OCR or PDF viewer: this skill is the conversion layer.

## Required input handling

Accept every supplied source together. Do not discard a source type because another one is available.

- Copied text is the primary evidence for lyric and chord content.
- Screenshots are the primary evidence for visual chord-to-lyric positions and sections.
- If no screenshot provides a position, render the supplied PDF visually and use the rendered page as the position reference. Do not infer layout from PDF text extraction alone.
- If sources conflict or a placement is unclear, choose the most likely alignment and mark that chord event `review.confidence: "low"`, `review.status: "unreviewed"`, with one or more applicable reasons. Never omit the uncertain chord merely to make the output look clean.

Before producing a package, ask for a song title and guitar tuning only when they are absent from every source. Ask whether original materials should be embedded in the package when the user has not chosen. Do not silently assume standard tuning or embed sources without this choice.

## Workflow

1. Inventory sources and assign each a `kind` plus `role`: copied text normally supplies `content`; screenshots/PDF normally supply `layout`; a source can be `both`.
2. Establish song sections and lyrics from text, then map every visual chord to the exact lyric grapheme directly under its root-letter start before writing its anchor. Count graphemes, not JavaScript string length or visual columns. Follow the required character-level procedure in [references/conversion-rules.md](references/conversion-rules.md); never snap a chord to a word start or whitespace merely because it is easier to read.
3. Resolve visual layout in priority order: screenshot first, rendered PDF second. Preserve exact copied lyric spelling where it conflicts with OCR-like reading of an image.
4. Build `chordsheet.json` against [assets/chordsheet.schema.json](assets/chordsheet.schema.json). Consult [references/conversion-rules.md](references/conversion-rules.md) for anchoring, review, transposition, source, and diagram rules.
5. Add a voicing only when it is visually confirmed in a supplied source diagram or comes from a clearly licensed, recorded dataset. Use `verification.status: "verified"`, state the method and reference, and retain arrays in lowest-string to highest-string order. Never invent a fingering from memory. Missing verified data is represented by omitting the voicing; the reader will show `暂无指法`.
6. Preserve structured rhythm metadata when present, including time signature, tempo, and patterns. Do not fabricate rhythm when the source has none.
7. Validate the JSON and package it as a non-encrypted ZIP with root `chordsheet.json` and optional `sources/` files. In a ChordSheet repository, run:

   ```sh
   node scripts/validate-chordsheet.mjs path/to/chordsheet.json
   node scripts/package-chordsheet.mjs path/to/chordsheet.json --source sources/original.pdf=path/to/original.pdf --output path/to/song.chordsheet
   node scripts/validate-chordsheet.mjs path/to/song.chordsheet
   ```

   Include one `--source` option for every source declared `embedded: true`; use none when the user chose not to embed materials.
8. Deliver the `.chordsheet` file and a concise conversion note: source evidence used, number of low-confidence positions, whether originals were embedded, and any unavailable diagrams. Do not claim that a score is fully confirmed if it contains low-confidence events.

## Non-negotiable format behavior

- Store corrected base chord symbols in `symbol`; do not pre-apply a requested display transposition.
- `metadata.baseWrittenKey` is the written chord key, not the sounding key. A song with C shapes and capo 1 has base written key `C`, not `Db`.
- Preserve root, suffix, and eligible final slash bass accurately. `C6/9` is not a slash-bass chord.
- Keep all provided sources in the source manifest, even if the user chose not to embed their bytes.
- Never use image coordinates as the persisted alignment model. Use them only to determine the corresponding lyric grapheme during conversion; playable placement is always `anchor.graphemeOffset`.
- Do not produce a raw PDF/image “viewer package.” The deliverable is recreated structured score data.
