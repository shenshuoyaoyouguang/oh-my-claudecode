# OMC HUD 优化编码任务规划（tasks.md）

> 文档版本：v1.0（2026-08-15）
> 文档性质：可执行编码任务清单（工程落地级）
> 上游依据：
> - 技术设计：`docs/design/hud-implementation-design.md`（12 个任务分解 + 验收标准 + 风险回滚）
> - 架构设计：`docs/design/hud-architecture.md`（四层架构 + 公理 R1-R6 / C1-C6 + 不变量 I1/I3）
> - UI 审查：`docs/design/hud-ui-review.md`（P1×9 / P2×14 问题清单 + 三阶段落地路径）
> 任务总数：12 个主任务（A×4 + B×6 + C×2），分解为 28 个子任务
> 预估总工作量：3-4 人天
> 约束：不引入新依赖；保持 I1（渲染纯函数）/ I3（降级永不失败）；每任务 0.5-2 人时

---

## 任务依赖关系总览

```
阶段 A（可全部并行）：
  A-1 ─┐
  A-2 ─┤
  A-3 ─┼──> 阶段 B
  A-4 ─┘

阶段 B：
  B-1 ─┐
  B-2 ─┤
  B-3 ─┼──> B-6（折叠策略依赖宽度预算 + 区域分隔）
  B-4 ─┤
  B-5 ─┘

阶段 C（依赖 A+B 完成）：
  C-1 ─┐
  C-2 ─┘
```

---

## 1. 阶段 A：标签一致性与文案精简

> **业务目标**：补齐 P0-2 括留的 4 处标签 dim，统一文案措辞，消除状态栏内嵌教程。
> **前置依赖**：无（colors.ts 令牌已就位）。
> **阶段门禁**：`vitest run src/__tests__/hud` 全绿；grep 确认 `COMPRESS?`/`echo {}`/`[API err]` 不再出现。

### 1.1 A-1 标签 dim 补齐（context/background/ralph/session）

> **对应问题**：P0-2 括留 / P1-09
> **目标**：4 个元素的标签从裸前景 `${labels.x}:` 改为 `dim(${labels.x}:)`，统一 R-LABEL-1「标签永远 dim」。
> **涉及文件**：
> - `src/hud/elements/context.ts`（L136、L157）
> - `src/hud/elements/background.ts`（L38、L78）
> - `src/hud/elements/ralph.ts`（L39）
> - `src/hud/elements/session.ts`（L39）
> **依赖**：无
> **预估工作量**：1 人时

- [ ] **A-1a** 修改 `src/hud/elements/context.ts` L136：`renderContext` 返回值中 `${labels.context}:` 改为 `${DIM}${labels.context}:${RESET}`；L157 `renderContextWithBar` 同理（标签部分 dim，值与 bar 保持原色）。验收：`grep -n "labels.context}:" src/hud/elements/context.ts` 输出行均含 DIM 前缀。
- [ ] **A-1b** 修改 `src/hud/elements/background.ts` L38：`renderBackground` 返回值中 `${labels.background}:` 改为 `${DIM}${labels.background}:${RESET}`；L78 `renderBackgroundDetailed` 同理。验收：`grep -n "labels.background}:" src/hud/elements/background.ts` 输出行均含 DIM 前缀。
- [ ] **A-1c** 修改 `src/hud/elements/ralph.ts` L39：`renderRalph` 返回值中 `${labels.ralph}:` 改为 `${DIM}${labels.ralph}:${RESET}`。需从 `../colors.js` 额外导入 `DIM`。验收：`grep -n "labels.ralph}:" src/hud/elements/ralph.ts` 输出行含 DIM 前缀。
- [ ] **A-1d** 修改 `src/hud/elements/session.ts` L39：`renderSession` 返回值中 `session:` 硬编码标签改为 `${DIM}session:${RESET}`（该元素未使用 labels 系统，直接 dim 字面量）。需从 `../colors.js` 额外导入 `DIM`。验收：`grep -n "session:" src/hud/elements/session.ts` 输出行含 DIM 前缀。
- [ ] **A-1e** 更新受影响快照测试：运行 `npx vitest run src/__tests__/hud/context.test.ts src/__tests__/hud/render.test.ts`，对 4 元素输出含 `\x1b[2m`（dim）标签前缀的快照执行 `vitest -u` 更新。验收：测试全绿，快照中 4 元素标签部分含 `\x1b[2m`。

