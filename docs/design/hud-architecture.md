# OMC HUD 模块架构设计文档（第一性原理）

> 文档版本：v1.0（2026-08-15）
> 适用范围：`src/hud/` 模块（47 文件 / 约 10.8k 行 TS，含 28 个 UI 元素组件与 42+ 测试文件）
> 文档性质：架构设计 + 技术设计文档（工程落地级）
> 配套文档：
> - 需求摘要（五要素 + 非功能约束 + 设计红线）：由需求发现分析师（许明需）产出，见 `.workbuddy/artifacts/hud-design/01-requirements.md`
> - 现有 UI 审查报告（5 维评分 + 问题清单）：由质量审查官（严过审）产出，见 `docs/design/hud-ui-review.md` 第一部分
> - UI 优化方案（设计令牌 + 落地路径 + 优先级）：见 `docs/design/hud-ui-review.md` 第二、三部分

---

## 第一部分：第一性原理架构设计

### 1. 核心本质与根本需求拆解

#### 1.1 HUD 的本质是什么

回到第一性原理：HUD（Heads-Up Display）这个概念源自航空——**飞行员在保持视线不离开外部世界的前提下，获取关键飞行参数的叠加显示**。它的全部价值浓缩为四个字：**一瞥式感知（glanceable awareness）**。

OMC HUD 的使命因此不是"展示尽可能多的信息"，而是：

> **在用户与 Claude Code 交互的每时每刻，以最低认知成本、最低视觉干扰，让用户始终知道"此刻系统在干什么、我还能做什么、我该不该介入"。**

#### 1.2 从本质推导根本需求

把"一瞥式感知"继续向下拆解，得到六条不可妥协的根本需求（每个都对应一组具体约束）：

| # | 根本需求 | 推导来源 | 若违反的后果 |
|---|---------|---------|-------------|
| R1 | **真实性（Truthfulness）** | "感知"的前提是感知的内容为真。展示"正在运行的 agent"必须是真实运行的 agent；展示的 context% 必须贴近真实窗口 | 用户基于错误信息做介入决策 → 系统性误判 |
| R2 | **及时性（Timeliness）** | 一瞥感知要求状态与真相的时延在人的注意尺度内（<1s 量级） | 看到的是 30s 前的状态 → 一瞥失去意义 |
| R3 | **可读性（Legibility）** | 一瞥 = 秒级解码。所有符号必须可自解释或已学习（低学习成本） | 需逐字符解码 → 认知负担反而高于不显示 |
| R4 | **低干扰性（Non-intrusiveness）** | 状态栏是叠加层，不是主界面。任何时刻都不能遮挡/破坏用户正在进行的输入 | 输入框被挤压、终端被刷屏 → 用户禁用 HUD |
| R5 | **可配置性（Configurability）** | 不同用户（新手/重度）、不同终端（宽/窄、彩色/灰阶）对"密度"的需求天然不同 | 一刀切 → 一半用户觉得吵，一半觉得不够 |
| R6 | **健壮性（Robustness）** | 状态栏是"附加价值"，绝不能成为"故障源"。任何数据源失败都必须优雅降级 | HUD 崩溃阻塞 Claude Code → 负价值 |

#### 1.3 基本约束条件（环境的"物理定律"）

这些约束不是可选项，而是 Claude Code 状态栏机制强加的：

- **C1 进程模型**：statusline 每次渲染由 Claude Code 以独立子进程拉起（`omc-hud.mjs`），或由 `--watch` 模式以独立进程每 ~1s 轮询。→ 进程冷启动成本必须可接受；进程间只能通过**文件系统 + stdin/stdout** 通信。
- **C2 输入边界**：stdin JSON 快照字段受限（cwd、transcript_path、model、context_window、rate_limits），且**不是所有字段每次都有值**（如 `used_percentage` 会间歇性缺失）。
- **C3 输出边界**：只能输出 stdout 文本 + ANSI 转义序列，**无图形 API、无鼠标事件**；`console.log` 的每一行都落在终端输入区上方。
- **C4 时序预算**：单次渲染生命周期 ≤1s（目标 <300ms）；watch 轮询间隔 1s，不得堆积。
- **C5 资源边界**：子进程内存有限；不得泄漏子进程（spawn 后必须 unref）；不得阻塞主进程事件循环。
- **C6 兼容性**：ANSI 子集（避免 256 色/真彩依赖）、CJK 双宽字符、emoji 降级（Windows/WSL）、深浅色终端主题下均可读。

