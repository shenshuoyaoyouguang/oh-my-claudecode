# 中文语言支持增强实施方案 — 最终状态与验证计划

## 执行状态总览

| 阶段 | 内容 | 状态 |
|------|------|------|
| 阶段 1：类型层 | `types.ts` — COMPLEXITY_KEYWORDS 中文扩展（4类关键词） | ✅ 已完成 |
| 阶段 1：配置层 | `loader.ts` — escalationKeywords / simplificationKeywords 中文扩展 | ✅ 已完成 |
| 阶段 2：信号提取层 | `signals.ts` — 8个信号提取函数中文增强 | ✅ 已完成 |
| 阶段 3：关键词检测层 | `keyword-detector/index.ts` — KEYWORD_PATTERNS（15类）+ 参考/解释/追问中文模式 | ✅ 已完成 |
| 阶段 3：关键词检测层 | `keyword-detector/index.ts` — 3个辅助意图检测器中文补全 | ✅ 已完成 |
| 阶段 4：测试 | 4个测试文件创建/扩展 + 诊断/激活/元问题测试用例 | ✅ 已完成 |
| 阶段 5：验证 | 运行全量测试并验证 | ✅ 已完成 |

---

## 已完成架构总览

### 修改的核心文件（5个）

| 文件 | 修改内容 | 行号参考 |
|------|---------|---------|
| `src/features/model-routing/types.ts` | COMPLEXITY_KEYWORDS 四类关键词（architecture/debugging/simple/risk）追加中文；DEFAULT_ROUTING_CONFIG 中 escalationKeywords/simplificationKeywords 追加中文 | L237-271 |
| `src/config/loader.ts` | `buildDefaultConfig()` 中 routing.escalationKeywords / routing.simplificationKeywords 追加中文 | L123-149 |
| `src/features/model-routing/signals.ts` | 8个信号函数追加中文模式：detectQuestionDepth (L125-158), detectImplicitRequirements (L164-181), detectCrossFileDependencies (L209-233), detectTestRequirements (L238-259), detectDomain (L264-309), detectExternalKnowledge (L314-330), assessReversibility (L335-364), assessImpactScope (L369-403) | 见各函数 |
| `src/hooks/keyword-detector/index.ts` | KEYWORD_PATTERNS 全部15个类型追加中文；INFORMATIONAL_INTENT_PATTERNS (L387-392)、REFERENCE_META_PATTERNS (L396-405)、REFERENCE_EXPLANATION_PATTERNS (L406-415)、QUESTION_FOLLOWUP_PATTERNS (L416-423) 追加中文；hasActivationIntentNearKeyword (L478-506)、hasDiagnosticIntentNearKeyword (L545-561)、isRalphUltraworkMetaOrBanterContext (L563-602) 追加中文 | 见各函数 |

### 新增/扩展的测试文件（4个）

| 文件 | 内容 |
|------|------|
| `src/features/model-routing/__tests__/chinese-signals.test.ts` | 新建：中文信号提取测试（词法信号 + 结构信号） |
| `src/__tests__/model-routing-chinese.test.ts` | 新建：中文端到端路由测试（10个场景） |
| `src/__tests__/model-routing.test.ts` | 扩展：中文信号提取 + 中文集成场景测试 |
| `src/hooks/keyword-detector/__tests__/index.test.ts` | 扩展：中文关键词检测 + 中文信息性意图过滤 + 中文诊断意图检测 + 中文激活意图检测 + 中文元问题/闲聊过滤 |

---

## 阶段 5：验证

### 5.1 验证步骤

按顺序执行以下命令（全部在项目根目录 `d:\xiaoxiao\oh-my-claudecode` 下运行）：

```bash
# 1. 运行中文信号提取测试
npx vitest run src/features/model-routing/__tests__/chinese-signals.test.ts

# 2. 运行中文端到端路由测试
npx vitest run src/__tests__/model-routing-chinese.test.ts

# 3. 运行关键词检测测试（含全部中文测试）
npx vitest run src/hooks/keyword-detector/__tests__/index.test.ts

# 4. 运行模型路由全量测试（含中文扩展）
npx vitest run src/__tests__/model-routing.test.ts

# 5. 运行全量回归测试
npm test -- --run
```

### 5.2 验证检查项