### 1.2 A-2 ctx 动作词统一（COMPRESS? → ! compact）

> **对应问题**：P2-2a / P1-04
> **目标**：消除疑问句式 `COMPRESS?`，统一为动作词 `! compact`，与详情行 `run /compact` 语义一致。
> **涉及文件**：`src/hud/elements/context.ts`（L51）
> **依赖**：无（可与 A-1 合并到同一 commit）
> **预估工作量**：0.5 人时

- [ ] **A-2a** 修改 `src/hud/elements/context.ts` L51：`getContextDisplayStyle` 中 `case 'compact'` 的 `suffix` 从 `' COMPRESS?'` 改为 `'! compact'`。验收：`grep "COMPRESS?" src/hud/elements/context.ts` 无输出。
- [ ] **A-2b** 更新快照测试：运行 `npx vitest run src/__tests__/hud/context.test.ts`，对 ctx=82%（compact 区）输出含 `! compact` 的快照执行更新。验收：ctx=82% 快照输出含 `! compact`，不含 `COMPRESS?`。

### 1.3 A-3 multi-repo 教程缩简

> **对应问题**：P2-2b / P1-06
> **目标**：状态栏不再内嵌 shell 教程，缩为 `⚠ multi-repo (unmarked)`，引导移至文档。
> **涉及文件**：`src/hud/elements/multi-repo.ts`（L218-224）
> **依赖**：无
> **预估工作量**：0.5 人时

- [ ] **A-3a** 修改 `src/hud/elements/multi-repo.ts` L218-224：`renderMultiRepo` 中 `!info.hasMarker` 分支的返回值从完整 `echo {} > "..."` 教程改为 `yellow('⚠ multi-repo (unmarked)')`。验收：`grep "echo {}" src/hud/elements/multi-repo.ts` 无输出。
- [ ] **A-3b** 更新快照测试：运行 `npx vitest run src/__tests__/hud/render.test.ts`，对无标记态快照输出 `⚠ multi-repo (unmarked)` 的用例执行更新。验收：快照输出含 `⚠ multi-repo (unmarked)`，不含 `echo {}`。

### 1.4 A-4 错误徽标措辞明确

> **对应问题**：P2-2c / P2-12
> **目标**：`[API err]` 易误解为程序报错，改为 `[usage:err]` 明确错误源为用量 API。
> **涉及文件**：`src/hud/elements/limits.ts`（L306-309）
> **依赖**：无
> **预估工作量**：0.5 人时

- [ ] **A-4a** 修改 `src/hud/elements/limits.ts` L306-309：`renderRateLimitsError` 中三处徽标 `[API 429]`→`[usage:429]`、`[API auth]`→`[usage:auth]`、`[API err]`→`[usage:err]`。验收：`grep "\[API " src/hud/elements/limits.ts` 无输出。
- [ ] **A-4b** 更新快照测试：运行 `npx vitest run src/__tests__/hud/rate-limits-error.test.ts src/__tests__/hud/limits-error.test.ts`，对徽标措辞快照执行更新。验收：快照输出含 `[usage:429]`/`[usage:auth]`/`[usage:err]`。

---

## 2. 阶段 B：密度与宽度治理

> **业务目标**：主行密度预算 ≤8 元素；emoji/ambiguous 宽度精确计量；窄终端 detail 优先保留；区域分隔符层级可辨。
> **前置依赖**：阶段 A 完成（标签 dim 统一后，密度重排的快照基线才稳定）。
> **阶段门禁**：`vitest run src/__tests__/hud` 全绿；focused 主行启用元素数 ≤8；窄屏 60 列 detail 始终保留；ioGrouping 区域边界 `╎` 与元素边界 `|` 视觉区分。

### 2.1 B-1 getCharWidth emoji/ambiguous 宽度升级

