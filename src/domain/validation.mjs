import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import schema from "../../schema/chordsheet.schema.json" with { type: "json" };
import { graphemeCount } from "./graphemes.mjs";
import { parseKey } from "./chords.mjs";

const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, strictTypes: false });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

/** @param {string} path @param {string} message */
const semanticIssue = (path, message) => ({ code: "SEMANTIC_INVALID", path, message });

/** @param {unknown} value @param {Set<string>} ids @param {Array<any>} issues @param {string} path */
function collectId(value, ids, issues, path) {
  if (!value || typeof value !== "object" || !("id" in value)) return;
  const id = value.id;
  if (ids.has(id)) issues.push(semanticIssue(`${path}/id`, `重复 id：${id}`));
  ids.add(id);
}

/** @param {any} document @param {{ sourcePaths?: Set<string> }} [options] */
export function validateChordSheet(document, options = {}) {
  const schemaValid = validateSchema(document);
  if (!schemaValid) {
    return (validateSchema.errors ?? []).map((error) => ({
      code: "SCHEMA_INVALID",
      path: error.instancePath || "/",
      message: error.message ?? "不符合谱包结构"
    }));
  }

  const issues = [];
  const ids = new Set();
  const sourceIds = new Set();
  const voicingIds = new Set();
  const rhythmIds = new Set();

  document.sources.forEach((source, index) => {
    collectId(source, ids, issues, `/sources/${index}`);
    sourceIds.add(source.id);
    if (source.embedded && source.path && options.sourcePaths && !options.sourcePaths.has(source.path)) {
      issues.push(semanticIssue(`/sources/${index}/path`, "已嵌入的来源文件不在归档中"));
    }
  });

  document.voicings.forEach((voicing, index) => {
    collectId(voicing, ids, issues, `/voicings/${index}`);
    voicingIds.add(voicing.id);
    if (voicing.tuning.length !== voicing.frets.length || (voicing.fingers && voicing.fingers.length !== voicing.frets.length)) {
      issues.push(semanticIssue(`/voicings/${index}`, "指法的 tuning、frets 与 fingers 长度必须一致"));
    }
    for (const [barreIndex, barre] of (voicing.barres ?? []).entries()) {
      if (barre.fromString > barre.toString || barre.toString > voicing.tuning.length || barre.fret < voicing.baseFret) {
        issues.push(semanticIssue(`/voicings/${index}/barres/${barreIndex}`, "横按范围或品位无效"));
      }
    }
  });

  for (const [sectionIndex, section] of document.sections.entries()) {
    collectId(section, ids, issues, `/sections/${sectionIndex}`);
    for (const [lineIndex, line] of section.lines.entries()) {
      collectId(line, ids, issues, `/sections/${sectionIndex}/lines/${lineIndex}`);
      const linePath = `/sections/${sectionIndex}/lines/${lineIndex}`;
      const chords = line.type === "annotation" ? [] : line.chords;
      let previousAnchor = -1;
      const seenAnchors = new Set();
      for (const [chordIndex, chord] of chords.entries()) {
        collectId(chord, ids, issues, `${linePath}/chords/${chordIndex}`);
        if (chord.voicingId && !voicingIds.has(chord.voicingId)) {
          issues.push(semanticIssue(`${linePath}/chords/${chordIndex}/voicingId`, "引用的指法不存在"));
        }
        for (const [evidenceIndex, evidence] of (chord.evidence ?? []).entries()) {
          if (!sourceIds.has(evidence.sourceId)) {
            issues.push(semanticIssue(`${linePath}/chords/${chordIndex}/evidence/${evidenceIndex}/sourceId`, "引用的来源不存在"));
          }
          if (evidence.region && evidence.region.x + evidence.region.width > 1 + Number.EPSILON || evidence.region && evidence.region.y + evidence.region.height > 1 + Number.EPSILON) {
            issues.push(semanticIssue(`${linePath}/chords/${chordIndex}/evidence/${evidenceIndex}/region`, "归一化区域超出来源边界"));
          }
        }
        if (line.type === "lyrics") {
          const offset = chord.anchor.graphemeOffset;
          if (offset > graphemeCount(line.text)) issues.push(semanticIssue(`${linePath}/chords/${chordIndex}/anchor/graphemeOffset`, "歌词锚点超出字素边界"));
          if (offset < previousAnchor) issues.push(semanticIssue(`${linePath}/chords/${chordIndex}/anchor/graphemeOffset`, "同一歌词行的和弦必须按锚点升序保存"));
          if (seenAnchors.has(offset)) issues.push(semanticIssue(`${linePath}/chords/${chordIndex}/anchor/graphemeOffset`, "同一歌词行不能有重复锚点"));
          previousAnchor = offset;
          seenAnchors.add(offset);
        }
      }
    }
  }

  const patterns = document.rhythm?.patterns ?? [];
  for (const [patternIndex, pattern] of patterns.entries()) {
    collectId(pattern, ids, issues, `/rhythm/patterns/${patternIndex}`);
    rhythmIds.add(pattern.id);
    const usedSlots = new Set();
    for (const [eventIndex, event] of pattern.events.entries()) {
      if (event.slot >= pattern.stepsPerMeasure || usedSlots.has(event.slot)) {
        issues.push(semanticIssue(`/rhythm/patterns/${patternIndex}/events/${eventIndex}/slot`, "节奏位置必须在拍内且不可重复"));
      }
      usedSlots.add(event.slot);
    }
  }
  document.sections.forEach((section, index) => {
    if (section.rhythmPatternId && !rhythmIds.has(section.rhythmPatternId)) {
      issues.push(semanticIssue(`/sections/${index}/rhythmPatternId`, "引用的节奏型不存在"));
    }
  });
  if (document.metadata.baseWrittenKey && !parseKey(document.metadata.baseWrittenKey)) {
    issues.push(semanticIssue("/metadata/baseWrittenKey", "基础书写调性无法解析"));
  }
  return issues;
}
