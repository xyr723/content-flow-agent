# 架构说明

## 设计原则

- KISS：主链路只保留输入、适配、校验、审核、发布。
- YAGNI：真实发布 API 暂不做，默认模拟发布。
- DRY：平台差异通过 Skill 插件隔离，workflow 不重复写平台逻辑。
- 可测试：每个节点输入输出稳定，可单独写单元测试。

## 单向 Workflow

本项目避免 Agent 循环，把内容发布拆成一个确定性有向无环流程：

```text
raw input
  -> normalized content package
  -> platform plan
  -> platform drafts
  -> validation report
  -> human reviewed drafts
  -> publish results
```

每个节点只做一件事，输入输出都是结构化数据。

## Agent 位置

Agent 不是执行器，而是 planner。

它接收用户自然语言，例如：

```text
把这篇文章改成公众号、知乎、小红书版本，再把视频发到 B 站和抖音，先走人工审核。
```

输出结构化配置：

```json
{
  "targetPlatforms": ["wechat", "zhihu", "xiaohongshu", "bilibili", "douyin"],
  "publishMode": "manual_review"
}
```

后续 workflow 根据配置执行固定节点。

## Skill Gateway

Skill Gateway 是统一入口，负责：

- 注册平台 Skill。
- 根据平台 ID 找到 Skill。
- 执行 `adapt`、`validate`、`publish`。
- 收集错误和警告。

这样平台扩展不会污染 workflow 主逻辑。

## 外部 Skill 兼容思路

外部 Skill 生态可以作为未来能力来源，但当前阶段不直接依赖外部 Skill 完成核心流程。

未来兼容方式：

```text
External Skill
  -> ExternalSkillAdapter
  -> PlatformSkill
  -> SkillGateway
```

这样可以保留自研协议和测试边界，同时允许接入外部 Skill。

## 安全边界

- 不保存平台账号密码。
- 不硬编码 token。
- 不默认读取浏览器 Cookie。
- 真实发布能力必须通过显式配置启用。
- 模拟发布是默认路径。
