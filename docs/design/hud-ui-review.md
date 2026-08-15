# OMC HUD 现有 UI 审查报告与优化方案

> 文档版本：v1.0（2026-08-15）
> 文档结构：
> - **第一部分 · 现有 UI 审查报告**（质量审查官·严过审）：5 维评分 + Anti-Slop 检测 + 分维度问题清单（P0/P1/P2 分级）
> - **第二部分 · 设计系统方向与令牌**（设计系统专家·彩格调）：终端 HUD 设计令牌、语义色/阈值/标签/符号规范
> - **第三部分 · 优化方案与落地路径**（主理人汇编）：优化优先级排序、每项问题的具体改造建议与落地文件映射
> - **第四部分 · 优化原型可视化**（原型构建师·筑原型）：5 预设 × 深浅色 × 宽窄屏的终端仿真原型
> - 配套文档：架构设计见 `docs/design/hud-architecture.md`；需求摘要见 `.workbuddy/artifacts/hud-design/01-requirements.md`

---

# 第一部分 · 现有 UI 审查报告

- 审查人：严过审（质量审查官）
- 审查对象：`oh-my-claudecode/src/hud/`（Claude Code ANSI 彩色终端状态栏）
- 审查范围：render.ts / colors.ts / types.ts / index.ts / mission-board.ts / payload-estimate.ts / sanitize.ts / string-width.ts 及 elements/ 下全部元素实现
- 审查方式：静态代码走查（渲染管线、各元素渲染格式、配置系统、宽度与降级逻辑）
- 结论：**需修正后通过**（详见评分与问题清单）

---

## 一、总体判断

OMC HUD 是一个**工程质量高、信息密度极大、设计语法未完全统一**的终端状态栏系统。

优点（客观记录，不因放行而吹毛求疵）：
- CJK 宽度感知实现扎实（`string-width.ts` 覆盖主要双宽区段），截断/换行均以可见列数为准。
- ANSI 截断对颜色泄漏做了防护（`render.ts:221` 截断前补 `\x1b[0m`），细节到位。
- 响应式具备完整策略：自动探测列宽（`index.ts:288-300`）、wrap/truncate 双模式、`maxOutputLines` 折叠（`render.ts:307-317`）。
- 状态降级链路完整：API 失败 → `[API err]`/`[API auth]`/`[API 429]`；stale 缓存用 `*`/`~` 双信号标记；整体崩溃时输出兜底文案（`index.ts:601-620`）。
- 上下文百分比做了迟滞平滑，避免刷新抖动（`context.ts:74-121`）。
- cwd 支持 OSC 8 终端超链接；session 状态做文件锁 RMW，工程考量充分。

但作为一个"每秒刷新的状态栏"，其默认 `focused` 预设**承载了过多互相竞争的信息**，且存在**颜色语义冲突、缩写含义跨元素冲突、配置与实现脱节**三类系统性问题。详情见下。

---

## 二、5 维度评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 设计哲学 | 3/5 | 有明确方向（"密度换取信息量"+ 分组/预设/多行布局），但元素标签语法、颜色词汇、分隔符层级未形成统一视觉语言；I/O/S 分组是"功能正确"而非"视觉自洽" |
| 视觉层次 | 3/5 | line1/main/detail 三级与 warning 详情行分工合理；但主行约 15+ 元素并行、品牌标签 bold 占最强权重、两个时间信号并排、区域分隔符与元素分隔符相同导致层级模糊 |
| 执行质量 | 4/5 | 结构清晰、宽度处理严谨、缓存/降级/锁完善；主要执行缺口是 emoji/ambiguous 宽度计量不准、一处配置死项（`showHealthIndicator`）、健康阈值硬编码 |
| 特异性 | 4/5 | 品牌辨识度强：`[OMC#ver]`、ralph/autopilot/prd 模式、mission board、agent 类型编码均为独有语言，不会与通用工具混淆；但 agent 单字符编码 30+ 条映射、碰撞频发，特异性过头反伤可读性 |
| 克制 | 3/5 | 提供 minimal 预设体现克制意图，但默认 focused 明显信息过载（留白不足、冗余信号多），存在"能显示的都显示"倾向 |

**总分：17/25**
**结论：需修正后通过**（P0=0；发现 P1 级系统性问题 9 项，建议至少修复其中 5 项后放行）

---

## 三、Anti-Slop 检测

| 级别 | 检测项 | 结果 |
|------|--------|------|
| P0 | 紫色/彩虹渐变背景 | ✅ 未发现（纯 ANSI 标准色） |
| P0 | 编造统计/虚假证言 | ✅ N/A（状态栏代码，无营销数据） |
| P0 | 通用 emoji 替代专业图标 | ⚠️ 见 P1-07：emoji 用于 ⏱/💭/🧠/🤔 且部分无 ASCII 回退 |
| P0 | 圆角卡片 + 彩色边框 AI 套路 | ✅ N/A（终端渲染） |
| P0 | 手绘风格 SVG 人物插图 | ✅ N/A |
| P0 | 明显破碎布局/溢出 | ✅ 未发现（宽度逻辑严谨） |
| P0 | 对比度不达标 | ✅ N/A（ANSI；dim 文本对比度见 P2） |
| P0 | 完全无响应式 | ✅ 未发现（响应式策略完整） |
| P1 | Inter 作展示字体 | ✅ N/A（终端） |
| P1 | 过多圆角/阴影堆叠 | ✅ N/A |
| P1 | 留白不足、信息密度过高 | ⚠️ 命中（见 P1-01 主行超载） |
| P1 | 同一页面 4+ 种颜色 | ⚠️ 命中（单行混用绿/黄/红/青/品红/亮色 + dim/bold） |
| P1 | 动画时长无 reduced-motion | ✅ N/A（无动画，状态栏静态合理） |
| P1 | 段落宽度 >75 字符 | ⚠️ 部分命中（主行默认可超 80 列，靠 wrap 兜底） |
| P1 | CTA 过多 | ✅ N/A |
| P2 | hover/focus 缺失 | ✅ N/A（终端无 hover；cwd 有 OSC8 超链接加分） |
| P2 | 图标大小不统一 | ⚠️ 命中（emoji 与 ASCII 混用） |
| P2 | 行高字距 | ✅ N/A |
| P2 | 微过渡动画 | ✅ N/A（状态栏加动画反而有害） |
| P2 | 图片 alt | ✅ N/A |

**Anti-Slop 结论：P0 = 0，P1 = 3（密度、4+ 色、emoji 回退）——按清单阈值"P1≤3"处于边界通过。**

---

## 四、按审查维度的详细问题清单

### 维度 A：可用性（Usability）——信息是否一眼可读、符号是否自解释

#### P1-01 主行信息超载，认知扫描成本高
- **证据**：`DEFAULT_ELEMENT_ORDER.main` 声明 21 个元素（`types.ts:671-676`）；`focused` 预设下同时激活约 15+ 元素（model、rateLimits、ralph、autopilot、prd、skills、lastSkill、contextBar、agents、background、todos、thinking、promptTime、session、tokens、callCounts、profile…`types.ts:852-895`）。
- **影响**：主行成为一长串 `label:value` 的堆叠；每秒刷新时用户难以定位"当前最需要看的那一项"。属 Anti-Slop P1"信息密度过高"。
- **优化方向**：① 把单调递增型（`callCounts`）、纯计时型（`promptTime`）、低价值型（`profile`）默认移至 detail 行或默认关闭；② 明确"主行最多 6-8 项"的密度预算并写进预设设计约束。

#### P1-02 agent 单字符编码是记忆负担最重的设计
- **证据**：`AGENT_TYPE_CODES`（`agents.ts:24-126`）约 30 条映射，且大量碰撞后取巧：`T` 同时给 analyst 与 test-engineer，`V` 给 verifier 与 vision，`Qs/Ia/Pm` 用双字符消歧；大小写再叠加模型档位语义（大写=Opus，`agents.ts:146-155`）。`opencode` 预设默认 `agentsFormat: 'codes'`（`types.ts:960`）。
- **影响**：`agents:Oes` 这种输出，用户必须背一张 30+ 编码表 + 大小写规则才能读懂；双字符与单字符混用本身破坏了编码系统一致性。
- **优化方向**：`codes` 仅作为高级可选格式保留；默认/`opencode` 预设改 `descriptions` 或 `multiline`（README 已标注 `tasks` 是最易读格式）；若保留 codes，需在文档中提供图例表。

#### P1-03 缩写字母跨元素含义冲突（最隐蔽的硬伤）
- **证据**：call-counts 的 ASCII 标签 `T/A/S`（`types.ts:501-503`，`call-counts.ts:30-32`）与 agent 编码中 `T`=analyst/test-engineer、`A`=architect、`S`=scientist（`agents.ts:32-126`）**字母相同、含义不同**。同一行可能出现 `agents:...S...` 与 `S:3` 并存。
- **影响**：用户在同一个状态栏里读到两套 `S/T/A` 词汇表，是典型的"符号不自解释"。
- **优化方向**：call-counts ASCII 回退改用 `tool:/agent:/skill:` 全称标签，或改用 `Tls/Ags/Sks` 等不与 agent 编码冲突的词。

#### P1-04 ctx 的 `COMPRESS?` 后缀语义模糊
- **证据**：`context.ts:55` 在 80%≤ctx<85% 输出 `ctx:82% COMPRESS?`；而详情行警告写 `run /compact`（`context-warning.ts:40`）。同阈值两种动作词汇。
- **影响**：`COMPRESS?` 读起来像疑问句而非动作指令；"COMPRESS" 也不是用户习惯的命令名（实际命令是 `/compact`）。
- **优化方向**：主行与详情行统一为同一动作词（建议 `ctx:82%! compact` 或 `compact?`），颜色阈值与文案单一来源（`thresholds.contextCompactSuggestion`）。

#### P1-05 token 缩写 `r/s` 无自解释前缀
- **证据**：`token-usage.ts:42-51` 输出 `↑1.2k ↓345 r89 s12.3k`，其中 `r`=reasoning、`s`=session total 无任何标签；`joinTokenParts`（`token-usage.ts:56-60`）直接拼接。
- **影响**：新用户无法推断 `r`/`s` 含义；在 `ioGrouping` 关闭时更无上下文线索。
- **优化方向**：`r89` → `r:89`、`s12.3k` → `s:12.3k` 或改用 `⤷reason`/`=total`；至少在默认 preset 的注释/README 提供图例。

