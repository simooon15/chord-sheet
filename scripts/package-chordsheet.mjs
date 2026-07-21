import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createChordSheetArchive } from "../src/package/archive.mjs";

const args = process.argv.slice(2);
const [jsonFile] = args;
const sources = new Map();
let output;
for (let index = 1; index < args.length; index += 1) {
  if (args[index] === "--source") {
    const [archivePath, localPath] = (args[index + 1] ?? "").split("=", 2);
    if (!archivePath || !localPath) throw new Error("--source 需要使用 sources/name=本地文件 的形式。");
    sources.set(archivePath, new Uint8Array(await readFile(resolve(localPath))));
    index += 1;
  } else if (args[index] === "--output") {
    output = args[index + 1];
    index += 1;
  }
}
if (!jsonFile || !output) throw new Error("用法：node scripts/package-chordsheet.mjs <chordsheet.json> [--source 归档路径=本地文件] --output song.chordsheet");

const document = JSON.parse(await readFile(resolve(jsonFile), "utf8"));
await writeFile(resolve(output), createChordSheetArchive(document, sources));
console.log(`已创建谱包：${output}`);