> **对应问题**：P1-2 / P1-13
> **目标**：emoji（🔧🤖⚡💭⏱）与 ambiguous（⇡⇣↑↓）字符宽度从 1 改为 2，截断精确命中 maxWidth。
> **涉及文件**：`src/utils/string-width.ts`（L95-102）
> **测试文件**：`src/__tests__/hud/max-width.test.ts`
> **依赖**：无
> **预估工作量**：2 人时

- [ ] **B-1a** 在 `src/utils/string-width.ts` 中新增 `isEmojiChar(codePoint: number): boolean` 函数，判定 emoji 区段：U+1F000–U+1FAFF（Emoticons/Pictographs）、U+2600–U+27BF（Misc Symbols/Dingbats）、U+2B00–U+2BFF（Misc Symbols/Arrows）。验收：`isEmojiChar(0x1F527)`（🔧）返回 true。
- [ ] **B-1b** 在 `src/utils/string-width.ts` 中新增 `isAmbiguousChar(codePoint: number): boolean` 函数，判定 ambiguous 区段：U+21A0–U+21FF（箭头 ⇡⇣↑↓）、U+2300–U+23FF（Misc Technical，含 ⏱ U+23F1）。验收：`isAmbiguousChar(0x21E1)`（⇡）返回 true。
- [ ] **B-1c** 修改 `src/utils/string-width.ts` L95-102 `getCharWidth`：在 `isCJKCharacter` 判定后、`return 1` 前，增加 `if (isEmojiChar(codePoint)) return 2;` 和 `if (isAmbiguousChar(codePoint)) return 2;`。验收：`getCharWidth('🔧')` 返回 2、`getCharWidth('⇡')` 返回 2、`getCharWidth('a')` 返回 1（回归）。
- [ ] **B-1d** 在 `src/__tests__/hud/max-width.test.ts` 新增边界用例：emoji 单字符宽度=2、ambiguous 单字符宽度=2、emoji+ASCII 混合截断点验证、CJK+emoji 混合宽度验证。验收：`npx vitest run src/__tests__/hud/max-width.test.ts` 全绿。

### 2.2 B-2 safeMode ASCII 替换表扩展

> **对应问题**：P1-2 关联（safeMode 宽度确定性）
> **目标**：safeMode 下 emoji/ambiguous/区域分隔符替换为 1 列 ASCII，保证宽度确定。
> **涉及文件**：`src/hud/sanitize.ts`
> **测试文件**：`src/__tests__/hud/sanitize.test.ts`
> **依赖**：B-1（需先确定哪些字符需要替换）
> **预估工作量**：2 人时

- [ ] **B-2a** 在 `src/hud/sanitize.ts` 中扩展 Unicode→ASCII 替换映射表，覆盖：🔧→`Tl:`、🤖→`Ag:`、⚡→`Sk:`、💭→`*`、⏱→`t:`、╎→`|`、█→`#`、░→`-`、⇡→`^`、⇣→`v`、↑→`^`、↓→`v`。在既有 `sanitizeOutput` 函数中应用该映射。验收：`sanitizeOutput('🔧')` 返回 `Tl:`。
- [ ] **B-2b** 在 `src/__tests__/hud/sanitize.test.ts` 新增用例：每个替换映射的输入→输出断言；safeMode 快照中无 emoji 括留。验收：`npx vitest run src/__tests__/hud/sanitize.test.ts` 全绿。

### 2.3 B-3 区域分隔符层级（L1 | vs L2 ╎）

> **对应问题**：P1-10
> **目标**：I/O/S 区域边界用 `╎`（U+257E，L2），区域内元素边界用 `|`（L1），层级可辨。
> **涉及文件**：`src/hud/render.ts`（L144-145 新增常量、L722/726 区域间改用）
> **测试文件**：`src/__tests__/hud/render.test.ts`
> **依赖**：B-2（safeMode 需能回退 `╎`→`|`）
> **预估工作量**：1.5 人时

