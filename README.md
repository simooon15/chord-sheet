# ChordSheet

当前代码版本为`v0.2.1`（release-candidate，有谱么新版书签导入待真实编辑器验收）。最近正式发布版本为`v0.2.0`，已于 2026-08-18 由项目负责人确认定稿。

## 文档规范

创建、修改或审核任何正式文档前，必须先阅读并遵守[项目文档撰写与结构规范](docs/overview/writing-guidelines.md)。该文件是文档职责、结构、信息密度、维护方式和发布前检查的唯一权威来源；README只保留入口，不复制规范正文。

Release文档在对应版本开发完成后创建为`release-candidate`，并与版本交付同步；项目负责人验收期间持续更新，验收通过后才定稿为`released`。

## 文档导航

- 上一版本`v0.1.1`：[PRD](docs/versions/v0.1.1/prd-v0.1.1.md)、[Implementation](docs/versions/v0.1.1/implementation-v0.1.1.md)、[Release](docs/versions/v0.1.1/release-v0.1.1.md)
- 最近正式版本`v0.2.0`：[PRD](docs/versions/v0.2.0/prd-v0.2.0.md)、[Implementation](docs/versions/v0.2.0/implementation-v0.2.0.md)、[Release](docs/versions/v0.2.0/release-v0.2.0.md)
- 当前版本`v0.2.1`：[交付记录与验收状态](docs/versions/v0.2.1/release-v0.2.1.md)。
- 有谱么新版适配：[导入书签协议、操作与验收状态](docs/technical/yopu-import-bookmark.md)；已替换旧版复制入口，真实书签点击待验收。

## 本地运行

```bash
npm install
npm run dev
```

常用验证命令：

```bash
npm run build
npm run test:run
npm run test:e2e
```
