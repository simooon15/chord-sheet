# ChordSheet v0.1.1 技术实施方案

| 项目 | 说明 |
|---|---|
| 状态 | draft |
| 产品版本 | v0.1.1（修复版本：布局缺陷、制谱锚定可靠性、视觉与动效改版） |
| 读者 | 执行开发任务的 Codex、ChordSheet 维护者 |
| 文档职责 | 将 v0.1.1 呈现层与字符级制谱锚定规则落实为具体改动清单、实现方式、开发顺序与测试门槛 |
| 产品基线 | `docs/versions/v0.1.1/prd-v0.1.1.md` |
| 架构与领域权威 | `docs/versions/v0.1.0/implementation-v0.1.0.md` |
| 实际交付记录 | `docs/versions/v0.1.1/release-v0.1.1.md` |

## 1. 实施目标与约束

本文说明如何实现 `docs/versions/v0.1.1/prd-v0.1.1.md` 已确认的呈现层规则，并记录制谱 Skill 的字符级锚定与统一测试基准。架构、数据契约、校验、存储、领域逻辑与编辑流程不变，`docs/versions/v0.1.0/implementation-v0.1.0.md` 仍是这些部分的权威，本文不重复其内容。

以下限制贯穿全部改动：

1. 呈现层改动样式优先：除两处 TSX 小改动外，全部改动落在 `src/styles.css`；字符级锚定仅更新 Skill 规则与测试基准，不改应用运行时；
2. 不修改 `:root` 任何颜色 token 的定义值；hover 洗色等允许使用既有 token 的透明度派生；
3. 不重构组件、不新增依赖、不引入动画库；
4. 已完成的两项缺陷修复（第 3、4 节）与字符级锚定规则（第 12 节）作为事实记录，不得回退；待实施项（第 5–9 节）按第 10 节顺序执行。

## 2. 改动地图

| 文件 | 改动内容 | 状态 |
|---|---|---|
| `src/styles.css` | 指法图行内布局规则；层级、排印、质感、动效规则 | 部分完成 |
| `src/ui/Score.tsx` | `.score` 加 `with-diagrams` 类；`LyricScoreLine` 锚点测量；符号 `key` | 前两项已完成，`key` 待加 |
| `src/ui/ChordDiagram.tsx` | 移除来源小字 | 已完成 |
| `src/ui/App.tsx` | 概览互补分支反转；概览名称 `key` | 待实施 |
| `tests/ui/App.test.tsx` | The Cure 基准谱的下载、阅读、编辑与导入断言 | 已完成 |
| `tests/e2e/chordsheet.spec.ts` | The Cure 基准谱的拖入、桌面、手机与概览互补断言 | 已完成 |
| `package.json` | `version` 为 `0.1.1` | 已完成 |
| `skills/chordsheet/SKILL.md` | 强制 PDF/图片/文字将和弦根音映射到具体歌词字素 | 已完成 |
| `skills/chordsheet/references/conversion-rules.md` | 字符级锚定步骤、空白与不确定位置的复核规则 | 已完成 |
| `output/the-cure-test-run/` | The Cure 完整字符锚定包及其渲染页 | 已完成，后续测试基准 |

## 3. 已完成：行内指法图布局修复

### 3.1 问题根因

歌词行的和弦布局为「单行和弦名」设计：`.inline-chord-anchor` 是零宽零高内联块，`.score-chord` 对其绝对定位，`.score-lyrics` 仅以 `padding-top: 1.8em` 预留名称高度。装入约 58×100px 的 compact 指法图后，垂直方向溢出盖住上一行，水平方向因锚点零占位导致相邻图互相重叠。

### 3.2 实现方式

`Score` 容器在 `chordDisplay === "nameAndDiagram"` 时加 `with-diagrams` 类（`src/ui/Score.tsx` 的 `Score` 组件）。`src/styles.css` 新增三条规则：

```css
.score.with-diagrams .score-lyrics { padding-top: .8em; }
.score.with-diagrams .inline-chord-anchor { height: 7.2em; }
.score.with-diagrams .inline-chord-anchor .score-chord { left: 0; transform: translateX(-50%); }
```

