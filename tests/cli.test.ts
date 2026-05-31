import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";

function runCli(args: string[]) {
  return spawnSync(process.execPath, ["dist/src/cli.js", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

describe("cli", () => {
  it("runs the full workflow from command line arguments", () => {
    const result = runCli([
      "--text",
      "这是一份用于多平台分发的正文。",
      "--instruction",
      "发到公众号和 B 站",
      "--title",
      "CLI 主流程",
      "--image",
      "cover.png",
      "--video",
      "demo.mp4",
    ]);

    assert.equal(result.status, 0, result.stderr);

    const report = JSON.parse(result.stdout);
    assert.deepEqual(
      report.drafts.map((draft: { platform: string }) => draft.platform),
      ["wechat", "bilibili"],
    );
    assert.deepEqual(
      report.publishResults.map((publishResult: { status: string }) => publishResult.status),
      ["mock_published", "mock_published"],
    );
  });

  it("runs the workflow with the hybrid planner fast path", () => {
    const result = runCli([
      "--text",
      "这是一份用于多平台分发的正文。",
      "--instruction",
      "发到公众号和知乎，先审核",
      "--planner",
      "hybrid",
    ]);

    assert.equal(result.status, 0, result.stderr);

    const report = JSON.parse(result.stdout);
    assert.deepEqual(
      report.drafts.map((draft: { platform: string }) => draft.platform),
      ["wechat", "zhihu"],
    );
    assert.deepEqual(
      report.publishResults.map((publishResult: { status: string }) => publishResult.status),
      ["review_required", "review_required"],
    );
  });

  it("runs real publish preflight mode from the command line", () => {
    const result = runCli([
      "--text",
      "这是一份用于真实发布预检的正文。",
      "--instruction",
      "发到公众号",
      "--mode",
      "real",
    ]);

    assert.equal(result.status, 0, result.stderr);

    const report = JSON.parse(result.stdout);
    assert.deepEqual(
      report.publishResults.map((publishResult: { status: string }) => publishResult.status),
      ["failed"],
    );
    assert.match(
      report.publishResults[0].message,
      /真实发布未配置: 公众号 需要显式配置发布凭据和执行器/,
    );
  });

  it("rejects unsupported planner modes", () => {
    const result = runCli([
      "--text",
      "正文",
      "--instruction",
      "发到公众号",
      "--planner",
      "unknown",
    ]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /--planner only supports rules, hybrid, or langchain/);
  });

  it("prints usage and exits with failure when required arguments are missing", () => {
    const result = runCli(["--instruction", "发到公众号"]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /--text/);
    assert.match(result.stderr, /--instruction/);
  });
});
