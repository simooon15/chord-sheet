import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import fixture from "../../output/the-cure-test-run/chordsheet.json";
import { validateChordSheet } from "../../src/domain/validation.mjs";
import type { ChordSheetDocument } from "../../src/domain/types";
import { soundingKey } from "../../src/domain/chords.mjs";
import { Score } from "../../src/ui/Score";

describe("The Cure 字符锚定基准谱", () => {
  const document = fixture as ChordSheetDocument;

  it("保留完整三页谱面的段落、和弦锚点与 C 形状 + capo 1 的实际 Db 调", () => {
    expect(validateChordSheet(document)).toEqual([]);
    expect(document.metadata.baseWrittenKey).toBe("C");
    expect(document.view.capo).toBe(1);
    expect(soundingKey(document.metadata.baseWrittenKey, 0, document.view.capo, "flat")).toBe("Db");
    expect(document.sections).toHaveLength(11);
    const chordEventCount = document.sections.flatMap((section) => section.lines).reduce((total, line) => total + (line.type === "annotation" ? 0 : line.chords.length), 0);
    expect(chordEventCount).toBe(94);
    const characterAnchoredLine = document.sections.find((section) => section.id === "refrain-2")?.lines.find((line) => line.id === "r2-1");
    expect(characterAnchoredLine).toMatchObject({ text: "'Cause, baby, I'm unraveled (I'm unraveled)", chords: [{ symbol: "F", anchor: { graphemeOffset: 20 } }] });
  });

  it("在基础调使用内置指法库显示可追溯的和弦图", () => {
    const diagramDocument = structuredClone(document);
    diagramDocument.view.chordDisplay = "nameAndDiagram";
    render(<Score document={diagramDocument} onChordClick={() => undefined} />);
    expect(screen.getAllByRole("figure").length).toBeGreaterThan(0);
    expect(screen.queryByText("暂无指法")).not.toBeInTheDocument();
  });
});
