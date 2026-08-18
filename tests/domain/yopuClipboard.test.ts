import { describe, expect, it } from "vitest";
import cureFixture from "../../output/the-cure-test-run/chordsheet.json";
import syntheticFixture from "../fixtures/yopu-clipboard.synthetic.json";
import type { ChordSheetDocument } from "../../src/domain/types";
import {
  createYopuClipboardExport,
  YOPU_COPY_PASTE_SENTINEL,
  type YopuNode
} from "../../src/domain/yopuClipboard";

function reconstructedLines(nodes: YopuNode[]) {
  const lines: string[] = [];
  let current = "";
  nodes.forEach((node) => {
    if (node.type === "TEXT" || node.type === "CHORD_ANCHOR") current += node.value;
    if (node.type === "LINE_BREAK") {
      lines.push(current);
      current = "";
    }
  });
  lines.push(current);
  return lines;
}

function expectedLines(document: ChordSheetDocument) {
  return document.sections.flatMap((section) => section.lines.map((line) => (
    line.type === "chords" ? "" : line.text
  )));
}

describe("有谱么剪贴板转换", () => {
  it("生成四类节点、单一哨兵和稳定的 even 交替", () => {
    const document = syntheticFixture as ChordSheetDocument;
    const before = JSON.stringify(document);
    const result = createYopuClipboardExport(document);
    const parts = result.payload.split(YOPU_COPY_PASTE_SENTINEL);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBe(result.plainText);
    expect(JSON.parse(parts[1])).toEqual(result.nodes);
    expect(JSON.stringify(document)).toBe(before);

    expect(result.nodes.filter((node) => node.type === "HEADLINE")).toEqual([
      { type: "HEADLINE", value: "主歌", even: false },
      { type: "HEADLINE", value: "副歌", even: true }
    ]);
    expect(result.nodes.filter((node) => node.type === "LINE_BREAK").map((node) => node.even)).toEqual([true, false, true]);
    expect(new Set(result.nodes.map((node) => node.type))).toEqual(new Set(["HEADLINE", "TEXT", "CHORD_ANCHOR", "LINE_BREAK"]));
  });

  it("按 Unicode 字素消费可见锚点，保留空白与行末边界并应用当前转调", () => {
    const result = createYopuClipboardExport(syntheticFixture as ChordSheetDocument);
    const firstBreak = result.nodes.findIndex((node) => node.type === "LINE_BREAK");
    const firstLine = result.nodes.slice(1, firstBreak);
    const anchors = firstLine.filter((node): node is Extract<YopuNode, { type: "CHORD_ANCHOR" }> => node.type === "CHORD_ANCHOR");
    expect(anchors.map((node) => node.value)).toEqual(["A", "", ""]);
    expect(anchors.map((node) => node.attributes.chord)).toEqual(["C#", "G#", "D#"]);
    expect(reconstructedLines(result.nodes)).toEqual(expectedLines(syntheticFixture as ChordSheetDocument));
  });

  it("逐项报告样本协议不会传递的语义", () => {
    const codes = createYopuClipboardExport(syntheticFixture as ChordSheetDocument).warnings.map((warning) => warning.code);
    expect(codes).toEqual(["metadata", "sources", "capo", "rhythm", "repeat", "voicing", "annotation", "duration"]);
  });

  it("使用已保存的 The Cure 基准谱完成主转换往返", () => {
    const document = cureFixture as ChordSheetDocument;
    const result = createYopuClipboardExport(document);
    const chordCount = document.sections.reduce((total, section) => total + section.lines.reduce(
      (lineTotal, line) => lineTotal + (line.type === "annotation" ? 0 : line.chords.length),
      0
    ), 0);
    expect(result.nodes.filter((node) => node.type === "CHORD_ANCHOR")).toHaveLength(chordCount);
    expect(result.nodes.filter((node) => node.type === "HEADLINE")).toHaveLength(document.sections.length);
    expect(reconstructedLines(result.nodes)).toEqual(expectedLines(document));
    expect(JSON.parse(result.payload.split(YOPU_COPY_PASTE_SENTINEL)[1])).toEqual(result.nodes);
  });
});
