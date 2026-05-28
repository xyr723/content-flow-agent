import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, "../..");

const { SkillGateway } = await import(
  pathToFileURL(resolve(projectRoot, ".test-build/src/core/skill-gateway.js"))
);

function createContentPackage(targetPlatforms) {
  return {
    sourceText: "跨平台发布内容",
    title: "发布标题",
    images: [{ id: "image-1", type: "image", path: "/tmp/image.png" }],
    videos: [],
    targetPlatforms,
    publishMode: "mock",
  };
}

function createDraft(platform, suffix = "") {
  return {
    platform,
    title: `${platform} 标题${suffix}`,
    body: `${platform} 正文${suffix}`,
    tags: [platform],
    assets: [],
    warnings: [],
  };
}

function createSkill(platform, calls) {
  return {
    id: platform,
    displayName: platform,
    supportedMedia: ["text", "image"],
    async adapt(input) {
      calls.adapt.push({ platform, input });
      return createDraft(platform);
    },
    async validate(draft) {
      calls.validate.push({ platform, draft });
      return { ok: true, errors: [], warnings: [] };
    },
    async publish(draft) {
      calls.publish.push({ platform, draft });
      return {
        platform,
        status: "mock_published",
        url: `https://example.test/${platform}`,
        message: `${platform} published`,
      };
    },
  };
}

test("注册 skill 后可按目标平台 adapt", async () => {
  const calls = { adapt: [], validate: [], publish: [] };
  const gateway = new SkillGateway();
  const input = createContentPackage(["wechat", "zhihu"]);

  gateway.register(createSkill("wechat", calls));
  gateway.register(createSkill("zhihu", calls));

  const drafts = await gateway.adapt(input);

  assert.deepEqual(
    drafts.map((draft) => draft.platform),
    ["wechat", "zhihu"],
  );
  assert.deepEqual(
    calls.adapt.map((call) => call.platform),
    ["wechat", "zhihu"],
  );
  assert.equal(calls.adapt[0].input, input);
  assert.equal(calls.adapt[1].input, input);
});

test("publish 会按 draft.platform 路由到对应 skill", async () => {
  const calls = { adapt: [], validate: [], publish: [] };
  const gateway = new SkillGateway();
  const wechatDraft = createDraft("wechat", " A");
  const zhihuDraft = createDraft("zhihu", " B");

  gateway.register(createSkill("wechat", calls));
  gateway.register(createSkill("zhihu", calls));

  const results = await gateway.publish([zhihuDraft, wechatDraft]);

  assert.deepEqual(
    calls.publish.map((call) => call.platform),
    ["zhihu", "wechat"],
  );
  assert.equal(calls.publish[0].draft, zhihuDraft);
  assert.equal(calls.publish[1].draft, wechatDraft);
  assert.deepEqual(
    results.map((result) => result.platform),
    ["zhihu", "wechat"],
  );
});

test("未注册平台抛出明确错误", async () => {
  const gateway = new SkillGateway();

  assert.throws(
    () => gateway.get("douyin"),
    /Platform skill is not registered: douyin/,
  );

  await assert.rejects(
    () => gateway.adapt(createContentPackage(["xiaohongshu"])),
    /Platform skill is not registered: xiaohongshu/,
  );

  await assert.rejects(
    () => gateway.publish([createDraft("bilibili")]),
    /Platform skill is not registered: bilibili/,
  );
});
