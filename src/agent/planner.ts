import type { ContentPackage, PlatformId } from "../core/types.js";

const PLATFORM_ALIASES: Array<[RegExp, PlatformId]> = [
  [/公众号|微信/i, "wechat"],
  [/知乎/i, "zhihu"],
  [/b站|bilibili/i, "bilibili"],
  [/小红书|xhs/i, "xiaohongshu"],
  [/抖音|douyin/i, "douyin"],
];

export function planContentPackage(sourceText: string, instruction: string): ContentPackage {
  const targetPlatforms = PLATFORM_ALIASES
    .filter(([pattern]) => pattern.test(instruction))
    .map(([, platform]) => platform);

  return {
    sourceText,
    images: [],
    videos: [],
    targetPlatforms: targetPlatforms.length > 0 ? targetPlatforms : ["wechat", "zhihu"],
    publishMode: /审核|确认|review/i.test(instruction) ? "manual_review" : "mock",
  };
}
