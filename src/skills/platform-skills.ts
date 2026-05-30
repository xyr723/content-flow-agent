import { SkillGateway } from "../core/skill-gateway.js";
import type { PlatformSkill } from "../core/platform-skill.js";
import type {
  ContentPackage,
  MediaAsset,
  PlatformDraft,
  PlatformId,
  PublishResult,
  ValidationResult,
} from "../core/types.js";

type PlatformProfile = {
  id: PlatformId;
  displayName: string;
  supportedMedia: PlatformSkill["supportedMedia"];
  makeTitle(input: ContentPackage): string;
  makeBody(input: ContentPackage): string;
  makeSummary?: (input: ContentPackage) => string;
  makeTags(input: ContentPackage): string[];
  selectAssets(input: ContentPackage): MediaAsset[];
  makeWarnings?: (input: ContentPackage) => string[];
};

const firstSentence = (text: string): string => text.split(/[。！？]/)[0] || text;

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
    return {
      platform: this.id,
      title: this.profile.makeTitle(input),
      body: this.profile.makeBody(input),
      summary: this.profile.makeSummary?.(input),
      tags: this.profile.makeTags(input),
      assets: this.profile.selectAssets(input),
      warnings: this.profile.makeWarnings?.(input) ?? [],
    };
  }

  async validate(draft: PlatformDraft): Promise<ValidationResult> {
    const errors = [
      ...(draft.title.trim().length === 0 ? ["标题不能为空"] : []),
      ...(draft.body.trim().length === 0 ? ["正文不能为空"] : []),
    ];

    return {
      ok: errors.length === 0,
      errors,
      warnings: [
        ...draft.warnings,
        ...(draft.tags.length === 0 ? ["建议至少添加一个标签"] : []),
      ],
    };
  }

  async publish(draft: PlatformDraft): Promise<PublishResult> {
    return {
      platform: draft.platform,
      status: "mock_published",
      url: `https://example.com/mock/${draft.platform}`,
      message: `${this.displayName}模拟发布成功`,
    };
  }
}

const profiles: PlatformProfile[] = [
  {
    id: "wechat",
    displayName: "公众号",
    supportedMedia: ["text", "image"],
    makeTitle: (input) => input.title ?? "公众号图文草稿",
    makeBody: (input) => `导语：${firstSentence(input.sourceText)}。\n\n${input.sourceText}`,
    makeSummary: (input) => `摘要：${firstSentence(input.sourceText)}。`,
    makeTags: () => ["内容发布", "工作流", "创作者工具"],
    selectAssets: (input) => input.images,
  },
  {
    id: "zhihu",
    displayName: "知乎",
    supportedMedia: ["text", "image"],
    makeTitle: (input) => `${input.title ?? "内容发布工作流"}是怎样提升分发效率的？`,
    makeBody: (input) => `先说结论：${firstSentence(input.sourceText)}。\n\n经验拆解：\n${input.sourceText}`,
    makeSummary: (input) => firstSentence(input.sourceText),
    makeTags: () => ["效率工具", "内容运营", "工作流"],
    selectAssets: (input) => input.images,
  },
  {
    id: "xiaohongshu",
    displayName: "小红书",
    supportedMedia: ["text", "image", "video"],
    makeTitle: () => "一次输入，多平台草稿自动生成",
    makeBody: (input) => `${input.sourceText}\n\n适合创作者和运营团队快速整理发布素材。`,
    makeSummary: () => "统一输入，自动生成平台草稿。",
    makeTags: () => ["效率提升", "运营日常", "内容工具"],
    selectAssets: (input) => [...input.images, ...input.videos],
    makeWarnings: () => ["建议补充更生活化的封面文案"],
  },
  {
    id: "bilibili",
    displayName: "哔哩哔哩",
    supportedMedia: ["text", "video"],
    makeTitle: (input) => `${input.title ?? "内容发布工作流"}｜工具演示`,
    makeBody: (input) => `视频简介：${input.sourceText}\n\n分区建议：知识 / 职业职场`,
    makeSummary: () => "视频平台发布说明和分区建议。",
    makeTags: () => ["工具演示", "开发记录", "内容运营"],
    selectAssets: (input) => input.videos,
  },
  {
    id: "douyin",
    displayName: "抖音",
    supportedMedia: ["text", "video"],
    makeTitle: () => "多平台发布提效方法",
    makeBody: (input) => `${firstSentence(input.sourceText)}。\n封面文案：一次输入，全平台草稿。`,
    makeSummary: () => "短视频发布文案。",
    makeTags: () => ["短视频", "创作者", "效率"],
    selectAssets: (input) => input.videos,
  },
];

export function createDefaultPlatformSkills(): PlatformSkill[] {
  return profiles.map((profile) => new ProfiledPlatformSkill(profile));
}

export function createDefaultSkillGateway(): SkillGateway {
  const gateway = new SkillGateway();
  for (const skill of createDefaultPlatformSkills()) {
    gateway.register(skill);
  }
  return gateway;
}
