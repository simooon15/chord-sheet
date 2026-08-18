# ChordSheet v0.2.0 技术实施方案

| 项目 | 说明 |
|---|---|
| 状态 | approved |
| 产品版本 | v0.2.0（功能版本：多指法选择、有谱么兼容导出、指法库质量维护、制谱字符对字符锚定修正） |
| 读者 | 执行开发任务的 Codex、ChordSheet 维护者 |
| 文档职责 | 将 v0.2.0 产品规则落实为指法解析与保存、有谱么剪贴板转换、数据审计、Skill 同步和测试清单 |
| 产品基线 | `docs/versions/v0.2.0/prd-v0.2.0.md` |
| 架构与领域权威 | `docs/versions/v0.1.0/implementation-v0.1.0.md` |

## 1. 实施目标与约束

本版本以最小改动开放现有多指法能力。现有 `.chordsheet` 已具备 `voicings` 数组和歌词/纯和弦事件的 `voicingId`，首版直接复用这两个字段，不新增选择映射结构，不升级 `formatVersion: "1.0.0"`。

以下约束贯穿实现：

1. 只实现本曲全部精确同名和弦的统一选择；
2. 选择结果必须写入歌曲本身，不能只存在 React 状态或 IndexedDB 旁路配置；
3. 内置指法继续在构建时进入本地 JSON，运行时不联网；
4. 不把内置数据的数组下标作为导出谱包中的永久引用；
5. 只显示和保存 `verified` 指法；
6. 不改动无关编辑器、歌词布局、转调、Capo 和打印行为；
7. Skill 锚定修正作为本版本已完成切片保留，不回退；
8. 有谱么适配只生成剪贴板内容，不调用其接口、登录账号或自动发布；
9. 真实有谱么编辑器粘贴验收是发布门槛，不能由本地快照测试代替。

## 2. 开发前基线与根因

### 2.1 多指法数据被单结果接口隐藏

开发前，`src/domain/voicings.ts` 的行为为：

1. `resolveBuiltinVoicings(symbol)` 返回该和弦全部内置候选；
2. `resolveVoicings(document, symbol, voicingId)` 在原调有谱包指法时只返回该单个指法，否则返回内置候选；
3. `resolveVoicing(...)` 固定返回 `resolveVoicings(...)[0]`；
4. `Score.tsx` 与 `App.tsx` 只调用 `resolveVoicing`。

因此数据层已经拥有候选列表，缺失的是候选合并、选择入口和持久化操作。

### 2.2 默认排序未直接表达“容易”

开发前的 `scorePosition` 只按 `baseFret * 100 + span * 10 + muted` 排序。它能优先低把位，但不会把横按作为主要难度特征，可能让用户看到不习惯的默认形状。

### 2.3 Skill 锚定错误来自输入数据而非渲染器

`Score.tsx` 按 `anchor.graphemeOffset` 将和弦插入对应歌词边界，`styles.css` 只负责视觉定位，没有词首吸附逻辑。

旧版制谱规则中“单词上方 → 词首”的一句话与字符级步骤冲突，导致 Notion 谱包曾写出 A→43、Faug→53。当前规则已修正为 A→53、Faug→55，并要求保留对齐所需首尾空白。

### 2.4 ChordSheet 已有数据足以生成有谱么节点流

开发前，应用只有 `.chordsheet` 下载出口，`App.tsx` 中没有剪贴板导出逻辑。用户提供的有谱么复制样本由可读文本、固定哨兵 `_XHE_COPY_PASTE_SENTINEL_` 和 JSON 节点数组构成，节点只使用 `HEADLINE`、`TEXT`、`CHORD_ANCHOR` 与 `LINE_BREAK` 四种类型。

ChordSheet 的 `Section`、三种 `ScoreLine`、和弦 `symbol` 与歌词 `graphemeOffset` 可以确定性生成这些节点。关键差异是有谱么把锚点对应的歌词字素放入 `CHORD_ANCHOR.value`，而 ChordSheet 把完整歌词保存在 `line.text` 中。因此转换器必须按字素切分文字并移动锚点字素，不能按 UTF-16 下标切片。

