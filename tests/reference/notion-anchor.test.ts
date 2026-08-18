import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import fixture from "../../output/notion-the-rare-occasions.chordsheet.json";
import { splitGraphemes } from "../../src/domain/graphemes.mjs";
import { validateChordSheet } from "../../src/domain/validation.mjs";
import { createChordSheetArchive, importChordSheet } from "../../src/package/archive.mjs";
import type { ChordSheetDocument, LyricLine } from "../../src/domain/types";

const document = fixture as ChordSheetDocument;

function lyricLines() {
  return document.sections.flatMap((section) => section.lines.filter((line): line is LyricLine => line.type === "lyrics"));
}

describe("Notion 字符锚点回归谱", () => {
  it("保留 A→r(53) 和 Faug→s(55)，不吸附到单词开头", () => {
    const line = lyricLines().find((candidate) => candidate.text === "For I have seen the ending and there is no ascending rise");
    expect(line).toBeDefined();
    const graphemes = splitGraphemes(line!.text);
    const a = line!.chords.find((chord) => chord.symbol === "A");
    const faug = line!.chords.find((chord) => chord.symbol === "Faug");
    expect(a?.anchor.graphemeOffset).toBe(53);
    expect(faug?.anchor.graphemeOffset).toBe(55);
    expect(graphemes[a!.anchor.graphemeOffset]).toBe("r");
    expect(graphemes[faug!.anchor.graphemeOffset]).toBe("s");
    expect(a?.anchor.graphemeOffset).not.toBe(43);
    expect(faug?.anchor.graphemeOffset).not.toBe(53);
  });

  it("保留锚定所需空白、事件数量并通过共享校验", () => {
    const lines = lyricLines();
    expect(lines.filter((line) => /^\s/u.test(line.text))).toHaveLength(5);
    expect(lines.filter((line) => /\s$/u.test(line.text))).toHaveLength(1);
    expect(lines.reduce((count, line) => count + line.chords.length, 0)).toBe(59);
    expect(document.sections.flatMap((section) => section.lines)
      .filter((line) => line.type === "chords")
      .reduce((count, line) => count + line.chords.length, 0)).toBe(16);
    expect(validateChordSheet(document)).toEqual([]);
  });

  it("JSON 和已交付谱包均可无损导入，重新打包后保持内容", async () => {
    const archivedBytes = new Uint8Array(await readFile(resolve("output/notion-the-rare-occasions.chordsheet")));
    const archived = await importChordSheet(archivedBytes);
    expect(archived.document).toEqual(document);
    const repacked = await importChordSheet(createChordSheetArchive(document));
    expect(repacked.document).toEqual(document);
  });
});
