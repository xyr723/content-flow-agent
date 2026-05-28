export type PlatformId =
  | "wechat"
  | "zhihu"
  | "bilibili"
  | "xiaohongshu"
  | "douyin";

export type MediaType = "image" | "video";

export type PublishMode = "mock" | "manual_review" | "real";

export type MediaAsset = {
  id: string;
  type: MediaType;
  path: string;
  alt?: string;
};

export type ContentPackage = {
  sourceText: string;
  title?: string;
  images: MediaAsset[];
  videos: MediaAsset[];
  targetPlatforms: PlatformId[];
  publishMode: PublishMode;
};

export type PlatformDraft = {
  platform: PlatformId;
  title: string;
  body: string;
  summary?: string;
  tags: string[];
  assets: MediaAsset[];
  warnings: string[];
};

export type ValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export type PublishResult = {
  platform: PlatformId;
  status: "drafted" | "review_required" | "mock_published" | "failed";
  url?: string;
  message: string;
};

