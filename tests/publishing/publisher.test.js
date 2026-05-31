import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, "../..");

const {
  MockPublisher,
  PublisherRegistry,
  createDefaultPublisherRegistry,
} = await import(
  pathToFileURL(resolve(projectRoot, ".test-build/src/publishing/publisher.js"))
);
const publicApi = await import(pathToFileURL(resolve(projectRoot, ".test-build/src/index.js")));

function createDraft(platform = "wechat") {
  return {
    platform,
    title: `${platform} 草稿`,
    body: `${platform} 正文`,
    tags: [platform],
    assets: [],
    warnings: [],
  };
}

describe("Publisher abstraction", () => {
  it("mock publishes drafts with stable platform URLs", async () => {
    const publisher = new MockPublisher("wechat", "公众号");

    const result = await publisher.publish(createDraft("wechat"));

    assert.deepEqual(result, {
      platform: "wechat",
      status: "mock_published",
      url: "https://example.com/mock/wechat",
      message: "公众号 模拟发布成功",
    });
  });

  it("routes publish requests by draft platform", async () => {
    const registry = new PublisherRegistry();
    registry.register(new MockPublisher("wechat", "公众号"));
    registry.register(new MockPublisher("zhihu", "知乎"));

    const results = await registry.publish([createDraft("zhihu"), createDraft("wechat")]);

    assert.deepEqual(
      results.map((result) => result.platform),
      ["zhihu", "wechat"],
    );
    assert.deepEqual(
      results.map((result) => result.url),
      ["https://example.com/mock/zhihu", "https://example.com/mock/wechat"],
    );
  });

  it("fails clearly when a publisher is missing", async () => {
    const registry = new PublisherRegistry();

    assert.throws(
      () => registry.get("douyin"),
      /Publisher is not registered: douyin/,
    );

    await assert.rejects(
      () => registry.publish([createDraft("bilibili")]),
      /Publisher is not registered: bilibili/,
    );
  });

  it("creates default publishers for every supported platform", async () => {
    const registry = createDefaultPublisherRegistry();

    const results = await registry.publish([
      createDraft("wechat"),
      createDraft("zhihu"),
      createDraft("bilibili"),
      createDraft("xiaohongshu"),
      createDraft("douyin"),
    ]);

    assert.deepEqual(
      results.map((result) => result.platform),
      ["wechat", "zhihu", "bilibili", "xiaohongshu", "douyin"],
    );
  });

  it("exports publishers from the package entry", () => {
    assert.equal(typeof publicApi.MockPublisher, "function");
    assert.equal(typeof publicApi.PublisherRegistry, "function");
    assert.equal(typeof publicApi.createDefaultPublisherRegistry, "function");
  });
});
