/**
 * Complexity Signal Extraction
 *
 * Extracts complexity signals from task prompts to inform routing decisions.
 * Signals are categorized into lexical, structural, and context types.
 */

import type {
  LexicalSignals,
  StructuralSignals,
  ContextSignals,
  ComplexitySignals,
  RoutingContext,
} from './types.js';
import { COMPLEXITY_KEYWORDS } from './types.js';

/**
 * Extract lexical signals from task prompt
 * These are fast, regex-based extractions that don't require model calls
 */
export function extractLexicalSignals(prompt: string): LexicalSignals {
  const lowerPrompt = prompt.toLowerCase();
  const words = prompt.split(/\s+/).filter(w => w.length > 0);

  return {
    wordCount: words.length,
    filePathCount: countFilePaths(prompt),
    codeBlockCount: countCodeBlocks(prompt),
    hasArchitectureKeywords: hasKeywords(lowerPrompt, COMPLEXITY_KEYWORDS.architecture),
    hasDebuggingKeywords: hasKeywords(lowerPrompt, COMPLEXITY_KEYWORDS.debugging),
    hasSimpleKeywords: hasKeywords(lowerPrompt, COMPLEXITY_KEYWORDS.simple),
    hasRiskKeywords: hasKeywords(lowerPrompt, COMPLEXITY_KEYWORDS.risk),
    questionDepth: detectQuestionDepth(lowerPrompt),
    hasImplicitRequirements: detectImplicitRequirements(lowerPrompt),
  };
}

/**
 * Extract structural signals from task prompt
 * These require more sophisticated parsing
 */
export function extractStructuralSignals(prompt: string): StructuralSignals {
  const lowerPrompt = prompt.toLowerCase();

  return {
    estimatedSubtasks: estimateSubtasks(prompt),
    crossFileDependencies: detectCrossFileDependencies(prompt),
    hasTestRequirements: detectTestRequirements(lowerPrompt),
    domainSpecificity: detectDomain(lowerPrompt),
    requiresExternalKnowledge: detectExternalKnowledge(lowerPrompt),
    reversibility: assessReversibility(lowerPrompt),
    impactScope: assessImpactScope(prompt),
  };
}

/**
 * Extract context signals from routing context
 */
export function extractContextSignals(context: RoutingContext): ContextSignals {
  return {
    previousFailures: context.previousFailures ?? 0,
    conversationTurns: context.conversationTurns ?? 0,
    planComplexity: context.planTasks ?? 0,
    remainingTasks: context.remainingTasks ?? 0,
    agentChainDepth: context.agentChainDepth ?? 0,
  };
}

/**
 * Extract all complexity signals
 */
export function extractAllSignals(
  prompt: string,
  context: RoutingContext
): ComplexitySignals {
  return {
    lexical: extractLexicalSignals(prompt),
    structural: extractStructuralSignals(prompt),
    context: extractContextSignals(context),
  };
}

// ============ Helper Functions ============

/**
 * Count file paths in prompt
 */
