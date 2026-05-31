import { SkillGateway } from "../core/skill-gateway.js";
import type { PlatformSkill } from "../core/platform-skill.js";
import type {
  ContentPackage,
  MediaAsset,
  MediaType,
  PlatformDraft,
  PlatformId,
  PublishResult,
  ValidationResult,
} from "../core/types.js";
import { createDefaultDraftValidator } from "../validation/draft-validator.js";

type PlatformProfile = {
  id: PlatformId;
  displayName: string;
  supportedMedia: PlatformSkill["supportedMedia"];
  requiredMedia?: MediaType;
  tags: string[];
  createTitle(input: ContentPackage): string;
  createBody(input: ContentPackage): string;
  createSummary(input: ContentPackage): string;
};

const MAX_TITLE_LENGTH = 40;
const draftValidator = createDefaultDraftValidator();

function compactText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1)}...`
    : normalized;
}

function baseTitle(input: ContentPackage): string {
  const title = input.title?.trim();
  if (title) {
    return compactText(title, MAX_TITLE_LENGTH);
  }

  return compactText(input.sourceText, 20) || "未命名内容";
}

function pickAssets(input: ContentPackage, supportedMedia: PlatformSkill["supportedMedia"]): MediaAsset[] {
  return [...input.images, ...input.videos].filter((asset) =>
    supportedMedia.includes(asset.type),
  );
}

function countByType(assets: MediaAsset[], type: MediaType): number {
  return assets.filter((asset) => asset.type === type).length;
}

class ProfiledPlatformSkill implements PlatformSkill {
  readonly id: PlatformId;
  readonly displayName: string;
  readonly supportedMedia: PlatformSkill["supportedMedia"];

  constructor(private readonly profile: PlatformProfile) {
    this.id = profile.id;
    this.displayName = profile.displayName;
    this.supportedMedia = profile.supportedMedia;
  }

  async adapt(input: ContentPackage): Promise<PlatformDraft> {
    const assets = pickAssets(input, this.supportedMedia);
    const warnings =
      this.profile.requiredMedia && countByType(assets, this.profile.requiredMedia) === 0
        ? [`${this.displayName} 缺少${this.profile.requiredMedia === "video" ? "视频" : "图片"}素材`]
        : [];

    return {
      platform: this.id,
      title: this.profile.createTitle(input),
      body: this.profile.createBody(input),
      summary: this.profile.createSummary(input),
      tags: this.profile.tags,
      assets,
      warnings,
    };
  }

  async validate(draft: PlatformDraft): Promise<ValidationResult> {
    return draftValidator.validate(draft);
  }

  async publish(draft: PlatformDraft): Promise<PublishResult> {
    return {
      platform: draft.platform,
      status: "mock_published",
      url: `https://example.com/mock/${draft.platform}`,
      message: `${this.displayName} 模拟发布成功`,
    };
  }
}

const PLATFORM_PROFILES: PlatformProfile[] = [
  {
    id: "wechat",
    displayName: "公众号",
    supportedMedia: ["text", "image"],
    tags: ["公众号", "长文", "内容分发"],
    createTitle: (input) => `${baseTitle(input)} | 公众号长文版`,
    createSummary: (input) => compactText(input.sourceText, 80),
    createBody: (input) =>
      `# ${baseTitle(input)}\n\n公众号导语：适合沉淀为可收藏的长文。\n\n${input.sourceText}\n\n配图顺序：${input.images.map((image) => image.path).join("、") || "暂无配图"}`,
  },
  {
    id: "zhihu",
    displayName: "知乎",
    supportedMedia: ["text", "image"],
    tags: ["知乎", "经验分享", "内容运营"],
    createTitle: (input) => `${baseTitle(input)}：为什么值得关注？`,
    createSummary: (input) => compactText(input.sourceText, 90),
    createBody: (input) =>
      `问题背景：${input.sourceText}\n\n核心观点：把原始内容拆成适合平台阅读的结构。\n\n结论：先保证内容清晰，再做平台风格适配。`,
  },
  {
    id: "xiaohongshu",
    displayName: "小红书",
    supportedMedia: ["text", "image", "video"],
    tags: ["小红书", "种草笔记", "内容分发"],
    createTitle: (input) => `${baseTitle(input)} | 3 个实用看点`,
    createSummary: (input) => compactText(input.sourceText, 60),
    createBody: (input) =>
      `${compactText(input.sourceText, 120)}\n\n封面文案：${baseTitle(input)}\n\n#小红书 #内容分发 #运营效率`,
  },
  {
    id: "bilibili",
    displayName: "B 站",
    supportedMedia: ["text", "image", "video"],
    requiredMedia: "video",
    tags: ["B站", "视频", "内容分发"],
    createTitle: (input) => `${baseTitle(input)} | 视频版`,
    createSummary: (input) => compactText(input.sourceText, 70),
    createBody: (input) =>
      `视频简介：${compactText(input.sourceText, 140)}\n\n封面建议：突出主题“${baseTitle(input)}”。\n\n分区建议：知识 / 职业职场。`,
  },
  {
    id: "douyin",
    displayName: "抖音",
    supportedMedia: ["text", "image", "video"],
    requiredMedia: "video",
    tags: ["抖音", "短视频", "热点"],
    createTitle: (input) => `60 秒看懂：${compactText(baseTitle(input), 24)}`,
    createSummary: (input) => compactText(input.sourceText, 50),
    createBody: (input) =>
      `${compactText(input.sourceText, 80)}\n\n封面文案：先看这一条\n\n#抖音 #短视频 #内容效率`,
  },
];

export function createDefaultPlatformSkills(): PlatformSkill[] {
  return PLATFORM_PROFILES.map((profile) => new ProfiledPlatformSkill(profile));
}

export function createDefaultSkillGateway(): SkillGateway {
  const gateway = new SkillGateway();
  for (const skill of createDefaultPlatformSkills()) {
    gateway.register(skill);
  }
  return gateway;
}
