import Dexie, { type Table } from "dexie";
import type { ChordSheetDocument } from "../domain/types";

interface StoredSong {
  documentId: string;
  title: string;
  artist?: string;
  updatedAt: string;
  document: ChordSheetDocument;
  sources: Record<string, ArrayBuffer>;
}

class ChordSheetDatabase extends Dexie {
  songs!: Table<StoredSong, string>;

  constructor() {
    super("chordsheet-v1");
    this.version(1).stores({ songs: "documentId, title, updatedAt" });
  }
}

const database = new ChordSheetDatabase();

const copySources = (sources: Map<string, Uint8Array>) => Object.fromEntries(
  Array.from(sources, ([path, bytes]) => [path, bytes.slice().buffer])
);

export async function listSongs() {
  return database.songs.orderBy("updatedAt").reverse().toArray();
}

export async function loadSong(documentId: string) {
  const stored = await database.songs.get(documentId);
  if (!stored) return undefined;
  return {
    document: stored.document,
    sources: new Map(Object.entries(stored.sources).map(([path, buffer]) => [path, new Uint8Array(buffer)]))
  };
}

export async function saveSong(document: ChordSheetDocument, sources: Map<string, Uint8Array>) {
  await database.songs.put({
    documentId: document.documentId,
    title: document.metadata.title,
    artist: document.metadata.artist,
    updatedAt: new Date().toISOString(),
    document,
    sources: copySources(sources)
  });
}

export async function removeSong(documentId: string) {
  await database.songs.delete(documentId);
}
