import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { importChordSheet } from "../src/package/archive.mjs";
import { validateChordSheet } from "../src/domain/validation.mjs";

const [input] = process.argv.slice(2);
if (!input) {
  console.error("用法：node scripts/validate-chordsheet.mjs <song.chordsheet|chordsheet.json>");
  process.exitCode = 2;
} else {
  try {
    const bytes = new Uint8Array(await readFile(input));
    if (extname(input).toLowerCase() === ".chordsheet") {
      const { document } = await importChordSheet(bytes);
      console.log(`有效谱包：${document.metadata.title} (${document.documentId})`);
    } else {
      const document = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      const issues = validateChordSheet(document);
      if (issues.length) throw new Error(`${issues[0].path}: ${issues[0].message}`);
      console.log(`有效谱面 JSON：${document.metadata.title} (${document.documentId})`);
    }
  } catch (error) {
    console.error(`校验失败：${error.message}`);
    process.exitCode = 1;
  }
}
