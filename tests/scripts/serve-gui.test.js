import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { resolveGuiRequest, getContentType } = await import(
  pathToFileURL(resolve("scripts/serve-gui.mjs"))
);

describe("serve-gui helpers", () => {
  it("maps root and gui assets to the expected source files", () => {
    assert.equal(resolveGuiRequest("/").relativePath, "src/gui/index.html");
    assert.equal(resolveGuiRequest("/styles.css").relativePath, "src/gui/styles.css");
    assert.equal(resolveGuiRequest("/src/gui/app.js").relativePath, ".gui-build/src/gui/app.js");
  });

  it("returns stable content types", () => {
    assert.equal(getContentType("index.html"), "text/html; charset=utf-8");
    assert.equal(getContentType("styles.css"), "text/css; charset=utf-8");
    assert.equal(getContentType("app.js"), "text/javascript; charset=utf-8");
  });
});