> 设计结论：这六条需求（R1-R6）与六条约束（C1-C6）构成 HUD 的全部设计公理。**架构的每一项决策都必须能追溯到某条公理。**
>
> **补充：八条设计红线**（由需求发现分析师提炼，任何方案不得违反）：
> ① 绝不阻塞主流程；② 渲染生命周期 ≤1s；③ 控制序列白名单（仅 SGR）；④ 任何外部输入都可缺失（只降级不崩溃）；⑤ 配置永远有默认值；⑥ 渲染与数据解耦；⑦ 与终端主题兼容（深浅色均可读）；⑧ 克制不喧宾夺主。

---

### 2. 整体架构：四层 + 单向数据流

基于公理推导，HUD 采用**数据层 / 逻辑层 / 渲染层 / 交互层**四层架构，强制**单向数据流**：

```
┌────────────────────────────────────────────────────────────────────┐
│                    交互层 Interaction（进程边界）                     │
│   stdin 快照读取 · watch 轮询循环 · 输出回写 · 诊断输出 · 触发文件     │
└───────────────▲──────────────────────────────┬─────────────────────┘
                │ 原始输入(StatuslineStdin)     │ 多行 ANSI 字符串
┌───────────────┴──────────────────────────────▼─────────────────────┐
│                    逻辑层 Domain（编排与装配）                       │
│   index.ts 主流程 · 会话身份解析 · 配置合并(preset→defaults→覆盖)    │
│   · 会话健康度计算 · token 统计 · 阈值判定 · 子进程节流              │
└───────▲──────────────────────────────┬─────────────────────────────┘
        │ 规范化数据(TranscriptData等)  │ HudRenderContext（唯一渲染契约）
┌───────┴──────────────────────────────▼─────────────────────────────┐
│                    数据层 Data Access（外部世界适配器）              │
│   stdin.ts   transcript.ts   omc-state.ts   state.ts               │
│   usage-api.ts   mission-board.ts   payload-estimate.ts            │
└───────▲────────────────────────────────────────────────────────────┘
        │ 文件系统 / OAuth API / Keychain / 环境变量
┌───────┴────────────────────────────────────────────────────────────┐
│                    渲染层 Presentation（纯函数 UI）                 │
│   render.ts 管线 · elements/* 28 元素 · colors.ts 设计令牌          │
│   sanitize.ts 净化 · 宽度/行数治理                                   │
└────────────────────────────────────────────────────────────────────┘
```

#### 2.1 各层职责边界与接口规范

| 层 | 核心文件 | 职责（只做这些） | 严禁（边界） |
|----|---------|----------------|-------------|
| **数据层** | `stdin.ts` `transcript.ts` `omc-state.ts` `state.ts` `usage-api.ts` `mission-board.ts` `payload-estimate.ts` | 从 stdin/文件/API 读取并**规范化**为领域类型；维护各自缓存与降级策略 | 不产生任何视觉输出；不触碰渲染 |
| **逻辑层** | `index.ts` `types.ts`（配置模型） | 编排数据层调用；解析会话身份；合并配置（默认→预设→用户覆盖）；计算派生指标（健康度、token 汇总、上下文稳定化）；调度后台子进程 | 不直接拼 ANSI；不直接读文件（通过数据层） |
| **渲染层** | `render.ts` `elements/*` `colors.ts` `sanitize.ts` | 将 `HudRenderContext` 纯函数式转换为多行 ANSI 字符串；布局/宽度/行数治理；safeMode 净化 | 不发起 IO；不访问状态文件；不读取 stdin |
| **交互层** | `stdin.ts`(读) `index.ts`(输出) `hud-watch.ts` | 进程生命周期；stdin 读取与缓存回退；stdout 输出（含 NBSP 替换）；watch 轮询循环；诊断模式；`compact-requested.json` 等不可见副作用 | 不做业务判断；不产生中间视觉 |

#### 2.2 通信机制（三个关键约定）

