import { strToU8, unzipSync, zipSync } from "fflate";
import { validateChordSheet } from "../domain/validation.mjs";
import { PackageError } from "./errors.mjs";

const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
const MAX_ENTRIES = 100;
const MAX_UNCOMPRESSED_BYTES = 300 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const MAX_SOURCE_BYTES = 100 * 1024 * 1024;
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;

/** @param {Uint8Array} bytes @param {number} offset */
const u16 = (bytes, offset) => bytes[offset] | (bytes[offset + 1] << 8);
/** @param {Uint8Array} bytes @param {number} offset */
const u32 = (bytes, offset) => (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;

/** @param {Uint8Array} bytes */
function findEndOfCentralDirectory(bytes) {
  const firstOffset = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= firstOffset; offset -= 1) {
    if (u32(bytes, offset) === EOCD_SIGNATURE && offset + 22 + u16(bytes, offset + 20) === bytes.length) return offset;
  }
  throw new PackageError("PACKAGE_INVALID_ZIP", "文件不是有效的 ZIP 归档。");
}

/** @param {string} path */
function assertSafePath(path) {
  const isDirectory = path.endsWith("/");
  const trimmed = isDirectory ? path.slice(0, -1) : path;
  if (!trimmed || path.startsWith("/") || path.includes("\\") || path.includes("\0") || trimmed.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new PackageError("PACKAGE_UNSAFE_PATH", "谱包包含不安全的归档路径。", path);
  }
  if (!isDirectory && path !== "chordsheet.json" && !path.startsWith("sources/")) {
    throw new PackageError("PACKAGE_UNSAFE_PATH", "V1 谱包只允许 chordsheet.json 与 sources/ 中的文件。", path);
  }
}

/** @param {Uint8Array} bytes */
export function inspectArchive(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length > MAX_ARCHIVE_BYTES) {
    throw new PackageError("PACKAGE_LIMIT_EXCEEDED", "谱包压缩文件不能超过 100 MiB。");
  }
  const eocd = findEndOfCentralDirectory(bytes);
  const disk = u16(bytes, eocd + 4);
  const centralDirectoryDisk = u16(bytes, eocd + 6);
  const entriesOnDisk = u16(bytes, eocd + 8);
  const entryCount = u16(bytes, eocd + 10);
  const centralSize = u32(bytes, eocd + 12);
  const centralOffset = u32(bytes, eocd + 16);
  if (disk !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== entryCount || entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new PackageError("PACKAGE_INVALID_ZIP", "不支持分卷或 ZIP64 谱包。");
  }
  if (entryCount > MAX_ENTRIES || centralOffset + centralSize > bytes.length) {
    throw new PackageError("PACKAGE_LIMIT_EXCEEDED", "谱包条目数量或中央目录超出允许范围。");
  }

  const decoder = new TextDecoder("utf-8", { fatal: true });
  const paths = new Set();
  const entries = [];
  let totalUncompressed = 0;
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > centralOffset + centralSize || u32(bytes, cursor) !== CENTRAL_SIGNATURE) {
      throw new PackageError("PACKAGE_INVALID_ZIP", "谱包中央目录已损坏。");
    }
    const flags = u16(bytes, cursor + 8);
    const compressedSize = u32(bytes, cursor + 20);
    const uncompressedSize = u32(bytes, cursor + 24);
    const nameLength = u16(bytes, cursor + 28);
    const extraLength = u16(bytes, cursor + 30);
    const commentLength = u16(bytes, cursor + 32);
    const externalAttributes = u32(bytes, cursor + 38);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > centralOffset + centralSize || flags & 0x1) {
      throw new PackageError("PACKAGE_INVALID_ZIP", flags & 0x1 ? "V1 不支持加密谱包。" : "谱包中央目录已损坏。");
    }
    const path = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    assertSafePath(path);
    const isDirectory = path.endsWith("/");
    const mode = externalAttributes >>> 16;
    if ((mode & 0o170000) === 0o120000) throw new PackageError("PACKAGE_UNSAFE_PATH", "V1 不支持符号链接条目。", path);
    if (paths.has(path)) throw new PackageError("PACKAGE_UNSAFE_PATH", "谱包包含重复路径。", path);
    paths.add(path);
    if (!isDirectory) {
      totalUncompressed += uncompressedSize;
      if (totalUncompressed > MAX_UNCOMPRESSED_BYTES || (path === "chordsheet.json" && uncompressedSize > MAX_DOCUMENT_BYTES) || (path.startsWith("sources/") && uncompressedSize > MAX_SOURCE_BYTES)) {
        throw new PackageError("PACKAGE_LIMIT_EXCEEDED", "谱包解压后的文件大小超出允许范围。", path);
      }
      entries.push({ path, compressedSize, uncompressedSize });
    }
    cursor = next;
  }
  if (cursor !== centralOffset + centralSize || !paths.has("chordsheet.json")) {
    throw new PackageError("DOCUMENT_MISSING", "谱包根目录缺少 chordsheet.json。");
  }
  return entries;
}

