import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = fileURLToPath(new URL("../", import.meta.url));
const defaultOutputDir = join(rootDir, "dist/pages");

export function createPageIndexHtml(html) {
  return html.replaceAll('href="/styles.css"', 'href="./styles.css"').replaceAll('src="/src/', 'src="./src/');
}

export async function buildGuiPage({ rootDir: projectRoot = rootDir, outputDir = defaultOutputDir } = {}) {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const indexHtml = await readFile(join(projectRoot, "src/gui/index.html"), "utf8");
  await writeFile(join(outputDir, "index.html"), createPageIndexHtml(indexHtml));
  await cp(join(projectRoot, "src/gui/styles.css"), join(outputDir, "styles.css"));
  await cp(join(projectRoot, ".gui-build/src"), join(outputDir, "src"), { recursive: true });

  return outputDir;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outputDir = await buildGuiPage();
  console.log(`Pages 静态文件已生成：${outputDir}`);
}
