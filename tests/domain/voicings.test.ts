import { describe, expect, it } from "vitest";
import cureFixture from "../../output/the-cure-test-run/chordsheet.json";
import type { ChordSheetDocument } from "../../src/domain/types";
import { resolveBuiltinVoicings, resolveVoicing, resolveVoicings } from "../../src/domain/voicings";

describe("内置吉他指法库", () => {
  it("为标准定弦的常用和弦保留全部可选按法，并优先低把位显示", () => {
    const voicings = resolveBuiltinVoicings("C");
    expect(voicings).toHaveLength(4);
    expect(voicings[0]).toMatchObject({
      chordSymbol: "C",
      frets: [null, 3, 2, 0, 1, 0],
      baseFret: 1,
      verification: { method: "licensedDataset", license: "MIT" }
    });
  });

  it("规范化等音名称、常用别名与 Slash bass，但不猜测库外符号", () => {
    expect(resolveBuiltinVoicings("Dbmaj7")).not.toHaveLength(0);
    expect(resolveBuiltinVoicings("Am/C")).not.toHaveLength(0);
    expect(resolveBuiltinVoicings("C6/9")).not.toHaveLength(0);
    expect(resolveBuiltinVoicings("Cunknown")).toEqual([]);
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
});