function countFilePaths(prompt: string): number {
  // Match common file path patterns
  const patterns = [
    /(?:^|\s)[.\/~]?(?:[\w-]+\/)+[\w.-]+\.\w+/gm,  // Unix-style paths
    /`[^`]+\.\w+`/g,  // Backtick-quoted files
    /['"][^'"]+\.\w+['"]/g,  // Quoted files
  ];

  let count = 0;
  for (const pattern of patterns) {
    const matches = prompt.match(pattern);
    if (matches) count += matches.length;
  }

  return Math.min(count, 20); // Cap at reasonable max
}

/**
 * Count code blocks in prompt
 */
function countCodeBlocks(prompt: string): number {
  const fencedBlocks = (prompt.match(/```[\s\S]*?```/g) || []).length;
  const indentedBlocks = (prompt.match(/(?:^|\n)(?:\s{4}|\t)[^\n]+(?:\n(?:\s{4}|\t)[^\n]+)*/g) || []).length;
  return fencedBlocks + Math.floor(indentedBlocks / 2);
}

/**
 * Check if prompt contains any of the keywords
 */
function hasKeywords(prompt: string, keywords: string[]): boolean {
  return keywords.some(kw => prompt.includes(kw));
}

/**
 * Detect question depth
 * 'why' questions require deeper reasoning than 'what' or 'where'
 */
function detectQuestionDepth(prompt: string): 'why' | 'how' | 'what' | 'where' | 'none' {
  // English patterns
  if (/\bwhy\b.*\?|\bwhy\s+(is|are|does|do|did|would|should|can)/i.test(prompt)) {
    return 'why';
  }
  // 中文匹配 - 为什么/为何/为啥 → why
  if (/为什么|为何|为啥|原因是什么|什么原因/.test(prompt)) {
    return 'why';
  }
  // English patterns
  if (/\bhow\b.*\?|\bhow\s+(do|does|can|should|would|to)/i.test(prompt)) {
    return 'how';
  }
  // 中文匹配 - 怎么/如何/怎样 → how
  if (/怎么|如何|怎样|怎么样|如何做|怎么做/.test(prompt)) {
    return 'how';
  }
  // English patterns
  if (/\bwhat\b.*\?|\bwhat\s+(is|are|does|do)/i.test(prompt)) {
    return 'what';
  }
  // 中文匹配 - 什么是/什么/啥 → what
  if (/什么是|是什么|什么|啥/.test(prompt)) {
    return 'what';
  }
  // English patterns
  if (/\bwhere\b.*\?|\bwhere\s+(is|are|does|do|can)/i.test(prompt)) {
    return 'where';
  }
  // 中文匹配 - 在哪里/在哪/哪儿 → where
  if (/在哪里|在哪|哪儿/.test(prompt)) {
    return 'where';
  }
  return 'none';
}

/**
 * Detect implicit requirements (vague statements without clear deliverables)
 */
function detectImplicitRequirements(prompt: string): boolean {
  const vaguePatterns = [
    // English
    /\bmake it better\b/,
    /\bimprove\b(?!.*(?:by|to|so that))/,
    /\bfix\b(?!.*(?:the|this|that|in|at))/,
    /\boptimize\b(?!.*(?:by|for|to))/,
    /\bclean up\b/,
    /\brefactor\b(?!.*(?:to|by|into))/,
    // 中文
    /弄好一点|搞好一点|优化一下|改好一点|弄好看点/,
    /改进一下|改善一下|提升一下/,
    /修一下|修修|修好|修一下bug/,
    /优化(?!.*(?:通过|为了|到))/,
    /清理一下|整理一下|打扫/,
    /重构(?!.*(?:到|通过|成))/,
  ];
  return vaguePatterns.some(p => p.test(prompt));
}

/**
 * Estimate number of subtasks
 */
function estimateSubtasks(prompt: string): number {
  let count = 1;

  // Count explicit list items
  const bulletPoints = (prompt.match(/^[\s]*[-*•]\s/gm) || []).length;
  const numberedItems = (prompt.match(/^[\s]*\d+[.)]\s/gm) || []).length;
  count += bulletPoints + numberedItems;

  // Count 'and' conjunctions that might indicate multiple tasks
  const andCount = (prompt.match(/\band\b/gi) || []).length;
  count += Math.floor(andCount / 2);

  // Count 'then' indicators
  const thenCount = (prompt.match(/\bthen\b/gi) || []).length;
  count += thenCount;

  return Math.min(count, 10);
}

/**
 * Detect if task involves changes across multiple files
 */
function detectCrossFileDependencies(prompt: string): boolean {
  const fileCount = countFilePaths(prompt);
  if (fileCount >= 2) return true;

  const crossFileIndicators = [
    // English
    /multiple files/i,
    /across.*files/i,
    /several.*files/i,
    /all.*files/i,
    /throughout.*codebase/i,
    /entire.*project/i,
    /whole.*system/i,
    // 中文
    /多个文件/,
    /跨文件/,
    /所有文件/,
    /整个项目/,
    /整个代码库/,
    /全部文件/,
    /好几个文件/,
  ];

  return crossFileIndicators.some(p => p.test(prompt));
}

/**
 * Detect test requirements
 */
function detectTestRequirements(prompt: string): boolean {
  const testIndicators = [
    // English
    /\btests?\b/i,
    /\bspec\b/i,
    /make sure.*work/i,
    /verify/i,
    /ensure.*pass/i,
    /\bTDD\b/,
    /unit test/i,
    /integration test/i,
    // 中文
    /测试/,
    /单元测试/,
    /集成测试/,
    /确保.*通过/,
    /验证/,
    /测试用例/,
    /用例/,
  ];
  return testIndicators.some(p => p.test(prompt));
}

/**
 * Detect domain specificity
 */
function detectDomain(
  prompt: string
): 'generic' | 'frontend' | 'backend' | 'infrastructure' | 'security' {
  const domains: Record<string, RegExp[]> = {
    frontend: [
      // English
      /\b(react|vue|angular|svelte|css|html|jsx|tsx|component|ui|ux|styling|tailwind|sass|scss)\b/i,
      /\b(button|modal|form|input|layout|responsive|animation)\b/i,
      // 中文
      /前端/, /界面/, /页面/, /组件/, /样式/, /布局/, /响应式/,
      /按钮/, /弹窗/, /表单/, /输入框/, /动画/,
    ],
    backend: [
      // English
      /\b(api|endpoint|database|query|sql|graphql|rest|server|auth|middleware)\b/i,
      /\b(node|express|fastify|nest|django|flask|rails)\b/i,
      // 中文
      /后端/, /接口/, /数据库/, /查询/, /服务端/, /中间件/,
      /认证/, /授权/,
    ],
    infrastructure: [
      // English
      /\b(docker|kubernetes|k8s|terraform|aws|gcp|azure|ci|cd|deploy|container)\b/i,
      /\b(nginx|load.?balancer|scaling|monitoring|logging)\b/i,
      // 中文
      /运维/, /部署/, /容器/, /负载均衡/, /扩容/, /监控/, /日志/,
      /持续集成/, /持续部署/,
    ],
    security: [
      // English
      /\b(security|auth|oauth|jwt|encryption|vulnerability|xss|csrf|injection)\b/i,
      /\b(password|credential|secret|token|permission)\b/i,
      // 中文
      /安全/, /加密/, /漏洞/, /注入/, /密码/, /凭证/, /令牌/,
      /权限/, /越权/,
    ],
  };

  for (const [domain, patterns] of Object.entries(domains)) {
    if (patterns.some(p => p.test(prompt))) {
      return domain as 'frontend' | 'backend' | 'infrastructure' | 'security';
    }
  }

  return 'generic';
}

/**
 * Detect if external knowledge is required
 */
function detectExternalKnowledge(prompt: string): boolean {
  const externalIndicators = [
    // English
    /\bdocs?\b/i,
    /\bdocumentation\b/i,
    /\bofficial\b/i,
    /\blibrary\b/i,
    /\bpackage\b/i,
    /\bframework\b/i,
    /\bhow does.*work\b/i,
    /\bbest practice/i,
    // 中文
    /文档/, /官方/, /库/, /框架/, /怎么.*工作/, /最佳实践/,
    /第三方/, /外部/,
  ];
  return externalIndicators.some(p => p.test(prompt));
}

/**
 * Assess reversibility of changes
 */
function assessReversibility(prompt: string): 'easy' | 'moderate' | 'difficult' {
  const difficultIndicators = [
    // English
    /\bmigrat/i,
    /\bproduction\b/i,
    /\bdata.*loss/i,
    /\bdelete.*all/i,
    /\bdrop.*table/i,
    /\birreversible/i,
    /\bpermanent/i,
    // 中文
    /迁移/, /生产环境/, /数据丢失/, /删除所有/, /不可逆/, /永久/,
    /删库/, /上线/,
  ];

  const moderateIndicators = [
    // English
    /\brefactor/i,
    /\brestructure/i,
    /\brename.*across/i,
    /\bmove.*files/i,
    /\bchange.*schema/i,
    // 中文
    /重构/, /重组/, /重命名/, /移动文件/, /修改.*结构/,
  ];

  if (difficultIndicators.some(p => p.test(prompt))) return 'difficult';
  if (moderateIndicators.some(p => p.test(prompt))) return 'moderate';
  return 'easy';
}

/**
 * Assess impact scope of changes
 */
function assessImpactScope(prompt: string): 'local' | 'module' | 'system-wide' {
  const systemWideIndicators = [
    // English
    /\bentire\b/i,
    /\ball\s+(?:files|components|modules)/i,
    /\bwhole\s+(?:project|codebase|system)/i,
    /\bsystem.?wide/i,
    /\bglobal/i,
    /\beverywhere/i,
    /\bthroughout/i,
    // 中文
    /整个/, /全部/, /所有/, /全局/, /系统级/, /到处/, /贯穿/,
    /整个项目/, /整个系统/,
  ];

  const moduleIndicators = [
    // English
    /\bmodule/i,
    /\bpackage/i,
    /\bservice/i,
    /\bfeature/i,
    /\bcomponent/i,
    /\blayer/i,
    // 中文
    /模块/, /包/, /服务/, /功能/, /组件/, /层/,
  ];

  if (systemWideIndicators.some(p => p.test(prompt))) return 'system-wide';

  // Check for multiple files (indicates module-level at least)
  if (countFilePaths(prompt) >= 3) return 'module';
  if (moduleIndicators.some(p => p.test(prompt))) return 'module';

  return 'local';
}
