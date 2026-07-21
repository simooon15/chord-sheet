const SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const NOTE_TO_SEMITONE = new Map([
  ["C", 0], ["B#", 0], ["C#", 1], ["Db", 1], ["D", 2], ["D#", 3], ["Eb", 3],
  ["E", 4], ["Fb", 4], ["E#", 5], ["F", 5], ["F#", 6], ["Gb", 6], ["G", 7],
  ["G#", 8], ["Ab", 8], ["A", 9], ["A#", 10], ["Bb", 10], ["B", 11], ["Cb", 11]
]);
const NOTE = "[A-G](?:#|b|♯|♭)?";
const ROOT = new RegExp(`^(${NOTE})(.*)$`, "u");
const BASS = new RegExp(`/(${NOTE})$`, "u");

/** @param {string} note */
export function noteToSemitone(note) {
  return NOTE_TO_SEMITONE.get(note.replaceAll("♯", "#").replaceAll("♭", "b"));
}

/** @param {number} semitone @param {"sharp"|"flat"} spelling */
export function semitoneToNote(semitone, spelling) {
  const notes = spelling === "flat" ? FLAT_NOTES : SHARP_NOTES;
  return notes[((semitone % 12) + 12) % 12];
}

/** @param {string} symbol */
export function parseChordSymbol(symbol) {
  const rootMatch = symbol.match(ROOT);
  if (!rootMatch) return null;
  const root = rootMatch[1];
  const rootSemitone = noteToSemitone(root);
  if (rootSemitone === undefined) return null;

  const suffix = rootMatch[2];
  const bassMatch = suffix.match(BASS);
  const bass = bassMatch?.[1];
  const bassSemitone = bass ? noteToSemitone(bass) : undefined;
  if (bass && bassSemitone === undefined) return null;

  return {
    root,
    rootSemitone,
    suffix: bassMatch ? suffix.slice(0, -bassMatch[0].length) : suffix,
    bass,
    bassSemitone
  };
}

/**
 * Transposes only pitch names. Unsupported symbols remain intact so a partial
 * rewrite can never corrupt an original chord label.
 * @param {string} symbol
 * @param {number} semitones
 * @param {"auto"|"sharp"|"flat"} [spelling]
 */
export function transposeChordSymbol(symbol, semitones, spelling = "auto") {
  const parsed = parseChordSymbol(symbol);
  if (!parsed) return { symbol, supported: false };
  const useFlats = spelling === "flat" || (spelling === "auto" && /[b♭]/u.test(`${parsed.root}${parsed.bass ?? ""}`));
  const outputSpelling = useFlats ? "flat" : "sharp";
  const root = semitoneToNote(parsed.rootSemitone + semitones, outputSpelling);
  const bass = parsed.bassSemitone === undefined ? "" : `/${semitoneToNote(parsed.bassSemitone + semitones, outputSpelling)}`;
  return { symbol: `${root}${parsed.suffix}${bass}`, supported: true };
}

/** @param {string | undefined} key */
export function parseKey(key) {
  if (!key) return null;
  const match = key.match(/^([A-G](?:#|b)?)(m)?$/u);
  if (!match) return null;
  const semitone = noteToSemitone(match[1]);
  return semitone === undefined ? null : { semitone, minor: Boolean(match[2]), spelling: match[1].includes("b") ? "flat" : "sharp" };
}

/** @param {string | undefined} key @param {number} semitones @param {"auto"|"sharp"|"flat"} [spelling] */
export function transposeKey(key, semitones, spelling = "auto") {
  const parsed = parseKey(key);
  if (!parsed) return undefined;
  const outputSpelling = spelling === "auto" ? parsed.spelling : spelling;
  return `${semitoneToNote(parsed.semitone + semitones, outputSpelling)}${parsed.minor ? "m" : ""}`;
}

/** @param {string | undefined} writtenKey @param {number} transposeSemitones @param {number} capo @param {"auto"|"sharp"|"flat"} [spelling] */
export function soundingKey(writtenKey, transposeSemitones, capo, spelling = "auto") {
  return transposeKey(writtenKey, transposeSemitones + capo, spelling);
}
