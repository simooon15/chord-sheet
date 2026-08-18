import catalogueData from "../data/guitar-voicings.json";
import commonOrderData from "../data/chordpro-common-voicing-order.json";
import { noteToSemitone, parseChordSymbol, transposeChordSymbol } from "./chords.mjs";
import type { ChordOnlyEvent, ChordSheetDocument, LyricChord, Voicing } from "./types";

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

interface CommonOrder {
  source: { name: string; version: string; commit: string; license: string };
  tuning: string[];
  positions: Record<string, number[]>;
}

const catalogue = catalogueData as Catalogue;
const commonOrder = commonOrderData as CommonOrder;
export const MAX_COMMON_VOICINGS = 4;
export const MAX_COMMON_BASE_FRET = 5;
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
  return [
    position.b,
    position.f.includes(0) ? 0 : 1,
    position.r.length > 0 ? 1 : 0,
    span,
    muted
  ] as const;
}

function comparePosition(
  catalogueKey: string,
  left: { position: CataloguePosition; index: number },
  right: { position: CataloguePosition; index: number }
) {
  const commonIndexes = commonOrder.positions[catalogueKey] ?? [];
  const commonRank = (index: number) => {
    const rank = commonIndexes.indexOf(index);
    return rank === -1 ? commonIndexes.length + 1 : rank;
  };
  const leftScore = [...scorePosition(left.position), commonRank(left.index), left.index];
  const rightScore = [...scorePosition(right.position), commonRank(right.index), right.index];
  for (let index = 0; index < leftScore.length; index += 1) {
    if (leftScore[index] !== rightScore[index]) return leftScore[index] - rightScore[index];
  }
  return 0;
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
    .filter(({ position }) => position.b <= MAX_COMMON_BASE_FRET)
    .sort((left, right) => comparePosition(catalogueKey, left, right))
    .map(({ position, index }) => toVoicing(symbol, catalogueKey, position, index))
    .filter((voicing, index, all) => all.findIndex((candidate) => voicingFingerprint(candidate) === voicingFingerprint(voicing)) === index)
    .slice(0, MAX_COMMON_VOICINGS);
}

function sameTuning(left: string[], right: string[]) {
  return left.length === right.length && left.every((note, index) => note === right[index]);
}

function normalizedFingers(voicing: Voicing) {
  if (!voicing.fingers || voicing.fingers.every((finger) => !finger)) return [];
  return voicing.fingers.map((finger) => finger ?? 0);
}

export function voicingFingerprint(voicing: Voicing) {
  const barres = (voicing.barres ?? [])
    .map((barre) => ({
      fromString: barre.fromString,
      toString: barre.toString,
      fret: barre.fret,
      finger: barre.finger ?? 0
    }))
    .sort((left, right) => (
      left.fromString - right.fromString
      || left.toString - right.toString
      || left.fret - right.fret
      || left.finger - right.finger
    ));
  return JSON.stringify({
    chordSymbol: voicing.chordSymbol,
    tuning: voicing.tuning,
    frets: voicing.frets,
    fingers: normalizedFingers(voicing),
    baseFret: voicing.baseFret,
    barres
  });
}

export function voicingFeatures(voicing: Voicing) {
  const fretted = voicing.frets.filter((fret): fret is number => typeof fret === "number" && fret > 0);
  return {
    open: voicing.frets.includes(0),
    barre: Boolean(voicing.barres?.length),
    baseFret: voicing.baseFret,
    fretSpan: fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0,
    mutedStringCount: voicing.frets.filter((fret) => fret === null).length
  };
}

function matchingPackageVoicings(document: ChordSheetDocument, displayedSymbol: string) {
  return document.voicings.filter((item) => (
    item.verification.status === "verified"
    && item.chordSymbol === displayedSymbol
    && sameTuning(item.tuning, document.metadata.instrument.tuning)
  ));
}

function uniqueVoicings(voicings: Voicing[]) {
  const fingerprints = new Set<string>();
  return voicings.filter((voicing) => {
    const fingerprint = voicingFingerprint(voicing);
    if (fingerprints.has(fingerprint)) return false;
    fingerprints.add(fingerprint);
    return true;
  });
}