1. **进程内通信 = 纯函数调用 + 单一数据流**。渲染层只依赖 `HudRenderContext`（一个不可变快照对象），逻辑层负责把一切数据源装配进它。这条约定使渲染层成为**100% 可测试的纯函数**（对应 R3/R6、C4）。
2. **进程间通信 = stdin JSON 入 + stdout 文本出 + 文件系统副作用**。HUD 与 Claude Code 之间只有这三种信道；`hud-stdin-cache.json`、`hud-state.json`、`compact-requested.json` 是全部跨进程状态的载体（对应 C1）。
3. **跨会话隔离 = session-scoped 路径**。`state/sessions/{sessionId}/` 下的状态文件是唯一权威来源；会话身份优先从 transcript 路径提取 UUID，回退 `CLAUDE_SESSION_ID` 环境变量（对应 R1，杜绝跨会话污染——Issue #3487）。

**交互层补充（watch 模式）**：`--watch` 模式下 stdin 恒为 TTY，`readStdin()` 返回 null，交互层回退读取磁盘缓存 `hud-stdin-cache.json`（会话作用域优先，无会话时按 mtime 取最近活跃会话缓存）。watch 循环（`hud-watch.ts`）使用 `setTimeout().unref()` 实现 1s 轮询且不阻塞进程退出，第二次迭代起 `skipInit=true` 跳过状态清理。这保证了 detached/tmux 场景下 watch 面板不卡在空视图。

#### 2.3 关键数据结构与流转路径

**核心快照类型**（定义于 `types.ts`，全部为只读接口）：

```
StatuslineStdin ──(stdin.ts 解析/稳定化)──► HudRenderContext
transcript.jsonl ──(transcript.ts tail解析)─► TranscriptData ─┐
ralph/ultrawork/prd/autopilot 状态文件 ──(omc-state.ts)───►  │
hud-state.json ──(state.ts)──────────────────────────────►   ├─► HudRenderContext
OAuth usage API ──(usage-api.ts 缓存+backoff)─────────────►   │   （渲染层唯一输入）
mission-board ──(mission-board.ts)────────────────────────►   │
settings.json omcHud ──(state.ts 合并)──► HudConfig ────────────┘   │
                                                                    ▼
                                                         render(context, config)
                                                                    ▼
                                                   多行 ANSI 字符串 → stdout
```

**三个关键不变量**：

- **I1 渲染无副作用**：`render(context, config)` 是纯函数——同样的输入永远产生同样的输出（除时间相关元素外）。这是快照测试的基础。
- **I2 配置先于解析**：`readHudConfig()` 在 transcript 解析之前完成，使 `staleTaskThresholdMinutes` 等解析参数可配置（`index.ts` L284 注释明确此顺序）。
- **I3 降级永不失败**：每个数据源读取都被 try/catch 包裹，失败返回 `null`/空数组而非抛错；渲染层对每个元素做"渲染结果为 falsy 则不显示"的处理，天然实现内容级降级（对应 R6）。

---

### 3. 模块划分（技术文档视角）

#### 3.1 核心模块（`src/hud/` 根目录，14 文件）

| 模块 | 文件 | 职责 | 关键导出 |
|------|------|------|---------|
| 主流程编排 | `index.ts` | 入口、stdin→render 全链路、会话身份、宽度自适应、健康度、更新检查、子进程节流 | `main()` |
| 类型与配置模型 | `types.ts` | 全部领域类型、`HudConfig`、5 预设、标签系统、元素/区域注册元数据 | `HudRenderContext`、`DEFAULT_HUD_CONFIG`、`PRESET_CONFIGS` |
| 渲染管线 | `render.ts` | 元素调度、布局组装（line1/main/detail）、I/O/S 分组、宽度/行数治理 | `render()`、`ELEMENT_REGISTRY` |
| 状态管理 | `state.ts` | HUD 状态文件读写（文件锁 RMW）、配置读写合并、初始化清理 | `readHudState/writeHudState/readHudConfig` |
| transcript 解析 | `transcript.ts` | JSONL 解析、tail 窗口（4MB）、agent/todo/权限/思考/token 提取、缓存 | `parseTranscript()` |
| stdin 解析 | `stdin.ts` | 快照读取、缓存、上下文百分比多级回退与稳定化、速率限制提取 | `readStdin()`、`getContextPercent()` |
| OMC 状态读取 | `omc-state.ts` | ralph/ultrawork/prd/autopilot 状态文件只读适配、2h 过期判定 | `readRalphStateForHud()` 等 |
| 用量 API | `usage-api.ts` | OAuth 用量获取、凭证读取、缓存、429 backoff、token 刷新、SSRF 防护 | `getUsage()` |
| 颜色令牌 | `colors.ts` | ANSI 颜色函数、阈值色、模型分级色、进度条 | `green()/yellow()/...`、`coloredBar()` |
| 净化 | `sanitize.ts` | safeMode：剥离 ANSI、ASCII 化 | `sanitizeOutput()` |
| 任务板 | `mission-board.ts` | 任务板状态收集与渲染（opt-in）；数据源为 session/team 任务状态，含 timeline 事件（handoff/completion/failure/update）、agent 状态、任务计数 | `refreshMissionBoardState()`、`renderMissionBoard()` |
| payload 估算 | `payload-estimate.ts` | 基于 transcript 文件大小的请求体压力估算（22MB 警告 / 26MB 临界 / 32MB 上限）；非精确值，label 含 "est" 标识 | `estimatePayloadFromTranscriptPath()` |
| 自定义费率 | `custom-rate-provider.ts` | 外部命令式速率限制提供者、缓存降级 | `executeCustomProvider()` |
| 后台任务 | `background-tasks.ts` / `background-cleanup.ts` | 后台任务登记、过期/孤儿清理（动态 import 破循环） | `markOrphanedTasksAsStale()` 等 |

