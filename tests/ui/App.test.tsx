import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import fixture from "../../output/the-cure-test-run/chordsheet.json";
import { createChordSheetArchive } from "../../src/package/archive.mjs";
import { App } from "../../src/ui/App";

describe("本地实时谱页面", () => {
  it("首页提供可下载的制谱 Skill", () => {
    render(<App />);
    const link = screen.getByRole("link", { name: "下载 ChordSheet Builder 制谱 Skill（ZIP）" });
    expect(link).toHaveAttribute("href", "/downloads/chordsheet-builder-skill-v0.1.1.zip");
    expect(link).toHaveAttribute("download");
  });

  it("可打开 The Cure 基准谱并将全谱切换到名称与内置指法模式", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "打开 The Cure 基准谱" }));
    expect(await screen.findByRole("heading", { name: "The Cure" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "显示名称 + 指法" }));
    expect(screen.getAllByLabelText(/吉他指法/).length).toBeGreaterThan(0);
    expect(screen.queryByText("暂无指法")).not.toBeInTheDocument();
  });

  it("在编辑模式可改歌词并显示独立锚点轨道", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "打开 The Cure 基准谱" }));
    await user.click(screen.getByRole("button", { name: "编辑" }));
    const lyricInput = screen.getByDisplayValue("All the pretty girls in the foreground of my mind");
    fireEvent.change(lyricInput, { target: { value: "All the pretty girls in the foreground" } });
    expect(screen.getByDisplayValue("All the pretty girls in the foreground")).toBeInTheDocument();
    expect(screen.getAllByRole("slider", { name: /锚点/ }).length).toBeGreaterThan(0);
  });

  it("可在主页拖入 .chordsheet 谱包并沿用标准导入流程", async () => {
    render(<App />);
    const archive = createChordSheetArchive(fixture);
    const file = {
      name: "the-cure.character-anchor-test.chordsheet",
      arrayBuffer: async () => archive.slice().buffer
    } as unknown as File;
    fireEvent.drop(screen.getByRole("button", { name: "拖入 .chordsheet 谱包，或点击选择文件" }), { dataTransfer: { files: [file] } });
    expect(await screen.findByRole("heading", { name: "The Cure" })).toBeInTheDocument();
  });

  it("主页拖入非谱包文件时不尝试识别原始材料", () => {
    render(<App />);
    const file = { name: "source.pdf" } as File;
    fireEvent.drop(screen.getByRole("button", { name: "拖入 .chordsheet 谱包，或点击选择文件" }), { dataTransfer: { files: [file] } });
    expect(screen.getByText(/请导入以 .chordsheet 结尾的谱包/)).toBeInTheDocument();
  });
});
