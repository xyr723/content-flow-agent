import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, "../..");

const { SkillGateway } = await import(
  pathToFileURL(resolve(projectRoot, ".test-build/src/core/skill-gateway.js"))
);
const { MockPublisher, PublisherRegistry } = await import(
  pathToFileURL(resolve(projectRoot, ".test-build/src/publishing/publisher.js"))
);
const { runReviewedPublishWorkflow } = await import(
  pathToFileURL(resolve(projectRoot, ".test-build/src/workflows/content-publish-workflow.js"))
);

function createInput() {
  return {
    sourceText: "一次输入，多平台生成草稿。",
    title: "内容发布工作流",
    images: [{ id: "image-1", type: "image", path: "assets/cover.png" }],
    videos: [],
    targetPlatforms: ["wechat", "zhihu"],
    publishMode: "manual_review",
  };
}

function createGateway(validateDraft = () => true) {
  const calls = { adapt: [], validate: [], publish: [], publisher: [] };
  const gateway = new SkillGateway();

  for (const platform of ["wechat", "zhihu"]) {
    gateway.register({
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
        calls.validate.push({ platform: draft.platform, title: draft.title });
        const ok = validateDraft(draft);
        return ok
          ? { ok: true, errors: [], warnings: [] }
          : { ok: false, errors: [`${draft.platform} 标题未审核`], warnings: [] };
      },
      async publish(draft) {
        calls.publish.push({ platform: draft.platform, title: draft.title });
        return {
          platform: draft.platform,
          status: "mock_published",
          url: `https://example.com/mock/${draft.platform}`,
          message: `${draft.platform} 模拟发布成功`,
        };
      },
    });
  }

  return { gateway, calls };
}

function createPublisherRegistry(calls) {
  const registry = new PublisherRegistry();
  for (const platform of ["wechat", "zhihu"]) {
    registry.register({
      ...new MockPublisher(platform, platform),
      async publish(draft) {
        calls.publisher.push({ platform: draft.platform, title: draft.title });
        return {
          platform: draft.platform,
          status: "mock_published",
          url: `https://example.com/mock/${draft.platform}`,
          message: `${draft.platform} publisher 发布成功`,
        };
      },
    });
  }
  return registry;
}

describe("review interactions", () => {
  it("publishes approved drafts after manual review", async () => {
    const { gateway, calls } = createGateway();
    const publishers = createPublisherRegistry(calls);

    const result = await runReviewedPublishWorkflow(
      createInput(),
      gateway,
      [
        { platform: "wechat", action: "approve" },
        { platform: "zhihu", action: "approve" },
      ],
      publishers,
    );

    assert.deepEqual(
      result.reviewResults.map((review) => review.status),
      ["approved", "approved"],
    );
    assert.deepEqual(
      result.publishResults.map((publishResult) => publishResult.status),
      ["mock_published", "mock_published"],
    );
    assert.deepEqual(
      calls.publish.map((call) => call.platform),
      [],
    );
    assert.deepEqual(
      calls.publisher.map((call) => call.platform),
      ["wechat", "zhihu"],
    );
    assert.ok(result.steps.some((step) => step.node === "apply_review_decisions"));
  });

  it("rejects a draft without publishing it", async () => {
    const { gateway, calls } = createGateway();
    const publishers = createPublisherRegistry(calls);

    const result = await runReviewedPublishWorkflow(
      createInput(),
      gateway,
      [
        { platform: "wechat", action: "approve" },
        { platform: "zhihu", action: "reject", reason: "内容不适合知乎" },
      ],
      publishers,
    );

    assert.deepEqual(
      result.publishResults.map((publishResult) => publishResult.status),
      ["mock_published", "rejected"],
    );
    assert.deepEqual(calls.publish.map((call) => call.platform), []);
    assert.deepEqual(calls.publisher.map((call) => call.platform), ["wechat"]);
    assert.match(result.publishResults[1].message, /内容不适合知乎/);
  });

  it("applies edited drafts and revalidates them before publishing", async () => {
    const { gateway, calls } = createGateway((draft) => draft.title.includes("已审核"));
    const publishers = createPublisherRegistry(calls);

    const result = await runReviewedPublishWorkflow(
      createInput(),
      gateway,
      [
        {
          platform: "wechat",
          action: "edit",
          patch: { title: "内容发布工作流 wechat 已审核" },
        },
        {
          platform: "zhihu",
          action: "edit",
          patch: { title: "内容发布工作流 zhihu 已审核" },
        },
      ],
      publishers,
    );

    assert.deepEqual(
      result.reviewResults.map((review) => review.status),
      ["edited", "edited"],
    );
    assert.deepEqual(
      result.validations.map((validation) => validation.ok),
      [true, true],
    );
    assert.deepEqual(
      calls.publish.map((call) => call.title),
      [],
    );
    assert.deepEqual(
      calls.publisher.map((call) => call.title),
      ["内容发布工作流 wechat 已审核", "内容发布工作流 zhihu 已审核"],
    );
  });

  it("blocks publishing when a review edit fails independent validation", async () => {
    const { gateway, calls } = createGateway();
    const publishers = createPublisherRegistry(calls);

    const result = await runReviewedPublishWorkflow(
      createInput(),
      gateway,
      [
        { platform: "wechat", action: "approve" },
        {
          platform: "zhihu",
          action: "edit",
          patch: { title: " " },
        },
      ],
      publishers,
    );

    assert.deepEqual(
      result.publishResults.map((publishResult) => publishResult.status),
      ["mock_published", "failed"],
    );
    assert.deepEqual(calls.publish.map((call) => call.platform), []);
    assert.deepEqual(calls.publisher.map((call) => call.platform), ["wechat"]);
    assert.match(result.publishResults[1].message, /标题不能为空/);
  });
});
