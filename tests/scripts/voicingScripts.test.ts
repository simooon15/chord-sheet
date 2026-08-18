import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

function runScript(script: string, args: string[] = []) {
  return execFileSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
}

describe("指法库维护脚本", () => {
  it("审计当前内置库并输出稳定的结构与质量摘要", () => {
    const report = JSON.parse(runScript("scripts/audit-guitar-voicings.mjs")) as {
      chordEntryCount: number;
      positionCount: number;
      structuralErrors: string[];
      duplicateFingerprints: string[];
      pitchClassMismatches: string[];
    };
    expect(report).toMatchObject({ chordEntryCount: 828, positionCount: 3283, structuralErrors: [] });
    expect(report.duplicateFingerprints).toEqual(["G:major[0] = G:major[1]"]);
    expect(report.pitchClassMismatches.length).toBeGreaterThan(0);
  });

  it("将 ChordPro 输入转换为仅供人工审查的差异报告", () => {
    const report = JSON.parse(runScript("scripts/import-chordpro-voicings.mjs", [
      "tests/fixtures/chordpro-guitar.synthetic.json",
      "--version", "fixture",
      "--commit", "fixture"
    ])) as {
      sourceChordCount: number;
      concreteEntries: number;
      aliases: number;
      convertibleEntries: number;
      identicalShapes: unknown[];
      candidateCount: number;
      unconvertible: Array<{ name: string; reason: string }>;
    };
    expect(report).toMatchObject({
      sourceChordCount: 4,
      concreteEntries: 3,
      aliases: 1,
      convertibleEntries: 3,
      candidateCount: 0
    });
    expect(report.identicalShapes).toHaveLength(3);
    expect(report.unconvertible).toEqual([{ name: "H", reason: "unsupported chord name" }]);
  });

  it("只为与主库同形的 ChordPro 标准按法生成离线排序索引", async () => {
    const directory = await mkdtemp(join(tmpdir(), "chordsheet-common-order-"));
    const output = join(directory, "common-order.json");
    try {
      runScript("scripts/import-chordpro-voicings.mjs", [
        "tests/fixtures/chordpro-guitar.synthetic.json",
        "--version", "fixture",
        "--commit", "fixture",
        "--common-order-output", output
      ]);
      const order = JSON.parse(await readFile(output, "utf8")) as { positions: Record<string, number[]> };
      expect(order.positions).toEqual({ "C:major": [0], "D:7": [0] });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