#### P1-06 状态栏内嵌 shell 配置教程
- **证据**：`multi-repo.ts:219-224` 在无 `.omc-workspace` 标记时输出完整命令 `⚠ multi-repo detected — run: echo {} > "parent/.omc-workspace" to enable shared state`。
- **影响**：状态栏是"状态"不是"教程"；`echo {} >` 在 Windows/cmd 下不成立，且 `{}` 占位符对非技术用户无意义。这是把配置引导硬塞进实时状态行。
- **优化方向**：缩成 `⚠ multi-repo (unmarked)`，把创建标记的指引移到文档或一次性的终端提示，而非常驻 HUD。

#### P2-01 `prd` 元素裸渲染无标签
- **证据**：`prd.ts:34` 直接返回 `cyan(currentStoryId)`（如 `US-002`），没有 `PRD:` 前缀；而同文件 `renderPrdWithProgress` 有 `(2/5)` 进度。
- **影响**：主行里飘一个裸青色 `US-002`，用户可能误认为是版本号/分支名。
- **优化方向**：统一加 `PRD:` 前缀，如 `PRD:US-002`。

#### P2-02 rate limits 标签样式不一致
- **证据**：`limits.ts:74-76` 的 `5h:` 为普通文本，`limits.ts:86-87` 起 `wk:/mo:/sn:/op:/extra:` 均为 dim。`renderRateLimitsCompact`（`limits.ts:149-189`）则完全无标签（`45%/12%`）。
- **影响**：同一元素内部标签"一会亮一会暗"，破坏 `label:value` 语法一致性。
- **优化方向**：所有标签统一 dim，值与颜色保留；compact 模式需在文档说明"按固定顺序 5h/wk/mo/sn/op"。

#### P2-03 `bg:` 缩写歧义
- **证据**：`DEFAULT_HUD_LABELS.background='bg'`（`types.ts:505`），`background.ts:45` 输出 `bg:3/5`。
- **影响**：`bg` 可理解为 background（进程）也可理解为"begin"等；低伤害但可优化。
- **优化方向**：可接受；文档注明"bg=后台任务"即可。

---

### 维度 B：视觉一致性（Visual Consistency）——颜色语义、分隔符、预设漂移

#### P1-07 阈值色跨元素不统一（同数值、不同颜色）
- **证据**：
  - context：`getContextColor` RED≥85 / YELLOW≥70（`colors.ts:82-86`）。
  - rate limits：`limits.ts:16-18` RED≥90 / YELLOW≥70。
  - enterprise cost：`enterprise-cost.ts:16-18` RED≥90 / YELLOW≥70（注释称"matching limits.ts"）。
  - todos：`todos.ts:34-40` GREEN≥80% / YELLOW≥50% / 其余 CYAN；`getTodoColor`（`colors.ts:103-109`）同理。
  - background：`background.ts:37-43` 容量用 YELLOW/CYAN/GREEN。
- **影响**：同为百分比仪表，"ctx=85% 红、rate limit=85% 黄、todo=50% 黄"——用户无法用颜色建立统一的危险分级直觉。
- **优化方向**：把阈值抽成单一常量表（`THRESHOLDS.percent: { warn: 70, critical: 90 }` 或按语义统一），context 与 limits 共用同一套；todo/background 的"进度色"与"危险色"应明确分属不同色彩语义并文档化。

#### P1-08 模型档位色与状态警告色语义冲突
- **证据**：`getModelTierColor`（`colors.ts:121-128`）：Opus→MAGENTA、**Sonnet→YELLOW**、Haiku→GREEN、未知→CYAN。而全局 YELLOW 在 ctx/limits/session 中均表示"警告"。
- **影响**：agent 编码里黄色字母（Sonnet 档位，默认模型极常见）会被读成"该 agent 处于警告状态"；绿色（Haiku）会与"健康"混淆。同一色相承载两套语义，是状态栏最危险的颜色问题。
- **优化方向**：档位色改用不与状态色冲突的色相（如 Opus=BRIGHT_BLUE、Sonnet=BLUE、Haiku=CYAN），或仅在 multiline 场景使用档位色并在图例中说明。

#### P1-09 dim/bold 标签语法不统一
- **证据**：
  - dim 标签：`renderGitRepo` `dim('repo:')`（`git.ts:168`）、`renderApiKeySource` `dim('key:')`（`api-key-source.ts:70`）、`renderLastTool` `dim('tool:')`（`last-tool.ts:16`）、`renderSessionSummary` `dim('summary:')`（`session-summary.ts:30`）。
  - 非 dim 标签：`ctx:`（`context.ts:137`）、`agents:`（`agents.ts:227`）、`ralph:`（`ralph.ts:44`）、`todos:`（`todos.ts:71`）。
  - 值也着色：`model.ts:83` 将 `Model: Opus` 整个 cyan（标签值一起）。
- **影响**：元素间"标签/值"的视觉语法各行其是，难以形成"标签弱、值强"的统一阅读模式。
- **优化方向**：确立并执行 `dim(label:) + colored(value)` 的全局语法；model 等特殊元素单独说明。

#### P1-10 区域分隔符与元素分隔符同构，层级不可辨
- **证据**：`collectInlineWithRegions`（`render.ts:679-720`）：区域内元素用 `dim(PLAIN_SEPARATOR)` 连接（`render.ts:715`），区域间也用 `dim(PLAIN_SEPARATOR)` 连接（`render.ts:719`）。即 `I: ↑1.2k ctx:67% | O: ↓345 r89 | S: session:45m ...` 里的所有 `|` 视觉完全一样。
- **影响**：I/O/S 分组本意是改善层级，但"元素边界"与"区域边界"无法区分，反而增加一层无差异分隔。
- **优化方向**：区域间改用高对比分隔（如 `dim('  │  ')` 或 ` | ` 双空格间距），区域内保持窄分隔；或在区域 tag 上加重（如 `I ▸`）。

#### P2-04 `!` 字符三重含义
- **证据**：git 修改标记 `!3`（`git.ts:267`）；context warning 图标 `!`/`!!`（`context-warning.ts:37`）；agent 超时 `!`（`formatDuration` 返回 `'!'`，`agents.ts:175`）。
- **影响**：同一 `!` 在不同元素分别表示"修改数/严重度/超时"，读图时易误判。
- **优化方向**：agent 超时改用 `⏱` 或 `+` 等不与 git 冲突的符号；warning 保留 `!`。

#### P2-05 预设间视觉漂移过大
- **证据**：`agentsFormat` 在 5 个预设间为 count/multiline(3)/multiline(10)/codes/multiline(5)（`types.ts:808-1027`）；`ioGrouping` 在 focused/full/dense 为 true、minimal/opencode 为 false。
- **影响**：切换预设等于切换一整套视觉语法，用户可能无法预期"换个预设 HUD 长什么样"。
- **优化方向**：可接受（预设即密度档位），但建议在文档中明确"预设改变的是布局语法而非仅开关"，并保证每档内部自洽。

---

### 维度 C：信息层级（Information Hierarchy）——主行 vs 详情行、强调/淹没、I/O/S 分组效果

#### P1-11 品牌标签 bold 权重 > 关键状态权重
- **证据**：`render.ts:421` `bold(\`[OMC${versionTag}]\`)`；`render.ts:405` profile 也 bold；而最可操作的 ctx 百分比仅是普通色（`context.ts:137`）。
- **影响**：`[OMC#4.1.10]` 是零操作价值的品牌标识，却拿了最强字重；用户视线被品牌吸引而非状态。
- **优化方向**：OMC 标签改 dim/普通；bold 只保留给 update 提醒与 warning banner。

#### P1-12 callCounts 单调计数占据主行
- **证据**：`showCallCounts` 默认 true（`types.ts:784`），渲染 `🔧42 🤖7 ⚡3`（`call-counts.ts:46-67`）置于主行靠右（`types.ts:675`）。
- **影响**：工具调用次数是只增不减的累计量，对"当前是否健康"无指示价值，却持续与 rate limit/ctx 抢注意力。
- **优化方向**：默认移到 detail 行或默认关闭；如需保留，改成"本回合增量"更有意义。

#### P2-06 两个时间信号并排、语义不同
- **证据**：`promptTime` 输出 `⏱13s`（`prompt-time.ts:37`，距上次提问的经过时长），`session` 输出 `session:45m`（`session.ts:22`，会话总时长）。主行顺序为 `promptTime, session`（`types.ts:673`）。
- **影响**：`⏱13s session:45m` 两个"时间"紧邻但含义不同，易被误读为同一维度。
- **优化方向**：给 promptTime 加标签（`prompt:13s`），或把 session 归入详情行。

#### P2-07 I/O/S 分组与 token 拆分产生语义重复
- **证据**：`render.ts:688-697` 将 tokens 拆到三区：input→I、output+reasoning→O、session→S；而 `token-usage.ts:42-50` 输出本身已带 `↑`/`↓`/`s` 前缀。于是 I 区同时出现标签 `I:` 与 `↑`，S 区同时出现 `S:` 与 `s`。
- **影响**：区域标签与符号前缀互为冗余，信息重复且占宽。
- **优化方向**：分组开启时，tokens 的 `↑/↓` 符号可作为区域内部符号保留，但 S 区的 `s` 前缀应去掉（区域标签已表达）；或将 tokens 整体视为"跨区元素"不做拆分。

#### P2-08 mission-board 摘要行过长
- **证据**：`mission-board.ts:617` `MISSION xxx [running] · 2/5 done · 3 active · objective...`；`timeline` 行多事件 ` | ` 拼接（`mission-board.ts:632-640`）。
- **影响**：详情行可能超出 maxWidth 被截断，丢失最有价值的事件信息。
- **优化方向**：timeline 按宽度预算截断事件数；`objective` 缩短。

---

