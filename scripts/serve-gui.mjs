import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = fileURLToPath(new URL("../", import.meta.url));

export function getContentType(filePath) {
  const extension = extname(filePath);
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  return "text/plain; charset=utf-8";
}

export function resolveGuiRequest(url) {
  const path = new URL(url, "http://localhost").pathname;
  if (path === "/" || path === "/index.html") return { relativePath: "src/gui/index.html" };
  if (path === "/styles.css") return { relativePath: "src/gui/styles.css" };
  if (path.startsWith("/src/")) return { relativePath: normalize(`.gui-build${path}`) };
  return { relativePath: "src/gui/index.html" };
}

async function listen(port) {
  const server = createServer(async (request, response) => {
    try {
      const { relativePath } = resolveGuiRequest(request.url ?? "/");
      const filePath = join(rootDir, relativePath);
      const content = await readFile(filePath);
      response.writeHead(200, { "content-type": getContentType(filePath) });
      response.end(content);
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("文件不存在");
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, resolve);
  });

  console.log(`图形界面已启动：http://localhost:${port}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 4173);
  await listen(port);
}