- [ ] **B-3a** 在 `src/hud/render.ts` L145 后新增模块级常量 `const REGION_SEPARATOR = dim(' ╎ ');`（与 `DIM_SEPARATOR` 同区，含首尾空格增强视觉区分）。验收：`grep "REGION_SEPARATOR" src/hud/render.ts` 有输出。
- [ ] **B-3b** 修改 `src/hud/render.ts` L726：`collectInlineWithRegions` 中区域间 join 从 `DIM_SEPARATOR` 改为 `REGION_SEPARATOR`（L722 区域内元素间保持 `DIM_SEPARATOR` 不变）。验收：ioGrouping 开启时区域边界为 `╎`，元素边界为 `|`。
- [ ] **B-3c** 更新快照测试：运行 `npx vitest run src/__tests__/hud/render.test.ts`，对 ioGrouping 开启的快照执行更新，断言区域边界含 `╎`（U+257E）、元素边界含 `|`。验收：快照中二者视觉区分。

### 2.4 B-4 预设重排（主行密度预算）

> **对应问题**：P1-1 / P1-01 / P1-12 / P2-06
> **目标**：focused 预设主行启用元素 ≤8；callCounts/promptTime 移至 detail 组或默认关。
> **涉及文件**：`src/hud/types.ts`（DEFAULT_ELEMENT_ORDER L671-676、PRESET_CONFIGS.focused L887/893）
> **测试文件**：`src/__tests__/hud/defaults.test.ts`
> **依赖**：无（可与 B-1~B-3 并行）
> **预估工作量**：1.5 人时

- [ ] **B-4a** 修改 `src/hud/types.ts` L671-676 `DEFAULT_ELEMENT_ORDER.main`：移除 `callCounts`、`promptTime`（profile 已在 line1）；L677 `detail` 数组增加 `callCounts`、`promptTime`。验收：`DEFAULT_ELEMENT_ORDER.main` 不含 `callCounts`/`promptTime`。
- [ ] **B-4b** 修改 `src/hud/types.ts` L887/893 `PRESET_CONFIGS.focused`：`showCallCounts: true → false`、`promptTime: true → false`。验收：`PRESET_CONFIGS.focused.elements.showCallCounts === false`。
- [ ] **B-4c** 在 `src/__tests__/hud/defaults.test.ts` 新增密度断言：计算 focused 预设下 main 组实际启用元素数，断言 `≤ 8`。验收：`npx vitest run src/__tests__/hud/defaults.test.ts` 全绿，断言通过。
- [ ] **B-4d** 更新受影响快照：运行 `npx vitest run src/__tests__/hud/render.test.ts`，对 focused 预设快照执行更新（主行不再含 callCounts/promptTime）。验收：快照全绿。

### 2.5 B-5 opencode agent 编码降级

> **对应问题**：P1-4 / P1-02
> **目标**：opencode 预设默认 `agentsFormat` 从 `'codes'`（30+ 编码记忆负担）改为 `'tasks'`（最易读）。
> **涉及文件**：`src/hud/types.ts`（L963）
> **测试文件**：`src/__tests__/hud/defaults.test.ts`
> **依赖**：无
> **预估工作量**：0.5 人时

- [ ] **B-5a** 修改 `src/hud/types.ts` L963 `PRESET_CONFIGS.opencode.agentsFormat`：`'codes'` → `'tasks'`。验收：`PRESET_CONFIGS.opencode.elements.agentsFormat === 'tasks'`。
- [ ] **B-5b** 更新快照测试：运行 `npx vitest run src/__tests__/hud/render.test.ts src/__tests__/hud/defaults.test.ts`，对 opencode 预设快照执行更新（默认不再输出单字符编码）。验收：快照全绿，opencode 默认快照不含单字符 agent 编码。

### 2.6 B-6 窄终端折叠策略（detail 优先保留）

> **对应问题**：P1-3 / P1-14 / P2-09
> **目标**：窄终端（<70 列）下 detail（警告/agents/todos）优先保留；主行按元素优先级丢弃低价值元素。
> **涉及文件**：`src/hud/render.ts`（L781-789 折叠逻辑）
> **测试文件**：`src/__tests__/hud/render.test.ts`（新增窄屏夹具）
> **依赖**：B-1（宽度预算）、B-3（区域分隔）
> **预估工作量**：2 人时

