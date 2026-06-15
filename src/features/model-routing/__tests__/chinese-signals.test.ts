import { describe, it, expect } from 'vitest';
import { extractLexicalSignals, extractStructuralSignals } from '../signals.js';

describe('Chinese Language Signal Extraction', () => {
  describe('extractLexicalSignals — Chinese', () => {
    it('should detect Chinese architecture keywords', () => {
      const signals = extractLexicalSignals('我们需要重构架构设计');
      expect(signals.hasArchitectureKeywords).toBe(true);
    });

    it('should detect Chinese debugging keywords', () => {
      const signals = extractLexicalSignals('调试这个根因问题');
      expect(signals.hasDebuggingKeywords).toBe(true);
    });

    it('should detect Chinese simple keywords', () => {
      const signals = extractLexicalSignals('帮我找一下配置文件');
      expect(signals.hasSimpleKeywords).toBe(true);
    });

    it('should detect Chinese risk keywords', () => {
      const signals = extractLexicalSignals('这是一个关键的生产环境安全漏洞');
      expect(signals.hasRiskKeywords).toBe(true);
    });

    it('should detect Chinese question depth — why', () => {
      const signals = extractLexicalSignals('为什么这个功能不工作了？');
      expect(signals.questionDepth).toBe('why');
    });

    it('should detect Chinese question depth — how', () => {
      const signals = extractLexicalSignals('怎么实现这个功能？');
      expect(signals.questionDepth).toBe('how');
    });

    it('should detect Chinese question depth — what', () => {
      const signals = extractLexicalSignals('这个文件是做什么的？');
      expect(signals.questionDepth).toBe('what');
    });

    it('should detect Chinese question depth — what (啥是)', () => {
      const signals = extractLexicalSignals('啥是微服务架构？');
      expect(signals.questionDepth).toBe('what');
    });

    it('should detect Chinese question depth — what (什么意思)', () => {
      const signals = extractLexicalSignals('这个参数什么意思？');
      expect(signals.questionDepth).toBe('what');
    });

    it('should detect Chinese question depth — where', () => {
      const signals = extractLexicalSignals('配置文件在哪里？');
      expect(signals.questionDepth).toBe('where');
    });

    it('should return none for Chinese declarative statements', () => {
      const signals = extractLexicalSignals('实现这个功能');
      expect(signals.questionDepth).toBe('none');
    });

    it('should detect Chinese implicit requirements', () => {
      const signals = extractLexicalSignals('把这个弄好一点就行');
      expect(signals.hasImplicitRequirements).toBe(true);
    });

    it('should not detect implicit requirements in specific Chinese tasks', () => {
      const signals = extractLexicalSignals('修复utils.ts中的bug，添加null检查');
      expect(signals.hasImplicitRequirements).toBe(false);
    });

    it('should handle mixed Chinese-English prompts', () => {
      const signals = extractLexicalSignals('Refactor这个API的架构设计');
      expect(signals.hasArchitectureKeywords).toBe(true);
    });
  });

  describe('extractStructuralSignals — Chinese', () => {
    it('should detect Chinese cross-file dependencies', () => {
      const signals = extractStructuralSignals('需要修改多个文件');
      expect(signals.crossFileDependencies).toBe(true);
    });

    it('should detect Chinese test requirements', () => {
      const signals = extractStructuralSignals('写完代码后需要确保测试通过');
      expect(signals.hasTestRequirements).toBe(true);
    });

    it('should detect Chinese test requirements — write tests', () => {
      const signals = extractStructuralSignals('给这个模块写测试');
      expect(signals.hasTestRequirements).toBe(true);
    });

    it('should NOT detect test requirements for general validation', () => {
      const signals = extractStructuralSignals('验证登录功能是否正常');
      expect(signals.hasTestRequirements).toBe(false);
    });

    it('should detect Chinese frontend domain', () => {
      const signals = extractStructuralSignals('修改前端页面的样式和布局');
      expect(signals.domainSpecificity).toBe('frontend');
    });

    it('should detect Chinese backend domain', () => {
      const signals = extractStructuralSignals('设计后端API接口和数据库查询');
      expect(signals.domainSpecificity).toBe('backend');
    });

    it('should detect Chinese infrastructure domain', () => {
      const signals = extractStructuralSignals('部署Docker容器并设置监控');
      expect(signals.domainSpecificity).toBe('infrastructure');
    });

    it('should detect Chinese security domain', () => {
      const signals = extractStructuralSignals('防止越权攻击并进行安全加密审查');
      expect(signals.domainSpecificity).toBe('security');
    });

    it('should detect Chinese system-wide impact', () => {
      const signals = extractStructuralSignals('这个改动会影响整个系统');
      expect(signals.impactScope).toBe('system-wide');
    });

    it('should detect Chinese module-level impact', () => {
      const signals = extractStructuralSignals('更新认证模块和服务层');
      expect(signals.impactScope).toBe('module');
    });

    it('should detect Chinese local impact', () => {
      const signals = extractStructuralSignals('修复这个函数中的拼写错误');
      expect(signals.impactScope).toBe('local');
    });

    it('should detect Chinese difficult reversibility', () => {
      const signals = extractStructuralSignals('执行生产环境数据库迁移');
      expect(signals.reversibility).toBe('difficult');
    });

    it('should detect Chinese moderate reversibility', () => {
      const signals = extractStructuralSignals('重构整个模块结构');
      expect(signals.reversibility).toBe('moderate');
    });

    it('should detect Chinese easy reversibility', () => {
      const signals = extractStructuralSignals('添加一个console.log语句');
      expect(signals.reversibility).toBe('easy');
    });

    it('should detect Chinese external knowledge requirement', () => {
      const signals = extractStructuralSignals('查看官方文档中的最佳实践');
      expect(signals.requiresExternalKnowledge).toBe(true);
    });
  });
});