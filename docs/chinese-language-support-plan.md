# Chinese Language Support Plan

## 目标

为 oh-my-claudecode 提供与日语、韩语对齐的中文关键字路由能力,确保中文用户使用 `优化`、`深度优化` 等 bare 意图词时能够正确触发 `ultrathink` 模式,同时避免对路径、代码块、引用内容产生误匹配。

## 背景

历史上 `KEYWORD_PATTERNS.ultrathink` 仅包含英文 `ultrathink`、韩文 `울트라씽크`、日文 `ウルトラシンク`,导致中文用户输入 `优化这个函数`、`请深度优化这段代码` 时无法触发 ultrathink,与日语行为不对等。

CJK 路径剥离与 `NON_LATIN_SCRIPT_PATTERN` 早已覆盖中文范围(`\u3000-\u9FFF`),路由基础设施完备,只差关键字模式补齐。

## 实施范围

### 1. ultrathink 中文别名

在 `src/hooks/keyword-detector/index.ts` 的 `KEYWORD_PATTERNS.ultrathink` 中追加 `(深度?优化)` 别名,匹配 `优化` 与 `深度优化`。

### 2. 边界策略

- **不使用 `\b`**:JavaScript 的 `\b` 基于 `\w`(`[A-Za-z0-9_]`),CJK 字符属于 `\W`,在 CJK 字符前后 `\b` 行为不可靠。
- **依赖路径剥离**:`sanitizeForKeywordDetection` 中的 `FILE_PATH_PATTERN`(基于 `PATH_SEGMENT_CHARS`)已覆盖 CJK 范围,路径段中的 `优化` 会被剥离(如 `src/优化/重写.tsx`、`/docs/优化笔记.md`)。
- **依赖代码块剥离**:`removeCodeBlocks` 已剥离 fenced 与 inline 代码块,代码中的 `优化` 不会泄漏到检测层。

### 3. 连词上下文

中文连词 `并且`、`和` 在 `优化并且简化`、`优化和改进` 等表达中只作为文字上下文,不参与模式匹配。只要 `优化` 别名触发即可,无需为连词单独实现路由逻辑。

`我并且你` 这类不含 `优化` 的文本不会触发,满足收紧要求(对应提交 `a3e2e9f0`)。

## 不变量

- 已有英语/韩语/日语匹配行为不变
- 路径剥离行为不变(`PATH_SEGMENT_CHARS` 不变)
- `NON_LATIN_SCRIPT_PATTERN` 不变
- 代码块剥离行为不变

## 验证

- `src/hooks/keyword-detector/__tests__/i18n-routing.test.ts` 全部 13 个测试通过
- `src/hooks/keyword-detector/__tests__/index.test.ts` 全部已有测试不回归

## 关联提交

- `ea2ae4f3` fix(i18n): cover bare 优化 intent & add regression tests for signal tightening
- `a3e2e9f0` fix(i18n): tighten Chinese conjunction regex to reduce over-match
- `4d5c1cda` fix(i18n): cover CJK file paths & Chinese conjunctions for routing parity
- `f7ce24bf` docs(i18n): add trailing newline to chinese-language-support-plan.md
- `07050bb9` chore(docs): remove .trae/ residual after plan migration to docs/
