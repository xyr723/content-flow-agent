import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fakeModel } from "@langchain/core/testing";

import {
  createPlannerChatModel,
  planContentPackage,
  planContentPackageWithLangChain,
} from "../src/index.js";
import type { LangChainPlannerModel, MediaAsset } from "../src/index.js";

describe("agent planner", () => {
  it("keeps the deterministic planner available for fast local planning", () => {
    const result = planContentPackage(
      "这是一篇图文内容。",
      "发到所有图文平台，先人工审核，不要发知乎",
    );

    assert.deepEqual(result.targetPlatforms, ["wechat", "xiaohongshu"]);
    assert.equal(result.publishMode, "manual_review");
  });

  it("uses LangChain structured output for ambiguous planning instructions", async () => {
    const videos: MediaAsset[] = [
      { id: "video-1", type: "video", path: "demo.mp4" },
    ];
    const model = fakeModel().structuredResponse({
      targetPlatforms: ["douyin", "bilibili"],
      publishMode: "manual_review",
      confidence: 0.93,
      reasoning: "用户要求短视频渠道并先审核。",
    });

    const result = await planContentPackageWithLangChain(
      "请把这段内容做成短视频分发。",
      "短视频渠道优先，先让我确认",
      {
        title: "短视频分发",
        videos,
        model,
        strategy: "force_langchain",
      },
    );

    assert.deepEqual(result.contentPackage.targetPlatforms, ["douyin", "bilibili"]);
    assert.equal(result.contentPackage.publishMode, "manual_review");
    assert.equal(result.contentPackage.title, "短视频分发");
    assert.deepEqual(result.contentPackage.videos, videos);
    assert.equal(result.metadata.source, "langchain");
    assert.equal(result.metadata.confidence, 0.93);
    assert.match(result.metadata.reasoning ?? "", /短视频渠道/);
  });

  it("falls back to deterministic planning when the LangChain model fails", async () => {
    const model: LangChainPlannerModel = {
      withStructuredOutput() {
        return {
          async invoke() {
            throw new Error("planner service unavailable");
          },
        };
      },
    };

    const result = await planContentPackageWithLangChain(
      "这是一篇图文内容。",
      "发到公众号和知乎",
      {
        model,
        strategy: "force_langchain",
      },
    );

    assert.deepEqual(result.contentPackage.targetPlatforms, ["wechat", "zhihu"]);
    assert.equal(result.contentPackage.publishMode, "mock");
    assert.equal(result.metadata.source, "fallback");
    assert.match(result.metadata.warnings.join("\n"), /planner service unavailable/);
  });

  it("creates a LangChain chat model from runtime configuration without embedding credentials", async () => {
    const model = await createPlannerChatModel({
      modelName: "openai:gpt-4.1-mini",
      temperature: 0,
      timeout: 10,
      maxRetries: 1,
    });

    assert.equal(typeof model.withStructuredOutput, "function");
  });
});
