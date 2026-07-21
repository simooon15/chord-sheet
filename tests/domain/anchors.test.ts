import { describe, expect, it } from "vitest";
import { findGraphemeChange, moveChordAnchor, transformAnchorsAfterTextEdit } from "../../src/domain/anchors.mjs";

describe("歌词字素锚点", () => {
  it("以字素而不是 UTF-16 字符数计算替换范围", () => {
    expect(findGraphemeChange("A👩‍🎤B", "A你B")).toEqual({ start: 1, oldEnd: 2, newEnd: 2, delta: 0 });
  });

  it("将编辑区内和弦折叠并标为低置信度", () => {
    const chords = [
      { id: "before", symbol: "C", anchor: { graphemeOffset: 0 } },
      { id: "inside", symbol: "G", anchor: { graphemeOffset: 2 }, review: { confidence: "high", status: "confirmed" } },
      { id: "after", symbol: "Am", anchor: { graphemeOffset: 4 } }
    ];
    const result = transformAnchorsAfterTextEdit(chords, "abcd", "aXXd");
    expect(result[0].anchor.graphemeOffset).toBe(0);
    expect(result[1]).toMatchObject({ anchor: { graphemeOffset: 1 }, review: { confidence: "low", status: "unreviewed", reasons: ["positionConflict"] } });
    expect(result[2].anchor.graphemeOffset).toBe(4);
  });

  it("在拖动后标记为已校正", () => {
    expect(moveChordAnchor({ id: "c", symbol: "C", anchor: { graphemeOffset: 0 } }, 3)).toMatchObject({
      anchor: { graphemeOffset: 3 },
      review: { status: "corrected", confidence: "high" }
    });
  });
});
