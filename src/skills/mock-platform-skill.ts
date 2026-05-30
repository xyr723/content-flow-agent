import type { PlatformSkill } from "../core/platform-skill.js";
import type {
  ContentPackage,
  PlatformDraft,
  PlatformId,
  PublishResult,
  ValidationResult,
} from "../core/types.js";

export class MockPlatformSkill implements PlatformSkill {
  readonly supportedMedia: PlatformSkill["supportedMedia"] = ["text", "image", "video"];
  readonly id: PlatformId;
  readonly displayName: string;

  constructor(id: PlatformId, displayName: string) {
    this.id = id;
    this.displayName = displayName;
  }

  async adapt(input: ContentPackage): Promise<PlatformDraft> {
    return {
      platform: this.id,
      title: input.title ?? `${this.displayName} 发布草稿`,
      body: `[${this.displayName}] ${input.sourceText}`,
      tags: [this.displayName, "内容分发"],
      assets: [...input.images, ...input.videos],
      warnings: [],
    };
  }

  async validate(draft: PlatformDraft): Promise<ValidationResult> {
    const errors = [
      ...(draft.title.length === 0 ? ["标题不能为空"] : []),
      ...(draft.body.length === 0 ? ["正文不能为空"] : []),
    ];

    return {
      ok: errors.length === 0,
      errors,
      warnings: draft.tags.length === 0 ? ["建议至少添加一个标签"] : [],
    };
  }

  async publish(draft: PlatformDraft): Promise<PublishResult> {
    return {
      platform: draft.platform,
      status: "mock_published",
      url: `https://example.com/mock/${draft.platform}`,
      message: "模拟发布成功",
    };
  }
}