### 维度 D：响应式适配（Responsive）——窄终端、maxWidth、CJK/emoji 宽度、折叠

#### P1-13 emoji / ambiguous 宽度计量不准确
- **证据**：`getCharWidth`（`string-width.ts:95-102`）仅识别 CJK/零宽，**emoji（💭🧠🤔⏱ 等）按 1 列计**，而多数终端渲染为 2 列；`⇡/⇣`（U+21E1/21E3，`git.ts:269-270`）、`⏱`（U+23F1）等属 East Asian Ambiguous，宽度因终端而异。`truncateLineToMaxWidth`（`render.ts:206-216`）依赖该宽度做预算。
- **影响**：含 emoji/箭头的主行截断会出现 off-by-width：可能截多一列或溢出一列，破坏"恰好 maxWidth"的保证。
- **优化方向**：引入完整 unicode-width 表（或对 emoji/ambiguous 显式按 2 列计）；在 `safeMode` 下对 emoji 做 ASCII 替换保证宽度确定。

#### P1-14 窄终端下 detail 信息被主行换行挤掉
- **证据**：`render.ts:774-784` 先 `applyMaxWidthByMode`（wrap 会产生多行），再 `limitOutputLines`（`maxOutputLines` 默认 4，`types.ts:788`）。窄终端主行 wrap 成 2 行后，detail 只剩 2 行额度 → agents 树/todos/警告被截断丢弃。
- **影响**：恰好在最需要上下文（窄屏）时，agent 可视化与 todos 被折叠，仅剩无差别的 `... (+N lines)`。
- **优化方向**：折叠策略应优先保住 detail（警告、agents、todos），可对主行做更激进的元素级丢弃（如 drop callCounts/promptTime）而非整行换行；或 detail 行优先于主行 wrap 保留。

#### P2-09 wrap 依赖分隔符精确匹配，内容内分隔符也会被切
- **证据**：`wrapLineToMaxWidth`（`render.ts:233-247`）通过 `line.includes(DIM_SEPARATOR)`/`PLAIN_SEPARATOR` 分割；而 `renderAgentsWithDescriptions` 内部也用 `dim(' | ')` 连接（`agents.ts:441`）。
- **影响**：agents 的 `descriptions` 格式内部分隔与元素分隔完全相同，wrap 会切进元素内部，语义上拆散一条 agent 描述。
- **优化方向**：用内部不可见的占位 token 标记元素边界后再 wrap；或 agents 内部改用 `,` 连接。

#### P2-10 换行后二次截断逻辑冗余
- **证据**：`render.ts:787-792` 在 wrap 之后又对所有行 `truncateLineToMaxWidth`（truncate 模式）——对已满足宽度的行是无操作，但若 wrap 后的某段仍超宽会再被截断，行为与 `wrap` 语义不完全一致。
- **影响**：轻微；wrap 模式下"某单段超宽回退 truncate"（`render.ts:243-245`）已处理，二次截断是安全网，但需在注释说明。
- **优化方向**：保留安全网即可，注释澄清意图。

---

### 维度 E：交互反馈（Interaction Feedback）——状态变化、stale、错误提示

#### P1-15 `showHealthIndicator` 是死配置（声明了但从未渲染）
- **证据**：`types.ts:609` 注释 "Show 🟢/🟡/🔴 health indicator (default: true if sessionHealth is true)"；但 `render.ts:494-500` 仅调用 `renderSession`，而 `session.ts:15-23` 只输出 `session:45m`（绿色/黄色/红色着色的时长），**没有任何 🟢🟡🔴 指示器渲染**。搜索代码无其他引用。
- **影响**：用户按文档开启该项无任何效果；`showHealthIndicator: true` 在全部预设里默认开启（如 `types.ts:888`），属于"配置与实现脱节"。
- **优化方向**：二选一——在 `renderSession` 中真正渲染指示器，或删除该配置项并修正注释。

#### P1-16 等待权限反馈默认关闭
- **证据**：`permissionStatus` 默认 false，注释自述 "Disabled: heuristic-based, causes false positives"（`types.ts:770-771`）；`render.ts:475` 仅在开启时渲染 `APPROVE? edit:xxx`（`permission.ts:17`）。
- **影响**：默认配置下，Claude 停在权限弹窗等待批准时，HUD 无任何"等待用户操作"的信号，用户可能误以为卡死。
- **优化方向**：保留启发式但提供轻量兜底（如"模型静默 >N 秒"即显示 `waiting…`）；或在文档显著标注该行为缺失。

#### P2-11 后台任务失败不可见
- **证据**：`background.ts:25-46` 只统计 `status === 'running'`；`index.ts:502` 传入 `getRunningTasks(hudState)`（已过滤掉非 running）。`BackgroundTask` 有 `status:'failed'` 与 `exitCode`（`types.ts:21-30`）但从不展示。
- **影响**：后台任务静默失败，用户无感知，违背"状态栏应报告异常"的职责。
- **优化方向**：统计 failed 数并在容量色之外用红色徽标 `bg:3/5 !1failed`。

#### P2-12 错误徽标措辞可更明确
- **证据**：`limits.ts:313-314` 输出 `[API err]`/`[API auth]`（黄色）；`limits.ts:383` 输出 `[cmd:err]`。
- **影响**：`[API err]` 易被理解为"程序报错"而非"HUD 的用量 API 拉取失败"；`[cmd:err]` 无法说明是哪个命令失败。
- **优化方向**：`[usage:err]`、`[usage:auth]`、`[custom:err]`，配合 stale 数据保留展示。

#### P2-13 健康阈值硬编码
- **证据**：`index.ts:211-212`：`durationMinutes>120 || contextPercent>85 → critical; >60 || >70 → warning`，均为魔法数字且与 `thresholds.contextCritical/warning`（`types.ts:627-637`）平行存在两套。
- **影响**：用户调整 context 阈值后 session 健康色不受影响，两套逻辑易漂移。
- **优化方向**：session 健康阈值复用 `config.thresholds` 或改为可配置。

#### P2-14 stale 标记语义需文档化
- **证据**：`limits.ts:67-68` stale 时 `5h:45%*(~3h42m)`：`*`=数据过期、`~`=重置时间近似。双信号合理但未在界面自解释。
- **优化方向**：可接受；README 图例补一行"`*`=缓存数据，`~`=近似重置"。

---

## 五、问题分级汇总

| 级别 | 数量 | 条目 |
|------|------|------|
| **P0（阻断）** | 0 | — |
| **P1（建议修复后放行）** | 9 | P1-01 主行超载；P1-02 agent 编码记忆负担；P1-03 缩写跨元素冲突（T/A/S）；P1-04 ctx COMPRESS? 语义；P1-05 token r/s 无标签；P1-06 状态栏内嵌 shell 教程；P1-07 阈值色不统一；P1-08 模型色/状态色冲突；P1-09/10 标签与分隔符语法不统一；P1-11/12 品牌 bold 与 callCounts 抢权重；P1-13 emoji 宽度计量；P1-14 窄终端 detail 丢失；P1-15 showHealthIndicator 死配置；P1-16 权限反馈默认关闭 |
| **P2（可选优化）** | 14 | P2-01~P2-14（prd 裸渲染、标签样式、`!` 多义、预设漂移、双时间并排、I/O/S 冗余、mission-board 过长、wrap 内容切分、二次截断、后台失败、错误措辞、健康阈值、stale 文档、bg 缩写） |

> 说明：P1 类目按"语义问题"聚合计数（同根因合并），若按原子问题拆分约 16 项。按 Anti-Slop 清单口径 P1=3，处于边界；但按本报告系统性问题口径建议至少修复 P1-03、P1-07、P1-08、P1-11、P1-15 五项后再放行。

---

## 六、给设计重构的优先建议（供 Phase 3 参考）

