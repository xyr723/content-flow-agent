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