/** @param {Uint8Array} bytes */
async function sha256(bytes) {
  if (!globalThis.crypto?.subtle) throw new PackageError("SOURCE_MISSING", "当前环境无法校验来源摘要。");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (part) => part.toString(16).padStart(2, "0")).join("");
}

/**
 * Validates, decompresses and verifies a package before it reaches storage.
 * @param {Uint8Array} bytes
 */
export async function importChordSheet(bytes) {
  const entries = inspectArchive(bytes);
  let contents;
  try {
    contents = unzipSync(bytes);
  } catch {
    throw new PackageError("PACKAGE_INVALID_ZIP", "谱包无法解压。");
  }
  const documentBytes = contents["chordsheet.json"];
  if (!documentBytes) throw new PackageError("DOCUMENT_MISSING", "谱包根目录缺少 chordsheet.json。");
  let document;
  try {
    document = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(documentBytes));
  } catch {
    throw new PackageError("DOCUMENT_INVALID_JSON", "chordsheet.json 不是有效的 UTF-8 JSON。");
  }
  if (document.formatVersion !== "1.0.0") throw new PackageError("VERSION_UNSUPPORTED", "只支持 ChordSheet 1.0.0 谱包。");

  const sourcePaths = new Set(entries.filter((entry) => entry.path.startsWith("sources/")).map((entry) => entry.path));
  const issues = validateChordSheet(document, { sourcePaths });
  if (issues.length) {
    const error = issues[0];
    throw new PackageError(error.code, error.message, error.path);
  }
  for (const source of document.sources) {
    if (source.embedded && source.sha256) {
      const sourceBytes = contents[source.path];
      if (!sourceBytes || await sha256(sourceBytes) !== source.sha256) {
        throw new PackageError("SOURCE_MISSING", "嵌入来源的摘要不匹配。", source.path);
      }
    }
  }
  const sources = new Map(entries.filter((entry) => entry.path.startsWith("sources/")).map((entry) => [entry.path, contents[entry.path]]));
  return { document, sources };
}

/**
 * Creates the portable .chordsheet ZIP used by both export paths.
 * @param {any} document
 * @param {Map<string, Uint8Array>} [sources]
 */
export function createChordSheetArchive(document, sources = new Map()) {
  const issues = validateChordSheet(document, { sourcePaths: new Set(sources.keys()) });
  if (issues.length) {
    const error = issues[0];
    throw new PackageError(error.code, error.message, error.path);
  }
  /** @type {Record<string, Uint8Array>} */
  const archiveEntries = { "chordsheet.json": strToU8(`${JSON.stringify(document, null, 2)}\n`) };
  for (const [path, data] of sources.entries()) {
    assertSafePath(path);
    if (!path.startsWith("sources/")) throw new PackageError("PACKAGE_UNSAFE_PATH", "来源文件必须放在 sources/ 下。", path);
    archiveEntries[path] = data;
  }
  return zipSync(archiveEntries, { level: 6 });
}
