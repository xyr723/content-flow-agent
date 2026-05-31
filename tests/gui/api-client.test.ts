import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  STATIC_PAGES_API_MESSAGE,
  postWorkflow,
} from "../../src/gui/api-client.js";

describe("GUI API client", () => {
  it("reports a clear message when a static host returns HTML instead of JSON", async () => {
    await assert.rejects(
      () =>
        postWorkflow(
          "/api/workflow/run",
          {},
          async () =>
            new Response("<html><head></head><body>GitHub Pages</body></html>", {
              headers: { "content-type": "text/html; charset=utf-8" },
              status: 200,
            }),
        ),
      new RegExp(STATIC_PAGES_API_MESSAGE),
    );
  });

  it("returns workflow payloads from JSON API responses", async () => {
    const payload = {
      ok: true,
      input: {
        sourceText: "正文",
        images: [],
        videos: [],
        targetPlatforms: ["wechat"],
        publishMode: "mock",
      },
      result: {
        drafts: [],
        validations: [],
        publishResults: [],
        steps: [],
      },
    };

    const result = await postWorkflow(
      "/api/workflow/run",
      {},
      async () =>
        Response.json(payload, {
          status: 200,
        }),
    );

    assert.deepEqual(result, payload);
  });
});
