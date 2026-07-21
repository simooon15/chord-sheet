import fixture from "../../output/the-cure-test-run/chordsheet.json";
import type { ChordSheetDocument } from "../domain/types";

export function createDemoDocument(): ChordSheetDocument {
  const document = structuredClone(fixture) as ChordSheetDocument;
  document.documentId = "the-cure-character-anchor-demo";
  document.sources = document.sources.map(({ path: _path, ...source }) => ({ ...source, embedded: false }));
  return document;
}
