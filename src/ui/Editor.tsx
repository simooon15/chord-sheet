import { useMemo } from "react";
import { moveChordAnchor, transformAnchorsAfterTextEdit } from "../domain/anchors.mjs";
import { graphemeCount } from "../domain/graphemes.mjs";
import type { ChordSheetDocument, LyricChord, LyricLine } from "../domain/types";

interface Props {
  document: ChordSheetDocument;
  onChange: (document: ChordSheetDocument) => void;
}

function updateLyricLine(document: ChordSheetDocument, sectionId: string, lineId: string, update: (line: LyricLine) => LyricLine): ChordSheetDocument {
  return {
    ...document,
    sections: document.sections.map((section) => section.id !== sectionId ? section : {
      ...section,
      lines: section.lines.map((line) => line.id !== lineId || line.type !== "lyrics" ? line : update(line))
    })
  };
}

const newId = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`;

export function Editor({ document, onChange }: Props) {
  const lyricLines = useMemo(() => document.sections.flatMap((section) => section.lines.filter((line): line is LyricLine => line.type === "lyrics").map((line) => ({ section, line }))), [document.sections]);

  return (
    <aside className="editor-panel" aria-label="桌面编辑器">
      <div className="editor-heading">
        <p className="eyebrow">DESKTOP EDITOR</p>
        <h2>校正歌词与落点</h2>
        <p>改词会保留可确定的位置；落在改动范围内的和弦会标记为待复核。</p>
      </div>
      {lyricLines.map(({ section, line }) => {
        const total = graphemeCount(line.text);
        return (
          <section className="edit-line" key={line.id}>
            <h3>{section.label}</h3>
            <label>
              歌词
              <input
                value={line.text}
                onChange={(event) => onChange(updateLyricLine(document, section.id, line.id, (current) => ({
                  ...current,
                  text: event.target.value || " ",
                  chords: transformAnchorsAfterTextEdit(current.chords, current.text, event.target.value || " ") as LyricChord[]
                })))}
              />
            </label>
            <div className="anchor-rail" aria-label={`${section.label} 和弦锚点轨道`}>
              {line.chords.map((chord) => (
                <div className="anchor-control" key={chord.id}>
                  <input
                    aria-label={`${chord.symbol} 的歌词位置`}
                    value={chord.symbol}
                    onChange={(event) => onChange(updateLyricLine(document, section.id, line.id, (current) => ({
                      ...current,
                      chords: current.chords.map((item) => item.id === chord.id ? { ...item, symbol: event.target.value || "?" } : item)
                    })))}
                  />
                  <input
                    aria-label={`${chord.symbol} 锚点`}
                    type="range"
                    min="0"
                    max={total}
                    value={chord.anchor.graphemeOffset}
                    onChange={(event) => onChange(updateLyricLine(document, section.id, line.id, (current) => ({
                      ...current,
                      chords: current.chords.map((item) => item.id === chord.id ? moveChordAnchor(item, Number(event.target.value)) : item).sort((a, b) => a.anchor.graphemeOffset - b.anchor.graphemeOffset)
                    })))}
                  />
                  <output>{chord.anchor.graphemeOffset} / {total}</output>
                  <button
                    type="button"
                    className="quiet-button"
                    onClick={() => onChange(updateLyricLine(document, section.id, line.id, (current) => ({ ...current, chords: current.chords.filter((item) => item.id !== chord.id) })))}
                  >删除</button>
                </div>
              ))}
              <button
                type="button"
                className="quiet-button add-chord"
                onClick={() => onChange(updateLyricLine(document, section.id, line.id, (current) => {
                  const chord: LyricChord = { id: newId("chord"), symbol: "C", anchor: { graphemeOffset: 0 }, review: { confidence: "low", status: "unreviewed", reasons: ["inferred"] } };
                  return { ...current, chords: [...current.chords, chord].sort((a, b) => a.anchor.graphemeOffset - b.anchor.graphemeOffset) };
                }))}
              >+ 添加和弦</button>
            </div>
          </section>
        );
      })}
    </aside>
  );
}
