import { Fragment, useLayoutEffect, useRef } from "react";
import { graphemeCount, splitGraphemes } from "../domain/graphemes.mjs";
import { transposeChordSymbol } from "../domain/chords.mjs";
import { resolveVoicing } from "../domain/voicings";
import type { ChordSheetDocument, ChordOnlyEvent, LyricChord } from "../domain/types";
import { ChordDiagram } from "./ChordDiagram";

interface Props {
  document: ChordSheetDocument;
  onChordClick: (chord: LyricChord | ChordOnlyEvent, trigger: HTMLButtonElement) => void;
}

function displaySymbol(symbol: string, semitones: number) {
  return transposeChordSymbol(symbol, semitones).symbol;
}

function ChordButton({ chord, document, onClick }: { chord: LyricChord | ChordOnlyEvent; document: ChordSheetDocument; onClick: Props["onChordClick"] }) {
  const symbol = displaySymbol(chord.symbol, document.view.transposeSemitones);
  const lowConfidence = chord.review?.confidence === "low";
  const diagramMode = document.view.chordDisplay === "nameAndDiagram";
  const action = diagramMode ? "换指法" : "展开全谱指法";
  return (
    <button
      type="button"
      className={`score-chord ${lowConfidence ? "needs-review" : ""}`}
      onClick={(event) => onClick(chord, event.currentTarget)}
      onContextMenu={(event) => {
        if (!diagramMode) return;
        event.preventDefault();
        onClick(chord, event.currentTarget);
      }}
      aria-label={`${symbol}，${action}`}
      title={lowConfidence ? `此位置需要复核；${action}` : action}
    >
      {!diagramMode ? <span key={symbol}>{symbol}</span> : <ChordDiagram symbol={symbol} voicing={resolveVoicing(document, chord.symbol, chord.voicingId)} compact />}
      {lowConfidence && <i aria-label="需要复核">•</i>}
    </button>
  );
}

const DIAGRAM_ANCHOR_MIN_DISTANCE = 64;

function LyricScoreLine({ line, document, onChordClick }: { line: Extract<ChordSheetDocument["sections"][number]["lines"][number], { type: "lyrics" }>; document: ChordSheetDocument; onChordClick: Props["onChordClick"] }) {
  const graphemes = splitGraphemes(line.text);
  const chordsByOffset = new Map(line.chords.map((chord) => [chord.anchor.graphemeOffset, chord]));
  const anchors = [...new Set([0, ...line.chords.map((chord) => chord.anchor.graphemeOffset), graphemeCount(line.text)])].sort((a, b) => a - b);
  const diagramMode = document.view.chordDisplay === "nameAndDiagram";
  const lineRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const paragraph = lineRef.current;
    if (!paragraph) return;
    const anchorSpans = Array.from(paragraph.querySelectorAll<HTMLElement>(".inline-chord-anchor"));
    if (!diagramMode) {
      anchorSpans.forEach((span) => { span.style.width = ""; });
      return;
    }
    // 指法图模式下锚点默认零宽、歌词连续排版；只有相邻锚点距离放不下 58px 指法图时，
    // 才把前一个锚点槽位撑宽到刚好不重叠。多跑几轮以吸收撑宽导致的换行变化。
    const expandCrowdedAnchors = () => {
      anchorSpans.forEach((span) => { span.style.width = ""; });
      if (anchorSpans.length < 2) return;
      for (let pass = 0; pass < 3; pass++) {
        let adjusted = false;
        const rows = new Map<number, HTMLElement[]>();
        anchorSpans.forEach((span) => {
          const top = Math.round(span.getBoundingClientRect().top);
          rows.set(top, [...(rows.get(top) ?? []), span]);
        });
        rows.forEach((row) => {
          row.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
          for (let index = 0; index < row.length - 1; index++) {
            const current = row[index].getBoundingClientRect();
            const next = row[index + 1].getBoundingClientRect();
            if (next.left - current.left < DIAGRAM_ANCHOR_MIN_DISTANCE) {
              row[index].style.width = `${current.width + DIAGRAM_ANCHOR_MIN_DISTANCE - (next.left - current.left)}px`;
              adjusted = true;
            }
          }
        });
        if (!adjusted) break;
      }
    };
    expandCrowdedAnchors();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(expandCrowdedAnchors);
    observer.observe(paragraph);
    return () => observer.disconnect();
  }, [diagramMode, line, document.view.fontScale]);

  return (
    <p className="score-lyrics" ref={lineRef}>
      {anchors.slice(0, -1).map((offset, index) => {
        const chord = chordsByOffset.get(offset);
        return <Fragment key={`${line.id}-${offset}`}>
          {chord && <span className="inline-chord-anchor"><ChordButton chord={chord} document={document} onClick={onChordClick} /></span>}
          {graphemes.slice(offset, anchors[index + 1]).join("")}
        </Fragment>;
      })}
      {chordsByOffset.get(graphemes.length) && <span className="inline-chord-anchor end-anchor"><ChordButton chord={chordsByOffset.get(graphemes.length)!} document={document} onClick={onChordClick} /></span>}
    </p>
  );
}

export function Score({ document, onChordClick }: Props) {
  return (
    <section className={`score ${document.view.chordDisplay === "nameAndDiagram" ? "with-diagrams" : ""}`} aria-label="实时谱面">
      {document.sections.map((section) => (
        <section className="score-section" key={section.id}>
          <h2>{section.label}{section.repeat && section.repeat > 1 ? ` ×${section.repeat}` : ""}</h2>
          {section.lines.map((line) => {
            if (line.type === "annotation") return <p className="score-annotation" key={line.id}>{line.text}</p>;
            if (line.type === "chords") return <p className="score-chords-only" key={line.id}>{line.chords.map((chord) => <ChordButton chord={chord} document={document} onClick={onChordClick} key={chord.id} />)}</p>;
            return <LyricScoreLine line={line} document={document} onChordClick={onChordClick} key={line.id} />;
          })}
        </section>
      ))}
    </section>
  );
}
