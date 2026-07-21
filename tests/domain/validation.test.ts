import { describe, expect, it } from "vitest";
import fixture from "../../output/the-cure-test-run/chordsheet.json";
import type { ChordSheetDocument } from "../../src/domain/types";
import { validateChordSheet } from "../../src/domain/validation.mjs";

describe("谱包合同校验", () => {
  it("接受 The Cure 字符锚定基准谱", () => {
    expect(validateChordSheet(fixture)).toEqual([]);
  });

  it("拒绝重复歌词锚点", () => {
    const invalid = structuredClone(fixture) as unknown as ChordSheetDocument;
    const lyricLine = invalid.sections[1].lines[0];
    if (lyricLine.type !== "lyrics") throw new Error("The Cure 基准谱应包含歌词行");
    lyricLine.chords[1].anchor.graphemeOffset = 0;
    expect(validateChordSheet(invalid)).toContainEqual(expect.objectContaining({ path: "/sections/1/lines/0/chords/1/anchor/graphemeOffset" }));
  });
});