公开检索未发现该哨兵或节点流的官方协议说明。本实现以 2026-07-23 用户提供的完整样本为兼容基线，并把第三方格式变化视为可检测的外部风险。

## 3. 改动地图

| 文件 | 改动内容 | 当前状态 |
|---|---|---|
| `src/domain/voicings.ts` | 合并来源、已选与内置候选；去重；默认排序；选择与恢复帮助函数 | 已完成 |
| `src/data/chordpro-common-voicing-order.json` | ChordPro 标准形状与现有主库完全同形的位置索引；仅用于常用四个排序 | 已完成 |
| `src/domain/types.ts` | 继续复用 `Voicing` 与事件 `voicingId`，原则上不新增字段 | 无需改动 |
| `src/ui/VoicingPicker.tsx` | 新增桌面浮层/移动底部抽屉共用的候选选择组件 | 已完成 |
| `src/ui/ChordDiagram.tsx` | 继续复用既有图示和无障碍来源标记 | 无需改动 |
| `src/ui/Score.tsx` | 将和弦点击从全谱切换改为打开选择器，传递基础事件信息 | 已完成 |
| `src/ui/App.tsx` | 管理选择器与全曲指法选择；增加“复制到有谱么”、预检提示、剪贴板写入和权限失败降级 | 已完成 |
| `src/domain/yopuClipboard.ts` | 将 ChordSheet 文档转换为有谱么剪贴板节点、可读前缀和完整载荷 | 已完成 |
| `src/styles.css` | 选择器、候选网格、选中态、响应式与焦点样式 | 已完成；维持既有视觉体系 |
| `src/data/guitar-voicings.json` | 保留现有主库；只接受审计后补充 | 已审计；未修改主库 |
| `scripts/audit-guitar-voicings.mjs` | 新增可重复运行的结构、重复、来源与覆盖审计 | 已完成 |
| `scripts/import-chordpro-voicings.mjs` | 可选的固定版本转换脚本，仅输出候选差异，不默认覆盖主库 | 已完成 |
| `THIRD_PARTY_NOTICES.md` | 记录 ChordPro 派生排序索引的版本、许可和范围 | 已完成 |
| `tests/domain/voicings.test.ts` | 候选合并、排序、选择、恢复、转调和去重 | 已完成 |
| `tests/domain/yopuClipboard.test.ts` | 节点映射、字素锚点、行状态、转调、往返和降级报告 | 已完成 |
| `tests/ui/App.test.tsx` | 选择器交互、全曲更新、保存状态和无障碍 | 已完成 |
| `tests/e2e/chordsheet.spec.ts` | 桌面、手机、导出再导入和转调回归 | 已完成 |
| `tests/fixtures/yopu-clipboard.synthetic.json` | 不含第三方歌词的最小兼容样本，覆盖四类节点和空白锚点 | 已完成 |
| `tests/fixtures/chordpro-guitar.synthetic.json` | ChordPro 差异报告与排序索引脚本夹具 | 已完成 |
| `tests/reference/notion-anchor.test.ts` | Notion A→53、Faug→55、首尾空白和谱包往返 | 已完成 |
| `skills/chordsheet/references/conversion-rules.md` | 删除默认词首吸附；保留精确字素与回归例 | 已完成 |
| `output/notion-the-rare-occasions.chordsheet.json` | 17 个锚点修正及首尾空白保留 | 已完成，未跟踪 |
| `output/notion-the-rare-occasions.chordsheet` | 修正后可导入谱包 | 已完成，未跟踪 |
| `public/downloads/chordsheet-builder-skill-v0.2.0.zip` | 包含本版本 Skill 规则 | 已完成 |
| `package.json` / `package-lock.json` | 应用版本同步为 `0.2.0` | 已完成 |

## 4. 候选解析

### 4.1 `resolveVoicings` 新行为

函数继续接收基础 `symbol` 和可选事件 `voicingId`，先计算 `displayedSymbol`，再构建候选：

