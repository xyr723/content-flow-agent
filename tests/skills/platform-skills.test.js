import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, "../..");

const { createDefaultPlatformSkills, createDefaultSkillGateway } = await import(
  pathToFileURL(resolve(projectRoot, ".test-build/src/skills/platform-skills.js"))
);

const input = {
  sourceText: "一次输入，多平台生成内容草稿。",
  title: "内容发布工作流",
  images: [{ id: "cover", type: "image", path: "assets/cover.png", alt: "封面" }],
  videos: [{ id: "demo", type: "video", path: "assets/demo.mp4", alt: "演示视频" }],
  targetPlatforms: ["wechat", "zhihu", "xiaohongshu", "bilibili", "douyin"],
  publishMode: "mock",
};

describe("platform skills", () => {
  it("creates five platform skills", () => {
    assert.deepEqual(
      createDefaultPlatformSkills().map((skill) => skill.id),
      ["wechat", "zhihu", "xiaohongshu", "bilibili", "douyin"],
    );
  });

  it("adapts the same content with platform-specific titles and tags", async () => {
    const drafts = await Promise.all(
      createDefaultPlatformSkills().map((skill) => skill.adapt(input)),
    );

    assert.equal(new Set(drafts.map((draft) => draft.title)).size, 5);
    assert.ok(drafts.find((draft) => draft.platform === "wechat").summary);
    assert.ok(drafts.find((draft) => draft.platform === "xiaohongshu").warnings.length > 0);
    assert.ok(
      drafts.find((draft) => draft.platform === "bilibili").assets.some((asset) => asset.type === "video"),
    );
    assert.ok(drafts.find((draft) => draft.platform === "douyin").tags.includes("短视频"));
  });

  it("registers all default skills in a gateway", async () => {
    const gateway = createDefaultSkillGateway();
    const drafts = await gateway.adapt(input);

    assert.deepEqual(
      drafts.map((draft) => draft.platform),
      ["wechat", "zhihu", "xiaohongshu", "bilibili", "douyin"],
    );
  });
});
