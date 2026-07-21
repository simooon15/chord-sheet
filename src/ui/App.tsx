import { type ChangeEvent, type CSSProperties, type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { parseKey, soundingKey, transposeChordSymbol, transposeKey } from "../domain/chords.mjs";
import { validateChordSheet } from "../domain/validation.mjs";
import { createDemoDocument } from "../data/demo";
import { resolveVoicing } from "../domain/voicings";
import type { ChordOnlyEvent, ChordSheetDocument, LyricChord } from "../domain/types";
import { createChordSheetArchive, importChordSheet } from "../package/archive.mjs";
import { PackageError } from "../package/errors.mjs";
import { listSongs, loadSong, removeSong, saveSong } from "../storage/library";
import { ChordDiagram } from "./ChordDiagram";
import { Editor } from "./Editor";
import { Score } from "./Score";

type StoredSummary = Awaited<ReturnType<typeof listSongs>>[number];

function allChords(document: ChordSheetDocument) {
  const seen = new Set<string>();
  const chords: Array<LyricChord | ChordOnlyEvent> = [];
  document.sections.forEach((section) => section.lines.forEach((line) => {
    if (line.type !== "annotation") chords.push(...line.chords);
  }));
  return chords.filter((chord) => {
    if (seen.has(chord.symbol)) return false;
    seen.add(chord.symbol);
    return true;
  });
}

function download(filename: string, bytes: Uint8Array, type: string) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const url = URL.createObjectURL(new Blob([copy.buffer], { type }));
  const anchor = Object.assign(document.createElement("a"), { href: url, download: filename });
  anchor.click();
  URL.revokeObjectURL(url);
}

