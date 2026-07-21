import { describe, expect, it } from "vitest";
import { parseChordSymbol, soundingKey, transposeChordSymbol, transposeKey } from "../../src/domain/chords.mjs";

describe("和弦转调", () => {
  it("只移动根音和有效的 slash bass，保留和弦性质", () => {
    expect(transposeChordSymbol("Bbmaj7/F", 2)).toEqual({ symbol: "Cmaj7/G", supported: true });
    expect(transposeChordSymbol("C6/9", 2)).toEqual({ symbol: "D6/9", supported: true });
    expect(transposeChordSymbol("F#m7b5/A", -1)).toEqual({ symbol: "Fm7b5/G#", supported: true });
  });

  it("不安全的符号保持原样", () => {
    expect(parseChordSymbol("(C)" )).toBeNull();
    expect(transposeChordSymbol("(C)", 2)).toEqual({ symbol: "(C)", supported: false });
  });

  it("区分书写调、转调和手动 capo 的实际调", () => {
    expect(transposeKey("C", 2)).toBe("D");
    expect(soundingKey("C", 0, 1)).toBe("C#");
    expect(soundingKey("C", 2, 1)).toBe("D#");
  });
});
