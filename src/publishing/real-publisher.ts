import type { PlatformDraft, PlatformId, PublishResult } from "../core/types.js";
import { PublisherRegistry, type Publisher } from "./publisher.js";

export type RealPublishHandler = {
  publish(draft: PlatformDraft): Promise<PublishResult>;
};

export class RealPublisher implements Publisher {
  constructor(
    readonly platform: PlatformId,
    readonly displayName: string,
    private readonly handler?: RealPublishHandler,
  ) {}

  async publish(draft: PlatformDraft): Promise<PublishResult> {
    if (!this.handler) {
      return {
        platform: draft.platform,
        status: "failed",
        message: `真实发布未配置: ${this.displayName} 需要显式配置发布凭据和执行器。`,
      };
    }

    return this.handler.publish(draft);
  }
}

const DEFAULT_REAL_PUBLISHERS: Array<{ platform: PlatformId; displayName: string }> = [
  { platform: "wechat", displayName: "公众号" },
  { platform: "zhihu", displayName: "知乎" },
  { platform: "bilibili", displayName: "B 站" },
  { platform: "xiaohongshu", displayName: "小红书" },
  { platform: "douyin", displayName: "抖音" },
];

export function createDefaultRealPublisherRegistry(): PublisherRegistry {
  const registry = new PublisherRegistry();
  for (const publisher of DEFAULT_REAL_PUBLISHERS) {
    registry.register(new RealPublisher(publisher.platform, publisher.displayName));
  }
  return registry;
}
