import { describe, expect, it } from "vitest";
import fixture from "../../output/the-cure-test-run/chordsheet.json";
import { createChordSheetArchive, importChordSheet, inspectArchive } from "../../src/package/archive.mjs";

describe(".chordsheet 归档", () => {
  it("可安全地打包并无损导入 The Cure 字符锚定基准谱", async () => {
    const archive = createChordSheetArchive(fixture);
    expect(inspectArchive(archive)).toEqual(expect.arrayContaining([expect.objectContaining({ path: "chordsheet.json" })]));
    const imported = await importChordSheet(archive);
    expect(imported.document).toEqual(fixture);
    expect(imported.sources.size).toBe(0);
  });
});
