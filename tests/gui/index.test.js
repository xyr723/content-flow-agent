import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("GUI shell", () => {
  it("exposes manual review, mock publish, and real preflight modes", async () => {
    const html = await readFile(resolve("src/gui/index.html"), "utf8");

    assert.match(html, /data-mode="manual_review"/);
    assert.match(html, /data-mode="mock"/);
    assert.match(html, /data-mode="real"/);
    assert.match(html, /真实发布预检/);
  });
});