1. 查找 `voicingId` 对应的谱包指法；只有其 `chordSymbol` 等于 `displayedSymbol` 且完整定弦一致时，才作为当前选择；
2. 原调时加入谱包内其他同和弦、同定弦的来源指法；
3. 标准 EADGBE 定弦时加入 `resolveBuiltinVoicings(displayedSymbol)` 筛出的最多 4 个低把位候选；
4. 按第 4.2 节指纹去重；
5. 当前选择排第一，来源指法随后，内置候选按第 4.3 节排序；去重后全列表截取前 4 个；
6. `resolveVoicing` 继续取第一项，供不需要候选列表的现有调用方使用。

关键修正：不能再因为存在一个谱包来源指法就提前 `return [source]`，否则选择器仍看不到其他内置候选。

### 4.2 指法指纹

新增纯函数 `voicingFingerprint(voicing)`，指纹至少包含：

```text
tuning
frets
fingers（缺失与全 0 视为同一“未指定”语义时需统一）
baseFret
barres（按 fromString、toString、fret、finger 稳定排序）
```

指纹只用于候选去重和查找已有谱包副本，不直接作为用户可见 ID。不同来源提供相同形状时保留优先级更高的来源记录。

### 4.3 内置常用四个排序

`@tombatossals/chords-db` 的 position 列表没有使用频次。构建时由 `scripts/import-chordpro-voicings.mjs --common-order-output` 读取固定版 ChordPro `guitar.json`，仅把与主库完全同形的 240 个位置写入 `src/data/chordpro-common-voicing-order.json`。运行时只读取该离线索引，不联网。

内置候选先排除起始把位高于第 5 把的位置，再按以下稳定元组排序、按完整指纹去重，最后截取 4 个；低把位不足 4 个时不以高把位形状补足：

```text
[
  baseFret,
  hasNoOpenString,
  hasBarre,
  fretSpan,
  mutedStringCount,
  chordProCommonRank,
  sourceIndex
]
```

`chordProCommonRank` 只表示 ChordPro 的标准形状是否与当前主库形状相同，不表示真实使用量，且不能压过低把位约束。`fretSpan` 只统计正品位；空弦不扩大跨度。当前用户选择在合并阶段始终置前，不会因四个限额被丢弃。

### 4.4 客观特征

新增纯函数供界面生成标签：

- `open`：至少一个空弦；
- `barre`：存在横按；
- `baseFret`：起始把位；
- `fretSpan`：最高与最低正品位差；
- `mutedStringCount`：闷弦数量。

这些值从指法结构派生，不写回谱包。

## 5. 选择与恢复

### 5.1 应用选择

新增纯函数：

```ts
selectVoicingForChord(
  document,
  baseSymbol,
  candidate
): ChordSheetDocument
```

执行步骤：

1. 以指纹查找 `document.voicings` 中是否已有相同指法；
2. 没有时复制完整候选并生成符合 Schema 的 ID，例如 `selected-${uuid}`；
3. 复制 `verification`，不得把 `licensedDataset` 改成 `manual`；
4. 遍历全部非 annotation 行；
5. 对 `chord.symbol === baseSymbol` 的事件写入该 `voicingId`；
6. 其他和弦、锚点、review 和行顺序保持不变；
7. 返回新文档，让现有 500ms 自动保存流程持久化。

由于候选本身保存的是当前 `displayedSymbol`，解析时必须按第 4.1 节重新核对显示和弦。这样原调 C 的形状不会在转调后冒充 C#。

### 5.2 最后一次选择语义

现有事件只能引用一个 `voicingId`，因此本版本定义为每个基础和弦只保存最后一次选择：

- 原调为 C 选择一个 C 指法后，全部基础 C 事件引用它；
- 转调后为显示 C# 再选择，仍更新同一批基础 C 事件，替换先前引用；
- 旧的选择副本若不再被任何事件引用，可在清理阶段删除。

该边界避免新增格式字段。若未来要同时记住每个转调状态的独立选择，应另起版本并扩展数据契约。

### 5.3 恢复默认

新增：

```ts
resetVoicingForChord(document, baseSymbol): ChordSheetDocument
```

执行步骤：

1. 清除全部精确匹配事件的 `voicingId`；
2. 收集整个文档剩余的 `voicingId` 引用；
3. 删除 ID 以 `selected-` 开头且已无引用的选择副本；
4. 保留全部来源指法和非本功能创建的谱包指法；
5. 解析器随后在原调优先找到原谱来源指法，否则使用内置默认。

