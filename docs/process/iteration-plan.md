# 迭代计划

## 目标

三天内交付一个可运行、可演示、可解释架构的多平台内容发布工具 MVP。

MVP 重点是：

- 一次输入，多平台适配。
- 图文和视频素材统一建模。
- 平台能力插件化。
- 主链路使用确定性 workflow。
- Agent 只负责自然语言到 workflow 配置的转换。
- 默认模拟发布，保留真实发布扩展点。

## 迭代计划

| 顺序 | 阶段 | 目标 | 验收标准 |
| --- | --- | --- | --- |
| 1 | `docs: add initial design documents` | 固定第一步工程边界 | README 能链接需求、设计、图示和计划；详细设计说明内容模型、Skill 协议、Gateway 和最小 workflow 链路；示例能展示一个内容输入到两个平台草稿，并覆盖 `manual_review` 与 `mock` 两种结果 |
| 2 | `chore: initialize project structure` | 初始化工程 | 仓库结构清晰，主分支可打开 |
| 3 | `feat: add content and skill contracts` | 定义核心数据模型 | 类型能表达文本、图片、视频和平台草稿 |
| 4 | `feat: add deterministic workflow engine` | 建立单向 workflow | 输入内容包后能得到草稿、校验、发布结果 |
| 5 | `feat: add article platform skills` | 公众号、知乎、小红书图文适配 | 每个平台输出不同标题、正文和标签 |
| 6 | `feat: add video platform skills` | B 站、抖音视频适配 | 能输出视频标题、简介、标签和封面建议 |
| 7 | `feat: add review hook and mock publisher` | 审核和模拟发布 | 人工审核模式不直接发布，mock 模式生成结果 |
| 8 | `feat: add planner and preview flow` | 接入 planner 与预览 | 用户指令能转换平台选择和发布模式 |
| 9 | `docs: add demo and final validation` | 完成演示材料 | README 有运行方式、Demo 视频链接和依赖说明 |

## 开发节奏

每次开发循环：

```text
需求/设计文档
  -> 新建分支
  -> 小步实现
  -> 本地测试
  -> 创建 PR
  -> 填写 PR 描述
  -> 合并后保持 main 可运行
```

## 第一阶段验收清单

第一阶段完成后，后续 PR 应该能按 workflow 的固定边界继续扩展，而不是重新定义主链路。

- 内容模型：`ContentPackage`、`PlatformDraft`、`PublishResult` 的字段能覆盖文本、图片、视频、目标平台和发布模式。
- Skill 协议：平台能力统一实现 `PlatformSkill`，并清楚区分 `adapt`、`validate`、`publish` 的职责。
- Gateway：平台 Skill 通过 `SkillGateway` 注册和查找；未注册平台有明确错误。
- workflow：主链路保持单向流转，从内容输入到平台草稿、校验结果、审核或模拟发布结果。
- 示例：`docs/examples/first-workflow.md` 展示一个 `ContentPackage`、两个平台草稿，以及 `manual_review` 和 `mock` 两种结果。

后续扩展平台时，PR 应优先补充对应 Skill 和测试；只有当主链路边界确实不足时，才调整 workflow 或核心模型。

## 设计记录

设计过程沉淀到以下文档：

- 需求分析写入 `docs/design/requirements.md`。
- 架构取舍写入 `docs/design/high-level-design.md`。
- 接口和模块写入 `docs/design/detailed-design.md`。
- 业务流程图写入 `docs/design/sequence-diagrams.md`。
- 状态转换图写入 `docs/design/state-diagrams.md`。
