# First Workflow Example

这个示例展示第一步开发完成后，workflow 从统一内容输入到平台草稿和结果状态的最小链路。示例数据不依赖真实平台接口，适合用于本地测试、文档说明和后续 PR 对齐行为边界。

## Input: ContentPackage

```json
{
  "sourceText": "本周我们上线了内容发布工作流：一次输入内容，系统会按目标平台生成草稿，并在发布前保留人工审核或模拟发布结果。",
  "title": "内容发布工作流上线",
  "images": [
    {
      "id": "cover-001",
      "type": "image",
      "path": "assets/cover.png",
      "alt": "内容工作流示意图"
    }
  ],
  "videos": [],
  "targetPlatforms": ["wechat", "xiaohongshu"],
  "publishMode": "manual_review"
}
```

## Output: PlatformDrafts

### WeChat Draft

```json
{
  "platform": "wechat",
  "title": "内容发布工作流上线",
  "body": "本周我们上线了内容发布工作流：一次输入内容，系统会按目标平台生成草稿，并在发布前保留人工审核或模拟发布结果。",
  "summary": "一次输入，多平台生成草稿，并支持人工审核或模拟发布。",
  "tags": ["内容发布", "工作流", "平台适配"],
  "assets": ["cover-001"],
  "warnings": []
}
```

### Xiaohongshu Draft

```json
{
  "platform": "xiaohongshu",
  "title": "一次输入，多平台草稿生成",
  "body": "内容发布工作流已经上线。输入一份内容后，可以按平台生成不同风格的草稿，并在发布前进入人工审核或模拟发布。",
  "summary": "统一内容输入，自动生成平台草稿。",
  "tags": ["内容工具", "效率工具", "多平台发布"],
  "assets": ["cover-001"],
  "warnings": ["建议补充更生活化的封面图，提升小红书笔记表现。"]
}
```

## Result: manual_review

`manual_review` 模式下，workflow 不进入真实发布或模拟发布，只返回待审核状态。

```json
{
  "mode": "manual_review",
  "drafts": ["wechat", "xiaohongshu"],
  "results": [
    {
      "platform": "wechat",
      "status": "review_required",
      "message": "Waiting for human review before publishing."
    },
    {
      "platform": "xiaohongshu",
      "status": "review_required",
      "message": "Waiting for human review before publishing."
    }
  ]
}
```

## Result: mock

同一份 `ContentPackage` 把 `publishMode` 改为 `mock` 后，workflow 返回模拟发布结果。

```json
{
  "mode": "mock",
  "drafts": ["wechat", "xiaohongshu"],
  "results": [
    {
      "platform": "wechat",
      "status": "mock_published",
      "url": "https://example.com/mock/wechat",
      "message": "模拟发布成功"
    },
    {
      "platform": "xiaohongshu",
      "status": "mock_published",
      "url": "https://example.com/mock/xiaohongshu",
      "message": "模拟发布成功"
    }
  ]
}
```