### 5.4 删除和弦后的垃圾清理

本版本不主动重构编辑器删除逻辑。只有“恢复默认”与“选择替换”操作清理由本功能创建且已无引用的 `selected-` 指法，避免触碰既有死数据边界。

## 6. UI 实现

### 6.1 状态归属

`App.tsx` 管理临时选择器状态：

```ts
type VoicingPickerState = {
  baseSymbol: string;
  eventId?: string;
  anchorElement?: HTMLElement;
} | undefined;
```

候选从当前 `document` 派生，不复制进组件状态。关闭选择器只清理临时 UI 状态，不修改文档。

### 6.2 `VoicingPicker`

新增一个组件，同时支持桌面浮层和移动抽屉，不拆成两套业务逻辑。Props 至少包括：

```ts
{
  symbol: string;
  candidates: Voicing[];
  selectedId?: string;
  onSelect: (voicing: Voicing) => void;
  onReset: () => void;
  onClose: () => void;
}
```

行为要求：

1. 打开后焦点进入标题或当前候选；
2. 左右方向键移动候选；
3. Enter/Space 确认；
4. Escape 关闭并把焦点还给触发按钮；
5. 使用 `role="dialog"`、可读标题和候选选中语义；
6. 候选区可滚动，但背景页面在移动抽屉打开时不滚动；
7. 点击遮罩关闭，不提交选择。

### 6.3 入口行为调整

当前正文和概览和弦按钮点击会切换 `chordDisplay`。本版本改为：

- 工具栏“显示名称 + 指法 / 只显示和弦名称”继续切换全谱；
- 概览头“展开指法 / 收起指法”继续切换全谱；
- 指法图或其“换指法”按钮打开选择器；
- 名称模式正文的纯和弦名保持现有全谱切换行为，避免名称状态没有图时丢失快捷入口；
- 右键指法图 `preventDefault()` 后打开同一选择器；
- 右键不是单独实现一套菜单业务。

如果实现中发现同一个按钮同时承担“展开”和“选择”仍不清晰，优先增加明确的内部“换指法”按钮，不扩大到其他 UI 重构。

### 6.4 样式

新增样式必须复用现有颜色、阴影、衬线/等宽字体和 `--ease-editorial`，不新增色相。至少覆盖：

- 浮层和底部抽屉；
- 候选图网格；
- 选中边框与勾选文本；
- 客观标签；
- 遮罩；
- 可见键盘焦点；
- 375px 窄屏单列或横向滚动布局；
- `prefers-reduced-motion`；
- 打印时隐藏选择器和触发控件。

## 7. 指法库审计与补充

### 7.1 审计脚本

新增 `scripts/audit-guitar-voicings.mjs`，读取本地紧凑 JSON 并输出稳定摘要：

```text
source/version/license
chord entry count
position count
min/max positions per chord
duplicate fingerprints
invalid array lengths
invalid fret/finger/barre values
unsupported suffixes
pitch-class mismatches for supported suffixes
```

脚本发现错误时返回非零退出码；仅统计性差异保持零退出码并打印报告。

### 7.2 ChordPro 比较脚本

`scripts/import-chordpro-voicings.mjs` 不在运行时访问网络。它接收人工下载并固定版本的 `guitar.json`，完成：

1. 读取 ChordPro 版本或要求命令行显式传入；
2. 转换定弦、绝对品位、手指和横按；
3. 规范化根音、升降号、后缀和 slash bass；
4. 与主库按标准化和弦键和指纹比较；
5. 输出“缺失名称、相同形状、冲突形状、不可转换”报告；
6. 默认不写 `src/data/guitar-voicings.json`；
7. 只有显式 `--output` 才生成待审 JSON，人工审查后再用 `apply_patch` 合入；显式 `--common-order-output` 只生成与主库同形的位置索引，不能写入主库。

### 7.3 许可与声明

本版本已将 ChordPro 同形位置索引写入 `src/data/chordpro-common-voicing-order.json`，因此 `THIRD_PARTY_NOTICES.md` 必须记录：