#### 3.2 UI 元素模块（`src/hud/elements/`，28 文件）

全部为**纯函数渲染器**，统一签名模式 `renderXxx(context片段, 配置, labels): string | null`：

```
line1组: hostname cwd gitRepo gitBranch gitStatus apiKeySource profile multi-repo
main组:  omcLabel model enterpriseCost rateLimits customBuckets permission thinking
         promptTime session tokens ralph autopilot prd skills lastSkill contextBar
         agents background callCounts lastTool sessionSummary
detail组: missionBoard contextWarning payloadWarning todos
```

每个元素遵守"**无可显示内容则返回 null**"约定，渲染管线据此自动跳过（实现 I3）。

#### 3.3 配置模型

```
优先级（从低到高）：DEFAULT_HUD_CONFIG → preset 覆盖 → 用户 elements 覆盖 → layout 顺序覆盖
来源：~/.claude/settings.json 的 omcHud key（权威）→ .omc/hud-config.json（legacy 兼容）
```

配置通过 `HudElementConfig`（约 40 个布尔/枚举开关）+ `LayoutConfig`（line1/main/detail 顺序）+ `HudThresholds`（颜色阈值）+ 5 预设实现"密度可调"（R5）。

---

### 4. 接口定义

#### 4.1 元素渲染器统一契约

```ts
// 所有元素遵循：
type ElementRenderer<T> = (data: T, options?: X, labels?: HudLabels) => string | null;
// 约定：返回 null 表示"无内容，跳过"；返回字符串为最终 ANSI 片段（不含分隔符）。
```

#### 4.2 stdin 契约（Claude Code → HUD）

```jsonc
{
  "transcript_path": "~/.claude/projects/xxx/2026-08-15/abc.jsonl",
  "cwd": "/path/to/worktree",
  "model": { "id": "claude-opus-4-8", "display_name": "Opus 4.8" },
  "context_window": { "context_window_size": 200000, "used_percentage": 67, "current_usage": {...} },
  "rate_limits": { "five_hour": { "used_percentage": 45 }, "seven_day": {...} }
}
```

#### 4.3 渲染契约（HUD → Claude Code）

多行字符串，每行以 `\n` 分隔；非 safeMode 下空格替换为 NBSP（`\u00A0`）以保持对齐；ANSI 序列仅用 SGR 子集。

#### 4.4 状态文件 Schema

```jsonc
// .omc/state/sessions/{sessionId}/hud-state.json（会话作用域）
{ "timestamp": "ISO8601", "backgroundTasks": [...], "sessionStartTimestamp": "ISO8601", "sessionId": "..." }
```

#### 4.5 输出约定

- 主行元素以 dim(` | `) 分隔；I/O/S 分组时区域标签 `I: / O: / S:` 为 dim 前缀。
- 错误指示统一风格：`[API err]` / `[API auth]` / `[API 429]` / `[cmd:err]`（黄色 dim）。
- 陈旧数据标记：`*`（dim）+ 重置时间前缀 `~`。

---

### 5. 错误处理策略（分层降级）

