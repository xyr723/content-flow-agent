import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, "../..");

const { SkillGateway } = await import(
  pathToFileURL(resolve(projectRoot, ".test-build/src/core/skill-gateway.js"))
);
const { ExternalSkillAdapter } = await import(
  pathToFileURL(resolve(projectRoot, ".test-build/src/extensions/external-skill-adapter.js"))
);
const publicApi = await import(pathToFileURL(resolve(projectRoot, ".test-build/src/index.js")));

const input = {
  sourceText: "外部 Skill 生成平台草稿。",
  title: "外部扩展",
  images: [],
  videos: [],
  targetPlatforms: ["wechat"],
  publishMode: "mock",
};

describe("ExternalSkillAdapter", () => {
  it("adapts an external skill into the PlatformSkill protocol", async () => {
    const gateway = new SkillGateway();
    gateway.register(
      new ExternalSkillAdapter({
        platform: "wechat",
        displayName: "外部公众号 Skill",
        supportedMedia: ["text", "image"],
        async adapt(content) {
          return {
            platform: "wechat",
            title: `${content.title} / 外部`,
            body: content.sourceText,
            tags: ["外部"],
            assets: content.images,
            warnings: [],
          };
        },
      }),
    );

    const drafts = await gateway.adapt(input);

    assert.deepEqual(
      drafts.map((draft) => draft.title),
      ["外部扩展 / 外部"],
    );
  });

  it("uses internal validation and mock publishing when external hooks are absent", async () => {
    const adapter = new ExternalSkillAdapter({
      platform: "zhihu",
      displayName: "外部知乎 Skill",
      supportedMedia: ["text"],
      async adapt() {
        return {
          platform: "zhihu",
          title: "",
          body: "正文",
          tags: [],
          assets: [],
          warnings: ["外部提醒"],
        };
      },
    });
    const draft = await adapter.adapt({ ...input, targetPlatforms: ["zhihu"] });

    const validation = await adapter.validate(draft);
    const publishResult = await adapter.publish({ ...draft, title: "已补标题" });

    assert.deepEqual(validation.errors, ["标题不能为空"]);
    assert.deepEqual(validation.warnings, ["外部提醒", "建议至少添加一个标签"]);
    assert.equal(publishResult.status, "mock_published");
    assert.equal(publishResult.url, "https://example.com/mock/zhihu");
  });

  it("delegates optional external validate and publish hooks", async () => {
    const calls = [];
    const adapter = new ExternalSkillAdapter({
      platform: "douyin",
      displayName: "外部抖音 Skill",
      supportedMedia: ["text", "video"],
      async adapt() {
        return {
          platform: "douyin",
          title: "外部抖音",
          body: "正文",
          tags: ["外部"],
          assets: [],
          warnings: [],
        };
      },
      async validate(draft) {
        calls.push(`validate:${draft.platform}`);
        return { ok: true, errors: [], warnings: ["外部校验通过"] };
      },
      async publish(draft) {
        calls.push(`publish:${draft.platform}`);
        return {
          platform: draft.platform,
          status: "mock_published",
          url: "https://external.example/douyin",
          message: "外部发布成功",
        };
      },
    });
    const draft = await adapter.adapt({ ...input, targetPlatforms: ["douyin"] });

    const validation = await adapter.validate(draft);
    const publishResult = await adapter.publish(draft);

    assert.deepEqual(calls, ["validate:douyin", "publish:douyin"]);
    assert.deepEqual(validation.warnings, ["外部校验通过"]);
    assert.equal(publishResult.url, "https://external.example/douyin");
  });

  it("exports the adapter from the package entry", () => {
    assert.equal(typeof publicApi.ExternalSkillAdapter, "function");
  });
});
