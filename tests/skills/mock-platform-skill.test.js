import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, "../..");

const { MockPlatformSkill } = await import(
  pathToFileURL(resolve(projectRoot, ".test-build/src/skills/mock-platform-skill.js"))
);

const input = {
  sourceText: "这是一段用于多平台分发的原始内容。",
  title: "原始标题",
  images: [{ id: "image-1", type: "image", path: "/tmp/image.png", alt: "配图" }],
  videos: [{ id: "video-1", type: "video", path: "/tmp/video.mp4" }],
  targetPlatforms: ["zhihu"],
  publishMode: "mock",
};

describe("MockPlatformSkill", () => {
  it("adapts content into a platform-specific draft while preserving input assets", async () => {
    const skill = new MockPlatformSkill("zhihu", "知乎");

    const draft = await skill.adapt(input);

    assert.equal(draft.platform, "zhihu");
    assert.equal(draft.title, "原始标题");
    assert.equal(draft.body, "[知乎] 这是一段用于多平台分发的原始内容。");
    assert.deepEqual(draft.tags, ["知乎", "内容分发"]);
    assert.deepEqual(draft.assets, [...input.images, ...input.videos]);
  });

  it("uses a stable platform title when input has no title", async () => {
    const skill = new MockPlatformSkill("wechat", "微信公众号");

    const draft = await skill.adapt({ ...input, title: undefined, targetPlatforms: ["wechat"] });

    assert.equal(draft.title, "微信公众号 发布草稿");
  });

  it("reports validation errors for empty title and body", async () => {
    const skill = new MockPlatformSkill("douyin", "抖音");

    const result = await skill.validate({
      platform: "douyin",
      title: "",
      body: "",
      tags: ["抖音"],
      assets: [],
      warnings: [],
    });

    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, ["标题不能为空", "正文不能为空"]);
  });

  it("reports a validation warning when tags are missing", async () => {
    const skill = new MockPlatformSkill("bilibili", "哔哩哔哩");

    const result = await skill.validate({
      platform: "bilibili",
      title: "标题",
      body: "正文",
      tags: [],
      assets: [],
      warnings: [],
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.warnings, ["建议至少添加一个标签"]);
  });

  it("publishes to a stable mock URL", async () => {
    const skill = new MockPlatformSkill("xiaohongshu", "小红书");

    const result = await skill.publish({
      platform: "xiaohongshu",
      title: "标题",
      body: "正文",
      tags: ["小红书"],
      assets: [],
      warnings: [],
    });

    assert.equal(result.platform, "xiaohongshu");
    assert.equal(result.status, "mock_published");
    assert.equal(result.url, "https://example.com/mock/xiaohongshu");
  });
});
