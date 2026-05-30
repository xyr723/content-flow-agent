import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, "../..");

const { renderWorkbench } = await import(
  pathToFileURL(resolve(projectRoot, ".test-build/src/gui/render.js"))
);
const { createDemoContentPackage } = await import(
  pathToFileURL(resolve(projectRoot, ".test-build/src/gui/demo-data.js"))
);

const input = {
  sourceText: "一次输入，多平台生成内容草稿。",
  title: "内容发布工作流",
  images: [{ id: "cover", type: "image", path: "assets/cover.png", alt: "封面" }],
  videos: [],
  targetPlatforms: ["wechat", "zhihu"],
  publishMode: "manual_review",
};

const result = {
  drafts: [
    {
      platform: "wechat",
      title: "内容发布工作流",
      body: "公众号正文",
      summary: "摘要",
      tags: ["内容发布"],
      assets: input.images,
      warnings: [],
    },
    {
      platform: "zhihu",
      title: "内容发布工作流是怎样提升分发效率的？",
      body: "知乎正文",
      tags: ["效率工具"],
      assets: [],
      warnings: [],
    },
  ],
  validations: [
    { ok: true, errors: [], warnings: [] },
    { ok: true, errors: [], warnings: ["建议补充案例"] },
  ],
  publishResults: [
    { platform: "wechat", status: "review_required", message: "等待人工审核" },
    { platform: "zhihu", status: "review_required", message: "等待人工审核" },
  ],
};

describe("renderWorkbench", () => {
  it("renders Chinese workbench sections and platform drafts", () => {
    const html = renderWorkbench(input, result);

    assert.match(html, /内容包/);
    assert.match(html, /平台草稿/);
    assert.match(html, /审核与报告/);
    assert.match(html, /公众号/);
    assert.match(html, /知乎/);
    assert.match(html, /等待人工审核/);
  });

  it("escapes source content before rendering", () => {
    const html = renderWorkbench({ ...input, sourceText: "<script>bad</script>" }, result);

    assert.doesNotMatch(html, /<script>bad<\/script>/);
    assert.match(html, /&lt;script&gt;bad&lt;\/script&gt;/);
  });

  it("creates a Chinese demo content package targeting all five platforms", () => {
    const demo = createDemoContentPackage("mock");

    assert.equal(demo.publishMode, "mock");
    assert.deepEqual(demo.targetPlatforms, ["wechat", "zhihu", "xiaohongshu", "bilibili", "douyin"]);
    assert.match(demo.title, /内容发布工作流/);
    assert.ok(demo.images.length > 0);
    assert.ok(demo.videos.length > 0);
  });
});