- ChordPro 版本与固定 commit；
- Artistic License 2.0；
- 使用了哪些配置或条目；
- 做过哪些字段转换；
- ChordPro 只作为补充，不是现有 MIT 主库的许可证替代。

## 8. Skill 锚定修正

### 8.1 已完成规则改动

`skills/chordsheet/references/conversion-rules.md` 已完成：

1. 将“单词上方默认词首”改为“根音字母精确来源列”；
2. 只有根音字母对齐词首时才使用词首；
3. 词内与空白列保留实际边界；
4. 对锚定有意义的前导或尾随空白不得裁剪；
5. 新增 A→53、Faug→55 的强制回归例。

`skills/chordsheet/SKILL.md` 原有工作流已经要求精确字素映射，本次不需要重复扩写入口文件。

### 8.2 当前谱包事实

`output/notion-the-rare-occasions.chordsheet.json` 当前包含：

- 7 个段落；
- 34 行；
- 59 个歌词锚定和弦事件；
- 16 个纯和弦行事件；
- 5 行前导空格；
- 1 行尾随空格；
- A→53，Faug→55。

JSON 与 `.chordsheet` 已分别通过：

```sh
node scripts/validate-chordsheet.mjs output/notion-the-rare-occasions.chordsheet.json
node scripts/validate-chordsheet.mjs output/notion-the-rare-occasions.chordsheet
```

`.chordsheet` 当前只包含根目录 `chordsheet.json`，没有嵌入原始来源。

### 8.3 自动化回归

新增 `tests/reference/notion-anchor.test.ts`，至少断言：

1. 找到文本 `For I have seen the ending and there is no ascending rise`；
2. A 的 `graphemeOffset` 为 53，边界字符为 `r`；
3. Faug 的 `graphemeOffset` 为 55，边界字符为 `s`；
4. 不存在该行 A→43 或 Faug→53；
5. 全文有 5 行前导空格、1 行尾随空格；
6. 有 59 个歌词和弦事件；
7. JSON 通过共享验证器；
8. 打包并重新导入后内容无损。

逐个 PDF 字符坐标的 59 项视觉复核仍作为人工验收记录；自动化测试只固化可从结构化产物证明的结果，不声称替代视觉对照。

### 8.4 Skill 分发

收尾时：

1. 运行 `scripts/sync-skill-schema.mjs`，即使 Schema 未变化也确认副本一致；
2. 按现有打包脚本生成 `public/downloads/chordsheet-builder-skill-v0.2.0.zip`；
3. 更新首页下载文件名和无障碍名称；
4. 解压检查 ZIP 根目录为 `chordsheet/`；
5. 确认 ZIP 内 `conversion-rules.md` 包含精确字素和 Notion 回归例；
6. 保留旧版 ZIP 作为历史下载物，除非 Simon 另行要求删除。

## 9. 有谱么剪贴板兼容导出

新增无 DOM 依赖的 `src/domain/yopuClipboard.ts`，集中管理第三方格式。主入口返回节点、可读前缀、完整载荷和降级提示，`App.tsx` 只负责用户交互与剪贴板写入：

```ts
export function createYopuClipboardExport(
  document: ChordSheetDocument
): {
  nodes: YopuNode[];
  plainText: string;
  payload: string;
  warnings: YopuExportWarning[];
};
```

### 9.1 载荷与节点顺序

完整载荷按以下规则拼接，哨兵只出现一次，节点使用紧凑 JSON：

```text
plainText + "_XHE_COPY_PASTE_SENTINEL_" + JSON.stringify(nodes)
```

| ChordSheet 内容 | 转换规则 | 限制 |
|---|---|---|
| `section.label` | 一个 `HEADLINE` | `section.type` 不单独传递 |
| `lyrics` 行 | `TEXT` 与 `CHORD_ANCHOR` 节点流 | 保留逻辑换行，不控制目标端自动折行 |
| `chords` 行 | `TEXT("")`、按顺序生成空值 `CHORD_ANCHOR`、`TEXT("")` | `durationBeats` 不传递 |
| `annotation` 行 | 单个 `TEXT(line.text)` | 目标端按普通文字显示并产生 warning |
| `section.repeat` | 不转换 | 产生 warning，由用户在目标端补充 |

