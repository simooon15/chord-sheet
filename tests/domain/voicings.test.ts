import { describe, expect, it } from "vitest";
import cureFixture from "../../output/the-cure-test-run/chordsheet.json";
import type { ChordOnlyEvent, ChordSheetDocument, LyricChord } from "../../src/domain/types";
import { validateChordSheet } from "../../src/domain/validation.mjs";
import {
  MAX_COMMON_VOICINGS,
  MAX_COMMON_BASE_FRET,
  resetVoicingForChord,
  resolveBuiltinVoicings,
  resolveVoicing,
  resolveVoicings,
  selectVoicingForChord,
  voicingFeatures,
  voicingFingerprint
} from "../../src/domain/voicings";

function chordEvents(document: ChordSheetDocument) {
  const events: Array<LyricChord | ChordOnlyEvent> = [];
  document.sections.forEach((section) => section.lines.forEach((line) => {
    if (line.type !== "annotation") events.push(...line.chords);
  }));
  return events;
}

describe("内置吉他指法库", () => {
  it("为标准定弦的常用和弦只保留低把位候选", () => {
    const voicings = resolveBuiltinVoicings("C");
    expect(voicings).toHaveLength(3);
    expect(voicings[0]).toMatchObject({
      chordSymbol: "C",
      frets: [null, 3, 2, 0, 1, 0],
      baseFret: 1,
      verification: { method: "licensedDataset", license: "MIT" }
    });
    expect(voicings.every((voicing) => voicing.baseFret <= MAX_COMMON_BASE_FRET)).toBe(true);
    expect(voicings.some((voicing) => voicing.baseFret === 8)).toBe(false);
  });

  it("规范化等音名称、常用别名与 Slash bass，但不猜测库外符号", () => {
    expect(resolveBuiltinVoicings("Dbmaj7")).not.toHaveLength(0);
    expect(resolveBuiltinVoicings("Am/C")).not.toHaveLength(0);
    expect(resolveBuiltinVoicings("C6/9")).not.toHaveLength(0);
    expect(resolveBuiltinVoicings("Cunknown")).toEqual([]);
  });

  it("最多显示四个低把位候选，不用高把位形状凑数", () => {
    ["C9", "Cm7", "C#m7", "Dm7", "Em7", "F", "Fm7", "F#m7", "G", "Gm7", "Am7", "Bbm7", "Bm7"]
      .forEach((symbol) => {
        const candidates = resolveBuiltinVoicings(symbol);
        expect(candidates.length).toBeLessThanOrEqual(MAX_COMMON_VOICINGS);
        expect(candidates.every((voicing) => voicing.baseFret <= MAX_COMMON_BASE_FRET)).toBe(true);
      });
    expect(resolveBuiltinVoicings("Cdim")[0]).toMatchObject({
      frets: [null, 3, 1, null, 1, 2],
      baseFret: 1
    });
  });

  it("优先使用谱包来源指法，转调后改用目标和弦的内置指法", () => {
    const sourceDocument = structuredClone(cureFixture) as ChordSheetDocument;
    sourceDocument.voicings = [{
      id: "test-source-c",
      chordSymbol: "C",
      tuning: ["E2", "A2", "D3", "G3", "B3", "E4"],
      frets: [null, 3, 2, 0, 1, 0],
      fingers: [null, 3, 2, 0, 1, 0],
      baseFret: 1,
      verification: { status: "verified", method: "sourceDiagram", reference: "The Cure character-anchor test fixture" }
    }];
    expect(resolveVoicing(sourceDocument, "C", "test-source-c")?.verification.method).toBe("sourceDiagram");

    const transposed = structuredClone(sourceDocument);
    transposed.view.transposeSemitones = 1;
    expect(resolveVoicing(transposed, "C", "test-source-c")).toMatchObject({
      chordSymbol: "C#",
      verification: { method: "licensedDataset" }
    });
  });

  it("为没有来源指法的标准定弦谱包提供内置匹配", () => {
    const document = cureFixture as ChordSheetDocument;
    expect(resolveVoicings(document, "G/B")[0]).toMatchObject({
      frets: [null, 2, 0, 0, 0, 3],
      verification: { method: "licensedDataset" }
    });
  });

  it("合并来源与内置候选并按指法结构去重", () => {
    const document = structuredClone(cureFixture) as ChordSheetDocument;
    const builtin = resolveBuiltinVoicings("C");
    document.voicings = [{
      ...structuredClone(builtin[0]),
      id: "source-c",
      verification: { status: "verified", method: "sourceDiagram", reference: "The Cure source" }
    }];
    const candidates = resolveVoicings(document, "C", "source-c");
    expect(candidates).toHaveLength(3);
    expect(candidates[0]).toMatchObject({ id: "source-c", verification: { method: "sourceDiagram" } });
    expect(new Set(candidates.map(voicingFingerprint)).size).toBe(3);
  });

  it("给候选生成客观特征，不把排序伪装成流行度", () => {
    const [openC, barreC] = resolveBuiltinVoicings("C");
    expect(voicingFeatures(openC)).toMatchObject({
      open: true,
      barre: false,
      baseFret: 1,
      mutedStringCount: 1
    });
    expect(resolveBuiltinVoicings("C").some((voicing) => voicingFeatures(voicing).barre)).toBe(true);
    expect(voicingFeatures(barreC).fretSpan).toBeGreaterThanOrEqual(0);
  });

  it("把选择应用到 The Cure 全部精确同名和弦并随谱包结构保存", () => {
    const document = structuredClone(cureFixture) as ChordSheetDocument;
    const candidate = resolveBuiltinVoicings("C")[1];
    const selected = selectVoicingForChord(document, "C", candidate);
    const events = chordEvents(selected);
    const cEvents = events.filter((chord) => chord.symbol === "C");
    const slashEvents = events.filter((chord) => chord.symbol === "G/B");
    expect(cEvents).toHaveLength(18);
    expect(new Set(cEvents.map((chord) => chord.voicingId)).size).toBe(1);
    expect(cEvents[0].voicingId).toMatch(/^selected-/);
    expect(selected.voicings.find((voicing) => voicing.id === cEvents[0].voicingId)).toMatchObject({
      chordSymbol: "C",
      frets: candidate.frets,
      verification: { method: "licensedDataset", license: "MIT" }
    });
    expect(slashEvents.every((chord) => chord.voicingId === undefined)).toBe(true);
    expect(validateChordSheet(selected)).toEqual([]);
  });

  it("转调后只解析目标和弦，重新选择会替换并清理旧副本", () => {
    const original = structuredClone(cureFixture) as ChordSheetDocument;
    const selectedC = selectVoicingForChord(original, "C", resolveBuiltinVoicings("C")[1]);
    const transposed = { ...selectedC, view: { ...selectedC.view, transposeSemitones: 1 } };
    expect(resolveVoicing(transposed, "C", selectedC.sections[1].lines[0].type === "lyrics" ? selectedC.sections[1].lines[0].chords[0].voicingId : undefined)).toMatchObject({
      chordSymbol: "C#"
    });
    const selectedSharp = selectVoicingForChord(transposed, "C", resolveBuiltinVoicings("C#")[1]);
    expect(selectedSharp.voicings.filter((voicing) => voicing.id.startsWith("selected-"))).toHaveLength(1);
    expect(resolveVoicing(selectedSharp, "C", chordEvents(selectedSharp).find((chord) => chord.symbol === "C")?.voicingId)).toMatchObject({
      chordSymbol: "C#"
    });
  });

  it("恢复默认时清除事件引用与无引用选择副本", () => {
    const selected = selectVoicingForChord(
      structuredClone(cureFixture) as ChordSheetDocument,
      "C",
      resolveBuiltinVoicings("C")[1]
    );
    const reset = resetVoicingForChord(selected, "C");
    const cEvents = chordEvents(reset).filter((chord) => chord.symbol === "C");
    expect(cEvents.every((chord) => chord.voicingId === undefined)).toBe(true);
    expect(reset.voicings.some((voicing) => voicing.id.startsWith("selected-"))).toBe(false);
    expect(resolveVoicing(reset, "C")).toMatchObject({ id: "builtin:C:major:0" });
  });
});