| 检查项 | 通过标准 |
|--------|---------|
| 所有现有英文测试通过 | 0 失败，无回归 |
| 所有新增中文信号提取测试通过 | 0 失败 |
| 所有新增中文端到端路由测试通过 | 0 失败 |
| 中文诊断意图过滤正确 | 诊断报告（如"自动驾驶一直循环运行"）不触发执行模式 |
| 中文激活意图检测正确 | 明确激活命令（如"请用拉尔夫处理"）能触发 |
| 中文元问题/闲聊过滤正确 | 比较类/闲聊类（如"拉尔夫和自动驾驶有什么区别？"）不触发 |
| 中英文混合输入正确路由 | tier 决策正确，如"Refactor the auth module，需要处理所有security相关的vulnerability" → HIGH |
| 中文信息性意图过滤准确 | "什么是自动驾驶模式？" → 不触发 autopilot 执行模式 |

### 5.3 关键测试场景覆盖

#### 信号提取层（chinese-signals.test.ts + model-routing.test.ts）
- 中文架构关键词检测（"重构架构设计"）
- 中文调试关键词检测（"调试根因问题"）
- 中文简单搜索关键词检测（"帮我找一下配置"）
- 中文风险关键词检测（"生产环境紧急部署"）
- 中文问题深度检测（为什么/怎么/什么是/在哪里）
- 中文隐式需求检测（"优化一下"、"修一下"）
- 中文跨文件依赖检测（"修改多个文件"）
- 中文测试需求检测（"确保测试通过"）
- 中文领域检测（前端/后端/安全/运维）
- 中文影响范围评估（"整个项目"、"全局"）

#### 端到端路由层（model-routing-chinese.test.ts）
- 中文简单搜索 → LOW tier
- 中文架构任务 → HIGH tier
- 中文调试任务 → HIGH tier
- 中文通用任务 → MEDIUM tier
- 中英文混合 → 正确路由
- 高置信度中文复杂任务

#### 关键词检测层（keyword-detector index.test.ts）
- 15个关键词类型的中文触发词检测
- 中文信息性意图过滤（"什么是X？"不触发执行）
- 中文诊断意图过滤（"X一直循环"不触发执行）
- 中文激活意图检测（"请用X"触发执行）
- 中文元问题/闲聊过滤（"X和Y有什么区别？"不触发）

---

## 附录 A：关键架构决策

1. **追加而非替换**：所有中文关键词/模式作为追加项，不删除任何现有匹配逻辑
2. **与现有韩文/日文支持一致**：遵循相同的架构模式和代码结构
3. **无破坏性变更**：纯英文输入的现有路由行为完全不变
4. **不使用 NLP/ML**：基于规则的关键词+正则匹配，保持零依赖和极低延迟
5. **不建立独立 i18n 文件**：中文关键词直接内联到对应功能模块
6. **hasDiagnosticIntentNearKeyword 中文模式**：结构与韩文 `자꾸/계속` 行和日文 `また/何度も` 行对等
7. **isRalphUltraworkMetaOrBanterContext 中文模式**：命令式动词检查（请用/启动/开启）优先于元问题模式，避免误判

## 附录 B：代码中已实现的中文关键词/模式清单

### COMPLEXITY_KEYWORDS（types.ts）
- **architecture**: 架构、重构、重新设计、重组、重新组织、解耦、模块化、抽象、模式、设计模式、设计
- **debugging**: 调试、诊断、根因、根原因、排查、追踪、分析、为什么、搞明白、弄明白、不工作、出问题、报错、坏了、崩溃
- **simple**: 找、搜索、查找、定位、列出、显示、在哪、什么是、获取、打印、展示
- **risk**: 关键、生产、紧急、安全、破坏性、危险、不可逆、数据丢失、迁移、部署、上线

### KEYWORD_PATTERNS（keyword-detector/index.ts）
- **cancel**: 取消omc、停止omc
- **ralph**: 拉尔夫（排除"拉尔夫・劳伦"）
- **autopilot**: 自动驾驶、全自动
- **ultrawork**: 超级工作
- **ralplan**: 拉尔计划
- **tdd**: 测试先行、测试驱动
- **code-review**: 代码审查、代码评审、审查代码
- **security-review**: 安全审查、安全评审、审查安全
- **ultrathink**: 深度思考
- **deepsearch**: 深度搜索、深入搜索
- **analyze**: 深度分析、深入分析
- **deep-interview**: 深度访谈