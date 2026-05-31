import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, "../..");

const {
  RealPublisher,
  createDefaultRealPublisherRegistry,
} = await import(
  pathToFileURL(resolve(projectRoot, ".test-build/src/publishing/real-publisher.js"))
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

describe("RealPublisher", () => {
  it("fails safely when real publishing is not explicitly configured", async () => {
    const publisher = new RealPublisher("wechat", "公众号");

    const result = await publisher.publish(createDraft("wechat"));

    assert.deepEqual(result, {
      platform: "wechat",
      status: "failed",
      message: "真实发布未配置: 公众号 需要显式配置发布凭据和执行器。",
    });
  });

  it("uses an explicit real publish handler when configured", async () => {
    const publisher = new RealPublisher("zhihu", "知乎", {
      async publish(draft) {
        return {
          platform: draft.platform,
          status: "mock_published",
          url: "https://real.example/zhihu/1",
          message: "真实发布执行器已调用",
        };
      },
    });

    const result = await publisher.publish(createDraft("zhihu"));

    assert.equal(result.url, "https://real.example/zhihu/1");
    assert.equal(result.message, "真实发布执行器已调用");
  });

  it("creates safe default real publishers for every supported platform", async () => {
    const registry = createDefaultRealPublisherRegistry();

    const results = await registry.publish([
      createDraft("wechat"),
      createDraft("zhihu"),
      createDraft("bilibili"),
      createDraft("xiaohongshu"),
      createDraft("douyin"),
    ]);

    assert.deepEqual(
      results.map((result) => result.status),
      ["failed", "failed", "failed", "failed", "failed"],
    );
    assert.match(results[0].message, /真实发布未配置/);
  });

  it("exports real publisher utilities from the package entry", () => {
    assert.equal(typeof publicApi.RealPublisher, "function");
    assert.equal(typeof publicApi.createDefaultRealPublisherRegistry, "function");
  });
});
