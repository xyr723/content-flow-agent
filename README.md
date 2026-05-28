# Content Flow Agent

面向创作者的多平台内容发布工具。用户输入一份原始内容和图文/视频素材后，系统通过单向 workflow 数据流自动生成公众号、知乎、B 站、小红书、抖音等平台的发布版本，并支持预览、校验、人工审核和模拟发布。

## 选题方向

本项目对应「题目二：多平台内容发布工具」。

目标不是做一个只会改写文案的工具，而是做一个可扩展的内容发布工作流：

1. 用户只输入一次原始内容。
2. Workflow 将内容依次送入解析、适配、校验、审核、发布节点。
3. 每个平台能力以 Skill 插件形式接入。
4. Agent 只负责把用户意图转换成 workflow 配置，不参与不可预测的循环调用。
5. 默认使用模拟发布，避免账号、Cookie、平台风控和第三方权限风险。

## 为什么使用 workflow，而不是 Agent 循环

Agent 循环适合开放式探索，但不适合内容发布的核心链路。原因是：

- 难预测：同一输入可能产生不同调用路径。
- 难测试：每个节点不能独立稳定验证。
- 消耗高：反复 LLM 调用会浪费 token。
- 风险高：平台发布流程需要确定性和可审计。

本项目采用单向无环数据流：

```text
ContentInput
  -> NormalizeContent
  -> PlanPlatforms
  -> AdaptByPlatformSkills
  -> ValidatePlatformDrafts
  -> HumanReviewHook
  -> PublishOrMockPublish
  -> PublishReport
```

如果后续确实需要更复杂的状态流转，可以迁移到 LangGraph；当前三天 MVP 优先使用轻量 workflow，保持可测试、可演示、可扩展。

## 架构设计

```text
frontend / cli
  |
  v
workflow engine
  |
  +-- agent planner
  |     - 将自然语言目标转换成结构化 workflow input
  |     - 不直接执行平台发布
  |
  +-- skill gateway
  |     - 统一调用平台 skill
  |     - 隔离平台差异
  |
  +-- platform skills
  |     - wechat_article
  |     - zhihu_article
  |     - bilibili_video
  |     - xiaohongshu_note
  |     - douyin_video
  |
  +-- validators
  |     - 标题长度
  |     - 标签数量
  |     - 素材缺失
  |     - 平台字段完整性
  |
  +-- publishers
        - mock publisher
        - future real publisher
```

## 核心数据流

### 1. 输入内容包

```ts
type ContentPackage = {
  sourceText: string;
  title?: string;
  images: MediaAsset[];
  videos: MediaAsset[];
  targetPlatforms: PlatformId[];
  publishMode: "mock" | "manual_review" | "real";
};
```

### 2. 平台 Skill 输出

```ts
type PlatformDraft = {
  platform: PlatformId;
  title: string;
  body: string;
  summary?: string;
  tags: string[];
  assets: MediaAsset[];
  warnings: string[];
};
```

### 3. 发布结果

```ts
type PublishResult = {
  platform: PlatformId;
  status: "drafted" | "review_required" | "mock_published" | "failed";
  url?: string;
  message: string;
};
```

## Skill 插件协议

每个平台能力都实现同一个接口：

```ts
interface PlatformSkill {
  id: PlatformId;
  displayName: string;
  supportedMedia: Array<"text" | "image" | "video">;
  adapt(input: ContentPackage): Promise<PlatformDraft>;
  validate(draft: PlatformDraft): Promise<ValidationResult>;
  publish(draft: PlatformDraft): Promise<PublishResult>;
}
```

新增平台只需要：

1. 新建一个 `src/skills/<platform>.ts`。
2. 实现 `PlatformSkill` 接口。
3. 在 `SkillGateway` 注册。
4. 补充测试和 README 依赖说明。

后续可通过适配层接入外部 Skill 生态，但核心平台协议保持在项目内统一维护，保证可控性和可测试性。

## 平台适配范围

| 平台 | 内容类型 | MVP 能力 | 发布方式 |
| --- | --- | --- | --- |
| 公众号 | 图文 | 标题、摘要、正文排版、图片顺序 | 模拟发布 |
| 知乎 | 图文长文 | 逻辑分段、问答/专栏风格、标签 | 模拟发布 |
| B 站 | 视频 | 视频标题、简介、分区提示、标签 | 模拟发布 |
| 小红书 | 图文/短视频 | 种草标题、正文、话题标签、封面文案 | 模拟发布 |
| 抖音 | 短视频 | 短标题、简介、话题、封面文案 | 模拟发布 |

## LangChain 的使用边界

LangChain 只用于 Agent Planner：

- 解析用户自然语言发布目标。
- 输出结构化 `ContentPackage` 或 workflow 配置。
- 根据内容类型推荐目标平台。

不让 LangChain Agent 直接进入循环式平台调用。平台适配、校验、发布全部走确定性 workflow 节点，便于单元测试和 PR 逐步交付。

## 人工审核 Hook

发布前保留人工审核节点：

```text
ValidatePlatformDrafts -> HumanReviewHook -> PublishOrMockPublish
```

审核节点用于：

- 修改标题和正文。
- 删除不合适的标签。
- 检查图片和视频顺序。
- 阻止有风险的平台发布。

## 项目文档

设计与计划文档保存在：

- [需求分析](docs/design/requirements.md)
- [概要设计](docs/design/high-level-design.md)
- [详细设计](docs/design/detailed-design.md)
- [迭代计划](docs/process/iteration-plan.md)
- [协作规范](docs/process/pr-and-commit-guidelines.md)
- [业务顺序图](docs/design/sequence-diagrams.md)
- [发布状态图](docs/design/state-diagrams.md)
- [第一阶段 workflow 示例](docs/examples/first-workflow.md)

开发约定：

- 需求和设计先落文档，再进入实现。
- 功能通过小粒度分支开发，主分支保持可运行。
- 每次变更包含清晰说明和可复现的验证方式。

## 三天交付计划

### Day 1

- 初始化仓库、README、目录结构。
- 定义内容模型、Skill 协议和 workflow 节点接口。
- 完成 mock publisher。

### Day 2

- 实现公众号、知乎、小红书 Skill。
- 实现 B 站、抖音视频 Skill。
- 加入平台校验和预览数据。

### Day 3

- 接入 LangChain Planner 的 mock/stub 版本。
- 完成人工审核 Hook、模拟发布报告。
- 补充测试、Demo 视频和 README 使用说明。

## 迭代拆分

建议按以下阶段推进：

1. `chore: initialize content flow agent repository`
2. `feat: add content package and platform skill contracts`
3. `feat: add deterministic workflow engine`
4. `feat: add article platform skills`
5. `feat: add video platform skills`
6. `feat: add validation and human review hook`
7. `feat: add mock publish report`
8. `docs: add demo guide and architecture notes`

## 依赖说明

当前初始化版本只包含项目文档和架构骨架，尚未引入第三方运行时依赖。

后续计划依赖：

- LangChain：仅用于 Agent Planner。
- Node.js / TypeScript：实现 workflow、Skill 和测试。
- 可选前端框架：用于预览和人工审核界面。

项目内实现的核心模块：

- 单向内容发布 workflow 设计。
- 自研 PlatformSkill 协议。
- SkillGateway 统一调用层。
- 平台适配和校验规则。
- 模拟发布与发布报告。

## 本地开发

初始化阶段：

```bash
git status
```

后续加入 TypeScript 工程后补充：

```bash
npm install
npm test
npm run dev
```
