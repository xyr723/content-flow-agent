# 详细设计

## 核心类型

### ContentPackage

表示用户输入的一次发布任务。

字段：

- `sourceText`：原始正文。
- `title`：可选原始标题。
- `images`：图片素材。
- `videos`：视频素材。
- `targetPlatforms`：目标平台。
- `publishMode`：发布模式。

### PlatformDraft

表示某个平台的适配草稿。

字段：

- `platform`：平台 ID。
- `title`：平台标题。
- `body`：正文、简介或说明。
- `summary`：摘要。
- `tags`：平台标签。
- `assets`：使用到的素材。
- `warnings`：适配阶段警告。

### PublishResult

表示发布结果。

字段：

- `platform`：平台 ID。
- `status`：发布状态。
- `url`：模拟或真实链接。
- `message`：结果说明。

## PlatformSkill 接口

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

## Workflow 节点

### NormalizeContent

把用户输入整理为 `ContentPackage`。

### PlanPlatforms

根据用户选择或 planner 输出确定目标平台。

### AdaptByPlatformSkills

通过 `SkillGateway` 调用各平台 `adapt`。

### ValidatePlatformDrafts

调用各平台 `validate`，输出错误和警告。

### HumanReviewHook

如果 `publishMode` 是 `manual_review`，则停止在审核状态，不进入发布。

### PublishOrMockPublish

如果是 `mock` 模式，返回模拟发布结果。真实发布留作扩展。

## 扩展新平台

新增平台步骤：

1. 新建 `src/skills/<platform>.ts`。
2. 实现 `PlatformSkill`。
3. 注册到 `SkillGateway`。
4. 添加单元测试。
5. 在 README 的平台表格中说明能力。

## 错误处理

- 未注册平台：抛出明确错误。
- 素材缺失：返回 validation error。
- 非阻塞建议：返回 warning。
- 发布失败：返回 `failed` 状态，不影响其他平台结果。

## 第一步开发验收标准

第一步开发聚焦于把主链路的工程边界固定下来，后续平台能力只需要沿着同一套 workflow 扩展。

### 内容模型

- `ContentPackage` 能表达一次发布任务的原始内容、素材、目标平台和发布模式。
- 图片、视频等素材在模型中统一描述，平台 Skill 不直接读取外部输入。
- `PlatformDraft` 能承载平台适配后的标题、正文、摘要、标签、素材引用和警告。
- `PublishResult` 能表达人工审核、模拟发布、失败等最小结果状态。

### Skill 协议

- 所有平台能力实现同一个 `PlatformSkill` 接口。
- `adapt` 只负责把 `ContentPackage` 转为平台草稿。
- `validate` 只负责检查草稿是否满足平台约束，并返回错误或警告。
- `publish` 只负责接收已校验草稿并返回发布结果。
- 新平台不需要修改 workflow 节点，只需要实现接口并完成注册。

### SkillGateway

- `SkillGateway` 按平台 ID 查找已注册 Skill。
- 对未注册平台返回明确错误，便于调用方定位配置问题。
- Gateway 不包含平台适配逻辑，只负责注册、查找和调用边界。
- workflow 通过 Gateway 调用平台 Skill，避免直接依赖具体平台实现。

### 最小可运行 workflow

最小链路需要覆盖以下顺序：

```text
ContentPackage
  -> PlanPlatforms
  -> AdaptByPlatformSkills
  -> ValidatePlatformDrafts
  -> HumanReviewHook 或 PublishOrMockPublish
  -> WorkflowResult
```

验收时至少准备一个输入内容包，选择两个平台，分别得到平台草稿和结果：

- `manual_review` 模式：生成草稿和校验结果后停在待审核状态。
- `mock` 模式：生成草稿、完成校验，并返回模拟发布结果。