- [ ] **B-6a** 在 `src/hud/render.ts` 中新增窄终端阈值常量 `const NARROW_TERMINAL_THRESHOLD = 70;`，并在 L781 前增加窄终端检测分支：当 `config.maxWidth < NARROW_TERMINAL_THRESHOLD` 时进入 detail 优先分配逻辑。验收：`grep "NARROW_TERMINAL_THRESHOLD" src/hud/render.ts` 有输出。
- [ ] **B-6b** 实现 detail 优先分配：窄终端分支内 `detail 额度 = min(detailLines.length, maxOutputLines / 2)`，`main 额度 = maxOutputLines - detail 额度`；对 main 行按 `applyMaxWidthByMode` wrap 后若超出 main 额度，按元素优先级序（context > 警告 > agents > model > 其余 > callCounts > promptTime > profile）丢弃低价值元素后重新 wrap。验收：窄屏下 detail 行数 ≥ main 行数。
- [ ] **B-6c** 将折叠策略集成到 `render` 函数 L781-789：窄终端走新分支，非窄终端走既有 `applyMaxWidthByMode` 路径（精准改动——不破坏宽屏既有行为）。保持 I1 纯函数（不引入 IO、不读状态）。验收：宽屏快照回归不变。
- [ ] **B-6d** 在 `src/__tests__/hud/render.test.ts` 新增窄屏（60 列）快照用例：断言 detail 行（todos/contextWarning/agents）始终保留；主行按优先级丢弃 callCounts/promptTime/profile。验收：`npx vitest run src/__tests__/hud/render.test.ts` 全绿，60 列快照 detail 保留。

---

## 3. 阶段 C：发布与文档

> **业务目标**：符号词典进文档，CHANGELOG 记录破坏性变更与迁移路径。
> **前置依赖**：阶段 A+B 完成（文档需反映最终实现）。
> **阶段门禁**：README 图例与代码输出一致；CHANGELOG 含迁移说明。

### 3.1 C-1 符号词典进文档

> **对应问题**：P1-02 / P1-03 图例
> **目标**：文档含符号图例表，用户可查阅 Tl/Ag/Sk、r:/tot:、⏱、╎、↑↓/⇡⇣ 含义。
> **涉及文件**：`README.md`（或 `README.zh.md`）、`docs/REFERENCE.md`
> **依赖**：阶段 A+B 完成
> **预估工作量**：2 人时

- [ ] **C-1a** 在 `README.md`（或 `README.zh.md`）的 HUD 相关章节新增「符号图例表」，覆盖：call-counts 标签 `Tl/Ag/Sk`、token 前缀 `r:/tot:`、agent 超时 `⏱`、区域分隔符 `╎`、token 箭道 `↑↓/⇡⇣`、stale 标记 `*/~`、健康指示器 `●/◐/○`。验收：README 含完整图例表，每项有含义说明。
- [ ] **C-1b** 在 `docs/REFERENCE.md` 的 HUD 配置章节补充符号说明与预设密度差异说明（focused ≤8 主行元素、opencode 默认 tasks 格式）。验收：REFERENCE.md 含符号说明 + 预设差异说明。

### 3.2 C-2 CHANGELOG 记录破坏性变更

> **对应问题**：兼容性
> **目标**：CHANGELOG 标注本批次破坏性变更 + 迁移说明（显式覆盖恢复旧默认）。
> **涉及文件**：`CHANGELOG.md`
> **依赖**：阶段 A+B 完成
> **预估工作量**：0.5 人时

- [ ] **C-2a** 在 `CHANGELOG.md` 新增版本条目，标注破坏性变更：① focused 预设 `showCallCounts`/`promptTime` 默认 true→false；② opencode 预设 `agentsFormat` 'codes'→'tasks'；③ context/background/ralph/session 标签改 dim；④ ctx 动作词 `COMPRESS?`→`! compact`；⑤ 错误徽标 `[API *]`→`[usage:*]`；⑥ multi-repo 教程缩简；⑦ 区域分隔符引入 `╎`。每项附迁移说明（如"显式 `elements.agentsFormat:'codes'` 可恢复旧默认"）。验收：CHANGELOG 含 7 条变更 + 迁移说明。

---

