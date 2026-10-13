import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const theCurePackage = "output/the-cure-test-run/the-cure-olivia-rodrigo.character-anchor-test.chordsheet";

test("homepage validates and imports a dropped .chordsheet package", async ({ page, isMobile }) => {
  test.skip(isMobile, "The drag-and-drop path is covered once on desktop.");
  await page.goto("/");
  const packageBytes = await readFile(theCurePackage);
  const dataTransfer = await page.evaluateHandle((bytes) => {
    const file = new File([new Uint8Array(bytes)], "the-cure.character-anchor-test.chordsheet", { type: "application/zip" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    return transfer;
  }, Array.from(packageBytes));
  await page.getByRole("button", { name: "拖入 .chordsheet 谱包，或点击选择文件" }).dispatchEvent("drop", { dataTransfer });
  await expect(page.getByRole("heading", { name: "The Cure" })).toBeVisible();
});

test("desktop reader supports global chord display, transpose and desktop editing", async ({ page, isMobile }) => {
  test.skip(isMobile, "Only applicable to the desktop project.");
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles(theCurePackage);
  await expect(page.getByRole("heading", { name: "The Cure" })).toBeVisible();

  await page.getByRole("button", { name: "显示名称 + 指法" }).click();
  await expect(page.locator(".score-lyrics .chord-diagram").first()).toBeVisible();
  await expect(page.getByText("暂无指法")).toHaveCount(0);
  await page.getByRole("button", { name: "升半音" }).click();
  await expect(page.locator(".song-metadata dd").first()).toHaveText("C#");

  await page.getByRole("button", { name: "编辑" }).click();
  await expect(page.getByLabel(/歌词/).first()).toBeVisible();
  await expect(page.getByRole("slider", { name: /锚点/ }).first()).toBeVisible();
});

test("desktop changes The Cure C voicing, saves it in the song and generates a Yopu import bookmark", async ({ page, isMobile }) => {
  test.skip(isMobile, "The persistence and clipboard path is covered once on desktop.");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles(theCurePackage);

  await page.getByRole("button", { name: "C，换指法" }).first().click();
  const picker = page.getByRole("dialog", { name: "选择 C 的指法" });
  await expect(picker).toBeVisible();
  await expect(picker.getByRole("radio")).toHaveCount(3);
  await picker.getByRole("radio").nth(1).click();
  await expect(picker).toHaveCount(0);
  await expect(page.getByText("已将 C 的指法应用到本曲全部同名和弦。")).toBeVisible();
  await expect(page.getByText("已保存到此浏览器")).toBeVisible();

  await page.getByRole("button", { name: "曲库" }).click();
  await page.getByRole("button", { name: "The Cure · Olivia Rodrigo" }).click();
  await page.getByRole("button", { name: "C，换指法" }).first().click();
  await expect(page.getByRole("radio").first()).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "关闭指法选择器" }).click();

  await page.getByRole("button", { name: "导入到有谱么" }).click();
  const bookmark = page.getByRole("link", { name: "导入 The Cure 到有谱么" });
  await expect(bookmark).toHaveAttribute("draggable", "true");
  await page.locator(".yopu-import").screenshot({ path: "test-results/yopu-import-preview.png" });
  const href = await bookmark.getAttribute("href");
  expect(href).toMatch(/^javascript:/);
  expect(decodeURIComponent(href!)).toContain("user-data-xhe-copy");
  await bookmark.click();
  await expect(page.locator(".document-notice")).toContainText("请把导入按钮拖到书签栏");

});

test("mobile retains every reading control and directs detailed edits to desktop", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Only applicable to the mobile project.");
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles(theCurePackage);
  await expect(page.getByRole("heading", { name: "The Cure" })).toBeVisible();
  await expect(page.getByRole("button", { name: "编辑" })).toBeHidden();
  await expect(page.getByRole("button", { name: "显示名称 + 指法" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "谱面字号" })).toBeVisible();
  await expect(page.getByText("需要校正歌词或和弦落点？请在桌面端打开此谱。")).toBeVisible();
  await expect(page.locator(".editor-panel")).toBeHidden();
});

test("mobile uses the same C voicing picker without horizontal overflow", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Only applicable to the mobile project.");
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles(theCurePackage);
  await page.getByRole("button", { name: "C，换指法" }).first().tap();
  const picker = page.getByRole("dialog", { name: "选择 C 的指法" });
  await expect(picker).toBeVisible();
  await expect(picker.getByRole("radio")).toHaveCount(3);
  const columnCount = await page.locator(".voicing-candidates").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  expect(columnCount).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await picker.getByRole("radio").nth(1).tap();
  await expect(picker).toHaveCount(0);
});

test("imports the character-anchored The Cure package with Db sounding key and complementary chord overview", async ({ page, isMobile }) => {
  test.skip(isMobile, "The desktop baseline covers the full diagram grid.");
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles(theCurePackage);
  await expect(page.getByRole("heading", { name: "The Cure" })).toBeVisible();
  await expect(page.getByText("实际调：Db")).toBeVisible();
  // 谱包默认 name：概览显示指法图，正文仅显示和弦名称。
  await expect(page.locator(".overview-chords .chord-diagram").first()).toBeVisible();
  await expect(page.locator(".score .chord-diagram")).toHaveCount(0);
  await page.getByRole("button", { name: "展开指法" }).click();
  await expect(page.locator(".overview-chords .chord-diagram")).toHaveCount(0);
  await expect(page.locator(".score .chord-diagram").first()).toBeVisible();
});
