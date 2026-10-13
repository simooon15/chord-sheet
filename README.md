# ChordSheet

把已有的和弦谱，整理成适合阅读、调整和继续编辑的谱面。

ChordSheet 是一个本地优先的浏览器制谱与阅读工具，适合把散落在文字、截图或 PDF 中的和弦谱整理成自己的曲库。通过配套制谱 Skill 生成 `.chordsheet` 谱包后，你可以在浏览器中阅读歌词和和弦、调整调性与指法、校正和弦落点，再导出保存或打印。

## 能做什么

- **阅读谱面**：查看段落、歌词、和弦名称与指法图，调整字号；支持桌面和手机阅读。
- **按自己的习惯演奏**：转调、设置 Capo，查看实际调性，为同一和弦选择本曲使用的指法。
- **继续编辑**：在桌面端修改谱面文字与和弦落点，把和弦对应到歌词的具体字符。
- **管理本地曲库**：歌曲自动保存在当前浏览器，导出 `.chordsheet` 谱包用于备份或转移，也可打印或通过浏览器保存为 PDF。
- **带到有谱么继续编辑**：v0.2.1 提供歌曲导入书签，用于适配新版编辑器；实际书签导入仍待真实兼容验收。

## 从一份谱开始

1. 下载 [ChordSheet Builder 制谱 Skill](public/downloads/chordsheet-builder-skill-v0.2.0.zip)，在支持 Skill 的 AI 工具中使用它，把和弦歌词、截图或 PDF 整理成 `.chordsheet` 谱包。
2. 打开 ChordSheet，把谱包拖进页面，或点击选择文件。也可以先打开内置 The Cure 基准谱，体验阅读与调整功能。
3. 根据演奏需要调整调性、Capo、字号和指法；需要修正文字或和弦位置时，在桌面端进入编辑模式。
4. 导出谱包保留可编辑副本，或打印成阅读用谱。

应用直接导入的是 `.chordsheet` 谱包；文字、截图和 PDF 需先由制谱 Skill 整理。制谱结果仍需对照原谱核对，特别是和弦对应的歌词字符。

本地曲库保存在当前浏览器中。切换设备、浏览器或清除网站数据前，请导出谱包备份。

## 本地运行

准备好 Node.js 和 npm，在项目目录运行：

```bash
npm install
npm run dev
```

打开终端显示的本地地址即可使用。

## 当前版本

当前代码版本为 **v0.2.1**，属于有谱么导入适配补丁。旧版“复制到有谱么”已替换为“导入到有谱么”：将歌曲导入按钮拖到 Chrome 书签栏，再到有谱么草稿页点击书签，目标是直接插入谱面，无需手工复制粘贴。

此版本为 `release-candidate`，本地验证已通过，真实有谱么书签点击验收尚未完成。最近正式版本为 v0.2.0。具体步骤与限制见 [有谱么导入说明](docs/technical/yopu-import-bookmark.md)。

## 开发与产品文档

当前补丁的范围见 [v0.2.1 简要 PRD](docs/versions/v0.2.1/prd-v0.2.1.md)，实际验证和待验收事项见 [v0.2.1 交付记录](docs/versions/v0.2.1/release-v0.2.1.md)。完整功能基线见 [v0.2.0 PRD](docs/versions/v0.2.0/prd-v0.2.0.md) 与 [技术实施](docs/versions/v0.2.0/implementation-v0.2.0.md)。

参与文档维护前，请阅读 [文档规范](docs/overview/writing-guidelines.md)。第三方指法数据的来源与许可见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)。

开发侧验证命令：

```bash
npm run test:run
npm run build
npm run test:e2e
```