## 4. 集成测试与全局验证

> **业务目标**：确保所有改动集成后测试基线全绿，不变量保持，公理可追溯。
> **前置依赖**：阶段 A+B+C 全部完成。

### 4.1 测试基线全绿

- [ ] **4.1a** 运行 `npx vitest run src/__tests__/hud`，确认全绿（基线 620 通过，2 例 Windows 性能断言超时除外）。若有失败，定位失败用例并修复或更新快照。验收：测试全绿或仅剩已知 Windows 超时例外。
- [ ] **4.2b** 运行 `npm run build`（tsc --noEmit），确认无类型错误。验收：build 成功，无新增类型错误。

### 4.2 不变量保持验证

- [ ] **4.2a** 验证 I1（渲染纯函数）：确认 `render` 函数无新增 IO 调用、无状态读取，同输入同输出（通过快照测试隐式验证）。验收：`grep "import.*fs\|require.*fs\|readFile\|writeFile" src/hud/render.ts` 无输出。
- [ ] **4.2b** 验证 I3（降级永不失败）：确认所有新增分支不抛错，元素丢弃逻辑依赖"返回 null 则跳过"既有约定。验收：`grep "throw " src/hud/render.ts src/utils/string-width.ts` 无新增抛错路径。

### 4.3 公理可追溯核对

- [ ] **4.3a** 核对每项改动可追溯至公理/红线（对照设计文档 §2.7 追溯矩阵）：A-1→R3+R-LABEL-1、A-2→R3+R-LABEL-4、A-3→R4+红线八、A-4→R3+R1、B-1→C6+R-WIDTH-2、B-2→C6+R-WIDTH-3+I3、B-3→R3+R-SEP-1/2、B-4→R3+R5+R-DENSITY-1/2、B-5→R3+R-DENSITY-3、B-6→R3+R4+R-DENSITY-4+I1、C-1→R3、C-2→红线五。验收：追溯矩阵完整，无遗漏。

---

## 5. 代码审查与最终确认

> **业务目标**：关键代码 Review，设计与实现一致性核对，变更范围最终确认。

### 5.1 关键代码 Review

- [ ] **5.1a** Review `src/hud/render.ts` 折叠策略分支（B-6）：确认元素优先级丢弃逻辑正确、纯函数保持、宽屏行为不变。验收：Review 意见记录，无逻辑缺陷。
- [ ] **5.1b** Review `src/utils/string-width.ts` 宽度判定（B-1）：确认 emoji/ambiguous 区段覆盖完整、无误判 ASCII 字符。验收：Review 意见记录，区段判定正确。
- [ ] **5.2c** Review `src/hud/types.ts` 预设变更（B-4/B-5）：确认默认值变更不破坏用户显式覆盖语义。验收：Review 意见记录，兼容性无风险。

### 5.2 设计与实现一致性核对

- [ ] **5.2a** 对照 `docs/design/hud-implementation-design.md` §2.4 的 12 个任务，逐项确认实现与设计一致，无遗漏、无超范围改动。验收：12 项全部勾对。
- [ ] **5.2b** 确认未引入新依赖（`package.json` 无变更）。验收：`git diff package.json` 无输出。

### 5.3 变更范围最终确认

- [ ] **5.3a** 运行 `git diff --stat` 确认变更文件列表与预期一致：`elements/context.ts`、`elements/background.ts`、`elements/ralph.ts`、`elements/session.ts`、`elements/multi-repo.ts`、`elements/limits.ts`、`utils/string-width.ts`、`render.ts`、`types.ts`、`sanitize.ts`、`README.md`、`docs/REFERENCE.md`、`CHANGELOG.md` + 受影响快照测试。验收：变更范围与预期一致，无无关文件改动。
- [ ] **5.3b** 确认每个任务按任务 ID 独立 commit（支持按任务单独 revert）。验收：`git log --oneline` 含 A-1~C-2 对应 commit，无混合提交。

---

## 验收标准汇总（Definition of Done）

> 遵循「目标驱动」——每条标准为可验证的检查点。

