import catalogueData from "../data/guitar-voicings.json";
import { noteToSemitone, parseChordSymbol, transposeChordSymbol } from "./chords.mjs";
import type { ChordSheetDocument, Voicing } from "./types";

interface CataloguePosition {
  f: number[];
  i: number[];
  b: number;
  r: number[];
}

interface Catalogue {
  source: {
    name: string;
    version: string;
    license: string;
    repository: string;
  };
  tuning: string[];
  chords: Record<string, CataloguePosition[]>;
}

const catalogue = catalogueData as Catalogue;
const CATALOGUE_NOTES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const SUFFIX_ALIASES: Record<string, string> = {
  "": "major",
  M: "major",
  maj: "major",
  m: "minor",
  min: "minor",
  "-": "minor",
  min7: "m7",
  "-7": "m7",
  M7: "maj7",
  "Δ7": "maj7",
  "°": "dim",
  "°7": "dim7",
  "+": "aug",
  "+7": "aug7",
  "6/9": "69"
};

function isStandardTuning(tuning: string[]) {
  return tuning.length === catalogue.tuning.length && tuning.every((note, index) => note === catalogue.tuning[index]);
}

function catalogueNote(note: string) {
  const semitone = noteToSemitone(note);
  return semitone === undefined ? undefined : CATALOGUE_NOTES[semitone];
}

function catalogueChordKey(symbol: string) {
  const parsed = parseChordSymbol(symbol);
  if (!parsed) return undefined;

  const root = catalogueNote(parsed.root);
  if (!root) return undefined;

  const normalizedSuffix = parsed.suffix.replaceAll("♯", "#").replaceAll("♭", "b");
  let suffix = SUFFIX_ALIASES[normalizedSuffix] ?? normalizedSuffix;
  if (parsed.bass) {
    const bass = catalogueNote(parsed.bass);
    if (!bass) return undefined;
    suffix = suffix === "major" ? `/${bass}` : suffix === "minor" ? `m/${bass}` : `${suffix}/${bass}`;
  }
  return `${root}:${suffix}`;
}

function barresFor(position: CataloguePosition) {
  return position.r.flatMap((localFret) => {
    const strings = position.f.reduce<number[]>((matches, fret, index) => {
      if (fret === localFret) matches.push(index + 1);
      return matches;
    }, []);
    if (strings.length < 2) return [];
    const finger = position.i[strings[0] - 1];
    return [{
      fromString: strings[0],
      toString: strings.at(-1)!,
      fret: localFret + position.b - 1,
      ...(finger > 0 ? { finger } : {})
    }];
  });
}

function scorePosition(position: CataloguePosition) {
  const fretted = position.f.filter((fret) => fret > 0);
  const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
  const muted = position.f.filter((fret) => fret < 0).length;
  return position.b * 100 + span * 10 + muted;
}

function toVoicing(symbol: string, catalogueKey: string, position: CataloguePosition, index: number): Voicing {
  return {
    id: `builtin:${catalogueKey}:${index}`,
    chordSymbol: symbol,
    tuning: [...catalogue.tuning],
    frets: position.f.map((fret) => fret < 0 ? null : fret === 0 ? 0 : fret + position.b - 1),
    fingers: position.f.map((fret, fretIndex) => fret < 0 ? null : position.i[fretIndex]),
    baseFret: position.b,
    ...(position.r.length ? { barres: barresFor(position) } : {}),
    verification: {
      status: "verified",
      method: "licensedDataset",
      reference: `${catalogue.source.name} v${catalogue.source.version}`,
      license: catalogue.source.license
    }
  };
}

export function resolveBuiltinVoicings(symbol: string) {
  const catalogueKey = catalogueChordKey(symbol);
  if (!catalogueKey) return [];
  const positions = catalogue.chords[catalogueKey];
  if (!positions) return [];
  return positions
    .map((position, index) => ({ position, index }))
    .sort((left, right) => scorePosition(left.position) - scorePosition(right.position))
    .map(({ position, index }) => toVoicing(symbol, catalogueKey, position, index));
}

function packageVoicing(document: ChordSheetDocument, symbol: string, voicingId?: string) {
  return document.voicings.find((item) => item.id === voicingId)
    ?? document.voicings.find((item) => item.chordSymbol === symbol && item.tuning.join("/") === document.metadata.instrument.tuning.join("/"));
}

export function resolveVoicings(document: ChordSheetDocument, symbol: string, voicingId?: string) {
  if (document.view.transposeSemitones === 0) {
    const source = packageVoicing(document, symbol, voicingId);
    if (source) return [source];
  }
  if (!isStandardTuning(document.metadata.instrument.tuning)) return [];
  const displayedSymbol = transposeChordSymbol(symbol, document.view.transposeSemitones).symbol;
  return resolveBuiltinVoicings(displayedSymbol);
}

export function resolveVoicing(document: ChordSheetDocument, symbol: string, voicingId?: string) {
  return resolveVoicings(document, symbol, voicingId)[0];
}
