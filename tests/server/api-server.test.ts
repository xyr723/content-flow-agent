import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";

import {
  createContentFlowServer,
  createContentPackageFromWorkflowRequest,
} from "../../src/server/api-server.js";

async function withServer(
  callback: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = createContentFlowServer({ rootDir: process.cwd() });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, resolve);
  });

  const address = server.address() as AddressInfo;
  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => (error ? reject(error) : resolve()));
    });
  }
}

describe("content flow API server", () => {
  it("creates workflow input from explicit GUI payload", () => {
    const input = createContentPackageFromWorkflowRequest({
      title: "后端闭环演示",
      sourceText: "这是一段用于后端 API 的正文。",
      targetPlatforms: ["wechat", "bilibili"],
      publishMode: "mock",
      images: ["cover.png"],
      videos: ["demo.mp4"],
    });

    assert.equal(input.title, "后端闭环演示");
    assert.equal(input.publishMode, "mock");
    assert.deepEqual(input.targetPlatforms, ["wechat", "bilibili"]);
    assert.deepEqual(input.images, [{ id: "image-1", type: "image", path: "cover.png" }]);
    assert.deepEqual(input.videos, [{ id: "video-1", type: "video", path: "demo.mp4" }]);
  });

  it("serves health and runs workflow through HTTP", async () => {
    await withServer(async (baseUrl) => {
      const health = await fetch(`${baseUrl}/api/health`);
      assert.equal(health.status, 200);
      assert.deepEqual(await health.json(), { ok: true, service: "content-flow-agent" });

      const response = await fetch(`${baseUrl}/api/workflow/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "真实发布预检",
          sourceText: "这是一段用于真实发布预检的正文。",
          targetPlatforms: ["wechat"],
          publishMode: "real",
        }),
      });

      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.ok, true);
      assert.equal(payload.input.publishMode, "real");
      assert.deepEqual(
        payload.result.publishResults.map((result: { status: string }) => result.status),
        ["failed"],
      );
      assert.match(
        payload.result.publishResults[0].message,
        /真实发布未配置: 公众号 需要显式配置发布凭据和执行器/,
      );
    });
  });

  it("applies review actions through HTTP", async () => {
    await withServer(async (baseUrl) => {
      const input = createContentPackageFromWorkflowRequest({
        title: "审核闭环",
        sourceText: "这是一段用于审核的正文。",
        targetPlatforms: ["wechat"],
        publishMode: "manual_review",
      });

      const response = await fetch(`${baseUrl}/api/workflow/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input, action: "approve" }),
      });

      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.ok, true);
      assert.deepEqual(
        payload.result.publishResults.map((result: { status: string }) => result.status),
        ["mock_published"],
      );
    });
  });
});
