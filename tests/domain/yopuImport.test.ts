import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import cureFixture from "../../output/the-cure-test-run/chordsheet.json";
import syntheticFixture from "../fixtures/yopu-clipboard.synthetic.json";
import type { ChordSheetDocument } from "../../src/domain/types";
import {
  createYopuImportBookmark,
  YOPU_COPY_STORAGE_KEY,
  type YopuNode
} from "../../src/domain/yopuImport";

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

describe("有谱么书签导入", () => {
  it("生成新版导入书签、四类节点和稳定的 even 交替", () => {
    const document = syntheticFixture as ChordSheetDocument;
    const before = JSON.stringify(document);
    const result = createYopuImportBookmark(document);
    expect(result.bookmarklet).toMatch(/^javascript:/);
    expect(result).not.toHaveProperty("payload");
    expect(JSON.stringify(document)).toBe(before);

    expect(result.nodes.filter((node) => node.type === "HEADLINE")).toEqual([
      { type: "HEADLINE", value: "主歌", even: false },
      { type: "HEADLINE", value: "副歌", even: true }
    ]);
    expect(result.nodes.filter((node) => node.type === "LINE_BREAK").map((node) => node.even)).toEqual([true, false, true]);
    expect(new Set(result.nodes.map((node) => node.type))).toEqual(new Set(["HEADLINE", "TEXT", "CHORD_ANCHOR", "LINE_BREAK"]));
  });

  it("按 Unicode 字素消费可见锚点，保留空白与行末边界并应用当前转调", () => {
    const result = createYopuImportBookmark(syntheticFixture as ChordSheetDocument);
    const firstBreak = result.nodes.findIndex((node) => node.type === "LINE_BREAK");
    const firstLine = result.nodes.slice(1, firstBreak);
    const anchors = firstLine.filter((node): node is Extract<YopuNode, { type: "CHORD_ANCHOR" }> => node.type === "CHORD_ANCHOR");
    expect(anchors.map((node) => node.value)).toEqual(["A", "", ""]);
    expect(anchors.map((node) => node.attributes.chord)).toEqual(["C#", "G#", "D#"]);
    expect(reconstructedLines(result.nodes)).toEqual(expectedLines(syntheticFixture as ChordSheetDocument));
  });

  it("逐项报告样本协议不会传递的语义", () => {
    const codes = createYopuImportBookmark(syntheticFixture as ChordSheetDocument).warnings.map((warning) => warning.code);
    expect(codes).toEqual(["metadata", "sources", "capo", "rhythm", "repeat", "voicing", "annotation", "duration"]);
  });

  it("使用已保存的 The Cure 基准谱完成主转换往返", () => {
    const document = cureFixture as ChordSheetDocument;
    const result = createYopuImportBookmark(document);
    const chordCount = document.sections.reduce((total, section) => total + section.lines.reduce(
      (lineTotal, line) => lineTotal + (line.type === "annotation" ? 0 : line.chords.length),
      0
    ), 0);
    expect(result.nodes.filter((node) => node.type === "CHORD_ANCHOR")).toHaveLength(chordCount);
    expect(result.nodes.filter((node) => node.type === "HEADLINE")).toHaveLength(document.sections.length);
    expect(reconstructedLines(result.nodes)).toEqual(expectedLines(document));
    expect(result.bookmarklet).toContain(encodeURIComponent(YOPU_COPY_STORAGE_KEY));
  });
  it("在有谱么域名缓存完整节点并通过编辑器输入事件直接导入", () => {
    const result = createYopuImportBookmark(cureFixture as ChordSheetDocument);
    let stored = "";
    let received: { inputType: string; dataTransfer: { getData: (type: string) => string } };
    const editor = { textContent: "\u200b", querySelectorAll: () => [{ firstChild: { nodeType: 3, textContent: "\u200b" } }], focus() {}, dispatchEvent(event: typeof received) { received = event; return false; } };
    class Transfer {
      value = "";
      setData(_type: string, value: string) { this.value = value; }
      getData() { return this.value; }
    }
    runInNewContext(decodeURIComponent(result.bookmarklet.slice("javascript:".length)), {
      location: { origin: "https://yopu.co", pathname: "/draft" },
      document: { querySelectorAll: () => [editor], createRange: () => ({ setStart() {}, collapse() {} }) },
      window: { getSelection: () => ({ removeAllRanges() {}, addRange() {} }) },
      crypto: { randomUUID: () => "unique-stamp" },
      localStorage: { setItem(key: string, value: string) { expect(key).toBe(YOPU_COPY_STORAGE_KEY); stored = value; } },
      DataTransfer: Transfer,
      InputEvent: class { constructor(_type: string, options: object) { Object.assign(this, options); } },
      alert: (message: string) => { throw new Error(message); }
    });
    expect(JSON.parse(stored)).toEqual({ stamp: "uniquestamp", itemList: result.nodes });
    expect(received!.inputType).toBe("insertFromPaste");
    expect(received!.dataTransfer.getData("text/plain")).toBe("_XHE_COPY_PASTE_SENTINEL_uniquestamp");
  });

  it.each([
    { origin: "https://example.com", pathname: "/draft" },
    { origin: "https://yopu.co", pathname: "/sheet" }
  ])("离开有谱么草稿页时不写入数据", (location) => {
    const notices: string[] = [];
    runInNewContext(decodeURIComponent(createYopuImportBookmark(syntheticFixture as ChordSheetDocument).bookmarklet.slice(11)), {
      location, alert: (message: string) => notices.push(message)
    });
    expect(notices).toHaveLength(1);
    expect(notices[0]).toContain("草稿编辑器");
  });

  it("拒绝向已有谱面追加时，不写入缓存也不执行插入", () => {
    let confirmed = false;
    runInNewContext(decodeURIComponent(createYopuImportBookmark(syntheticFixture as ChordSheetDocument).bookmarklet.slice(11)), {
      location: { origin: "https://yopu.co", pathname: "/draft" },
      document: { querySelectorAll: () => [{ textContent: "已有歌词" }] },
      confirm: () => { confirmed = true; return false; }
    });
    expect(confirmed).toBe(true);
  });

  it("缓存写入失败时报告错误，不进入编辑器插入步骤", () => {
    const notices: string[] = [];
    runInNewContext(decodeURIComponent(createYopuImportBookmark(syntheticFixture as ChordSheetDocument).bookmarklet.slice(11)), {
      location: { origin: "https://yopu.co", pathname: "/draft" },
      document: { querySelectorAll: () => [{ textContent: "", querySelectorAll: () => [{ firstChild: { nodeType: 3, textContent: "" } }] }] },
      crypto: { randomUUID: () => "stamp" },
      localStorage: { setItem() { throw new Error("quota exceeded"); } },
      alert: (message: string) => notices.push(message)
    });
    expect(notices).toEqual(["无法导入：quota exceeded"]);
  });

});