首版方案是「歌词行 `padding-top: 6.5em` 预留空间」，在移动端歌词换行后失效：图示空间只存在于段落顶部，锚定在换行后视觉行的指法图会向上侵入上一视觉行的文字。现方案改为给锚点内联块自身高度（7.2em）：空内联块的基线即其底缘，与歌词基线对齐，它所在的视觉行行框随之撑高，因此每个含锚点的视觉行（包括换行产生的）都独立获得图示空间。锚点保持零宽，指法图以锚点为中心水平居中；指法图模式下取消名称模式的 `translateY(-.55em)` 微调（`.score.with-diagrams .score-chord .chord-diagram { transform: none; }`）。

### 3.3 拥挤锚点撑宽算法

`LyricScoreLine` 在 `useLayoutEffect` 中执行 `expandCrowdedAnchors`，保证相邻指法图不重叠，同时不影响其他位置的连续排版：

1. 先将行内全部 `.inline-chord-anchor` 的 inline `width` 清空，恢复零宽基线；
2. 锚点少于 2 个时不处理；
3. 按 `getBoundingClientRect().top` 把锚点分入各视觉行（吸收 `white-space: pre-wrap` 的自然换行），每轮最多迭代 3 次以吸收撑宽引发的换行变化；
4. 每个视觉行内按 `left` 升序，逐对测量相邻锚点中心距，小于 `DIAGRAM_ANCHOR_MIN_DISTANCE`（64px，即 compact 图宽 58px 加 6px 间隔）时，把前一个锚点的槽位撑宽到刚好满足最小距离；由于指法图以锚点左缘为中心，撑宽只推开后续文字，不改变图与锚点的对齐；
5. 用 `ResizeObserver` 监听歌词段落，容器宽度或换行变化时重跑；`ResizeObserver` 不存在的环境（如 jsdom）跳过监听。

依赖项为 `[diagramMode, line, document.view.fontScale]`；切回名称模式时清除全部 inline 宽度。转调不改变指法图宽度，无需作为依赖。

注意：锚点槽位宽度**不加 CSS transition**，只允许 `height` 过渡（280ms，即谱面呼吸）。曾给 `width` 加过渡，但算法先清空宽度再测量，`getBoundingClientRect` 读到的是宽度回退动画中的中间几何（距离被旧宽度撑大，误判为无需撑宽），与 `ResizeObserver` 重跑形成竞态，导致撑宽全部丢失。宽度修正改为即时生效后，测量始终读到稳定几何。

### 3.4 已验证事实

在 The Cure 谱包（82 张行内指法图）上按边界框检测：指法图两两重叠 0 处、与段落标题重叠 0 处、与其他歌词行重叠 0 处；全谱仅 7 处锚点被撑宽。名称模式回归检测零重叠。`npm run test:run` 20 项测试通过。

## 4. 已完成：指法图来源标注移除

`ChordDiagram.tsx` 删除 `sourceLabel` 变量与 `<small>` 元素；`styles.css` 删除 `.chord-diagram small` 规则。`<figure>` 的 `aria-label` 保留 `${symbol} 吉他指法，已核验来源：…`，数据层核验要求不变。同步更新两处断言：`tests/ui/App.test.tsx` 由 `getAllByText("内置指法库")` 改为 `getAllByLabelText(/吉他指法/)`，`tests/e2e/chordsheet.spec.ts` 由 `getByText("内置指法库")` 改为 `page.locator(".chord-diagram").first()`。移除后图总高降低约 8px，6.5em 行预留仍然充裕，无需调整。

## 5. 待实施：视觉层级与排印

### 5.1 Chrome 退后

| 选择器 | 现状 | 改为 |
|---|---|---|
| `.topbar` | `box-shadow: 0 1px 0 …, 0 8px 18px …` | 仅保留 `0 1px 0` 的 1px 分隔线 |
| `.mode-button`（编辑） | 实底黑按钮；激活态实底 accent | 与 `.quiet-button` 一致的细边框透明底；`.is-active` 用 accent 边框与文字 |
| `.toolbar-group`（已按无框工具行定稿） | 胶囊容器（边框、圆角、背景、阴影、内距） | 容器全部去除：无框、无背景、无阴影；组间 `.toolbar-group + .toolbar-group` 以 1px 竖细线（`border-left` + 18px 内距）分隔；组内标签（首个 span 与 label）降为 `var(--quiet)` 11px 小字；移动端取消分隔线 |

