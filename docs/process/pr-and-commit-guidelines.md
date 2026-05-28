# 协作规范

## 基本原则

项目采用小步迭代方式开发，主分支保持可运行。

- 每个变更聚焦一个明确目标。
- 大功能拆成多个小步骤交付。
- 合并前补充必要测试或验证说明。
- 涉及接口、流程或依赖变化时，同步更新文档。

## 推荐分支命名

```text
docs/initial-design
feat/content-model
feat/workflow-engine
feat/platform-skills
feat/mock-publisher
feat/review-hook
docs/demo-guide
```

## 变更标题格式

```text
<type>: <一句话说明本次变更做了什么>
```

常用 type：

- `docs`：文档
- `chore`：工程初始化、配置
- `feat`：新增功能
- `fix`：缺陷修复
- `test`：测试
- `refactor`：不改变行为的重构

示例：

```text
docs: add requirements and workflow design
feat: add content package model
feat: add deterministic publish workflow
```

## 变更描述模板

```markdown
## 功能描述

说明本次变更新增或修改了什么，以及用户如何使用。

## 实现思路

说明技术选型、核心逻辑和关键取舍。

## 测试方式

- [ ] 本地运行了哪些命令
- [ ] 覆盖了哪些场景
- [ ] 哪些风险暂未覆盖

## 依赖说明

- 新增第三方依赖：
- 配置或环境变化：
```

## Commit 规范

Commit 保持小而清晰，能对应具体开发步骤。

推荐格式：

```text
<type>: <简短描述>
```

示例：

```text
docs: add product requirements
docs: add sequence and state diagrams
feat: define platform skill contract
feat: add mock platform publisher
test: cover workflow review mode
```

## 迭代节奏建议

### Day 1

- 上午：需求分析、概要设计、顺序图、状态图。
- 下午：工程初始化、核心类型、Skill 协议。
- 晚上：workflow 骨架和 mock publisher。

### Day 2

- 上午：图文平台 Skill。
- 下午：视频平台 Skill。
- 晚上：校验规则、预览数据、测试。

### Day 3

- 上午：LangChain planner stub 或真实接入。
- 下午：人工审核 Hook、模拟发布报告。
- 晚上：README、Demo 视频、最终测试。
