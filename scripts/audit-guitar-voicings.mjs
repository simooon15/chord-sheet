import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { noteToSemitone } from "../src/domain/chords.mjs";

const input = process.argv[2] ?? "src/data/guitar-voicings.json";
const catalogue = JSON.parse(await readFile(resolve(input), "utf8"));

const SUPPORTED_INTERVALS = new Map([
  ["major", [0, 4, 7]], ["minor", [0, 3, 7]], ["dim", [0, 3, 6]], ["dim7", [0, 3, 6, 9]],
  ["aug", [0, 4, 8]], ["sus", [0, 5, 7]], ["sus2", [0, 2, 7]], ["sus4", [0, 5, 7]],
  ["5", [0, 7]], ["6", [0, 4, 7, 9]], ["69", [0, 2, 4, 7, 9]],
  ["7", [0, 4, 7, 10]], ["maj7", [0, 4, 7, 11]], ["m7", [0, 3, 7, 10]],
  ["m7b5", [0, 3, 6, 10]], ["mMaj7", [0, 3, 7, 11]], ["add9", [0, 2, 4, 7]],
  ["madd9", [0, 2, 3, 7]], ["9", [0, 2, 4, 7, 10]], ["maj9", [0, 2, 4, 7, 11]],
  ["m9", [0, 2, 3, 7, 10]]
]);

function structuralError(message) {
  structuralErrors.push(message);
}

function absoluteFrets(position) {
  return position.f.map((fret) => fret < 0 ? null : fret === 0 ? 0 : fret + position.b - 1);
}

function fingerprint(position) {
  return JSON.stringify(absoluteFrets(position));
}

function tuningPitch(note) {
  return noteToSemitone(note.replace(/-?\d+$/u, ""));
}

function chordParts(key) {
  const [root, suffix] = key.split(":", 2);
  const rootPitch = noteToSemitone(root);
  if (rootPitch === undefined || !suffix || suffix.includes("/")) return undefined;
  const intervals = SUPPORTED_INTERVALS.get(suffix);
  if (!intervals) return undefined;
  return { rootPitch, intervals };
}

const structuralErrors = [];
const duplicateFingerprints = [];
const pitchMismatches = [];
const unsupportedSuffixes = new Map();
const tuning = Array.isArray(catalogue.tuning) ? catalogue.tuning : [];
const tuningPitches = tuning.map(tuningPitch);
const entries = Object.entries(catalogue.chords ?? {}).sort(([left], [right]) => left.localeCompare(right));
let positionCount = 0;
let minPositions = Infinity;
let maxPositions = 0;

if (!catalogue.source?.name || !catalogue.source?.version || !catalogue.source?.license || !catalogue.source?.repository) {
  structuralError("source 缺少 name、version、license 或 repository。");
}
if (tuning.length !== 6 || tuningPitches.some((pitch) => pitch === undefined)) {
  structuralError("tuning 必须是六根可解析的吉他定弦。");
}

for (const [key, positions] of entries) {
  if (!Array.isArray(positions) || positions.length === 0) {
    structuralError(`${key}: positions 必须是非空数组。`);
    continue;
  }
  positionCount += positions.length;
  minPositions = Math.min(minPositions, positions.length);
  maxPositions = Math.max(maxPositions, positions.length);

  const seen = new Map();
  const components = chordParts(key);
  if (!components) {
    const suffix = key.split(":", 2)[1] ?? "(invalid)";
    unsupportedSuffixes.set(suffix, (unsupportedSuffixes.get(suffix) ?? 0) + 1);
  }

  positions.forEach((position, index) => {
    if (!position || !Array.isArray(position.f) || !Array.isArray(position.i) || !Array.isArray(position.r)) {
      structuralError(`${key}[${index}]: f、i、r 必须是数组。`);
      return;
    }
    if (position.f.length !== tuning.length || position.i.length !== tuning.length) {
      structuralError(`${key}[${index}]: f 与 i 必须各有 ${tuning.length} 项。`);
    }
    if (!Number.isInteger(position.b) || position.b < 1 || position.b > 24) {
      structuralError(`${key}[${index}]: b 必须是 1–24 的整数。`);
    }
    position.f.forEach((fret, fretIndex) => {
      if (!Number.isInteger(fret) || fret < -1 || fret > 24) {
        structuralError(`${key}[${index}].f[${fretIndex}]: 必须是 -1–24 的整数。`);
      }
    });
    position.i.forEach((finger, fingerIndex) => {
      if (!Number.isInteger(finger) || finger < -1 || finger > 4) {
        structuralError(`${key}[${index}].i[${fingerIndex}]: 必须是 -1–4 的整数。`);
      }
    });
    position.r.forEach((barre, barreIndex) => {
      if (!Number.isInteger(barre) || barre < 1 || !position.f.includes(barre)) {
        structuralError(`${key}[${index}].r[${barreIndex}]: 必须是当前按法中出现的正整数品位。`);
      }
    });

    const shape = fingerprint(position);
    const firstIndex = seen.get(shape);
    if (firstIndex === undefined) seen.set(shape, index);
    else duplicateFingerprints.push(`${key}[${firstIndex}] = ${key}[${index}]`);

    if (!components || tuningPitches.some((pitch) => pitch === undefined)) return;
    const allowed = new Set(components.intervals.map((interval) => (components.rootPitch + interval) % 12));
    const mismatch = absoluteFrets(position).some((fret, stringIndex) => (
      fret !== null && !allowed.has((tuningPitches[stringIndex] + fret) % 12)
    ));
    if (mismatch) pitchMismatches.push(`${key}[${index}]`);
  });
}

const report = {
  source: catalogue.source,
  tuning,
  chordEntryCount: entries.length,
  positionCount,
  positionsPerChord: { min: Number.isFinite(minPositions) ? minPositions : 0, max: maxPositions },
  duplicateFingerprints,
  structuralErrors,
  unsupportedSuffixes: Object.fromEntries([...unsupportedSuffixes.entries()].sort(([left], [right]) => left.localeCompare(right))),
  pitchClassMismatches: pitchMismatches
};

console.log(JSON.stringify(report, null, 2));
if (structuralErrors.length) process.exitCode = 1;
