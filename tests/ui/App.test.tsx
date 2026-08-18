import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import fixture from "../../output/the-cure-test-run/chordsheet.json";
import { createChordSheetArchive } from "../../src/package/archive.mjs";
import { App } from "../../src/ui/App";

describe("本地实时谱页面", () => {
  it("首页提供可下载的制谱 Skill", () => {
    render(<App />);
    const link = screen.getByRole("link", { name: "下载 ChordSheet Builder 制谱 Skill（ZIP）" });
    expect(link).toHaveAttribute("href", "/downloads/chordsheet-builder-skill-v0.2.0.zip");
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

  it("使用 The Cure 的 C 候选更换全曲指法并可恢复默认", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "打开 The Cure 基准谱" }));
    const trigger = screen.getByRole("button", { name: "C，换指法" });
    await user.click(trigger);

    expect(screen.getByRole("dialog", { name: "选择 C 的指法" })).toBeInTheDocument();
    const candidates = screen.getAllByRole("radio");
    expect(candidates).toHaveLength(3);
    expect(candidates[0]).toHaveAttribute("aria-checked", "true");
    await user.click(candidates[1]);
    expect(screen.queryByRole("dialog", { name: "选择 C 的指法" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "C，换指法" }));
    expect(screen.getAllByRole("radio")[0]).toHaveAttribute("aria-checked", "true");
    const reset = screen.getByRole("button", { name: "恢复默认指法" });
    expect(reset).toBeEnabled();
    await user.click(reset);

    await user.click(screen.getByRole("button", { name: "C，换指法" }));
    expect(screen.getByRole("button", { name: "恢复默认指法" })).toBeDisabled();
  });

  it("指法选择器支持方向键、Escape，并把焦点还给触发按钮", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "打开 The Cure 基准谱" }));
    const trigger = screen.getByRole("button", { name: "C，换指法" });
    await user.click(trigger);
    const candidates = screen.getAllByRole("radio");
    expect(candidates[0]).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(candidates[1]).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("复制有谱么载荷前列出降级项，并写入包含单一哨兵的完整内容", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<App />);
    await user.click(screen.getByRole("button", { name: "打开 The Cure 基准谱" }));
    await user.click(screen.getByRole("button", { name: "复制到有谱么" }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("歌曲资料不会随剪贴板传递"));
    expect(writeText).toHaveBeenCalledOnce();
    const payload = writeText.mock.calls[0][0] as string;
    expect(payload.split("_XHE_COPY_PASTE_SENTINEL_")).toHaveLength(2);
    expect(() => JSON.parse(payload.split("_XHE_COPY_PASTE_SENTINEL_")[1])).not.toThrow();
    expect(screen.getByText(/已复制有谱么兼容内容/)).toBeInTheDocument();
  });

  it("剪贴板权限失败时显示可全选的完整载荷", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<App />);
    await user.click(screen.getByRole("button", { name: "打开 The Cure 基准谱" }));
    await user.click(screen.getByRole("button", { name: "复制到有谱么" }));
    const fallback = await screen.findByRole("textbox");
    expect((fallback as HTMLTextAreaElement).value).toContain("_XHE_COPY_PASTE_SENTINEL_");
    expect(screen.getByText(/浏览器未允许写入剪贴板/)).toBeInTheDocument();
  });
});