转换器按文档顺序生成节点，初始 `even` 为 `false`。同一逻辑行的节点共用该值；除全谱最后一行外，行尾先翻转 `even`，再生成携带新值的 `LINE_BREAK`，下一行延续该值。`even` 不写回 ChordSheet。

### 9.2 字符锚点

歌词必须用 `splitGraphemes` 切分，并按 `graphemeOffset` 升序处理。每个锚点前的文字进入 `TEXT`；可见字素进入 `CHORD_ANCHOR.value` 并被消费；空白字素或行末边界生成空值锚点。最后一个锚点后的文字进入结尾 `TEXT`。

Notion 回归行必须生成 A→`value: "r"`、Faug→`value: "s"`，规范化重建后歌词不变。和弦名称使用当前转调结果，但转换函数不得修改文档或把 Capo 叠加到和弦名。

### 9.3 复制与降级

`plainText` 只作为跨应用兜底；结构恢复以哨兵后的节点数组为准。用户点击按钮后，`App.tsx` 调用转换器并显示未传递字段；确认后由用户手势触发 `navigator.clipboard.writeText(payload)`。权限失败时显示已选中的只读 `textarea`。

载荷只保存在剪贴板，不写入日志、URL、远端接口或歌曲。样本没有指法结构，`voicingId`、Capo、节奏型、元数据和重复语义必须产生提示，不得声称已经传递。

### 9.4 验证

孤立的转换器单元测试可以使用项目自建的短歌词夹具，覆盖四类节点、`even`、可见与空白锚点、首尾空白、Unicode字素、纯和弦行、段落切换和转调。测试辅助函数可解析自身载荷并比较可传递语义，但短夹具不能作为主集成测试、端到端测试或有谱么兼容验收的替代品。

主集成测试、端到端测试和真实粘贴验收统一使用已保存的 The Cure 基准：JSON权威夹具为`output/the-cure-test-run/chordsheet.json`，实际导入谱包为`output/the-cure-test-run/the-cure-olivia-rodrigo.character-anchor-test.chordsheet`。本地往返不能证明第三方编辑器兼容，开发完成后必须使用该谱包执行一次真实粘贴验收：

1. 在 ChordSheet 导入上述 The Cure 基准谱包；
2. 点击“复制到有谱么”，粘贴到空白编辑器；
3. 核对段落、行数、歌词、和弦名称和每个字符落点；
4. 在有谱么中再次全选复制；
5. 规范化比较重新复制的节点流与导出结果；
6. 记录日期、浏览器、有谱么编辑器状态、The Cure 基准谱路径和全部偏差。

只有 The Cure 基准谱显示逐项一致且偏差为零，才能宣称当前版本兼容。格式变化优先局限在`yopuClipboard.ts`与夹具，不修改 ChordSheet Schema。

## 10. 测试计划

本节除明确标注为孤立单元测试的短夹具外，所有主集成和端到端路径都必须复用第9.4节指定的已保存 The Cure 基准，不得在开发过程中另造可替代的主测试谱。

### 10.1 领域测试

| 用例 | 断言 |
|---|---|
| C 候选 | 返回 4 个去重候选 |
| 来源 + 内置 | 来源指法在首位，内置其他形状仍可见 |
| 默认排序 | 无横按、小跨度、低把位顺序稳定 |
| 指纹 | 同形状不同来源只保留一项 |
| 应用选择 | 全部精确同名事件写入同一谱包指法 ID |
| Slash bass 隔离 | 选择 C 不修改 C/G |
| 转调隔离 | 保存的 C 形状不用于显示 C# |
| 转调重新选择 | 最后一次选择替换同一基础和弦旧引用 |
| 恢复默认 | 清除事件引用，仅删除无引用 `selected-` 副本 |
| 非标准定弦 | 不混入标准 EADGBE 内置候选 |
| 有谱么节点 | 四类节点、行顺序与 `even` 稳定 |
| 有谱么锚点 | 字素、空白、转调和规范化往返无损 |
| 有谱么降级 | 不支持字段逐项报告，不静默宣称已传递 |

### 10.2 组件测试

