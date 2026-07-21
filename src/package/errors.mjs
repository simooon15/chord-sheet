export class PackageError extends Error {
  /** @param {string} code @param {string} message @param {string} [path] */
  constructor(code, message, path) {
    super(message);
    this.name = "PackageError";
    this.code = code;
    this.path = path;
  }
}