export function App() {
  const [songs, setSongs] = useState<StoredSummary[]>([]);
  const [document, setDocument] = useState<ChordSheetDocument>();
  const [mode, setMode] = useState<"read" | "edit">("read");
  const [notice, setNotice] = useState("");
  const [saveState, setSaveState] = useState("");
  const [isDraggingPackage, setIsDraggingPackage] = useState(false);
  const [isImportingPackage, setIsImportingPackage] = useState(false);
  const sourcesRef = useRef(new Map<string, Uint8Array>());
  const fileInput = useRef<HTMLInputElement>(null);

  const refreshSongs = async () => setSongs(await listSongs());
  useEffect(() => { void refreshSongs(); }, []);

  useEffect(() => {
    if (!document) return;
    const issues = validateChordSheet(document, { sourcePaths: new Set(sourcesRef.current.keys()) });
    if (issues.length) {
      setSaveState(`待修正：${issues[0].message}`);
      return;
    }
    setSaveState("正在保存…");
    const timer = window.setTimeout(() => {
      void saveSong(document, sourcesRef.current).then(() => {
        setSaveState("已保存到此浏览器");
        void refreshSongs();
      }).catch(() => setSaveState("本地保存失败"));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [document]);

  const chordSummary = useMemo(() => document ? allChords(document) : [], [document]);
  const baseKey = document ? parseKey(document.metadata.baseWrittenKey) : null;
  const actualKey = document ? soundingKey(document.metadata.baseWrittenKey, document.view.transposeSemitones, document.view.capo, "flat") : undefined;

  const openDocument = (next: ChordSheetDocument, sources = new Map<string, Uint8Array>()) => {
    sourcesRef.current = sources;
    setDocument(next);
    setMode("read");
  };

  const importPackage = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".chordsheet")) {
      setNotice("请导入以 .chordsheet 结尾的谱包；文字、截图和 PDF 需要先由制谱 Skill 整理。");
      return;
    }
    setIsImportingPackage(true);
    setNotice("正在校验并导入谱包…");
    try {
      const incoming = await importChordSheet(new Uint8Array(await file.arrayBuffer()));
      if (songs.some((song) => song.documentId === incoming.document.documentId) && !window.confirm("本地已有相同 documentId 的谱面，是否替换？")) return;
      await saveSong(incoming.document as ChordSheetDocument, incoming.sources);
      await refreshSongs();
      openDocument(incoming.document as ChordSheetDocument, incoming.sources);
      setNotice(`已导入：${incoming.document.metadata.title}`);
    } catch (error) {
      const prefix = error instanceof PackageError ? `${error.code}：` : "导入失败：";
      setNotice(`${prefix}${error instanceof Error ? error.message : "无法读取谱包"}`);
    } finally {
      setIsImportingPackage(false);
    }
  };

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void importPackage(file);
  };

  const handlePackageDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDraggingPackage(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length !== 1) {
      setNotice("一次只能导入一个 .chordsheet 谱包。");
      return;
    }
    void importPackage(files[0]);
  };

  const changeView = (change: Partial<ChordSheetDocument["view"]>) => setDocument((current) => current ? { ...current, view: { ...current.view, ...change } } : current);

  const exportPackage = () => {
    if (!document) return;
    try {
      download(`${document.metadata.title}.chordsheet`, createChordSheetArchive(document, sourcesRef.current), "application/zip");
      setNotice("已生成可再次导入的 .chordsheet 谱包。");
    } catch (error) {
      setNotice(`无法导出：${error instanceof Error ? error.message : "谱面未通过校验"}`);
    }
  };

  if (!document) {
    return <main className="app-shell welcome-shell">
      <header className="brand"><span>ChordSheet</span><small>LOCAL EDITION</small></header>
      <section className="welcome-card">
        <h1>先整理，再专心演奏。</h1>
        <p className="welcome-lede">用 <a className="skill-inline" href={`${import.meta.env.BASE_URL}downloads/chordsheet-builder-skill-v0.1.1.zip`} download aria-label="下载 ChordSheet Builder 制谱 Skill（ZIP）">制谱 Skill</a> 把文字、截图或 PDF 生成 <code>.chordsheet</code> 谱包。</p>
        <button
          className={`package-drop-zone ${isDraggingPackage ? "is-dragging" : ""}`}
          type="button"
          aria-label="拖入 .chordsheet 谱包，或点击选择文件"
          onClick={() => fileInput.current?.click()}
          onDragEnter={(event) => { event.preventDefault(); setIsDraggingPackage(true); }}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setIsDraggingPackage(true); }}
          onDragLeave={() => setIsDraggingPackage(false)}
          onDrop={handlePackageDrop}
        >
          <strong>{isImportingPackage ? "正在校验并导入…" : isDraggingPackage ? "松开以导入谱包" : "导入 .chordsheet 谱包"}</strong>
          <span>拖入或点击选择文件</span>
        </button>
        <button className="welcome-demo-link" onClick={() => { openDocument(createDemoDocument()); setNotice("已打开不含原始材料的 The Cure 基准谱。"); }}>打开 The Cure 基准谱</button>
        <input className="visually-hidden" ref={fileInput} type="file" accept=".chordsheet,application/zip" onChange={handleImport} />
        {notice && <p className="notice" role="status">{notice}</p>}
      </section>
      {songs.length > 0 && <section className="recent-songs"><h2>本地曲库</h2>{songs.map((song) => <button key={song.documentId} onClick={() => void loadSong(song.documentId).then((saved) => saved && openDocument(saved.document, saved.sources))}>{song.title}{song.artist ? ` · ${song.artist}` : ""}</button>)}</section>}
    </main>;
  }

  const style = { "--score-scale": document.view.fontScale } as CSSProperties;
  const currentKey = transposeKey(document.metadata.baseWrittenKey, document.view.transposeSemitones);
  return <main className="app-shell" style={style}>
    <header className="topbar">
      <button className="brand brand-button" onClick={() => setDocument(undefined)}><span>ChordSheet</span><small>LOCAL EDITION</small></button>
      <p className="save-state" role="status">{saveState}</p>
      <div className="topbar-actions">
        <button className="quiet-button" onClick={() => fileInput.current?.click()}>导入</button>
        <button className="quiet-button" onClick={exportPackage}>导出谱包</button>
        <button className="quiet-button" onClick={() => window.print()}>打印 / PDF</button>
        <button className={`mode-button ${mode === "edit" ? "is-active" : ""}`} onClick={() => setMode(mode === "read" ? "edit" : "read")}>{mode === "read" ? "编辑" : "阅读"}</button>
      </div>
      <input className="visually-hidden" ref={fileInput} type="file" accept=".chordsheet,application/zip" onChange={handleImport} />
    </header>

    <aside className="library-pane no-print" aria-label="本地曲库">
      <div className="library-heading"><p className="eyebrow">LIBRARY</p><button className="quiet-button" onClick={() => setDocument(undefined)}>曲库</button></div>
      {songs.map((song) => <div className={`library-item ${song.documentId === document.documentId ? "is-current" : ""}`} key={song.documentId}>
        <button onClick={() => void loadSong(song.documentId).then((saved) => saved && openDocument(saved.document, saved.sources))}>{song.title}<small>{song.artist ?? "未署名"}</small></button>
        <button className="delete-song" aria-label={`删除 ${song.title}`} onClick={() => { if (window.confirm(`删除本地谱面「${song.title}」？`)) void removeSong(song.documentId).then(async () => { await refreshSongs(); if (document.documentId === song.documentId) setDocument(undefined); }); }}>×</button>
      </div>)}
    </aside>

    <section className="document-area">
      <div className="document-toolbar no-print" aria-label="谱面设置">
        <div className="toolbar-group">
          <span>转调</span>
          <button aria-label="降半音" onClick={() => changeView({ transposeSemitones: Math.max(-11, document.view.transposeSemitones - 1) })}>−</button>
          <strong>{document.view.transposeSemitones > 0 ? `+${document.view.transposeSemitones}` : document.view.transposeSemitones}</strong>
          <button aria-label="升半音" onClick={() => changeView({ transposeSemitones: Math.min(11, document.view.transposeSemitones + 1) })}>+</button>
          {baseKey && <select aria-label="目标调" value={document.view.transposeSemitones} onChange={(event) => changeView({ transposeSemitones: Number(event.target.value) })}>{Array.from({ length: 23 }, (_, index) => index - 11).map((semitones) => <option value={semitones} key={semitones}>{transposeKey(document.metadata.baseWrittenKey, semitones)}</option>)}</select>}
          <button className="quiet-button" onClick={() => changeView({ transposeSemitones: 0 })}>原调</button>
        </div>
        <div className="toolbar-group"><label>Capo <input aria-label="Capo 品位" type="number" min="0" max="24" value={document.view.capo} onChange={(event) => changeView({ capo: Math.max(0, Math.min(24, Number(event.target.value) || 0)) })} /></label><span className="actual-key">实际调：{actualKey ?? "未知"}</span></div>
        <div className="toolbar-group"><button className="quiet-button" onClick={() => changeView({ chordDisplay: document.view.chordDisplay === "name" ? "nameAndDiagram" : "name" })}>{document.view.chordDisplay === "name" ? "显示名称 + 指法" : "只显示和弦名称"}</button><label>字号 <input aria-label="谱面字号" type="range" min="0.75" max="2" step="0.05" value={document.view.fontScale} onChange={(event) => changeView({ fontScale: Number(event.target.value) })} /></label></div>
      </div>
      <p className="mobile-editor-hint no-print">需要校正歌词或和弦落点？请在桌面端打开此谱。</p>

      <article className="score-paper">
        <header className="song-header">
          <p className="eyebrow">{document.metadata.instrument.type.toUpperCase()} · {document.metadata.difficulty ?? "未标难度"}</p>
          <h1>{document.metadata.title}</h1>
          {document.metadata.artist && <p className="artist">{document.metadata.artist}</p>}
          <dl className="song-metadata"><div><dt>调性</dt><dd>{currentKey ?? "未知"}</dd></div><div><dt>Capo</dt><dd>{document.view.capo || "无"}</dd></div><div><dt>定弦</dt><dd>{document.metadata.instrument.tuning.join(" ")}</dd></div>{document.rhythm?.tempoBpm && <div><dt>速度</dt><dd>{document.rhythm.tempoBpm} BPM</dd></div>}</dl>
        </header>
        <section className={`chord-overview ${document.view.chordDisplay === "name" ? "with-diagrams" : ""}`} aria-label="本曲和弦">
          <div><p className="eyebrow">CHORDS IN THIS SONG</p><button className="quiet-button no-print" onClick={() => changeView({ chordDisplay: document.view.chordDisplay === "name" ? "nameAndDiagram" : "name" })}>{document.view.chordDisplay === "name" ? "展开指法" : "收起指法"}</button></div>
          <div className="overview-chords">{chordSummary.map((chord) => {
            const name = transposeChordSymbol(chord.symbol, document.view.transposeSemitones).symbol;
            return <button key={chord.symbol} className="overview-chord" onClick={() => changeView({ chordDisplay: document.view.chordDisplay === "name" ? "nameAndDiagram" : "name" })}>{document.view.chordDisplay === "name" ? <ChordDiagram symbol={name} voicing={resolveVoicing(document, chord.symbol, chord.voicingId)} /> : <span key={name}>{name}</span>}</button>;
          })}</div>
        </section>
        <Score document={document} onChordClick={() => changeView({ chordDisplay: document.view.chordDisplay === "name" ? "nameAndDiagram" : "name" })} />
      </article>
      {mode === "edit" && <Editor document={document} onChange={setDocument} />}
      <p className="document-notice no-print" role="status">{notice}</p>
    </section>
  </main>;
}
