import type { ContentPackage, PublishMode } from "../core/types.js";

export function createDemoContentPackage(publishMode: PublishMode = "manual_review"): ContentPackage {
  return {
    sourceText:
      "本周我们完成了一个面向创作者的内容发布工作流。用户只需要输入一次内容，系统会根据不同平台生成标题、正文、摘要、标签和素材顺序，并在发布前保留人工审核与模拟发布结果。",
    title: "三天搭建多平台内容发布工作流",
    images: [{ id: "cover", type: "image", path: "assets/cover.png", alt: "内容工作流封面图" }],
    videos: [{ id: "demo", type: "video", path: "assets/demo.mp4", alt: "工作流演示视频" }],
    targetPlatforms: ["wechat", "zhihu", "xiaohongshu", "bilibili", "douyin"],
    publishMode,
  };
}
