export type ReviewReason =
  | "positionConflict"
  | "contentConflict"
  | "unclearSource"
  | "inferred"
  | "other";

export interface Review {
  confidence: "high" | "medium" | "low";
  status: "unreviewed" | "confirmed" | "corrected";
  reasons?: ReviewReason[];
  note?: string;
}

export interface LyricChord {
  id: string;
  symbol: string;
  anchor: { graphemeOffset: number };
  voicingId?: string;
  review?: Review;
}

export interface ChordOnlyEvent {
  id: string;
  symbol: string;
  durationBeats?: number;
  voicingId?: string;
  review?: Review;
}

export interface LyricLine {
  id: string;
  type: "lyrics";
  text: string;
  chords: LyricChord[];
  review?: Review;
}

export interface ChordLine {
  id: string;
  type: "chords";
  chords: ChordOnlyEvent[];
  review?: Review;
}

export interface AnnotationLine {
  id: string;
  type: "annotation";
  text: string;
  review?: Review;
}

export type ScoreLine = LyricLine | ChordLine | AnnotationLine;

export interface Section {
  id: string;
  type: string;
  label: string;
  repeat?: number;
  rhythmPatternId?: string;
  review?: Review;
  lines: ScoreLine[];
}

export interface Voicing {
  id: string;
  chordSymbol: string;
  tuning: string[];
  frets: Array<number | null>;
  fingers?: Array<number | null>;
  baseFret: number;
  barres?: Array<{ fromString: number; toString: number; fret: number; finger?: number }>;
  verification: {
    status: "verified";
    method: "sourceDiagram" | "licensedDataset" | "manual";
    reference: string;
    license?: string;
    checkedAt?: string;
  };
}

export interface SourceRecord {
  id: string;
  kind: "copiedText" | "image" | "pdf";
  role: "content" | "layout" | "both";
  originalName?: string;
  mimeType?: string;
  pageCount?: number;
  embedded: boolean;
  path?: string;
  sha256?: string;
}

export interface ChordSheetDocument {
  format: "chordsheet";
  formatVersion: "1.0.0";
  documentId: string;
  createdAt?: string;
  updatedAt?: string;
  generator?: { name: string; version?: string };
  metadata: {
    title: string;
    artist?: string;
    language?: string;
    difficulty?: string;
    baseWrittenKey?: string;
    instrument: { type: "guitar"; tuning: string[] };
  };
  view: {
    transposeSemitones: number;
    capo: number;
    fontScale: number;
    chordDisplay: "name" | "nameAndDiagram";
  };
  sources: SourceRecord[];
  sections: Section[];
  voicings: Voicing[];
  rhythm?: {
    timeSignature?: { beatsPerMeasure: number; beatUnit: number };
    tempoBpm?: number;
    patterns?: Array<{
      id: string;
      label: string;
      stepsPerMeasure: number;
      events: Array<{ slot: number; stroke: string; accent?: boolean }>;
    }>;
  };
}

export interface ValidationIssue {
  code: "SCHEMA_INVALID" | "SEMANTIC_INVALID";
  path: string;
  message: string;
}
