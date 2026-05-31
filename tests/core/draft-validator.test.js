import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, "../..");

const { createDefaultDraftValidator } = await import(
  pathToFileURL(resolve(projectRoot, ".test-build/src/validation/draft-validator.js"))
);
const publicApi = await import(pathToFileURL(resolve(projectRoot, ".test-build/src/index.js")));

function createDraft(overrides = {}) {
  return {
    platform: "wechat",
    title: "内容发布工作流",
    body: "正文内容",
    tags: ["内容分发"],
    assets: [],
    warnings: [],
    ...overrides,
  };
}

describe("DraftValidator", () => {
  it("validates required draft fields without platform skills", () => {
    const validator = createDefaultDraftValidator();

    const result = validator.validate(
      createDraft({
        title: " ",
        body: "",
        tags: [],
      }),
    );

    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, ["标题不能为空", "正文不能为空"]);
    assert.deepEqual(result.warnings, ["建议至少添加一个标签"]);
  });

  it("enforces platform media requirements", () => {
    const validator = createDefaultDraftValidator();

    const result = validator.validate(
      createDraft({
        platform: "douyin",
        assets: [{ id: "cover", type: "image", path: "assets/cover.png" }],
      }),
    );

    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, ["缺少视频素材: 抖音 需要至少一个视频素材"]);
  });

  it("keeps draft warnings in validation warnings", () => {
    const validator = createDefaultDraftValidator();

    const result = validator.validate(
      createDraft({
        warnings: ["平台适配提醒"],
      }),
    );

    assert.equal(result.ok, true);
    assert.deepEqual(result.warnings, ["平台适配提醒"]);
  });

  it("exports the validator from the package entry", () => {
    assert.equal(typeof publicApi.createDefaultDraftValidator, "function");
    assert.equal(typeof publicApi.DraftValidator, "function");
  });
});
