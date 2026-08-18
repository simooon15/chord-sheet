import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { Voicing } from "../domain/types";
import { voicingFeatures } from "../domain/voicings";
import { ChordDiagram } from "./ChordDiagram";

interface Props {
  symbol: string;
  candidates: Voicing[];
  selectedId?: string;
  canReset: boolean;
  anchorElement?: HTMLElement;
  onSelect: (voicing: Voicing) => void;
  onReset: () => void;
  onClose: () => void;
}

function featureLabels(voicing: Voicing) {
  const features = voicingFeatures(voicing);
  return [
    features.open ? "开放弦" : undefined,
    features.barre ? "横按" : undefined,
    `第 ${features.baseFret} 把位`,
    `跨度 ${features.fretSpan} 品`,
    features.mutedStringCount ? `${features.mutedStringCount} 根闷弦` : undefined
  ].filter((label): label is string => Boolean(label));
}

export function VoicingPicker({
  symbol,
  candidates,
  selectedId,
  canReset,
  anchorElement,
  onSelect,
  onReset,
  onClose
}: Props) {
  const selectedIndex = Math.max(0, candidates.findIndex((candidate) => candidate.id === selectedId));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const candidateRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const initialAnchor = useRef(anchorElement);

  useEffect(() => {
    candidateRefs.current[activeIndex]?.focus();
  }, [activeIndex]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      initialAnchor.current?.focus();
    };
  }, []);

  const move = (step: number) => {
    if (!candidates.length) return;
    setActiveIndex((current) => (current + step + candidates.length) % candidates.length);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    }
    if (event.key === "Home" && candidates.length) {
      event.preventDefault();
      setActiveIndex(0);
    }
    if (event.key === "End" && candidates.length) {
      event.preventDefault();
      setActiveIndex(candidates.length - 1);
    }
  };

  const rect = anchorElement?.getBoundingClientRect();
  const position = rect ? {
    "--picker-top": "50%",
    "--picker-left": `${Math.max(12, Math.min(rect.left, window.innerWidth - 552))}px`,
    transform: "translateY(-50%)"
  } as CSSProperties : undefined;

  return <div className="voicing-picker-backdrop no-print" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <div
      className="voicing-picker"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voicing-picker-title"
      style={position}
      onKeyDown={handleKeyDown}
    >
      <div className="voicing-picker-heading">
        <div>
          <p className="eyebrow">本曲指法</p>
          <h2 id="voicing-picker-title">选择 {symbol} 的指法</h2>
          <p>{candidates.length > 1 ? `常用候选 ${activeIndex + 1} / ${candidates.length}` : "当前只有一个已核验指法"}</p>
        </div>
        <button className="quiet-button" type="button" onClick={onClose} aria-label="关闭指法选择器">关闭</button>
      </div>

      {candidates.length > 0 ? <div className="voicing-candidates" role="radiogroup" aria-label={`${symbol} 指法候选`}>
        {candidates.map((candidate, index) => {
          const selected = candidate.id === selectedId;
          return <button
            className={`voicing-candidate ${selected ? "is-selected" : ""}`}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={index === activeIndex ? 0 : -1}
            key={candidate.id}
            ref={(element) => { candidateRefs.current[index] = element; }}
            onFocus={() => setActiveIndex(index)}
            onClick={() => onSelect(candidate)}
          >
            <ChordDiagram symbol={symbol} voicing={candidate} />
            <span className="voicing-features">{featureLabels(candidate).map((label) => <small key={label}>{label}</small>)}</span>
            <strong>{selected ? "当前使用" : index === 0 ? "使用常用首选" : "使用此指法"}</strong>
          </button>;
        })}
      </div> : <p className="voicing-picker-empty">当前定弦下没有已核验的可选指法。</p>}

      <div className="voicing-picker-actions">
        <button className="quiet-button" type="button" disabled={!canReset} onClick={onReset}>恢复默认指法</button>
        <small>最多显示四个低把位常用候选。</small>
      </div>
    </div>
  </div>;
}
