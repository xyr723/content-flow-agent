import type { PlatformDraft, PlatformId, PublishResult } from "../core/types.js";

export interface Publisher {
  platform: PlatformId;
  displayName: string;
  publish(draft: PlatformDraft): Promise<PublishResult>;
}

export class MockPublisher implements Publisher {
  constructor(
    readonly platform: PlatformId,
    readonly displayName: string,
  ) {}

  async publish(draft: PlatformDraft): Promise<PublishResult> {
    return {
      platform: draft.platform,
      status: "mock_published",
      url: `https://example.com/mock/${draft.platform}`,
      message: `${this.displayName} 模拟发布成功`,
    };
  }
}

export class PublisherRegistry {
  private readonly publishers = new Map<PlatformId, Publisher>();

  register(publisher: Publisher): void {
    this.publishers.set(publisher.platform, publisher);
  }

  get(platform: PlatformId): Publisher {
    const publisher = this.publishers.get(platform);
    if (!publisher) {
      throw new Error(`Publisher is not registered: ${platform}`);
    }
    return publisher;
  }

  async publish(drafts: PlatformDraft[]): Promise<PublishResult[]> {
    return Promise.all(
      drafts.map((draft) => this.get(draft.platform).publish(draft)),
    );
  }
}

const DEFAULT_PUBLISHERS: Array<{ platform: PlatformId; displayName: string }> = [
  { platform: "wechat", displayName: "公众号" },
  { platform: "zhihu", displayName: "知乎" },
  { platform: "bilibili", displayName: "B 站" },
  { platform: "xiaohongshu", displayName: "小红书" },
  { platform: "douyin", displayName: "抖音" },
];

export function createDefaultPublisherRegistry(): PublisherRegistry {
  const registry = new PublisherRegistry();
  for (const publisher of DEFAULT_PUBLISHERS) {
    registry.register(new MockPublisher(publisher.platform, publisher.displayName));
  }
  return registry;
}