export function resolveVoicings(document: ChordSheetDocument, symbol: string, voicingId?: string) {
  const displayedSymbol = transposeChordSymbol(symbol, document.view.transposeSemitones).symbol;
  const packageVoicings = matchingPackageVoicings(document, displayedSymbol);
  const current = packageVoicings.find((item) => item.id === voicingId);
  const sourceVoicings = packageVoicings.filter((item) => item !== current && !item.id.startsWith("selected-"));
  const builtinVoicings = isStandardTuning(document.metadata.instrument.tuning)
    ? resolveBuiltinVoicings(displayedSymbol)
    : [];
  return uniqueVoicings([
    ...(current ? [current] : []),
    ...sourceVoicings,
    ...builtinVoicings
  ]).slice(0, MAX_COMMON_VOICINGS);
}

export function resolveVoicing(document: ChordSheetDocument, symbol: string, voicingId?: string) {
  return resolveVoicings(document, symbol, voicingId)[0];
}

function withVoicingId<T extends LyricChord | ChordOnlyEvent>(chord: T, voicingId?: string): T {
  if (voicingId) return { ...chord, voicingId };
  const { voicingId: _voicingId, ...rest } = chord;
  return rest as T;
}

function mapChordEvents(document: ChordSheetDocument, baseSymbol: string, voicingId?: string) {
  return {
    ...document,
    sections: document.sections.map((section) => ({
      ...section,
      lines: section.lines.map((line) => {
        if (line.type === "annotation") return line;
        if (line.type === "lyrics") return {
          ...line,
          chords: line.chords.map((chord) => chord.symbol === baseSymbol ? withVoicingId(chord, voicingId) : chord)
        };
        return {
          ...line,
          chords: line.chords.map((chord) => chord.symbol === baseSymbol ? withVoicingId(chord, voicingId) : chord)
        };
      })
    }))
  };
}

function referencedVoicingIds(document: ChordSheetDocument) {
  const references = new Set<string>();
  document.sections.forEach((section) => section.lines.forEach((line) => {
    if (line.type === "annotation") return;
    line.chords.forEach((chord) => {
      if (chord.voicingId) references.add(chord.voicingId);
    });
  }));
  return references;
}

function removeOrphanSelections(document: ChordSheetDocument) {
  const references = referencedVoicingIds(document);
  return {
    ...document,
    voicings: document.voicings.filter((voicing) => !voicing.id.startsWith("selected-") || references.has(voicing.id))
  };
}

function fingerprintHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function selectedVoicingId(document: ChordSheetDocument, fingerprint: string) {
  const base = `selected-${fingerprintHash(fingerprint)}`;
  const ids = new Set(document.voicings.map((voicing) => voicing.id));
  if (!ids.has(base)) return base;
  let suffix = 2;
  while (ids.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function copyVoicing(voicing: Voicing, id: string): Voicing {
  return {
    ...voicing,
    id,
    tuning: [...voicing.tuning],
    frets: [...voicing.frets],
    ...(voicing.fingers ? { fingers: [...voicing.fingers] } : {}),
    ...(voicing.barres ? { barres: voicing.barres.map((barre) => ({ ...barre })) } : {}),
    verification: { ...voicing.verification }
  };
}

export function selectVoicingForChord(
  document: ChordSheetDocument,
  baseSymbol: string,
  candidate: Voicing
): ChordSheetDocument {
  const displayedSymbol = transposeChordSymbol(baseSymbol, document.view.transposeSemitones).symbol;
  if (
    candidate.verification.status !== "verified"
    || candidate.chordSymbol !== displayedSymbol
    || !sameTuning(candidate.tuning, document.metadata.instrument.tuning)
  ) return document;

  const fingerprint = voicingFingerprint(candidate);
  const existing = document.voicings.find((voicing) => voicingFingerprint(voicing) === fingerprint);
  const selected = existing ?? copyVoicing(candidate, selectedVoicingId(document, fingerprint));
  const withVoicing = existing ? document : { ...document, voicings: [...document.voicings, selected] };
  return removeOrphanSelections(mapChordEvents(withVoicing, baseSymbol, selected.id));
}

export function resetVoicingForChord(document: ChordSheetDocument, baseSymbol: string): ChordSheetDocument {
  return removeOrphanSelections(mapChordEvents(document, baseSymbol));
}