```
┌─ 层 1 内容级：数据源失败 → 元素返回 null → 该片段不显示（如 API key 用户的 rateLimits 消失）
├─ 层 2 指示级：失败但需告知 → 渲染错误徽标（[API err]）或 API-key 提示（[usage: set omcHud.rateLimitsProvider]）
├─ 层 3 数据级：缓存降级 → 返回 last-known-good 数据 + stale 标记（* / ~）
├─ 层 4 进程级：整体异常 → stdout 输出 "[OMC] HUD error - check stderr"，细节写 stderr
└─ 层 5 安装级：ENOENT/MODULE_NOT_FOUND → 输出 "[OMC] run /omc-setup to install properly"
```

补充细则：
- usage API 失败缓存：瞬时网络失败 15s TTL、429 backoff 最长 5min、陈旧数据 15min 后丢弃。
- 文件锁争用：RMW 写状态时锁等待 ≤200ms，超时降级为无锁写入（不阻塞渲染）。
- 子进程泄漏防护：session-summary 派生进程跟踪 PID（`process.kill(pid,0)` 存活检查）+ 120s 节流窗口，双保险。

**宽度治理管线（render.ts，渲染层最后一公里）**：

```
元素片段收集（inline/detail 两 Map）
  → 布局组装（line1/main/detail 三组 + I/O/S 区域分组）
  → applyMaxWidthByMode（truncate：ANSI 感知截断+省略号 / wrap：按 " | " 边界换行）
  → limitOutputLines（maxOutputLines 折叠，保留首行 + "... (+N lines)"）
  → 二次 truncate 兜底（确保折叠指示行也遵守 maxWidth）
  → sanitizeOutput（safeMode：剥非 SGR 控制序列）→ stdout（空格→NBSP 对齐）
```

关键实现点：`truncateLineToMaxWidth` 按**显示宽度**（`stringWidth`/`getCharWidth`，CJK 双宽、代理对 emoji 正确计数）逐码点截断，并保留 ANSI 转义序列透传、截断前补 `\x1b[0m` 防颜色泄漏（对应 C2/C6/COMP-2）。

---

### 6. 性能考量

#### 6.1 性能预算

| 环节 | 预算 | 实际手段 |
|------|------|---------|
| 单次渲染总时延 | <1s（目标 <300ms） | 全链路同步 IO 最小化；API 调用带 10s 超时且失败走缓存 |
| watch 轮询 | 1s 间隔 | `setTimeout().unref()`；`skipInit` 二次轮询跳过初始化 |
| transcript 解析 | 大文件不线性增长 | tail 窗口 4MB + agent map 上限 100 + 20 条 LRU 缓存 + 早停 |
| 网络请求 | 不阻塞渲染 | usage API 缓存（成功 90s TTL / 失败 15s）+ 429 backoff |
| 事件循环 | 不阻塞 | update 缓存文件用异步 `fs.promises` 读取（Issue #1273） |

#### 6.2 已识别的性能风险

- **R1**：`transcript.ts` 缓存 key 基于 `stat.size:mtimeMs`，4MB 窗口下大 session 的 `sessionTotalTokens` 是部分数据（有意的降级语义，需文档明示）。
- **R2**：Windows 下 git 状态探测（`renderGitStatus`）同步执行外部命令，实测可达 6.4s（`circular-dep.test.ts` 超时记录）；需要后台化或缓存。
- **R3**：`render.ts` 每轮对所有启用元素做独立函数调用，元素数量增加时线性成本可控，但**每个元素内可能做文件系统探测**（如 `renderGitRepo`），应改为"数据层预取一次、渲染层只消费"。

---

### 7. 可扩展性 / 可维护性 / 可测试性

#### 7.1 扩展性设计

- **新增元素三件套**：`elements/xxx.ts`（纯渲染函数）→ `render.ts` 分支 + `ELEMENT_REGISTRY` 元数据 → `HudElementConfig` 开关 + 预设默认值 + `DEFAULT_ELEMENT_ORDER` 顺序。低成本、可发现。
- **布局即配置**：`LayoutConfig` 允许元素在 line1/main/detail 间迁移，无需改代码。
- **区域分组**：`DEFAULT_REGION_MAP` 声明元素→I/O/S 归属，未来新增元素只需一行映射。

#### 7.2 可维护性设计

- 单向数据流 + 渲染纯函数 → 心智模型简单。
- 集中类型定义（`types.ts`）→ 跨层契约单一来源。
- 循环依赖治理：`state.ts ↔ background-cleanup.ts` 通过动态 import 打破（有注释说明）。
- 错误路径全部带 `OMC_DEBUG` 门控日志。

#### 7.3 可测试性设计