1. 点击概览指法图打开选择器；
2. 候选数量、标签与当前选中态正确；
3. 选择后概览和正文同步；
4. 恢复默认正确；
5. Escape 关闭并恢复焦点；
6. 方向键和 Enter 可完成选择；
7. 单候选和无候选状态文案正确；
8. 点击明确的全谱按钮仍只切换显示模式；
9. “复制到有谱么”能写入完整载荷，并在降级或成功时正确反馈；
10. 剪贴板权限失败时展示可选中的完整文本。

### 10.3 端到端测试

1. 桌面：导入`output/the-cure-test-run/the-cure-olivia-rodrigo.character-anchor-test.chordsheet`，选择 C 的非默认指法，刷新后保持；
2. 谱包往返：导出、重新导入，选择保持；
3. 转调：原调选择不错误套用到新显示和弦；
4. 手机 375px：底部抽屉可打开、滚动、选择和关闭，无横向溢出；
5. 打印：选择器、遮罩和“换指法”控件均不出现；
6. Notion：精确锚定回归通过；
7. 有谱么本地链路：点击复制后剪贴板包含哨兵和合法节点流；
8. 有谱么人工链路：使用同一 The Cure 基准谱在真实网页编辑器粘贴，重新复制后的规范化结果与导出内容一致。

### 10.4 数据与构建

```sh
node scripts/audit-guitar-voicings.mjs
node scripts/validate-chordsheet.mjs output/notion-the-rare-occasions.chordsheet.json
node scripts/validate-chordsheet.mjs output/notion-the-rare-occasions.chordsheet
npm run test:run
npm run test:e2e
npm run build
```

真实有谱么编辑器不进入 CI 自动化，也不在测试中登录第三方账号。第 10.3 节第 8 项由人工执行；开发完成后将结果或待项目负责人确认的状态写入 Release 候选。

## 11. 开发顺序

1. **领域候选与排序**：完成第 4 节和领域测试，不改 UI；
2. **选择与恢复**：完成第 5 节，确认谱包往返不需要 Schema 变更；
3. **选择器 UI**：完成第 6 节和组件测试；
4. **桌面、手机与转调 E2E**：完成第 10.3 节前六项；
5. **有谱么纯转换器**：完成第 9.1–9.3 节与领域测试；
6. **有谱么复制入口**：完成剪贴板写入、降级界面和组件测试；
7. **有谱么真实验收**：完成第 9.4 节并记录偏差；
8. **指法库审计与常用排序**：完成第 7.1 节，生成并抽检 ChordPro 同形位置索引；
9. **决定是否合入补充形状**：其余 ChordPro 差异只保留比较报告，只有报告、许可和人工抽检都通过后才可进入主库；
10. **Skill 回归与分发**：完成第 8.3–8.4 节；
11. **收尾与交付**：版本改为 `0.2.0`，运行第 10.4 节全部命令；开发完成后创建`release-candidate`并与版本交付同步。

每一步只修改改动地图中的对应文件。若候选选择可在现有 `voicings` / `voicingId` 契约内完成，不得为未来的逐事件选择或多转调偏好提前扩展 Schema。

## 12. 完成标志

1. v0.2.0 PRD 第 10 节中可由开发侧执行的验证全部完成，待项目负责人确认的验收项已明确记录；
2. `formatVersion` 仍为 `1.0.0`，旧谱包无需迁移即可导入；
3. 用户选择写入谱包并通过校验；
4. 内置库审计可重复运行且无结构错误；
5. ChordPro 同形排序索引的版本、commit、许可证和 240 个键均可追溯；其余差异形状若未通过合入门槛，只保留比较报告；
6. Notion 精确锚定自动回归和人工验收完成；
7. 有谱么节点转换、本地往返和真实编辑器粘贴验收全部通过；
8. Skill v0.2.0 ZIP 与仓库规则一致；
9. 自动化测试、构建和人工响应式检查完成；
10. 上述开发工作完成后创建状态为`release-candidate`的`docs/versions/v0.2.0/release-v0.2.0.md`，记录实际交付、验证结果、偏差和待验收项，并与版本交付同步；
11. 项目负责人验收期间持续更新同一份Release候选；验收通过后定稿为`released`，未通过则回到开发并记录处理结果。
