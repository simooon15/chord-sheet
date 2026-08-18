import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { noteToSemitone, parseChordSymbol } from "../src/domain/chords.mjs";

const CATALOGUE_NOTES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const SUFFIX_ALIASES = new Map([
  ["", "major"], ["M", "major"], ["maj", "major"], ["m", "minor"], ["min", "minor"], ["-", "minor"],
  ["min7", "m7"], ["-7", "m7"], ["M7", "maj7"], ["Δ7", "maj7"], ["°", "dim"], ["°7", "dim7"],
  ["+", "aug"], ["+7", "aug7"], ["6/9", "69"]
]);

function usage() {
  throw new Error("用法：node scripts/import-chordpro-voicings.mjs <guitar.json> --version <version> --commit <commit> [--output review.json] [--common-order-output common-order.json]");
}

function catalogueNote(note) {
  const pitch = noteToSemitone(note);
  return pitch === undefined ? undefined : CATALOGUE_NOTES[pitch];
}

function catalogueKey(symbol) {
  const parsed = parseChordSymbol(symbol);
  if (!parsed) return undefined;
  const root = catalogueNote(parsed.root);
  if (!root) return undefined;
  const rawSuffix = parsed.suffix.replaceAll("♯", "#").replaceAll("♭", "b");
  let suffix = SUFFIX_ALIASES.get(rawSuffix) ?? rawSuffix;
  if (parsed.bass) {
    const bass = catalogueNote(parsed.bass);
    if (!bass) return undefined;
    suffix = suffix === "major" ? `/${bass}` : suffix === "minor" ? `m/${bass}` : `${suffix}/${bass}`;
  }
  return `${root}:${suffix}`;
}