1. **建立统一颜色语义表**（单一来源）：`status.warn/critical` 与 `tier.opus/sonnet/haiku` 使用不相交色相；percent 阈值全局唯一。
2. **建立统一标签语法**：`dim(label:) + colored(value)`，所有元素一致；分隔符分级（元素/区域不同）。
3. **主行密度预算**：默认预设主行 ≤6-8 项；单调计数、双时间、profile 降级到 detail 或默认关闭。
4. **符号词典**：输出前对所有单字符符号（T/A/S/r/s/!/?/*/~/⇡/⇣）做一次"是否跨元素同形异义"检查，消除冲突。
5. **宽度计量升级**：emoji/ambiguous 按终端实际宽度计列，或 safeMode 下强制 ASCII。
6. **配置与实现对齐**：清理死配置（`showHealthIndicator`），补齐默认关闭但文档承诺的能力（权限反馈）。
7. **窄终端保底**：折叠策略优先保住 detail（警告/agents/todos），主行按优先级丢弃低价值元素而非整行换行。

---

## 七、审查结论

- 5 维度评分：**17/25**（哲学 3 / 层次 3 / 执行 4 / 特异 4 / 克制 3）。
- P0：0 项；P1：9 项（系统性问题）；P2：14 项。
- **判定：需修正后通过（Conditional Pass）**。核心障碍不在工程质量，而在**视觉语言的系统一致性**（颜色/标签/分隔符/符号的四套语义）与**默认预设的密度控制**。工程执行（宽度、降级、缓存、CJK）已达到可发布水准，值得保留。

---

# 第二部分 · 设计系统方向与令牌

> 本部分由设计系统专家（彩格调）产出。规范核心：**一套语义，五档密度**——所有预设共用同一套语义色/阈值/标签/分隔符/符号令牌，预设只决定语法密度。主方案为「Linear Pulse」（借鉴 Linear 的克制与单焦点），吸收 gh 的单字符语法与 Lazygit 的终端字符令牌。


> 文档编号：03-design-system.md
> 编制：设计系统专家（彩格调 Cai）
> 面向对象：原型构建师（Phase 3 直接消费）、批评审查员、主理人
> 版本：v1.0
> 依据：01-requirements.md（五要素 + 红线）、02-ui-review.md（17/25，P1 系统性问题 9 项）、源码核对（`src/hud/colors.ts` / `types.ts` / `render.ts` / `elements/*.ts`）
> 约束：仅产出设计规范，不修改任何代码；ANSI SGR 子集、无真彩依赖、CJK 双宽、深浅色兼容、≤1s 生命周期。

---

## 0. 设计问题定义（Design Brief）

OMC HUD 是 **ANSI 终端渲染的状态栏**，不是网页。71 套品牌级网页设计系统（Stripe/Linear 等）的完整视觉体系（字体栈、阴影、栅格、OKLCh）无法直接套用，但其**设计原则**可以提炼为适配终端约束的**轻量令牌体系**。

本规范的核心判断：**OMC HUD 的病根不在"单个元素好不好看"，而在"视觉语言的系统一致性"**（颜色 / 标签 / 分隔符 / 符号四套语义各自为政）+ **默认预设密度失控**。因此本规范不新增装饰，只做四件事：

1. **定语义**——每种颜色、每个符号、每类分隔符只有一种含义（消灭 P1-03/07/08/09/10）。
2. **定层级**——标签弱、值强；品牌弱、状态强；区域分界清晰（P1-11）。
3. **定密度**——5 预设各自的主行预算，默认 focused 从 15+ 项降到 ≤8 项（P1-01/12）。
4. **定降级**——safeMode 下每个 emoji/ambiguous 字符都有确定宽度的 ASCII 替代（P1-13）。

---

## 一、设计方向推荐（3 套候选）

> 参考系统均来自 71 套品牌级设计系统库（Linear / GitHub CLI(gh) / Lazygit），但**只借鉴设计原则，不复刻视觉**。三套候选共享同一套令牌底层，差异在"语法密度"——这正是"预设 = 密度档位"的设计意图。

### 方案 A：Linear Pulse（主方案）★★★★★

| 项 | 内容 |
|----|------|
| **命名** | Linear Pulse —— 借鉴 Linear 设计系统（克制、微妙层次、单焦点） |
| **核心理念** | 每次只突出一个焦点；层级靠 **dim/亮度** 而非彩色；色彩只用于**状态标注**，绝不用于装饰；信息密度服务于"一秒定位最需看的那一项" |
| **视觉学派** | Tech Utility 为主 + Modern Minimal 的留白克制 |
| **适用预设** | `focused`（默认）、`full` |
| **P1 对应** | P1-01 主行超载（密度预算）、P1-07 阈值统一、P1-08 色相分离、P1-09 标签语法、P1-10 分隔符层级、P1-11 品牌降权、P1-12 callCounts 降级 —— **7 项核心 P1 全解决** |
| **代价** | 需要一次"减法"重构：默认 focused 主行元素从 15+ 降到 ≤8；部分老用户需要适应 |

**推荐理由**：focused 是绝大多数用户的首屏预设，而审查报告最严重的问题（主行超载 + 多套语义色冲突）恰好是 Linear 哲学的对立面。以 Linear 为基调做减法，收益最大、风险可控。

### 方案 B：gh Utility ★★★★☆

| 项 | 内容 |
|----|------|
| **命名** | gh Utility —— 借鉴 GitHub CLI / gh 的 CLI 状态语言 |
| **核心理念** | 工具化、单字符状态；能用一个字符表达绝不用两个；**符号集合显式最小化 + 图例文档化**；颜色仅用于 alert，常态靠文本 |
| **视觉学派** | Tech Utility（纯工具感） |
| **适用预设** | `minimal`、`opencode` |
| **P1 对应** | P1-02 agent 编码记忆负担（gh 主张"符号最小集 + 权威图例"）、P1-03 符号冲突（单字符集合显式冲突消除）、P1-12 callCounts 降级 |
| **代价** | 单字符表达力有限，无法承载 full/dense 的高密度信息 |

**推荐理由**：opencode 预设默认 `agentsFormat:'codes'` 正是 gh 式的单字符流，需要一份**权威符号词典**（见 §二.6）来救 P1-02/03。minimal 预设的"一行到底"也符合 gh 哲学。

### 方案 C：TUI Native ★★★☆☆

| 项 | 内容 |
|----|------|
| **命名** | TUI Native —— 借鉴 Lazygit 及终端原生 TUI 设计语言 |
| **核心理念** | 用终端原生块字符（`█░`）、框线字符（`│╎`）、区域分栏构建高密度但结构分明的信息；**每个字符宽度确定**是首要约束 |
| **视觉学派** | Tech Utility（数据仪表盘） |
| **适用预设** | `full`、`dense` |
| **P1 对应** | P1-13 宽度计量（块字符宽度确定）、P1-10 分隔符分层（框线字符 `╎` 强化区域边界）、P1-14 窄终端 detail 保留 |
| **代价** | 框线/块字符在 safeMode 需 ASCII 回退；部分终端字体渲染不一致 |

**推荐理由**：full/dense 预设需要最大信息密度，Lazygit 证明了终端原生字符能在高密度下保持可读。本方案的**字符选择**（`╎` 区域分隔、`█░` 进度）会被主方案 A 采纳为令牌，因此三方案并非互斥。

### 推荐结论

> **主方案 = 方案 A「Linear Pulse」**，同时将 **B 的单字符语法**与 **C 的字符令牌**并入统一令牌层：
> - **令牌层统一**（§二）：所有预设共用同一套语义色 / 阈值 / 标签语法 / 分隔符 / 符号词典；
> - **语法层分档**（§二.8）：预设只决定"用多少语法密度"，不改变语义。
>
> 一句话：**一套语义，五档密度**。这满足红线五（配置永远有默认值）与红线八（克制不喧宾夺主）。

### P1 问题 → 方案映射总表

| P1 问题 | 主方案 | 关键令牌 |
|---------|:------:|----------|
| P1-01 主行超载 | A | §二.8 密度预算 |
| P1-02 agent 编码记忆负担 | B | §二.6 符号词典 + codes 降级 |
| P1-03 T/A/S 跨元素冲突 | B | §二.6 call-counts 改 `Tl/Ag/Sk` |
| P1-04 COMPRESS? 语义 | A | §二.3 标签语法统一动作词 |
| P1-05 token r/s 无标签 | A | §二.6 `r:`/`tot:` 前缀 |
| P1-06 状态栏内嵌教程 | A | §二.7 降级规则（教程移出） |
| P1-07 阈值色不统一 | A | §二.2 THRESHOLDS.percent |
| P1-08 模型色/状态色冲突 | A | §二.1 色相不相交组 |
| P1-09 标签语法不统一 | A | §二.3 `dim(label:)+colored(value)` |
| P1-10 分隔符层级模糊 | A+C | §二.4 元素/区域分隔 |
| P1-11 品牌 bold 抢权重 | A | §二.5 bold 白名单 |
| P1-12 callCounts 抢注意力 | A | §二.8 单调计数降级 |
| P1-13 emoji 宽度计量 | C | §二.7 宽度策略 + ASCII 表 |
| P1-14 窄终端 detail 丢失 | C | §二.8 折叠保底策略 |
| P1-15 死配置 | A | §三 配置对齐建议 |
| P1-16 权限反馈缺失 | A | §三 配置对齐建议 |

---

## 二、设计令牌（Design Tokens）——核心规范

> 每条令牌均给出可直接映射 `src/hud/colors.ts` / `types.ts` / `render.ts` 的 ANSI 值与实现位置。色值以 ANSI SGR 为准（终端语义色，随主题明暗自适应），另附常规终端近似 HEX 供原型画布使用。

### 2.1 语义色令牌（Semantic Color Tokens）

#### 2.1.1 色相分组（解决 P1-08 的核心规则）

```
状态色相组（暖系，表达"健康程度"）：  GREEN(120°) / YELLOW(60°) / RED(0°)
档位色相组（冷系，表达"模型能力"）：  BRIGHT_BLUE(240°) / BLUE(240°) / CYAN(180°)
中性/修饰：DIM / BOLD / 默认前景（无彩色）
```

**规则 R-COLOR-1（色相不相交）**：档位色相组与状态色相组在色相环上完全不相交（冷 vs 暖）。任何元素禁止让"模型档位色"与"状态警告色"同时出现在同一值上。这直接消灭 P1-08（现状 Sonnet=YELLOW 与警告同色）。

**规则 R-COLOR-2（每值一色）**：一个值至多着一种彩色；标签永远 dim（见 §二.3）。

**规则 R-COLOR-3（info 隔离）**：`status.info`（BRIGHT_CYAN）与 `tier.haiku`（CYAN）色相相邻，禁止在同一元素内同时使用二者。

#### 2.1.2 令牌表

| 令牌 | ANSI 序列 | 近似 HEX（深色终端） | 近似 HEX（浅色终端） | 使用场景白名单（允许） | 禁止场景 |
|------|----------|---------------------|---------------------|------------------------|----------|
| `status.success` | `\x1b[32m` | `#3FB950` | `#1A7F37` | 正常态值（ctx<warn、limits<warn、健康）、进度完成度高 | 不用作装饰色 |
| `status.warning` | `\x1b[33m` | `#D29922` | `#9A6700` | 警告态值（≥warn）、agent 时长 2-5m、ralph 70-90% | 不用于模型档位（原 Sonnet） |
| `status.critical` | `\x1b[31m` | `#F85149` | `#CF222E` | 临界态值（≥critical）、agent 时长 >5m、ralph ≥90%、致命错误 | 不用于普通提醒 |
| `status.info` | `\x1b[96m` | `#39C5CF` | `#0B7285` | 次要信息：stale 说明、mission 时间线、可选提示 | 不与 `tier.haiku` 同现（R-COLOR-3） |
| `text.dim` | `\x1b[2m` | 前景 50% | 前景 50% | **所有标签**、分隔符、次要信息、版本号、空槽 `░`、未知模型 | 不用于主值 |
| `text.bold` | `\x1b[1m` | 加粗 | 加粗 | 仅 §二.5 白名单三类 | 品牌标签、普通值 |
| `brand.omc` | 默认前景（无 SGR 彩色） | 主题前景 | 主题前景 | `[OMC]` 前缀、版本标签 `#x.y.z` | 不用彩色、不用 bold |
| `tier.opus` | `\x1b[94m` | `#58A6FF` | `#0550AE` | Opus 档模型名、Opus agent 编码 | 不表达状态 |
| `tier.sonnet` | `\x1b[34m` | `#4493F8` | `#0969DA` | Sonnet 档模型名、Sonnet agent 编码 | 不表达状态 |
| `tier.haiku` | `\x1b[36m` | `#39C5CF` | `#0B7285` | Haiku 档模型名、Haiku agent 编码 | 不与 `status.info` 同现 |
| `tier.unknown` | `\x1b[2m` | 前景 50% | 前景 50% | 未知模型名 | — |
| `progress.filled` | 随阈值色（status.*） | — | — | 进度条实心 `█` | — |
| `progress.empty` | `\x1b[2m` | 前景 25% | 前景 25% | 进度条空槽 `░` | — |

#### 2.1.3 实现映射（colors.ts）

```
getModelTierColor：MAGENTA→BRIGHT_BLUE(opus)、YELLOW→BLUE(sonnet)、GREEN→CYAN(haiku)、未知 CYAN→DIM
getContextColor：  85→90（改 RED 阈值到 90，与 limits 统一，见 §二.2）
getTodoColor：     去 YELLOW，改为 GREEN(≥80)/CYAN(≥1)/DIM(0)（进度色非危险色）
getDurationColor： 保留 2m/5m 状态语义（时间异常属状态色，合理）
getRalphColor：    保留相对 0.7/0.9（迭代阈值，非 percent）
coloredBar：       color 由 getContextColor → 改由统一 THRESHOLDS.percent 驱动（§二.2）
```

> **为什么要改档位色为蓝色系**：审查 P1-08 指出 Opus=品红/Sonnet=黄/Haiku=绿 与状态色冲突（黄=警告、绿=健康、品红在部分终端近似红）。蓝色系是 ANSI 16 色中唯一整组（BLUE/BRIGHT_BLUE/CYAN）与红黄绿不相交的冷色组，且与"未知=dim"天然区分。代价：浅色终端下 34/94 对比度略低，故建议浅色主题保持 `modelFormat:'versioned'` 并在 agent 编码场景优先使用档位色。

### 2.2 阈值统一表（Threshold Tokens）（解决 P1-07）

**规则 R-THRESH-1（percent 全局唯一）**：所有"越满越危险"的百分比仪表共用一套阈值，抽为单一常量表：

```
THRESHOLDS.percent = { warn: 70, critical: 90 }
```

| 元素 | 现状 | 统一后 | 说明 |
|------|------|--------|------|
| context | warn 70 / crit 85 | **warn 70 / crit 90** | critical 从 85 上调到 90，与 limits 对齐 |
| rate limits（5h/wk/mo/sn/op/ent） | warn 70 / crit 90 | warn 70 / crit 90 | 不变（作为基准） |
| enterprise cost | warn 70 / crit 90 | warn 70 / crit 90 | 不变 |
| payload estimate | 分散 | warn 70 / crit 90 | 复用同一常量 |
| session health | 魔法数 60/120/70/85（index.ts:211） | **复用 THRESHOLDS.percent + duration** | 消除 P2-13 双套逻辑 |
| contextCompactSuggestion | 80 | **保留 80（独立）** | 这是"动作建议"不是颜色阈值，与 R-THRESH-1 不冲突 |

**规则 R-THRESH-2（进度色 ≠ 危险色）**：todos / background 容量是"完成度/进度"，**不表达危险**，使用 `progress` 色而非状态色：

| 元素 | 新色规则 | 旧色（废弃） |
|------|----------|-------------|
| todos 完成度 | ≥80% GREEN / ≥1% CYAN / 0 DIM | ≥50% YELLOW（废弃，避免"进度黄=危险黄"） |
| background 容量 | 满 GREEN / 部分 CYAN / 空 DIM | YELLOW/CYAN/GREEN 混用（废弃） |
| background 失败 | 红色徽标 `!N`（`bg:3/5 !1`） | 无（补齐 P2-11） |

**规则 R-THRESH-3（时长异常属状态色）**：agent 时长 / 会话时长用 `duration` 语义：`<2m GREEN / 2-5m YELLOW / >5m RED`。因为"超时"是异常而非进度。

**规则 R-THRESH-4（文案单一来源）**：主行与详情行的动作词统一（P1-04）。`COMPRESS?` → `ctx:82%! compact`（统一用 `/compact` 的动作词）；颜色阈值与动作词都读自同一 `thresholds` 配置。

### 2.3 标签语法令牌（Label Syntax Tokens）（解决 P1-09）

**全局语法（唯一）**：

```
dim(label:) + colored(value)
```

- 标签：`\x1b[2m` + 半角冒号 `:`（1 列），固定 dim。
- 值：着色（状态色 / 档位色 / 进度色 / 默认前景）。
- 规则：**标签永远 dim，值才着色；同一元素内不允许出现两个彩色标签**。

**规则 R-LABEL-1（label 固定格式）**：`<label>:`，冒号必带，无空格。
**规则 R-LABEL-2（无标签例外清单）**：以下元素允许无标签：`[OMC]` 品牌前缀、callCounts 图标、thinking 符号、区域标签 `I:/O:/S:` 本身。
**规则 R-LABEL-3（model 特殊）**：`Model:` 标签 dim，值用档位色（旧实现整段 cyan，废弃）。
**规则 R-LABEL-4（动作词统一）**：警告类后缀统一为 `! compact`（P1-04），不出现 `COMPRESS?`。

#### 元素标签规范总表（en，默认）

| 元素 | 标签（dim） | 值着色 | 备注 |
|------|------------|--------|------|
| context | `ctx:` | status.* | 阈值驱动 |
| model | `Model:` | tier.* | 旧整段 cyan 废弃 |
| rate limits | `5h:` `wk:` `mo:` `sn:` `op:` `ent:` | status.* | 全部 dim（修 P2-02） |
| ralph | `ralph:` | status.* | |
| prd | `PRD:` | 默认/cyan | 修 P2-01（裸 `US-002` 加前缀） |
| background | `bg:` | progress | 文档注明 bg=后台任务 |
| session | `session:` | status.* | 值=时长 |
| promptTime | `prompt:` | 默认 | 修 P2-06（`⏱13s` 加标签） |
| token usage | `tokens:`（或符号 `↑↓`） | 默认/cyan | 内部 `r:`/`tot:` 前缀见 §二.6 |
| agents | `agents:` | 按格式 | codes 用档位色 |
| todos | `todos:` | progress | 值=进度 |
| lastTool | `tool:` | 默认 | 现状已 dim |
| lastSkill | `skill:` | 默认 | |
| sessionSummary | `summary:` | 默认 | 现状已 dim |
| apiKeySource | `key:` | 默认 | 现状已 dim |
| gitRepo | `repo:` | 默认 | 现状已 dim |
| gitBranch | `branch:` | 默认 | |
| profile | `profile:` | 默认 | 非 bold（修 P1-11） |

#### 区域标签（ioGrouping）

`I:` / `O:` / `S:` 全部 dim + 冒号，格式 `dim('I: ')`。与 agent 编码的 `S`（scientist）冲突靠三重消歧：dim 前缀 + 冒号 + 区域分隔符（§二.4）。**规则 R-LABEL-5：区域标签只用 `I`/`O`/`S` 单字母，不本地化**（zh 用 `输入/输出/状态` 仅作为 locale 覆盖，默认 en）。

### 2.4 分隔符层级令牌（Separator Hierarchy Tokens）（解决 P1-10）

**规则 R-SEP-1（两级分隔）**：

| 层级 | 令牌 | ANSI 序列 | 显示列宽 | 用途 |
|------|------|----------|:--------:|------|
| L1 元素分隔 | `dim(' | ')` | `\x1b[2m | \x1b[0m` | 3 | 元素边界（现状保留） |
| L2 区域分隔 | `dim(' ╎ ')` | `\x1b[2m ╎ \x1b[0m`（U+257E，1 列） | 3 | I/O/S 区域边界 |
| L3 内容内部 | `,` 或空格 | 无 | 1 | agents 描述内部、git 状态内部、token 部件内部 |

**规则 R-SEP-2（区分度来源）**：L1 与 L2 同为 3 列，靠**字形**区分——`|` 细线 vs `╎` 粗实线（BOX DRAWINGS LIGHT VERTICAL）。区域边界另由区域标签 `dim('I: ')` 前置强化。
**规则 R-SEP-3（wrap 安全）**：wrap 只允许按 L1/L2 分隔符切分；元素**内部**一律用 L3（`,`/空格），绝不用 `|`（修 P2-09：agents 描述内部分隔改 `,`）。
**规则 R-SEP-4（safeMode 回退）**：`╎` → `|`（safeMode 下区域层级仅靠区域标签 + 间隔表达）。
**规则 R-SEP-5（I/O/S 冗余消解）**：分组开启时，tokens 的 `↑/↓` 符号保留（区域内部符号），但 S 区的 `s` 前缀去掉——区域标签已表达（修 P2-07）。

实现位置：`render.ts:144-145`（新增 `REGION_SEPARATOR` 常量）、`render.ts:715/719`（区域内用 L1、区域间用 L2）。

### 2.5 字重 / 修饰令牌（Weight & Decoration Tokens）（解决 P1-11）

**规则 R-WEIGHT-1（bold 白名单，全 HUD 仅三类）**：

| 场景 | 示例 | 说明 |
|------|------|------|
| 1. update 提醒 | `-> 4.1.11 omc update` | 可操作信号 |
| 2. warning banner 标题 | `⚠ context 90%` | 详情行警告标题 |
| 3. critical 关键值（可选） | `ctx:90%`（≥critical） | 临界值可加粗 |

**规则 R-WEIGHT-2（一行 ≤1 处 bold）**：单行内 bold 最多出现一次，且必然伴随可操作信息。
**规则 R-WEIGHT-3（品牌降权）**：`[OMC]` 前缀 → 默认前景（无彩色）+ **非 bold**；版本号 `#x.y.z` → dim。`profile` → 非 bold（修 P1-11）。
**规则 R-WEIGHT-4（dim 默认优先）**：凡拿不准是否强调的信息，一律 dim（标签、次要值、版本、未知、空槽）。

### 2.6 符号词典（Symbol Dictionary）（解决 P1-03 / P1-05 / P2-04）

**总则 R-SYM-1（单字符唯一语义）**：同一字符在全 HUD 只表达一种含义。冲突时换字符或加前缀。
**总则 R-SYM-2（大小写规则）**：仅 agent 编码用大小写表达档位（Opus=大写、非 Opus=小写）；其他符号一律不依赖大小写差异。
**总则 R-SYM-3（前缀消歧）**：缩写一律带冒号前缀（`r:`/`tot:`/`Tl:`）实现自解释。

| 符号 | 权威含义 | 所在元素 | safeMode / ASCII 回退 | 冲突处置 |
|------|----------|----------|----------------------|----------|
| `Tl:` `Ag:` `Sk:` | tool / agent / skill 调用计数 | callCounts（ASCII） | 不变 | **替代原 `T/A/S`**，消除与 agent 编码冲突（P1-03） |
| `🔧` `🤖` `⚡` | 同上（emoji） | callCounts（emoji） | `Tl:` `Ag:` `Sk:` | 宽度 2 列，safeMode 回退 3 列 |
| `A`-`Z` / `a`-`z` | agent 类型编码 | agents（codes） | 不变 | 30+ 映射为高级可选格式；**默认预设不用 codes**（P1-02） |
| `!` | **异常/需注意**（git modified、context 警告、background 失败徽标） | git / contextWarning / background | `!` | agent 超时**禁用** `!`（改 `⏱`） |
| `?` | git untracked | git | `?` | 唯一含义 |
| `+` | git staged | git | `+` | 唯一含义；agent 超时禁用 `+` |
| `⇡` `⇣` | git ahead / behind（版本漂移） | git | `↑` `↓` | 与 token 方向箭语义区分（§R-SYM-4） |
| `↑` `↓` | token 输入 / 输出流 | token usage | `↑` `↓` | 数据流方向语义 |
| `r:` | reasoning token | token usage | `r:` | 带冒号自解释（修 P1-05） |
| `tot:` | session 累计 token | token usage | `tot:` | 替代裸 `s`（修 P1-05） |
| `*` | 数据过期（stale 缓存） | rate limits | `*` | 图例文档化 |
| `~` | 重置时间近似 | rate limits | `~` | 图例文档化 |
| `⏱` | 计时 / 超时信号 | promptTime、agent timeout | `t:` 或省略 | **agent 超时改用此符号**（修 P2-04）；safeMode 下可省略（超时用红色 duration 表达） |
| `⚠` | 警告 banner | contextWarning / payloadWarning | `!` | 详情行专用 |
| `█` `░` | 进度实心 / 空槽 | contextBar | `#` `-` | 宽度 1 列（safeMode 等宽替代） |
| `I:` `O:` `S:` | 区域标签（Input/Output/Status） | ioGrouping | 不变 | 与 agent `S` 冲突靠 dim+冒号+区域分隔消歧（§二.4） |
| `bg:` | background 任务 | background | 不变 | 文档注明 bg=后台任务 |
| `L` | 本地安装包标记 | omcLabel | `L` | 版本后缀 |
| `...` `(+N lines)` | 折叠指示 | 任意（ROB-6） | 不变 | 表示被 maxOutputLines 折叠 |

**规则 R-SYM-4（箭头族语义隔离）**：`↑↓`（token 流）与 `⇡⇣`（git 漂移）字符不同、语义不同。当 `ioGrouping` 开启时，`↑↓` 出现在 I/O 区内，`⇡⇣` 出现在 git 行（line1），天然分域；文档图例必须同时列出二者。

**规则 R-SYM-5（`!` 语义隔离）**：`!` 只表达"异常/需注意"。git modified（`!3`）与 context warning（`!`/`!!`）语义一致（都是异常），允许共存；agent 超时改用 `⏱`（P2-04）。

### 2.7 CJK / emoji 宽度策略（解决 P1-13）

**规则 R-WIDTH-1（宽度分类）**：

| 类别 | 范围 | 显示宽度 |
|------|------|:--------:|
| ASCII | U+0000–U+007F | 1 |
| CJK / 全角 | U+1100–U+115F、U+2E80–U+A4CF、U+AC00–U+D7A3、U+F900–U+FAFF、U+FE30–U+FE4F、U+FF00–U+FF60、U+FFE0–U+FFE6 等（现有实现） | 2 |
| emoji | U+1F000–U+1FAFF、U+2600–U+27BF、U+2B00–U+2BFF 等 | **2**（新增） |
| ambiguous | U+21A0–U+21FF（含 ⇡⇣↑↓）、U+23F1（⏱）等 | **默认按 2 保守计** |
| 零宽 | U+200B–U+200F、U+FE00–U+FE0F | 0 |

**规则 R-WIDTH-2（getCharWidth 升级）**：`string-width.ts` 的 `getCharWidth` 增加 emoji 区段判定（现按 1 列计，P1-13 根因）；ambiguous 显式按 2 列保守计，宁可少显示一个字符也不溢出。

**规则 R-WIDTH-3（safeMode 强制 ASCII，宽度确定）**：safeMode 下所有 emoji / ambiguous 按映射表替换为 1 列宽 ASCII，保证 `truncateLineToMaxWidth` 恰好命中 maxWidth。

#### safeMode / ASCII 替换映射表

| 符号（emoji/图形） | 正常模式 | safeMode ASCII | 宽度变化 |
|--------------------|----------|----------------|:--------:|
| 🔧 工具 | 🔧 | `Tl:` | 2 → 3 |
| 🤖 agent | 🤖 | `Ag:` | 2 → 3 |
| ⚡ skill | ⚡ | `Sk:` | 2 → 3 |
| 💭 思考 | 💭 | `thk` | 2 → 3 |
| 🧠 思考 | 🧠 | `thk` | 2 → 3 |
| 🤔 思考 | 🤔 | `thk` | 2 → 3 |
| ⏱ 计时 | ⏱ | `t:` | 2 → 2 |
| ⇡ 领先 | ⇡ | `^` | 2 → 1 |
| ⇣ 落后 | ⇣ | `v` | 2 → 1 |
| ⚠ 警告 | ⚠ | `!` | 2 → 1 |
| █ 实心 | █ | `#` | 1 → 1 |
| ░ 空槽 | ░ | `-` | 1 → 1 |
| ╎ 区域分隔 | ╎ | `|` | 1 → 1 |

> 注：`Tl:` 等回退为 3 列，会略增宽；safeMode 下 `callCountsFormat` 建议显式 `ascii`。thinkingFormat 默认 `text`（"thinking"）即可规避 💭🧠🤔。

**规则 R-WIDTH-4（教程不占状态栏）**：P1-06 的 multi-repo 提示缩为 `⚠ multi-repo (unmarked)`；配置引导（`echo {} > ...`）移出 HUD，避免非 ASCII 与超长占位。

### 2.8 密度档位（Density Presets）（解决 P1-01 / P1-12）

**规则 R-DENSITY-1（主行预算）**：每个预设定义"主行 ≤N 项"硬上限；超出项移 detail 或默认关闭。密度预算写入预设设计约束，作为 ELEMENT_REGISTRY 元数据可校验。

| 预设 | 主行预算 | maxOutputLines | 主行推荐元素（默认顺序） | 详情行 / 次要行 | 说明 |
|------|:--------:|:--------------:|--------------------------|------------------|------|
| `minimal` | **≤4** | 2 | omcLabel, model, ctx, ralph | todos（1 行） | 单行极简 |
| `focused` | **≤8** | 4 | omcLabel, model, ctx, ralph, autopilot, prd, session, tokens | agents(≤3), todos, contextWarning | 默认；ioGrouping=on |
| `full` | **≤12** | 12 | 核心全部 | agents(≤10), todos, warnings, mission | 高密度 |
| `opencode` | **≤6** | 4 | omcLabel, model, ctx, agents(codes), ralph, session | todos | 单字符流（配图例） |
| `dense` | **≤10** | 6 | 同 full 压缩 | agents(≤5), todos | 高密度压缩 |

**规则 R-DENSITY-2（单调/计时/低价值降级）**：

| 元素类型 | 处置 | 依据 |
|----------|------|------|
| `callCounts`（单调递增计数） | 默认 detail 或关闭；保留时改"本回合增量" | P1-12 |
| `promptTime`（纯计时） | 默认 detail 或关闭；保留时加 `prompt:` 标签 | P2-06 |
| `profile`（低价值） | 默认 line1 或关闭；非 bold | P1-11 |
| `apiKeySource` / `hostname` | 默认 line1 或关闭 | 低价值 |

**规则 R-DENSITY-3（agentsFormat 分档）**：minimal → `count`；focused/full/dense → `multiline`（agents 走 detail 行，不占主行预算）；opencode → `codes`（必须配图例表 §二.6）。**默认预设一律不用 `codes`**（P1-02）。

**规则 R-DENSITY-4（窄终端保底，P1-14）**：折叠策略优先保住 detail（警告 / agents / todos）；主行超宽时按元素优先级**丢弃低价值元素**（callCounts、promptTime、profile）而非整行换行。优先级序：context > 警告 > agents > model > 其余 > callCounts。

---

## 三、给原型构建师的规格（Phase 3 直接消费）

### 3.1 原型画布规格

用纯 HTML/CSS 做**终端仿真画布**，覆盖 5 预设 × 2 主题 × 2 宽度 × 2 safeMode = 关键 8 场景：

| 维度 | 取值 | 说明 |
|------|------|------|
| 主题 | 深色 / 浅色 | 深色优先（终端默认多深色，需求开放问题 #5） |
| 宽度 | 120 列（宽）/ 60 列（窄） | 宽=完整主行；窄=触发 wrap/截断 |
| safeMode | 开 / 关 | 开=ASCII 替换 + 无 emoji/ambiguous |

CSS 等宽字体栈：`'JetBrains Mono', 'SF Mono', 'Cascadia Code', 'Consolas', monospace`（终端由用户主题决定，原型只仿真字形）。

ANSI → CSS class 映射（供原型直接消费）：

| ANSI | CSS class | 深色背景值 | 浅色背景值 |
|------|-----------|-----------|-----------|
| 30/37 | `.fg-default` | `#E6EDF3` | `#24292F` |
| 31 | `.fg-red` | `#F85149` | `#CF222E` |
| 32 | `.fg-green` | `#3FB950` | `#1A7F37` |
| 33 | `.fg-yellow` | `#D29922` | `#9A6700` |
| 34 | `.fg-blue` | `#4493F8` | `#0969DA` |
| 36 | `.fg-cyan` | `#39C5CF` | `#0B7285` |
| 94 | `.fg-bright-blue` | `#58A6FF` | `#0550AE` |
| 96 | `.fg-bright-cyan` | `#39C5CF` | `#0B7285` |
| 1 | `.fg-bold` | font-weight 700 | font-weight 700 |
| 2 | `.fg-dim` | opacity 0.55 | opacity 0.55 |
| 背景 | `.bg` | `#0D1117` | `#F6F8FA` |

### 3.2 每个预设的推荐元素组合表

| 元素 | minimal | focused | full | opencode | dense |
|------|:-------:|:-------:|:----:|:--------:|:-----:|
| omcLabel | ✔ | ✔ | ✔ | ✔ | ✔ |
| model | ✔ | ✔ | ✔ | ✔ | ✔ |
| contextBar / ctx | ✔ | ✔ | ✔ | ✔ | ✔ |
| ralph | ✔ | ✔ | ✔ | ✔ | ✔ |
| autopilot | — | ✔ | ✔ | ✔ | ✔ |
| prd | — | ✔ | ✔ | — | ✔ |
| session | — | ✔ | ✔ | ✔ | ✔ |
| tokens | — | ✔ | ✔ | — | ✔ |
| rateLimits | ✔ | ✔ | ✔ | — | ✔ |
| agents（格式） | count | multiline(3) | multiline(10) | codes | multiline(5) |
| todos | detail | detail | detail | detail | detail |
| thinking | — | ✔ | ✔ | ✔ | ✔ |
| callCounts | — | detail/off | detail/off | off | detail/off |
| promptTime | — | off | detail | off | off |
| background | — | ✔ | ✔ | — | ✔ |
| gitBranch/gitStatus | — | ✔ | ✔ | ✔ | ✔ |
| ioGrouping | off | **on** | on | off | on |
| maxOutputLines | 2 | 4 | 12 | 4 | 6 |
| **主行预算** | **≤4** | **≤8** | **≤12** | **≤6** | **≤10** |

### 3.3 原型必须演示的交互

1. **阈值变色**：context 70→90 三档（绿→黄→红），rate limits 同步；todo 进度色（绿/青/dim）与状态色区分。
2. **watch 刷新**：内容随快照变化（promptTime 递增、tokens 变化）。
3. **truncate / wrap**：120→60 列切换，观察 wrap 只按 L1/L2 分隔符切分、元素内部不拆。
4. **safeMode 对比**：emoji → ASCII 替换表效果（🔧→Tl: 等）。
5. **区域分隔**：focused 预设 I/O/S 区域用 `╎` vs 元素 `|` 的层级对比。

### 3.4 配置对齐建议（供主理人/批评参考，非本阶段实现）

- P1-15：`showHealthIndicator` 死配置 → 二选一（在 renderSession 真渲染 🟢🟡🔴 指示器 / 删除配置项并修正注释）。若保留，health 指示器用 `status.*` 色点（`●`/`◐`/`○`，safeMode 回退 `ok`/`warn`/`crit`）。
- P1-16：权限反馈默认关闭 → 提供轻量兜底"模型静默 >N 秒显示 `waiting…`"，或显著文档标注。
- P2-12：错误徽标措辞 `[API err]` → `[usage:err]`、`[usage:auth]`、`[custom:err]`。
- P2-08：mission-board 摘要行按宽度预算截断事件数。

---

## 四、红线对照（Design Red Lines Compliance）

| 红线 | 本规范保障 |
|------|-----------|
| 红线一：绝不阻塞主流程 | 令牌纯静态，无 IO/锁/子进程 |
| 红线二：渲染 ≤1s | 令牌不引入运行时计算（阈值/宽度为常量表） |
| 红线三：控制序列白名单 | 仅 SGR（2/1/31-37/94/96）；safeMode 剥离非 SGR |
| 红线四：外部输入可缺失 | 颜色/标签有默认值，缺数据降级 dim/省略 |
| 红线五：配置永远有默认值 | 所有令牌有 DEFAULT；预设可被细粒度开关覆盖 |
| 红线六：渲染与数据解耦 | 令牌为渲染层常量；阈值/宽度为纯函数输入 |
| 红线七：与终端主题兼容 | 只用 ANSI 语义色，无背景依赖；深浅色白名单校验 |
| 红线八：克制不喧宾夺主 | 无装饰色；bold ≤1/行；密度预算硬上限 |

---

## 五、Agent Prompt Guide（AI 生成 / 后续消费指南）

### Key Instructions
- 生成任何元素渲染：先查 §二.6 符号词典，确认所用字符无跨元素冲突；再查 §二.3 标签表，套用 `dim(label:)+colored(value)`。
- 颜色选择：先问"这是状态（status.*）、档位（tier.*）、进度（progress）还是修饰（dim/bold）？"——四者互不混用。
- 百分比值：一律用 `THRESHOLDS.percent {warn:70, critical:90}` 上色；禁止在元素内写死 85 等魔法数字。
- 密度：主行元素数超过预设预算时，优先丢弃 callCounts/promptTime/profile，禁止为塞下全部而压缩可读性。
- 宽度：任何非 ASCII 字符先查 §二.7 宽度表；safeMode 下必须使用替换映射。

### Quick Reference（核心令牌速查）

```text
# 语义色（ANSI SGR）
status.success  \x1b[32m   status.warning  \x1b[33m
status.critical \x1b[31m   status.info     \x1b[96m
tier.opus       \x1b[94m   tier.sonnet     \x1b[34m   tier.haiku \x1b[36m
text.dim        \x1b[2m    text.bold       \x1b[1m
brand.omc       默认前景（无色非 bold）

# 阈值
percent: warn=70 / critical=90（context/limits/cost/payload 共用）
duration: warn=2m / critical=5m（agent/session 时长）
progress: good=80% / any=1%（todos/background，无黄）

# 分隔符
L1 元素  dim(' | ')   L2 区域  dim(' ╎ ')   L3 内部  ',' / ' '

# 标签语法
dim(label:) + colored(value)   （标签永远 dim，值才着色）

# 密度
minimal≤4  focused≤8  opencode≤6  dense≤10  full≤12
```

---

*（文档结束）*


# 第三部分 · 优化方案与落地路径

> 本部分由主理人（画统筹）汇编，输入为：审查报告（严过审）+ 设计令牌规范（彩格调）。目标：把"17/25 需修正后通过"变成可排期、可执行、可验证的工程改造清单。

---

## 1. 优化优先级排序（P0 > P1 > P2，按"影响 ÷ 成本"排序）

### 1.1 总览

| 优先级 | 主题 | 对应问题 | 预估工作量 | 预期效果 |
|--------|------|---------|:----------:|----------|
| **P0-1** | 颜色语义统一（色相不相交 + 阈值唯一） | P1-07, P1-08, P2-13 | 小（colors.ts 一处） | 消灭"同数值不同色、同色相不同义"，用户直觉建立 |
| **P0-2** | 标签语法统一 `dim(label:)+colored(value)` | P1-09, P2-02, P2-01 | 中（10+ 元素微调） | 全 HUD 阅读模式一致，扫描成本下降 |
| **P0-3** | 符号冲突消除（符号词典落地） | P1-03, P1-05, P2-04 | 小（3 处硬编码） | 消灭两套 T/A/S 词汇表、裸 r/s 歧义 |
| **P0-4** | 死配置清理 | P1-15 | 极小（1 处） | 配置与实现对齐，文档诚实 |
| **P1-1** | 主行密度预算（focused ≤8 项） | P1-01, P1-12, P2-06 | 中（预设重排） | 默认 HUD 一眼可读 |
| **P1-2** | 宽度计量升级（emoji/ambiguous 2 列） | P1-13 | 中（string-width.ts） | 截断/换行精确命中 maxWidth |
| **P1-3** | 窄终端保底（detail 优先保留） | P1-14, P2-09 | 中（render.ts 折叠策略） | 窄屏不失关键信息 |
| **P1-4** | agent 编码降级（默认不用 codes） | P1-02 | 小（预设默认值） | 消除 30+ 编码记忆负担 |
| **P2-1** | 交互反馈补齐（权限 waiting / bg 失败） | P1-16, P2-11 | 中 | 状态栏履行"报告异常"职责 |
| **P2-2** | 文案统一（COMPRESS? → compact、错误徽标） | P1-04, P1-06, P2-12 | 小 | 动作词/错误措辞自解释 |

### 1.2 为什么这么排

- **P0 组都是"一致性/正确性"问题**：改动小、影响面广，是其他一切优化（密度、宽度）的前提——颜色和符号语法不统一时，谈密度预算没有意义。
- **P1 组是"体验"问题**：需要更谨慎的预设重排与渲染管线改动，依赖 P0 完成后令牌已就位。
- **P2 组是"增强"问题**：不阻塞发布，可与 P1 并行。

---

## 2. 逐项改造建议（文件级落地映射）

### 2.1 P0-1 颜色语义统一

| 动作 | 文件 | 具体改法 |
|------|------|---------|
| 新增统一常量表 | `src/hud/colors.ts` | 新增 `export const HUD_COLORS = { success:'\x1b[32m', warning:'\x1b[33m', critical:'\x1b[31m', info:'\x1b[96m', tierOpus:'\x1b[94m', tierSonnet:'\x1b[34m', tierHaiku:'\x1b[36m' }`；`getContextColor` 的 critical 阈值 85→90，与 `limits.ts` 的 90 对齐 |
| 档位色改蓝色系 | `src/hud/colors.ts` `getModelTierColor` | Opus: MAGENTA→BRIGHT_BLUE；Sonnet: YELLOW→BLUE；Haiku: GREEN→CYAN；未知: CYAN→DIM |
| 进度色与状态色分离 | `src/hud/colors.ts` `getTodoColor` + `src/hud/elements/todos.ts` `background.ts` | todos：≥80% GREEN / ≥1% CYAN / 0 DIM（去 YELLOW）；background：满 GREEN / 部分 CYAN / 空 DIM |
| session 健康阈值复用 | `src/hud/index.ts` `calculateSessionHealth` | 用 `config.thresholds` 替换魔法数 60/120/70/85 |

**验证**：跑 `vitest run src/__tests__/hud` 全绿；`colors.test.ts`（若有）更新断言。

### 2.2 P0-2 标签语法统一

| 元素 | 文件 | 改法 |
|------|------|------|
| rate limits 标签全部 dim | `elements/limits.ts` | `5h:` 由普通文本改 `dim('5h:')`（现状 wk:/mo:/sn:/op: 已 dim，统一之） |
| model 标签与值分离 | `elements/model.ts` | `dim('Model: ') + tierColor(name)`（现整段 cyan） |
| prd 加前缀 | `elements/prd.ts` | 裸 `US-002` → `dim('PRD:') + cyan('US-002')` |
| promptTime 加标签 | `elements/prompt-time.ts` | `⏱13s` → `dim('prompt:') + '13s'`（或保留 ⏱ 但加前缀） |
| profile 去 bold | `src/hud/render.ts` L405 | `bold('profile:...')` → `dim('profile:') + ...` |

**验证**：审查报告 P1-09/P2-02/P2-01/P2-06 对应快照用例更新。

### 2.3 P0-3 符号冲突消除

| 符号 | 文件 | 改法 |
|------|------|------|
| call-counts ASCII 标签 | `elements/call-counts.ts` + `types.ts` DEFAULT_HUD_LABELS | `T:/A:/S:` → `Tl:/Ag:/Sk:`（或 `tool:/agent:/skill:`） |
| token `r`/`s` | `elements/token-usage.ts` | `r89` → `r:89`；`s12.3k` → `tot:12.3k` |
| agent 超时 `!` | `elements/agents.ts` `formatDuration` | `'!'` → `'⏱'`（safeMode 回退省略，用红色 duration 表达） |
| I/O/S 区域 vs agent S | 无需改（dim+冒号+区域分隔已消歧） | 文档图例注明 |

**验证**：grep 全 `src/hud/` 确认 `T:`/`A:`/`S:` 不再有第二含义；图例表随 `README` 或 `/oh-my-claudecode:hud` 文档发布。

### 2.4 P0-4 死配置清理

| 动作 | 文件 | 改法 |
|------|------|------|
| `showHealthIndicator` | `types.ts` L609 + `render.ts` L494 | **推荐二选一**：在 `renderSession` 真正渲染 `●/◐/○`（status 色，safeMode 回退 `ok/warn/crit`），或删除配置项并修正注释。建议保留配置但补齐渲染（用户已默认开启） |

### 2.5 P1-1 主行密度预算

| 预设 | 文件 | 改法 |
|------|------|------|
| focused | `types.ts` PRESET_CONFIGS.focused | 主行保持 ≤8：`callCounts`→detail/off、`promptTime`→off、`profile`→line1/off；`agentsFormat:'multiline'`（已默认） |
| 全部 | `types.ts` DEFAULT_ELEMENT_ORDER | 把 `callCounts`、`promptTime`、`profile` 从 main 组移到 detail/line1 组 |

**验证**：`ELEMENT_REGISTRY` 增加 `mainBudget` 元数据（可选），预设校验测试断言主行元素数 ≤ 预算。

### 2.6 P1-2 宽度计量升级

| 动作 | 文件 | 改法 |
|------|------|------|
| emoji 按 2 列计 | `utils/string-width.ts` `getCharWidth` | 增加 U+1F000–U+1FAFF、U+2600–U+27BF、U+2B00–U+2BFF → width 2 |
| ambiguous 保守 2 列 | 同上 | U+21A0–U+21FF（⇡⇣↑↓）、U+23F1（⏱）→ width 2（宁可少显示不溢出） |
| safeMode ASCII 表 | `sanitize.ts` + 各元素 | 🔧→Tl:、🤖→Ag:、⚡→Sk:、💭→thk、⏱→t:、⇡→^、⇣→v、⚠→!、█→#、░→-、╎→\| |

**验证**：`max-width.test.ts` 增加 emoji/ambiguous 边界用例（含 CJK 混合行）。

### 2.7 P1-3 窄终端保底

| 动作 | 文件 | 改法 |
|------|------|------|
| 折叠优先保 detail | `render.ts` `limitOutputLines` 调用处 | wrap 模式下：先给 detail 行分配额度，主行剩余额度；主行超宽时按元素优先级丢弃（context > 警告 > agents > model > callCounts） |
| wrap 按元素边界切分 | `render.ts` `wrapLineToMaxWidth` | 元素内部不再用 ` | ` 连接（agents descriptions 改 `,` 连接）；wrap 只按 L1/L2 分隔符切 |

**验证**：`max-width.test.ts` 窄屏用例断言 detail（todos/警告）始终保留。

### 2.8 P1-4 agent 编码降级

| 动作 | 文件 | 改法 |
|------|------|------|
| 默认不用 codes | `types.ts` PRESET_CONFIGS | `opencode` 预设 `agentsFormat` 由 `'codes'` → `'tasks'`（README 已标注最易读）；保留 `codes` 为高级可选 |
| 图例文档化 | README / hud.md | 发布符号词典表 |

### 2.9 P2-1 交互反馈补齐

| 动作 | 文件 | 改法 |
|------|------|------|
| 权限 waiting 兜底 | `render.ts` L475 + `index.ts` | 启发式保留；增加"模型静默 >N 秒 → `waiting…`"轻量兜底（可配置开关） |
| 后台失败徽标 | `elements/background.ts` + `state.ts` `getRunningTasks` | `getRunningTasks` 增加 failed 统计；渲染 `bg:3/5 !1`（红色） |

---

## 3. 落地路径（三阶段）

### 阶段 A：一致性修复（0.5-1 人周）
- P0-1 ~ P0-4 全部；P2-2 文案统一。
- 交付物：颜色/阈值/标签/符号四张令牌表落入代码 + 全量测试更新。
- **门禁**：`vitest run src/__tests__/hud` 全绿；审查报告 P1 项从 9 降到 4。

### 阶段 B：密度与宽度（1-1.5 人周）
- P1-1 ~ P1-4；P2-1。
- 交付物：5 预设重排 + string-width 升级 + 折叠策略重构 + 交互反馈补齐。
- **门禁**：新增 max-width 边界用例全绿；focused 主行 ≤8 项校验通过；窄屏 60 列下 detail 保留。

### 阶段 C：发布与文档（0.5 人周）
- 符号词典/图例进 README 与 `/oh-my-claudecode:hud` 文档；CHANGELOG 记录破坏性变更（预设默认值变化、标签变化）。
- 兼容性策略：所有默认值变化遵循"新版预设 + 老用户保留旧预设"原则（可用 `preset` 显式锁定），避免升级惊吓。

---

## 4. 风险与回滚

| 风险 | 缓解 |
|------|------|
| 预设默认值变更引起老用户不适 | 预设可显式锁定；CHANGELOG 突出标注；提供 `opencode-legacy` 等过渡预设（可选） |
| 颜色语义变更破坏终端主题对比度 | 只用 ANSI 语义色（不依赖背景）；浅色终端下档位色用 `versioned` 模型名保证可读 |
| wrap 策略重构引入回归 | render 管线保持纯函数，快照测试覆盖；新增窄屏快照夹具 |
| string-width 升级影响既有 CJK 用例 | 全量回归 `max-width.test.ts` + `string-width` 单元测试 |

---

## 5. 验收标准（与架构文档 §13 对齐）

1. 审查报告 5 维评分从 17/25 → ≥21/25（重审时）。
2. P0 全部关闭；P1 至少关闭 6/9；P2 关闭 ≥8/14。
3. `vitest run src/__tests__/hud` 全绿（基线 620 通过，2 例 Windows 性能断言除外）。
4. 优化后原型（第四部分）与代码实现一致（原型作为视觉验收基准）。


---

# 第四部分 · 优化原型可视化

> 本部分由原型构建师（筑原型）产出：5 预设 × 深浅色 × 宽窄屏的终端仿真原型。
> 交付文件：（独立 HTML，732 行，双击即可打开，无需构建；JS 已通过语法校验）。
> 覆盖 5 预设（minimal/focused/full/opencode/dense）× 2 主题 × 2 宽度（120/60 列）× 2 safeMode，含 ctx 67/82/92 三档阈值变色、--watch 刷新模拟、I/O/S 区域分隔（L1 | vs L2 ╎）、窄屏丢弃低价值元素保 detail。

## 原型覆盖场景

| 维度 | 取值 | 说明 |
|------|------|------|
| 预设 | minimal / focused / full / opencode / dense | 严格按设计令牌 §3.2 元素组合表与密度预算渲染 |
| 主题 | 深色 / 浅色 | 一键切换；色值按 §3.1 ANSI→CSS 映射 |
| 宽度 | 120 列 / 60 列 | 窄屏演示 wrap 只按 L1/L2 分隔符切分 |
| safeMode | 开 / 关 | ASCII 替换表（🔧→Tl:、⏱→t:、⇡→^、█→#、╎→\|） |
| 交互 | 预设切换 / 临界状态切换 / 阈值变色 | context 67%→92% 演示绿→红；todos 进度色 |

## 原型演示的关键优化点（与第三部分一一对应）

1. **色相不相交**：model 档位色（Opus=亮蓝、Sonnet=蓝、Haiku=青）与 ctx/limits 状态色（绿/黄/红）同屏对比（P0-1）。
2. **标签语法统一**： 全局一致（P0-2）。
3. **符号词典落地**：、、、（P0-3）。
4. **区域分隔层级**：focused 预设  区域分隔符 vs 元素分隔符（P1-10）。
5. **密度预算**：各预设主行元素数符合 §2.8 预算（focused ≤8）（P1-1）。
6. **动作词统一**：（P2-2）。