主操作按钮不再保留实心底色；顶栏按钮全部统一为 quiet 风格。侧栏与曲目列表不动。无框工具行是实施中经 Simon 确认的方案，替代本文早期「胶囊边框更淡、内距收窄」的过渡表述。

### 5.2 三级字阶与歌头

| 选择器 | 改动 |
|---|---|
| `.score` | `font-family` 改为 `ui-serif, "Iowan Old Style", "Songti SC", Georgia, serif`；字号行距不变 |
| `.score-section h2` | 增加 `font-variant-caps: all-small-caps`；`letter-spacing` 由 `.13em` 改为 `.16em` |
| `.song-metadata dd` | 由等宽体改为衬线字栈；增加 `font-variant-numeric: oldstyle-nums` |
| `.song-metadata dt` | 颜色改为 `var(--quiet)` |

`.score-chord`（和弦名）、`.chord-diagram`（图内标注）保持 `ui-monospace` 不变，不受 `.score` 字族影响；实施时注意 `.score` 字族变更后这两处是否继承，必要时显式声明。

### 5.3 谱面纸张

`.score-paper` 的底色、边框、阴影保持现状，仅叠加第 6 节纸纹。`.song-header` 底部由 `border-bottom: 2px solid #2a2824` 单线改为书版双线：保留 2px 主线，用 `::after` 在下方约 3px 处加 1px 同色副线。

## 6. 待实施：纸纹质感

在 `.score-paper` 上以 `background-image` 叠加灰度噪点（不用伪元素，避免层叠遮挡内容），参数固定为：

```text
data-URI 内联 SVG，160×160 平铺
feTurbulence: type=fractalNoise, baseFrequency=0.9, numOctaves=2, stitchTiles=stitch
feColorMatrix: type=saturate, values=0（去色为灰噪）
rect opacity: 0.05
```

`@media print` 中对 `.score-paper` 增加 `background-image: none`，书版双线保留。

## 7. 待实施：过渡动效

### 7.1 缓动与总开关

`:root` 新增 `--ease-editorial: cubic-bezier(.2, .6, .2, 1)`。现有 `@media (prefers-reduced-motion: reduce)` 已将全部动画与过渡压到 0.01ms，新动效自动被覆盖，不单独写降级。

### 7.2 改动清单

| 目标 | 实现 |
|---|---|
| 谱面呼吸 | `.score-lyrics { transition: padding-top 280ms var(--ease-editorial) }`；`.inline-chord-anchor { transition: height 280ms var(--ease-editorial) }`（宽度不加过渡，原因见第 3.3 节） |
| 指法图入场 | `@keyframes diagram-in`（`opacity: 0 → 1`，`translate: 0 4px → 0 0`，220ms），作用于 `.score.with-diagrams .chord-diagram` 与 `.chord-overview.with-diagrams .chord-diagram`；用 `translate` 属性而非 `transform`，避免与既有 transform 规则冲突 |
| 转调淡入 | `@keyframes chord-symbol-in`（`opacity: 0 → 1`，160ms）；`Score.tsx` 的 `ChordButton` 名称 `<span>` 加 `key={symbol}`，`App.tsx` 概览名称文本包一层 `<span key={displayName}>`，转调触发重挂载即播放 |
| 正文和弦悬停 | `.score-chord:hover` 增加 `background-color: rgba(157, 76, 53, .07)`（既有 accent 的透明度派生），约 120ms |
| 概览图悬停 | `.chord-overview.with-diagrams .overview-chord:hover` 增加 `translate: 0 -2px` 与 `box-shadow: var(--shadow-float)`，约 160ms |

## 8. 待实施：和弦概览互补呈现

`src/ui/App.tsx` 概览区两个分支反转：

1. 第 202 行附近 `.chord-overview` 的 `with-diagrams` 类条件反转：`chordDisplay === "name"` 时加该类；
2. 第 206 行附近 `.overview-chord` 内容分支反转：`chordDisplay === "name"` 时渲染 `<ChordDiagram>`，`nameAndDiagram` 时渲染名称文本（名称文本同时按第 7.2 节包 `key` 以支持转调淡入）。

概览头按钮与工具栏按钮的文案、行为不变。转调后概览指法查询逻辑（`resolveVoicing` 按原符号查询）不变。

## 9. 测试计划

### 9.1 自动化测试更新

