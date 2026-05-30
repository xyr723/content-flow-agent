import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { buildGuiPage, createPageIndexHtml } = await import(
  pathToFileURL(resolve("scripts/build-gui-page.mjs"))
);

describe("build-gui-page helpers", () => {
  it("rewrites root asset URLs into relative URLs for project pages", () => {
    const html =
      '<link rel="stylesheet" href="/styles.css" />\n<script type="module" src="/src/gui/app.js"></script>';

    assert.equal(
      createPageIndexHtml(html),
      '<link rel="stylesheet" href="./styles.css" />\n<script type="module" src="./src/gui/app.js"></script>',
    );
  });

  it("copies GUI files into a static Pages directory", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "content-flow-pages-"));

    try {
      await mkdir(join(fixtureRoot, "src/gui"), { recursive: true });
      await mkdir(join(fixtureRoot, ".gui-build/src/gui"), { recursive: true });
      await writeFile(
        join(fixtureRoot, "src/gui/index.html"),
        '<link rel="stylesheet" href="/styles.css" />\n<script type="module" src="/src/gui/app.js"></script>',
      );
      await writeFile(join(fixtureRoot, "src/gui/styles.css"), "body { margin: 0; }\n");
      await writeFile(join(fixtureRoot, ".gui-build/src/gui/app.js"), "console.log('demo');\n");

      const outputDir = join(fixtureRoot, "dist/pages");
      await buildGuiPage({ rootDir: fixtureRoot, outputDir });

      assert.equal(
        await readFile(join(outputDir, "index.html"), "utf8"),
        '<link rel="stylesheet" href="./styles.css" />\n<script type="module" src="./src/gui/app.js"></script>',
      );
      assert.equal(await readFile(join(outputDir, "styles.css"), "utf8"), "body { margin: 0; }\n");
      assert.equal(await readFile(join(outputDir, "src/gui/app.js"), "utf8"), "console.log('demo');\n");
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });
});
