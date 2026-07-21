import type { Voicing } from "../domain/types";

interface Props {
  symbol: string;
  voicing?: Voicing;
  compact?: boolean;
}

export function ChordDiagram({ symbol, voicing, compact = false }: Props) {
  if (!voicing) {
    return <span className="diagram-unavailable" title={`${symbol} 没有可追溯的已核验指法`}>暂无指法</span>;
  }

  const strings = voicing.frets.length;
  const fretCount = 5;
  const width = compact ? 58 : 76;
  const height = compact ? 82 : 108;
  const left = 13;
  const top = 21;
  const gridWidth = width - left - 8;
  const gridHeight = height - top - 10;
  const fretStep = gridHeight / fretCount;
  const stringStep = gridWidth / (strings - 1);
  const base = voicing.baseFret;

  return (
    <figure className={`chord-diagram ${compact ? "is-compact" : ""}`} aria-label={`${symbol} 吉他指法，已核验来源：${voicing.verification.reference}`}>
      <figcaption>{symbol}</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true">
        {Array.from({ length: strings }, (_, index) => <line className="diagram-string" key={`s-${index}`} x1={left + index * stringStep} y1={top} x2={left + index * stringStep} y2={top + gridHeight} />)}
        {Array.from({ length: fretCount + 1 }, (_, index) => <line className={`diagram-fret ${index === 0 && base === 1 ? "nut" : ""}`} key={`f-${index}`} x1={left} y1={top + index * fretStep} x2={left + gridWidth} y2={top + index * fretStep} />)}
        {base > 1 && <text className="diagram-base-fret" x="1" y={top + fretStep * 0.72}>{base}</text>}
        {voicing.frets.map((fret, index) => {
          const x = left + index * stringStep;
          if (fret === null) return <text className="diagram-marker" key={`m-${index}`} x={x} y="13">×</text>;
          if (fret === 0) return <text className="diagram-marker" key={`o-${index}`} x={x} y="13">○</text>;
          const localFret = fret - base;
          if (localFret < 0 || localFret >= fretCount) return null;
          return <circle className="diagram-dot" key={`d-${index}`} cx={x} cy={top + (localFret + 0.5) * fretStep} r={compact ? 3.4 : 4.2} />;
        })}
        {(voicing.barres ?? []).map((barre, index) => {
          const localFret = barre.fret - base;
          if (localFret < 0 || localFret >= fretCount) return null;
          return <line className="diagram-barre" key={`b-${index}`} x1={left + (barre.fromString - 1) * stringStep} x2={left + (barre.toString - 1) * stringStep} y1={top + (localFret + 0.5) * fretStep} y2={top + (localFret + 0.5) * fretStep} />;
        })}
      </svg>
    </figure>
  );
}