| 用例 | 更新 |
|---|---|
| `tests/e2e/chordsheet.spec.ts` The Cure 用例 | 直接导入 `output/the-cure-test-run/the-cure-olivia-rodrigo.character-anchor-test.chordsheet`；默认 `name` 模式断言概览图示可用，切换后断言概览无图、正文 `.score-lyrics .chord-diagram` 出现 |
| `tests/e2e/chordsheet.spec.ts` 桌面阅读用例 | 不再使用演示谱；使用同一 The Cure 包验证导入、阅读、指法切换、转调和 Capo |
| `tests/ui/App.test.tsx` | 所有 fixture 改为同一 The Cure 包；概览互补断言验证 `name` 模式概览有图、切换后正文有图 |

### 9.2 人工与辅助验证

1. 指法图重叠检测：在浏览器控制台对 `.score-lyrics .chord-diagram` 做两两边界框相交检测，The Cure 全谱应为 0；同时检测与 `.score-section h2` 及其他歌词行的相交；
2. 桌面（1280px）与移动（375px）视口分别检查：歌词连续排版、无横向溢出、概览互补形态正确；
3. 打印预览：无纸纹、保留双线、无动画残留；
4. 开启系统 `prefers-reduced-motion`：全部动效关闭；
5. 切换指法显示与转调时目检过渡平滑，无瞬时跳变。

## 10. 开发顺序与完成标志

1. **概览互补与测试更新**（第 8、9.1 节）：e2e 全绿，两种模式下概览形态正确；
2. **字阶与排印**（第 5.2 节）：歌词衬线、段落标签小型大写、元信息旧式数字，重叠检测仍为 0；
3. **Chrome 退后**（第 5.1 节）：顶栏与工具栏细边框化，移动断点下无溢出；
4. **质感**（第 5.3、6 节）：双线与纸纹可见，打印预览无纸纹；
5. **动效**（第 7 节）：第 9.2 节第 4–5 条通过；
6. **收尾**：`package.json` 版本改为 `0.1.1`；`npm run test:run`、`npm run test:e2e`、`npm run build` 全部通过；更新 `docs/versions/v0.1.1/release-v0.1.1.md` 的实际交付与测试记录。

每一步只改对应清单内的选择器或文件，不顺手调整无关样式。

## 11. 风险控制

| 风险 | 控制 |
|---|---|
| 衬线字族改变锚点间距引发新重叠 | 布局为运行时实测，与字族无关；每步执行第 9.2 节重叠检测 |
| `.score` 字族被和弦名或图内标注继承 | 这两处显式声明 `ui-monospace` 字栈并目检 |
| 纸纹 data-URI 中的特殊字符破坏 CSS | 内联 SVG 的 `#` 编码为 `%23`，引号统一单引号；构建后目检 |
| 过渡与 `useLayoutEffect` 撑宽互相触发抖动 | 宽度修正不加过渡（见第 3.3 节），算法先清空再重算、结果不变即收敛 |
| e2e 断言与互补行为分叉 | 第 8 节与第 9.1 节在同一提交内完成 |

## 12. 已完成：字符级制谱锚定与统一测试基准

`skills/chordsheet/SKILL.md` 与 `skills/chordsheet/references/conversion-rules.md` 现在要求：PDF 无截图时先渲染页面，图片/PDF 以和弦根音首字母的左边缘对应歌词具体字素，保留布局的文本在空白规范化前按同列字符映射。坐标只用于转换时判定，最终数据仍只写 `anchor.graphemeOffset`；无法直接判定时以低置信复核，不得把和弦回退吸附到词首。

该策略已使用 `output/the-cure-test-run/the-cure-olivia-rodrigo.character-anchor-test.chordsheet` 验证。生成过程将三页 PDF 渲染为图片、逐页检查字符位置，产出 11 个段落、49 行和 94 个和弦事件；`node scripts/validate-chordsheet.mjs` 对 JSON 与打包后的 `.chordsheet` 均通过。该包不嵌入原 PDF，归档只含 `chordsheet.json`。

所有测试现已直接导入此包；`src/data/demo.ts` 也改为创建同一份 The Cure 基准谱。`examples/anchor-check.chordsheet` 与 `examples/the-cure-reference.chordsheet` 仅保留为历史示例，不再作为验收、视觉回归或行为断言的基准。
