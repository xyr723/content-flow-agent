import type {
  ContentPackage,
  MediaAsset,
  PlatformId,
  PublishMode,
} from "../core/types.js";

const PLATFORM_ALIASES: Array<[RegExp, PlatformId]> = [
  [/公众号|微信/i, "wechat"],
  [/知乎/i, "zhihu"],
  [/b\s*站|bilibili/i, "bilibili"],
  [/小红书|xhs/i, "xiaohongshu"],
  [/抖音|douyin/i, "douyin"],
];

export type PlanContentPackageOptions = {
  title?: string;
  images?: MediaAsset[];
  videos?: MediaAsset[];
  targetPlatforms?: PlatformId[];
  publishMode?: PublishMode;
};

export function planContentPackage(
  sourceText: string,
  instruction: string,
  options: PlanContentPackageOptions = {},
): ContentPackage {
  const detectedPlatforms = PLATFORM_ALIASES
    .filter(([pattern]) => pattern.test(instruction))
    .map(([, platform]) => platform);

  return {
    sourceText,
    title: options.title,
    images: options.images ?? [],
    videos: options.videos ?? [],
    targetPlatforms:
      options.targetPlatforms ??
      (detectedPlatforms.length > 0 ? detectedPlatforms : ["wechat", "zhihu"]),
    publishMode:
      options.publishMode ??
      (/审核|确认|review/i.test(instruction) ? "manual_review" : "mock"),
  };
}
