import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("GUI app API integration", () => {
  it("calls backend workflow and review APIs", async () => {
    const source = await readFile(resolve("src/gui/app.ts"), "utf8");

    assert.match(source, /\/api\/workflow\/run/);
    assert.match(source, /\/api\/workflow\/review/);
    assert.match(source, /FormData/);
  });
});
