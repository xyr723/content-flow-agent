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
  -> independent validation report
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
- 执行 `adapt`。

这样平台扩展不会污染 workflow 主逻辑。

## Draft Validator

Draft Validator 是独立校验器，负责：

- 检查通用草稿字段，例如标题、正文、标签。
- 检查平台约束，例如 B 站和抖音的视频素材要求。
- 合并平台适配阶段生成的非阻塞提醒。

workflow 的 `validate_platform_drafts` 节点统一调用独立校验器。平台 Skill 的 `validate` 仅作为兼容入口保留，并委托给同一套校验器规则。

## Publisher Registry

Publisher Registry 是发布入口，负责：

- 注册平台 Publisher。
- 根据平台 ID 找到 Publisher。
- 执行模拟发布或真实发布预检并返回 `PublishResult`。

workflow 的发布节点统一调用 Publisher Registry。`mock` 模式走 `MockPublisher`，`real` 模式走 `RealPublisher`。未显式配置真实发布执行器时，`RealPublisher` 只返回安全失败结果，不读取凭据、不访问真实平台。平台 Skill 的 `publish` 仅作为兼容入口保留，并委托给同一套 mock publisher。

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

`ExternalSkillAdapter` 已提供最小闭环：外部 Skill 可以通过 adapter 注册进 `SkillGateway`；缺省校验和发布会回落到内部 `DraftValidator` 和 `MockPublisher`。

## 安全边界

- 不保存平台账号密码。
- 不硬编码 token。
- 不默认读取浏览器 Cookie。
- 真实发布能力必须通过显式配置启用。
- 模拟发布是默认路径。
