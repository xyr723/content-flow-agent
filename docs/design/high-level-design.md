# 概要设计

## 总体方案

系统采用单向 workflow 架构，不采用循环式 Agent 执行链。

核心路径：

```text
输入内容
  -> 归一化内容包
  -> 平台规划
  -> Skill Gateway 调用平台 Skill
  -> 平台校验
  -> 人工审核
  -> 模拟发布
  -> 发布报告
```

## 模块划分

### Agent Planner

负责把自然语言意图转换为结构化配置。

示例：

```text
帮我把这篇文章发到公众号、知乎、小红书，视频发 B 站和抖音，先人工审核。
```

转换为：

```json
{
  "targetPlatforms": ["wechat", "zhihu", "xiaohongshu", "bilibili", "douyin"],
  "publishMode": "manual_review"
}
```

### Workflow Engine

负责执行确定性的节点链路。每个节点接收结构化输入，输出结构化结果。

### Skill Gateway

平台 Skill 的统一调用入口，隔离平台实现差异。

### Platform Skills

每个平台一个 Skill：

- 公众号 Skill
- 知乎 Skill
- B 站 Skill
- 小红书 Skill
- 抖音 Skill

### Publisher

MVP 默认使用 `PublisherRegistry` 和 `MockPublisher`。workflow 发布节点只依赖 Publisher 抽象，不直接调用平台 Skill 的 `publish`。`real` 模式通过 `RealPublisher` 做真实发布预检，未显式配置执行器时只返回安全失败。

### 扩展层

外部 Skill 通过 `ExternalSkillAdapter` 进入内部 `PlatformSkill` 协议。GUI 展示外部 Skill 适配层可用和真实发布未配置状态，避免把扩展能力藏在代码路径里。

## 技术取舍

| 选项 | 结论 | 原因 |
| --- | --- | --- |
| LangChain Agent 循环 | 不作为主链路 | 难预测、难测试、token 成本高 |
| LangGraph | 暂不引入 | 当前流程是单向无环图，轻量 workflow 足够 |
| 自研 workflow | 采用 | 节点简单，便于测试和展示 |
| 外部 Skill 生态 | 通过 adapter 兼容 | 保持内部协议稳定，同时允许外部能力进入 Gateway |
| 真实发布 | 仅做安全预检 | 涉及账号、权限和风控风险，必须显式配置执行器 |
