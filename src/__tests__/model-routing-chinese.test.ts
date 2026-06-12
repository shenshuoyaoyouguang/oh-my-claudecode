import { describe, it, expect } from 'vitest';
import { routeTask } from '../features/model-routing/router.js';
import type { RoutingContext } from '../features/model-routing/types.js';

describe('Chinese Language Routing — End to End', () => {
  it('should route Chinese simple search to LOW tier', () => {
    const context: RoutingContext = {
      taskPrompt: '帮我找一下配置文件在哪里',
    };
    const decision = routeTask(context);
    expect(decision.tier).toBe('LOW');
  });

  it('should route Chinese architecture task to HIGH tier', () => {
    const context: RoutingContext = {
      taskPrompt: '重构整个系统的架构，涉及所有模块的安全性问题',
    };
    const decision = routeTask(context);
    expect(decision.tier).toBe('HIGH');
  });

  it('should route Chinese debugging task to HIGH tier', () => {
    const context: RoutingContext = {
      taskPrompt: '生产环境出现严重bug，需要排查根因',
      agentType: 'architect',
    };
    const decision = routeTask(context);
    expect(decision.tier).toBe('HIGH');
  });

  it('should route Chinese generic task to MEDIUM tier', () => {
    const context: RoutingContext = {
      taskPrompt: '修改多个模块中的API接口，添加认证功能和对应的测试用例',
    };
    const decision = routeTask(context);
    expect(decision.tier).toBe('MEDIUM');
  });

  it('should handle mixed Chinese-English prompts', () => {
    const context: RoutingContext = {
      taskPrompt: 'Refactor the auth module，需要处理所有security相关的vulnerability',
    };
    const decision = routeTask(context);
    expect(decision.tier).toBe('HIGH');
  });

  it('should detect high confidence for explicit Chinese complex task', () => {
    const context: RoutingContext = {
      taskPrompt: '重构整个微服务架构，涉及数据库迁移和安全加固',
    };
    const decision = routeTask(context);
    expect(decision.confidence).toBeGreaterThan(0.7);
  });

  it('should apply escalation rules for Chinese risk keywords', () => {
    const context: RoutingContext = {
      taskPrompt: '生产环境出现关键安全漏洞，需要紧急修复',
      agentType: 'architect',
    };
    const decision = routeTask(context);
    expect(decision.tier).toBe('HIGH');
    const reasons = decision.reasons.join(' ');
    expect(reasons.length).toBeGreaterThan(0);
  });

  it('should route Chinese risk task to HIGH tier', () => {
    const context: RoutingContext = {
      taskPrompt: '这是一个关键的生产环境迁移任务，涉及数据丢失风险',
    };
    const decision = routeTask(context);
    expect(decision.tier).toBe('HIGH');
  });

  it('should route Chinese simple lookup to LOW tier', () => {
    const context: RoutingContext = {
      taskPrompt: '查找配置文件在哪里',
    };
    const decision = routeTask(context);
    expect(decision.tier).toBe('LOW');
  });

  it('should route Chinese implicit requirements with risk to HIGH tier', () => {
    const context: RoutingContext = {
      taskPrompt: '把这个生产环境的关键功能优化一下',
    };
    const decision = routeTask(context);
    // Has both risk keywords and implicit requirements → HIGH
    expect(decision.tier).toBe('HIGH');
  });
});