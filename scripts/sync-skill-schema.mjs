import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const source = resolve("schema/chordsheet.schema.json");
const destination = resolve("skills/chordsheet/assets/chordsheet.schema.json");
await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
console.log("已同步 Skill Schema。\n");
