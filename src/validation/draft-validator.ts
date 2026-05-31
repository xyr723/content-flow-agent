import type {
  MediaType,
  PlatformDraft,
  PlatformId,
  ValidationResult,
} from "../core/types.js";

export type PlatformValidationProfile = {
  platform: PlatformId;
  displayName: string;
  requiredMedia?: MediaType;
};

const DEFAULT_PLATFORM_VALIDATION_PROFILES: PlatformValidationProfile[] = [
  { platform: "wechat", displayName: "公众号" },
  { platform: "zhihu", displayName: "知乎" },
  { platform: "xiaohongshu", displayName: "小红书" },
  { platform: "bilibili", displayName: "B 站", requiredMedia: "video" },
  { platform: "douyin", displayName: "抖音", requiredMedia: "video" },
];

function mediaName(type: MediaType): string {
  return type === "video" ? "视频" : "图片";
}

export class DraftValidator {
  private readonly profilesByPlatform: Map<PlatformId, PlatformValidationProfile>;

  constructor(profiles: PlatformValidationProfile[] = DEFAULT_PLATFORM_VALIDATION_PROFILES) {
    this.profilesByPlatform = new Map(
      profiles.map((profile) => [profile.platform, profile]),
    );
  }

  validate(draft: PlatformDraft): ValidationResult {
    const errors: string[] = [];
    const warnings = [...draft.warnings];

    if (draft.title.trim().length === 0) {
      errors.push("标题不能为空");
    }

    if (draft.body.trim().length === 0) {
      errors.push("正文不能为空");
    }

    const profile = this.profilesByPlatform.get(draft.platform);
    if (
      profile?.requiredMedia &&
      !draft.assets.some((asset) => asset.type === profile.requiredMedia)
    ) {
      const name = mediaName(profile.requiredMedia);
      errors.push(`缺少${name}素材: ${profile.displayName} 需要至少一个${name}素材`);
    }

    if (draft.tags.length === 0) {
      warnings.push("建议至少添加一个标签");
    }

    return {
      ok: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateAll(drafts: PlatformDraft[]): ValidationResult[] {
    return drafts.map((draft) => this.validate(draft));
  }
}

export function createDefaultDraftValidator(): DraftValidator {
  return new DraftValidator();
}
