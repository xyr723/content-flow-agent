import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, "../..");

const { SkillGateway } = await import(
  pathToFileURL(resolve(projectRoot, ".test-build/src/core/skill-gateway.js"))
);
const { MockPlatformSkill } = await import(
  pathToFileURL(resolve(projectRoot, ".test-build/src/skills/mock-platform-skill.js"))
);
const { runContentPublishWorkflow } = await import(
  pathToFileURL(resolve(projectRoot, ".test-build/src/workflows/content-publish-workflow.js"))
);

function createGateway() {
  const gateway = new SkillGateway();
  gateway.register(new MockPlatformSkill("wechat", "微信公众号"));
  gateway.register(new MockPlatformSkill("zhihu", "知乎"));
  return gateway;
}

function createInput(publishMode) {
  return {
    sourceText: "一次输入，多平台生成草稿。",
    title: "内容发布工作流",
    images: [{ id: "image-1", type: "image", path: "assets/cover.png" }],
    videos: [],
    targetPlatforms: ["wechat", "zhihu"],
    publishMode,
  };
}

describe("runContentPublishWorkflow", () => {
  it("returns drafts and review-required results without publishing in manual_review mode", async () => {
    const result = await runContentPublishWorkflow(createInput("manual_review"), createGateway());

    assert.deepEqual(
      result.drafts.map((draft) => draft.platform),
      ["wechat", "zhihu"],
    );
    assert.deepEqual(
      result.validations.map((validation) => validation.ok),
      [true, true],
    );
    assert.deepEqual(
      result.publishResults.map((publishResult) => publishResult.status),
      ["review_required", "review_required"],
    );
  });

  it("adapts, validates, and mock-publishes all drafts in mock mode", async () => {
    const result = await runContentPublishWorkflow(createInput("mock"), createGateway());

    assert.deepEqual(
      result.publishResults.map((publishResult) => publishResult.platform),
      ["wechat", "zhihu"],
    );
    assert.deepEqual(
      result.publishResults.map((publishResult) => publishResult.status),
      ["mock_published", "mock_published"],
    );
    assert.deepEqual(
      result.publishResults.map((publishResult) => publishResult.url),
      ["https://example.com/mock/wechat", "https://example.com/mock/zhihu"],
    );
  });
});