function numberOrNull(value) {
  if (value === "x" || value === "X" || value === "-" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : undefined;
}

function normalizeFrets(frets, base) {
  if (!Array.isArray(frets) || !Number.isInteger(base) || base < 1) return undefined;
  const normalized = frets.map((fret) => {
    const value = numberOrNull(fret);
    return value === -1 ? null : value;
  });
  if (normalized.some((fret) => fret === undefined || fret < 0)) return undefined;
  return normalized.map((fret) => fret === null ? null : fret === 0 ? 0 : base + fret - 1);
}

function normalizeFingers(fingers, stringCount) {
  if (!Array.isArray(fingers)) return undefined;
  if (fingers.length !== stringCount) return undefined;
  const normalized = fingers.map(numberOrNull);
  if (normalized.some((finger) => finger === undefined || finger < 0 || finger > 4)) return undefined;
  return normalized;
}

function barresFor(frets, fingers) {
  const byFret = new Map();
  frets.forEach((fret, index) => {
    if (typeof fret !== "number" || fret === 0) return;
    const indexes = byFret.get(fret) ?? [];
    indexes.push(index);
    byFret.set(fret, indexes);
  });
  return [...byFret.entries()].flatMap(([fret, indexes]) => {
    if (indexes.length < 2) return [];
    const finger = fingers?.[indexes[0]];
    return [{ fromString: indexes[0] + 1, toString: indexes.at(-1) + 1, fret, ...(finger ? { finger } : {}) }];
  });
}

function shapeFingerprint(frets) {
  return JSON.stringify(frets);
}

function mainAbsoluteFrets(position) {
  return position.f.map((fret) => fret < 0 ? null : fret === 0 ? 0 : fret + position.b - 1);
}

const args = process.argv.slice(2);
const input = args[0];
let version;
let commit;
let output;
let commonOrderOutput;
for (let index = 1; index < args.length; index += 1) {
  if (args[index] === "--version") version = args[++index];
  else if (args[index] === "--commit") commit = args[++index];
  else if (args[index] === "--output") output = args[++index];
  else if (args[index] === "--common-order-output") commonOrderOutput = args[++index];
  else usage();
}
if (!input || !version || !commit) usage();

const source = JSON.parse(await readFile(resolve(input), "utf8"));
const main = JSON.parse(await readFile(resolve("src/data/guitar-voicings.json"), "utf8"));
if (!Array.isArray(source.chords) || !Array.isArray(source.tuning)) {
  throw new Error("ChordPro 文件必须包含 chords 数组与 tuning 数组。");
}
if (JSON.stringify(source.tuning) !== JSON.stringify(main.tuning)) {
  throw new Error(`仅支持与主库相同的标准定弦：${main.tuning.join(" ")}。`);
}

const sourceByName = new Map(source.chords.filter((entry) => typeof entry?.name === "string").map((entry) => [entry.name, entry]));
const resolving = new Set();
function resolveEntry(name) {
  const entry = sourceByName.get(name);
  if (!entry || resolving.has(name)) return undefined;
  if (!entry.copy) return entry;
  resolving.add(name);
  const copied = resolveEntry(entry.copy);
  resolving.delete(name);
  return copied ? { ...copied, ...entry, frets: entry.frets ?? copied.frets, fingers: entry.fingers ?? copied.fingers, base: entry.base ?? copied.base } : undefined;
}

const report = {
  source: { name: "ChordPro guitar.json", version, commit, license: "Artistic License 2.0" },
  sourceChordCount: source.chords.length,
  concreteEntries: 0,
  aliases: 0,
  convertibleEntries: 0,
  identicalShapes: [],
  missingNames: [],
  conflictingShapes: [],
  unconvertible: []
};
const candidates = [];
const emitted = new Set();
const commonPositionIndexes = new Map();
for (const raw of source.chords) {
  if (typeof raw?.name !== "string") {
    report.unconvertible.push({ name: "(missing)", reason: "missing name" });
    continue;
  }
  if (raw.copy) report.aliases += 1;
  else report.concreteEntries += 1;
  const entry = resolveEntry(raw.name);
  const key = catalogueKey(raw.name);
  const frets = normalizeFrets(entry?.frets, entry?.base ?? 1);
  if (!key) {
    report.unconvertible.push({ name: raw.name, reason: "unsupported chord name" });
    continue;
  }
  if (!frets || frets.length !== main.tuning.length) {
    report.unconvertible.push({ name: raw.name, reason: "invalid frets or string count" });
    continue;
  }
  const fingers = normalizeFingers(entry?.fingers, frets.length);
  if (entry?.fingers && !fingers) {
    report.unconvertible.push({ name: raw.name, reason: "invalid fingers" });
    continue;
  }
  report.convertibleEntries += 1;
  const shape = shapeFingerprint(frets);
  const mainPositions = main.chords[key] ?? [];
  const matchingIndexes = mainPositions.reduce((indexes, position, index) => {
    if (shapeFingerprint(mainAbsoluteFrets(position)) === shape) indexes.push(index);
    return indexes;
  }, []);
  const mainShapes = new Set(mainPositions.map(mainAbsoluteFrets).map(shapeFingerprint));
  if (!main.chords[key]) report.missingNames.push({ name: raw.name, key });
  else if (mainShapes.has(shape)) report.identicalShapes.push({ name: raw.name, key });
  else report.conflictingShapes.push({ name: raw.name, key });
  if (matchingIndexes.length) {
    const current = commonPositionIndexes.get(key) ?? new Set();
    matchingIndexes.forEach((index) => current.add(index));
    commonPositionIndexes.set(key, current);
  }

  const candidateKey = `${key}:${shape}`;
  if (!mainShapes.has(shape) && !emitted.has(candidateKey)) {
    emitted.add(candidateKey);
    candidates.push({
      key,
      sourceName: raw.name,
      frets,
      ...(fingers ? { fingers } : {}),
      baseFret: entry?.base ?? 1,
      barres: barresFor(frets, fingers)
    });
  }
}

for (const field of ["identicalShapes", "missingNames", "conflictingShapes", "unconvertible"]) {
  report[field].sort((left, right) => left.name.localeCompare(right.name) || (left.reason ?? "").localeCompare(right.reason ?? ""));
}
console.log(JSON.stringify({ ...report, candidateCount: candidates.length }, null, 2));
if (output) {
  await writeFile(resolve(output), `${JSON.stringify({ source: report.source, tuning: source.tuning, candidates }, null, 2)}\n`);
  console.log(`已写入待人工审查的候选文件：${output}`);
}
if (commonOrderOutput) {
  const positions = Object.fromEntries([...commonPositionIndexes.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, indexes]) => [key, [...indexes].sort((left, right) => left - right)]));
  await writeFile(resolve(commonOrderOutput), `${JSON.stringify({ source: report.source, tuning: source.tuning, positions }, null, 2)}\n`);
  console.log(`已写入 ChordPro 标准形状排序索引：${commonOrderOutput}`);
}
