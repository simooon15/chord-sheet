import { transposeChordSymbol } from "./chords.mjs";
import { splitGraphemes } from "./graphemes.mjs";
import type { ChordSheetDocument, LyricLine, ScoreLine } from "./types";

const YOPU_COPY_PASTE_SENTINEL = "_XHE_COPY_PASTE_SENTINEL_";
export const YOPU_COPY_STORAGE_KEY = "user-data-xhe-copy";

export type YopuNode =
  | { type: "HEADLINE"; value: string; even: boolean }
  | { type: "TEXT"; value: string; even: boolean }
  | { type: "CHORD_ANCHOR"; value: string; attributes: { chord: string }; even: boolean }
  | { type: "LINE_BREAK"; even: boolean };

export interface YopuExportWarning {
  code: "metadata" | "sources" | "capo" | "rhythm" | "repeat" | "voicing" | "annotation" | "duration";
  message: string;
}

function displayedChord(document: ChordSheetDocument, symbol: string) {
  return transposeChordSymbol(symbol, document.view.transposeSemitones).symbol;
}

function lyricNodes(document: ChordSheetDocument, line: LyricLine, even: boolean): YopuNode[] {
  const graphemes = splitGraphemes(line.text);
  const nodes: YopuNode[] = [];
  let cursor = 0;
  [...line.chords]
    .sort((left, right) => left.anchor.graphemeOffset - right.anchor.graphemeOffset)
    .forEach((chord) => {
      const offset = chord.anchor.graphemeOffset;
      nodes.push({ type: "TEXT", value: graphemes.slice(cursor, offset).join(""), even });
      const grapheme = graphemes[offset];
      const consumesGrapheme = grapheme !== undefined && !/^\s$/u.test(grapheme);
      nodes.push({
        type: "CHORD_ANCHOR",
        value: consumesGrapheme ? grapheme : "",
        attributes: { chord: displayedChord(document, chord.symbol) },
        even
      });
      cursor = consumesGrapheme ? offset + 1 : offset;
    });
  nodes.push({ type: "TEXT", value: graphemes.slice(cursor).join(""), even });
  return nodes;
}

function lineNodes(document: ChordSheetDocument, line: ScoreLine, even: boolean): YopuNode[] {
  if (line.type === "lyrics") return lyricNodes(document, line, even);
  if (line.type === "annotation") return [{ type: "TEXT", value: line.text, even }];
  return [
    { type: "TEXT", value: "", even },
    ...line.chords.map<YopuNode>((chord) => ({
      type: "CHORD_ANCHOR",
      value: "",
      attributes: { chord: displayedChord(document, chord.symbol) },
      even
    })),
    { type: "TEXT", value: "", even }
  ];
}

function plainLine(document: ChordSheetDocument, line: ScoreLine) {
  if (line.type !== "chords") return line.text;
  return line.chords.map((chord) => displayedChord(document, chord.symbol)).join(" ");
}

function exportWarnings(document: ChordSheetDocument): YopuExportWarning[] {
  const warnings: YopuExportWarning[] = [{
    code: "metadata",
    message: "标题、歌手等歌曲资料不会随书签导入。"
  }];
  if (document.sources.length) warnings.push({ code: "sources", message: "原始来源和核验记录不会随书签导入。" });
  if (document.view.capo) warnings.push({ code: "capo", message: `Capo ${document.view.capo}不会导入，请在有谱么中另行设置。` });
  if (document.rhythm) warnings.push({ code: "rhythm", message: "节拍、速度和节奏型不会随书签导入。" });

  const lines = document.sections.flatMap((section) => section.lines);
  if (document.sections.some((section) => (section.repeat ?? 1) > 1)) {
    warnings.push({ code: "repeat", message: "段落重复次数不会导入，请在有谱么中另行补充。" });
  }
  if (lines.some((line) => line.type !== "annotation" && line.chords.some((chord) => chord.voicingId))) {
    warnings.push({ code: "voicing", message: "自选指法不会导入，有谱么将使用自己的指法库。" });
  }
  if (lines.some((line) => line.type === "annotation")) {
    warnings.push({ code: "annotation", message: "注释行会作为普通文字传递。" });
  }
  if (lines.some((line) => line.type === "chords" && line.chords.some((chord) => chord.durationBeats !== undefined))) {
    warnings.push({ code: "duration", message: "纯和弦行的时值不会导入。" });
  }
  return warnings;
}

export function createYopuImportBookmark(document: ChordSheetDocument) {
  const nodes: YopuNode[] = [];
  const plainText: string[] = [];
  const totalLines = document.sections.reduce((total, section) => total + section.lines.length, 0);
  let lineIndex = 0;
  let even = false;

  document.sections.forEach((section) => {
    nodes.push({ type: "HEADLINE", value: section.label, even });
    plainText.push(section.label);
    section.lines.forEach((line) => {
      nodes.push(...lineNodes(document, line, even));
      plainText.push(plainLine(document, line));
      lineIndex += 1;
      if (lineIndex < totalLines) {
        even = !even;
        nodes.push({ type: "LINE_BREAK", even });
      }
    });
  });

  const readable = plainText.join("\n");
  return {
    nodes,
    plainText: readable,
    bookmarklet: createBookmarklet(nodes),
    warnings: exportWarnings(document)
  };
}

// The editor now resolves a stamp against same-origin storage instead of parsing JSON
// from the clipboard. Keep the executable bridge self-contained, without network calls.
function createBookmarklet(nodes: YopuNode[]) {
  const data = JSON.stringify(encodeURIComponent(JSON.stringify(nodes)));
  const script = `(() => {
    if (location.origin !== "https://yopu.co" || location.pathname !== "/draft") {
      alert("请先打开 https://yopu.co 的草稿编辑器，再点击此书签。"); return;
    }
    const editors = [...document.querySelectorAll('[contenteditable="true"]')];
    if (editors.length !== 1) { alert("未找到唯一的谱面编辑器，请等待页面加载完成。"); return; }
    const editor = editors[0];
    if (editor.textContent.replace(/\\u200b/g, "").trim() && !confirm("当前草稿已有内容，新谱将插入末尾。继续吗？")) return;
    try {
      const textNodes = [...editor.querySelectorAll("[text-value]")];
      const tail = textNodes[textNodes.length - 1]?.firstChild;
      if (!tail || tail.nodeType !== 3) throw new Error("未找到谱面末尾文字，请检查新版编辑器。");
      const stamp = crypto.randomUUID().replace(/-/g, "");
      const itemList = JSON.parse(decodeURIComponent(${data}));
      localStorage.setItem(${JSON.stringify(YOPU_COPY_STORAGE_KEY)}, JSON.stringify({ stamp, itemList }));
      editor.focus();
      const range = document.createRange();
      range.setStart(tail, tail.textContent.length); range.collapse(true);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      const transfer = new DataTransfer(); transfer.setData("text/plain", ${JSON.stringify(YOPU_COPY_PASTE_SENTINEL)} + stamp);
      const event = new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertFromPaste", dataTransfer: transfer });
      if (editor.dispatchEvent(event)) alert("编辑器未接受导入，可能已更新，请返回 ChordSheet 检查适配。");
    } catch (error) { alert("无法导入：" + error.message); }
  })();`;
  return `javascript:${encodeURIComponent(script)}`;
}
