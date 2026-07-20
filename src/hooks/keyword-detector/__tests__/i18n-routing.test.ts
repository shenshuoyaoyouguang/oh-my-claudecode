/**
 * i18n keyword detector routing — Red 阶段测试
 *
 * 本测试文件描述期望的 i18n 行为,对应 5 条待合并提交:
 * - 07050bb9  chore(docs): remove .trae/ residual after plan migration to docs/
 * - a3e2e9f0  fix(i18n): tighten Chinese conjunction regex to reduce over-match
 * - 4d5c1cda  fix(i18n): cover CJK file paths & Chinese conjunctions for routing parity
 * - f7ce24bf  docs(i18n): add trailing newline to chinese-language-support-plan.md
 * - ea2ae4f3  fix(i18n): cover bare 优化 intent & add regression tests for signal tightening
 *
 * Red 阶段:只新增测试,不修改源码。期望大部分正向用例失败,
 * 负向用例(不应触发)通过,从而构成清晰的 Red 状态。
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  detectKeywordsWithType,
  sanitizeForKeywordDetection,
  NON_LATIN_SCRIPT_PATTERN,
} from '../index.js';

describe('i18n keyword detector routing', () => {
  describe('Chinese conjunctions', () => {
    it('detects bare 优化 intent as ultrathink (ea2ae4f3)', () => {
      // bare 优化(无前缀动词)应被识别为 ultrathink 意图
      const result = detectKeywordsWithType('优化这个函数');
      const match = result.find((r) => r.type === 'ultrathink');
      expect(match).toBeDefined();
    });

    it('does not over-match conjunction 并且 in "我并且你" (a3e2e9f0)', () => {
      // 收紧 conjunction 正则:普通代词连接不应触发 ultrathink
      const result = detectKeywordsWithType('我并且你都不懂');
      expect(result.find((r) => r.type === 'ultrathink')).toBeUndefined();
    });

    it('routes 优化并且简化 as ultrathink via Chinese conjunction (4d5c1cda)', () => {
      // 中文连词 并且 应正确路由,连接两个意图词时整体触发 ultrathink
      const result = detectKeywordsWithType('优化并且简化这个函数');
      expect(result.find((r) => r.type === 'ultrathink')).toBeDefined();
    });

    it('routes 优化和改进 connected by 和 as ultrathink (4d5c1cda)', () => {
      // 中文连词 和 应正确路由,连接两个意图词时整体触发 ultrathink
      const result = detectKeywordsWithType('优化和改进这个函数');
      expect(result.find((r) => r.type === 'ultrathink')).toBeDefined();
    });

    it('detects 优化 with trailing verb 深度优化 as ultrathink (signal tightening)', () => {
      // 信号收紧:复合词 深度优化 也应被识别为 ultrathink 意图
      const result = detectKeywordsWithType('请深度优化这段代码');
      expect(result.find((r) => r.type === 'ultrathink')).toBeDefined();
    });
  });

  describe('CJK file paths', () => {
    it('strips Chinese file path src/组件/按钮.tsx without false activation (4d5c1cda)', () => {
      const sanitized = sanitizeForKeywordDetection('打开 src/组件/按钮.tsx');
      // 路径段应被剥离,不残留中文别名
      expect(sanitized).not.toContain('组件');
      expect(sanitized).not.toContain('按钮');
    });

    it('does not false-activate when 优化 appears inside a CJK file path (4d5c1cda)', () => {
      // 路径中的 优化 应被路径剥离逻辑吃掉,不触发 ultrathink
      const result = detectKeywordsWithType('查看 src/优化/重写.tsx');
      expect(result.find((r) => r.type === 'ultrathink')).toBeUndefined();
    });

    it('still detects bare 优化 after a CJK path (parity with Japanese behavior)', () => {
      // 与日语行为对齐:路径后的裸 优化 指令应仍能触发 ultrathink
      const result = detectKeywordsWithType('打开 src/组件/按钮.tsx 并优化');
      expect(result.find((r) => r.type === 'ultrathink')).toBeDefined();
    });

    it('does not false-activate for a leading-slash Chinese path "/docs/优化笔记.md"', () => {
      const result = detectKeywordsWithType('查看 /docs/优化笔记.md');
      expect(result.find((r) => r.type === 'ultrathink')).toBeUndefined();
    });
  });

  describe('i18n regression', () => {
    it('handles trailing newline in prompt without breaking detection (f7ce24bf)', () => {
      // 文档尾部换行修复的回归保护:换行结尾的提示不应破坏检测
      const result = detectKeywordsWithType('优化这个函数\n');
      expect(result.find((r) => r.type === 'ultrathink')).toBeDefined();
    });

    it('chinese-language-support-plan.md exists and ends with trailing newline (f7ce24bf)', () => {
      // f7ce24bf 为该文档添加尾部换行;此处回归保护文档存在且以换行结尾
      const docPath = join(
        // 测试文件位于 src/hooks/keyword-detector/__tests__/
        // 项目根目录上溯三级
        import.meta.url
          .replace('file:///', '')
          .replace(/[\\/].*$/, ''),
        'docs',
        'chinese-language-support-plan.md',
      );
      // 兜底:用 process.cwd() 解析,因为 import.meta.url 在 Windows 下盘符处理不一致
      const fallbackPath = join(process.cwd(), 'docs', 'chinese-language-support-plan.md');
      const resolved = existsSync(docPath) ? docPath : fallbackPath;

      expect(existsSync(resolved)).toBe(true);
      if (existsSync(resolved)) {
        const content = readFileSync(resolved, 'utf8');
        expect(content.endsWith('\n')).toBe(true);
      }
    });

    it('does not load anything from residual .trae/ directory (07050bb9)', () => {
      // 07050bb9 清理 .trae/ 残留:确保仓库根目录不再存在 .trae/
      const traeDir = join(process.cwd(), '.trae');
      expect(existsSync(traeDir)).toBe(false);
    });

    it('NON_LATIN_SCRIPT_PATTERN covers Chinese characters for routing', () => {
      // 回归保护:非拉丁脚本检测必须覆盖中文常用字
      expect(NON_LATIN_SCRIPT_PATTERN.test('优化')).toBe(true);
      expect(NON_LATIN_SCRIPT_PATTERN.test('并且')).toBe(true);
      expect(NON_LATIN_SCRIPT_PATTERN.test('组件')).toBe(true);
      expect(NON_LATIN_SCRIPT_PATTERN.test('hello')).toBe(false);
    });
  });
});
