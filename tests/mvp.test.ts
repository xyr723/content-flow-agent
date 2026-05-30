import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createDefaultSkillGateway,
  planContentPackage,
  runContentPublishWorkflow,
} from "../src/index.js";
import type { MediaAsset } from "../src/index.js";

describe("content flow MVP", () => {
  it("plans target platforms, review mode, and structured assets from an instruction", () => {
    const images: MediaAsset[] = [
      { id: "img-1", type: "image", path: "cover.png", alt: "封面图" },
    ];
    const videos: MediaAsset[] = [
      { id: "video-1", type: "video", path: "demo.mp4", alt: "演示视频" },
    ];

    const contentPackage = planContentPackage(
      "这是一篇关于内容复用的文章",
      "请发到公众号、知乎、小红书，视频发 B 站和抖音，先人工审核",
      { title: "内容复用指南", images, videos },
    );

    assert.deepEqual(contentPackage.targetPlatforms, [
      "wechat",
      "zhihu",
      "bilibili",
      "xiaohongshu",
      "douyin",
    ]);
    assert.equal(contentPackage.publishMode, "manual_review");
    assert.equal(contentPackage.title, "内容复用指南");
    assert.deepEqual(contentPackage.images, images);
    assert.deepEqual(contentPackage.videos, videos);
  });

  it("creates distinct platform drafts and stops before publishing in manual review mode", async () => {
    const gateway = createDefaultSkillGateway();
    const input = planContentPackage(
      "把一篇长文拆成多个平台版本，降低运营重复劳动。",
      "发到公众号、知乎、小红书、B 站和抖音，先审核",
      {
        title: "多平台内容分发",
        images: [{ id: "img-1", type: "image", path: "cover.png" }],
        videos: [{ id: "video-1", type: "video", path: "demo.mp4" }],
      },
    );

    const result = await runContentPublishWorkflow(input, gateway);

    assert.equal(result.drafts.length, 5);
    assert.deepEqual(
      result.validations.map((validation) => validation.ok),
      [true, true, true, true, true],
    );
    assert.equal(new Set(result.drafts.map((draft) => draft.title)).size, 5);
    assert.ok(
      result.drafts.find((draft) => draft.platform === "wechat")?.body.includes("公众号"),
    );
    assert.ok(
      result.drafts.find((draft) => draft.platform === "douyin")?.tags.includes("短视频"),
    );
    assert.deepEqual(
      result.publishResults.map((publishResult) => publishResult.status),
      [
        "review_required",
        "review_required",
        "review_required",
        "review_required",
        "review_required",
      ],
    );
  });

  it("mock publishes valid drafts and reports validation failures without publishing them", async () => {
    const gateway = createDefaultSkillGateway();
    const input = planContentPackage(
      "这是一篇只有图文素材的内容。",
      "发到公众号和 B 站",
      {
        title: "图文素材示例",
        images: [{ id: "img-1", type: "image", path: "cover.png" }],
      },
    );

    const result = await runContentPublishWorkflow(input, gateway);

    assert.deepEqual(
      result.validations.map((validation) => validation.ok),
      [true, false],
    );
    assert.deepEqual(
      result.publishResults.map((publishResult) => publishResult.status),
      ["mock_published", "failed"],
    );
    assert.equal(result.publishResults[0]?.url, "https://example.com/mock/wechat");
    assert.match(result.publishResults[1]?.message ?? "", /缺少视频素材/);
  });
});