- 渲染层 100% 纯函数 → 可直接断言输出字符串（现有 `render.test.ts`、`max-width.test.ts` 等 42 个测试文件、620 用例）。
- 测试注入点：`_resetSummarySpawnTimestamp()`、`_getSummaryProcessPid()` 等 `@internal` 导出。
- 状态读写可注入目录参数；文件锁可测试（`state-locking.test.ts`）。

---

### 8. 演进路线

| 阶段 | 内容 | 对应公理 |
|------|------|---------|
| **近期（P0）** | ① git 状态探测异步化/缓存（修复 R2 性能风险）② 元素渲染数据预取重构（R3）③ safeMode 语义文档化 | R6、R2 |
| **中期（P1）** | ① 渲染管线改为元素注册表驱动（消灭 render.ts 巨型 if/else，改为 `ELEMENT_REGISTRY` 迭代）② 新增元素声明式注册 API ③ sessionSummary 本地小模型化（去掉 `claude -p` 子进程） | R5、C1 |
| **远期（P2）** | ① 状态订阅模型（文件监听替代轮询，watch 模式事件驱动）② 可选 256 色渐进增强（需终端检测）③ 交互反馈增强（OSC 8 超链接已有基础，可扩展可点击交互）④ 多进程状态总线（替代文件锁） | C4、C6、R4 |

---

## 第二部分：技术设计文档（工程落地版）

> 本部分为可直接进入开发排期的技术规格。正文见第一部分的各节索引：背景（§1）、目标（§2 公理）、架构说明（§2 分层图）、模块划分（§3）、接口定义（§4）、错误处理（§5）、性能考量（§6）。

### 9. 背景

oh-my-claudecode（OMC）作为 Claude Code 的多智能体编排层，运行着 ralph 循环、autopilot 流水线、并行子代理等大量"不可见"的后台活动。缺乏实时状态感知时，用户无法判断"系统是否卡死、是否在烧 token、是否该介入"。HUD 模块通过 Claude Code 状态栏机制提供持续的一瞥式感知，是 OMC 用户体验的地基组件。

### 10. 目标

1. **正确**：展示的状态真实、可追溯（R1）。
2. **及时**：单次渲染 <300ms 目标，watch 1s 刷新（R2）。
3. **可读**：默认预设零学习成本；符号体系一致（R3）。
4. **克制**：绝不干扰输入区；输出行数可配置上限（R4）。
5. **灵活**：5 预设 + 细粒度开关 + 布局自定义（R5）。
6. **健壮**：任何数据源失败，HUD 自身不崩溃、不阻塞（R6）。

### 11. 接口定义索引

- 元素渲染器契约：§4.1
- stdin/输出契约：§4.2-4.3
- 状态文件 Schema：§4.4
- 配置 Schema：`types.ts` `HudConfig`（约 100 项，含 5 预设）；用户可见配置文档：`docs/REFERENCE.md` HUD 章节

### 12. 落地检查清单（新功能合入门槛）

- [ ] 新增/修改元素：纯函数、无 IO、返回 null 表示跳过
- [ ] 配置项：在 `HudElementConfig` 声明 + 默认值 + 至少一个预设可见
- [ ] 布局：元素加入 `ELEMENT_REGISTRY` 与 `DEFAULT_ELEMENT_ORDER`
- [ ] 错误路径：有 `OMC_DEBUG` 日志或静默降级，不抛错到进程级
- [ ] 测试：渲染快照 + 降级路径用例（`src/__tests__/hud/`）
- [ ] 文档：`docs/REFERENCE.md` 元素表同步

### 13. 验收标准（Definition of Done）

1. `vitest run src/__tests__/hud` 全绿（当前基线 620 通过，2 例 Windows 性能断言超时属环境问题，见 `.workbuddy/memory/2026-08-15.md`）。
2. 单次渲染（冷启动 + stdin + 解析 + 渲染）在 CI 与本地均 <1s。
3. 任意数据源（transcript 缺失/损坏、API 不可达、状态文件损坏、配置非法）下，HUD 输出仍为合法多行状态栏或友好降级提示。
4. 新元素从新建文件到上线无需改动渲染主循环（注册表驱动，P1 目标）。

---

*文档由设计原型专家团（DesignEngineTeam）编排产出：画统筹（Hua）执笔架构与技术文档；许明需（需求发现）、严过审（质量审查）、彩格调（设计系统）、筑原型（原型构建）提供设计侧输入。*
