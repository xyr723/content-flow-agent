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
| 1 | `docs: add initial design documents` | 保留设计过程 | README 能链接需求、设计、图示和计划 |
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

## 设计记录

设计过程沉淀到以下文档：

- 需求分析写入 `docs/design/requirements.md`。
- 架构取舍写入 `docs/design/high-level-design.md`。
- 接口和模块写入 `docs/design/detailed-design.md`。
- 业务流程图写入 `docs/design/sequence-diagrams.md`。
- 状态转换图写入 `docs/design/state-diagrams.md`。