### 阶段 A 验收
1. **A-1 标签 dim**：`vitest run src/__tests__/hud` 全绿；4 元素快照输出标签含 `\x1b[2m`（dim）前缀。
2. **A-2 动作词**：`grep "COMPRESS?" src/hud/elements/context.ts` 无输出；ctx=82% 快照含 `! compact`。
3. **A-3 教程缩简**：`grep "echo {}" src/hud/elements/multi-repo.ts` 无输出；快照含 `⚠ multi-repo (unmarked)`。
4. **A-4 徽标措辞**：`grep "\[API " src/hud/elements/limits.ts` 无输出；快照含 `[usage:err]` 等。

### 阶段 B 验收
5. **B-1 宽度计量**：`getCharWidth('🔧')` 返回 2、`getCharWidth('⇡')` 返回 2；`max-width.test.ts` 边界用例全绿。
6. **B-2 safeMode**：safeMode 快照中 🔧→`Tl:`、⏱→`t:`、╎→`|`；无 emoji 括留。
7. **B-3 区域分隔**：ioGrouping 快照中区域边界为 `╎`（U+257E），元素边界为 `|`。
8. **B-4 密度预算**：focused 预设主行启用元素数 ≤8（断言通过）；callCounts/promptTime 不在 main 组。
9. **B-5 agent 降级**：opencode 预设默认 `agentsFormat==='tasks'`；默认快照不输出单字符编码。
10. **B-6 窄终端保底**：60 列窄屏快照下 detail 行（todos/contextWarning/agents）始终保留；主行按优先级丢弃 callCounts/promptTime/profile。

### 阶段 C 验收
11. **C-1 符号词典**：README（或 docs/REFERENCE.md）含符号图例表；与代码输出一致。
12. **C-2 CHANGELOG**：CHANGELOG 含 7 条破坏性变更条目 + 迁移说明。

### 全局验收
13. **测试基线**：`vitest run src/__tests__/hud` 全绿（基线 620 通过，2 例 Windows 性能断言超时除外）。
14. **不变量保持**：I1（render 纯函数）通过快照验证；I3（降级永不失败）无新增抛错路径。
15. **公理可追溯**：每项改动可追溯至 R1-R6 / C1-C6 / 八红线。
16. **审查评分提升**：优化后 5 维评分从 17/25 → ≥21/25；P1 关闭 ≥6/9，P2 关闭 ≥8/14。

---

## 风险与回滚

| 风险 | 影响 | 缓解 | 回滚 |
|------|------|------|------|
| 预设默认值变更引起老用户不适 | opencode 用户习惯 codes 编码；focused 用户习惯看到 callCounts | CHANGELOG 突出标注；用户可显式 `elements.agentsFormat:'codes'` 或 `elements.showCallCounts:true` 恢复 | 单文件 `types.ts` revert PRESET_CONFIGS 即可恢复旧默认 |
| getCharWidth 升级影响既有 CJK 截断 | emoji 改 2 列后，含 emoji 的行截断点前移，既有快照偏移 | 全量回归 `max-width.test.ts` + `string-width` 单测；新增 emoji/ambiguous 边界用例 | `string-width.ts` revert getCharWidth 新增分支 |
| 折叠策略重构引入 wrap 回归 | 窄终端主行丢弃逻辑可能误删高价值元素 | render 保持纯函数（I1），快照覆盖；新增窄屏夹具；元素优先级序明确 | `render.ts` revert 折叠分支，回退既有 applyMaxWidthByMode |
| `╎` 字符在部分终端渲染不一致 | 个别终端字体缺 BOX DRAWINGS 字形 | safeMode 回退 `\|`（R-SEP-4）；CJK 终端普遍支持 | `render.ts` revert REGION_SEPARATOR，区域间回用 DIM_SEPARATOR |
| safeMode ASCII 替换表遗漏字符 | safeMode 下宽度仍不确定 | 替换表覆盖全部 emoji/ambiguous；测试 safeMode 快照 | `sanitize.ts` revert 替换映射 |

**回滚策略总则**：所有改动按任务 ID 独立 commit，任一任务可单独 revert 而不影响其他（除 B-6 依赖 B-1/B-3）。阶段 A/B/C 间通过 git tag 切分，支持按阶段回滚。