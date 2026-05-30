import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, "../..");

const { SkillGateway } = await import(
  pathToFileURL(resolve(projectRoot, ".test-build/src/core/skill-gateway.js"))
);
const {
  adaptByPlatformSkillsNode,
  humanReviewHookNode,
  planPlatformsNode,
  publishOrMockPublishNode,
  runContentPublishWorkflow,
  validatePlatformDraftsNode,
} = await import(
  pathToFileURL(resolve(projectRoot, ".test-build/src/workflows/content-publish-workflow.js"))
);

function createInput(publishMode = "mock") {
  return {
    sourceText: "一次输入，多平台生成草稿。",
    title: "内容发布工作流",
    images: [{ id: "image-1", type: "image", path: "assets/cover.png" }],
    videos: [],
    targetPlatforms: ["wechat", "zhihu"],
    publishMode,
  };
}

function createSkill(platform, calls, valid = true) {
  return {
    id: platform,
    displayName: platform,
    supportedMedia: ["text", "image"],
    async adapt(input) {
      calls.adapt.push(platform);
      return {
        platform,
        title: `${input.title} ${platform}`,
        body: `${platform} 正文`,
        tags: [platform],
        assets: input.images,
        warnings: [],
      };
    },
    async validate(draft) {
      calls.validate.push(draft.platform);
      return valid
        ? { ok: true, errors: [], warnings: [] }
        : { ok: false, errors: [`${draft.platform} 校验失败`], warnings: [] };
    },
    async publish(draft) {
      calls.publish.push(draft.platform);
      return {
        platform: draft.platform,
        status: "mock_published",
        url: `https://example.com/mock/${draft.platform}`,
        message: `${draft.platform} 模拟发布成功`,
      };
    },
  };
}

function createGateway() {
  const calls = { adapt: [], validate: [], publish: [] };
  const gateway = new SkillGateway();
  gateway.register(createSkill("wechat", calls, true));
  gateway.register(createSkill("zhihu", calls, false));
  return { gateway, calls };
}

describe("content publish workflow nodes", () => {
  it("records deterministic workflow node steps", async () => {
    const { gateway } = createGateway();
    const result = await runContentPublishWorkflow(createInput("manual_review"), gateway);

    assert.deepEqual(
      result.steps.map((step) => step.node),
      [
        "plan_platforms",
        "adapt_by_platform_skills",
        "validate_platform_drafts",
        "human_review_hook",
      ],
    );
    assert.deepEqual(
      result.steps.map((step) => step.status),
      ["completed", "completed", "completed", "completed"],
    );
  });

  it("exposes nodes that can be tested independently", async () => {
    const { gateway, calls } = createGateway();
    const planned = planPlatformsNode(createInput("mock"));
    const drafts = await adaptByPlatformSkillsNode(planned, gateway);
    const validations = await validatePlatformDraftsNode(drafts, gateway);
    const reviewResults = humanReviewHookNode(drafts);
    const publishResults = await publishOrMockPublishNode(planned, drafts, validations, gateway);

    assert.deepEqual(drafts.map((draft) => draft.platform), ["wechat", "zhihu"]);
    assert.deepEqual(validations.map((validation) => validation.ok), [true, false]);
    assert.deepEqual(
      reviewResults.map((result) => result.status),
      ["review_required", "review_required"],
    );
    assert.deepEqual(
      publishResults.map((result) => result.status),
      ["mock_published", "failed"],
    );
    assert.deepEqual(calls.publish, ["wechat"]);
    assert.match(publishResults[1].message, /zhihu 校验失败/);
  });
});
