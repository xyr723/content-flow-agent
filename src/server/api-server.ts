import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";
import type { Server } from "node:http";

import { planContentPackage } from "../agent/planner.js";
import type {
  ContentPackage,
  MediaAsset,
  MediaType,
  PlatformId,
  PublishMode,
} from "../core/types.js";
import { createDefaultSkillGateway } from "../skills/default-platform-skills.js";
import {
  runContentPublishWorkflow,
  runReviewedPublishWorkflow,
} from "../workflows/content-publish-workflow.js";
import type {
  ReviewAction,
  ReviewDecision,
} from "../workflows/content-publish-workflow.js";

const PLATFORM_IDS: PlatformId[] = [
  "wechat",
  "zhihu",
  "bilibili",
  "xiaohongshu",
  "douyin",
];
const PUBLISH_MODES: PublishMode[] = ["manual_review", "mock", "real"];
const REVIEW_ACTIONS: Array<ReviewAction | "edit_first"> = [
  "approve",
  "reject",
  "edit",
  "edit_first",
];

export type WorkflowRunRequest = {
  title?: unknown;
  sourceText?: unknown;
  instruction?: unknown;
  targetPlatforms?: unknown;
  publishMode?: unknown;
  images?: unknown;
  videos?: unknown;
};

export type WorkflowReviewRequest = {
  input?: unknown;
  action?: unknown;
};

export type ContentFlowServerOptions = {
  rootDir?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("请求体必须是 JSON 对象");
  }
  return value as Record<string, unknown>;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function requiredString(value: unknown, field: string): string {
  const text = optionalString(value);
  if (!text) {
    throw new Error(`${field} 不能为空`);
  }
  return text;
}

function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function toAssets(value: unknown, type: MediaType): MediaAsset[] {
  if (Array.isArray(value)) {
    return value
      .map((item, index): MediaAsset | undefined => {
        if (typeof item === "string" && item.trim()) {
          return {
            id: `${type}-${index + 1}`,
            type,
            path: item.trim(),
          };
        }

        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          const path = optionalString(record.path);
          if (!path) return undefined;
          return {
            id: optionalString(record.id) ?? `${type}-${index + 1}`,
            type,
            path,
            alt: optionalString(record.alt),
          };
        }

        return undefined;
      })
      .filter((asset): asset is MediaAsset => Boolean(asset));
  }

  return parseStringList(value).map((path, index) => ({
    id: `${type}-${index + 1}`,
    type,
    path,
  }));
}

function parsePlatforms(value: unknown): PlatformId[] | undefined {
  const platforms = parseStringList(value).filter((platform): platform is PlatformId =>
    PLATFORM_IDS.includes(platform as PlatformId),
  );
  return platforms.length > 0 ? platforms : undefined;
}

function parsePublishMode(value: unknown): PublishMode {
  if (typeof value === "string" && PUBLISH_MODES.includes(value as PublishMode)) {
    return value as PublishMode;
  }
  return "manual_review";
}

function defaultInstruction(platforms?: PlatformId[]): string {
  if (!platforms?.length) return "发到公众号和知乎";
  return `发到 ${platforms.join(", ")}`;
}

export function createContentPackageFromWorkflowRequest(
  payload: WorkflowRunRequest,
): ContentPackage {
  const body = asRecord(payload);
  const sourceText = requiredString(body.sourceText, "sourceText");
  const targetPlatforms = parsePlatforms(body.targetPlatforms);
  const instruction = optionalString(body.instruction) ?? defaultInstruction(targetPlatforms);

  return planContentPackage(sourceText, instruction, {
    title: optionalString(body.title),
    targetPlatforms,
    publishMode: parsePublishMode(body.publishMode),
    images: toAssets(body.images, "image"),
    videos: toAssets(body.videos, "video"),
  });
}

function parseContentPackage(value: unknown): ContentPackage {
  const body = asRecord(value);
  return {
    sourceText: requiredString(body.sourceText, "input.sourceText"),
    title: optionalString(body.title),
    images: toAssets(body.images, "image"),
    videos: toAssets(body.videos, "video"),
    targetPlatforms: parsePlatforms(body.targetPlatforms) ?? ["wechat"],
    publishMode: parsePublishMode(body.publishMode),
  };
}

function createReviewDecisions(input: ContentPackage, action: string): ReviewDecision[] {
  if (!REVIEW_ACTIONS.includes(action as ReviewAction | "edit_first")) {
    throw new Error("不支持的审核动作");
  }

  return input.targetPlatforms.map((platform, index) => {
    if (action === "reject") {
      return {
        platform,
        action: "reject",
        reason: "人工审核拒绝发布",
      };
    }

    if ((action === "edit" || action === "edit_first") && index === 0) {
      return {
        platform,
        action: "edit",
        reason: "人工审核已修改首个平台标题",
        patch: {
          title: `${input.title ?? "未命名内容"}（已审核）`,
        },
      };
    }

    return {
      platform,
      action: "approve",
    };
  });
}

function contentType(filePath: string): string {
  const extension = extname(filePath);
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  return "text/plain; charset=utf-8";
}

function resolveStaticRequest(url: string): string {
  const path = new URL(url, "http://localhost").pathname;
  if (path === "/" || path === "/index.html") return "src/gui/index.html";
  if (path === "/styles.css") return "src/gui/styles.css";
  if (path.startsWith("/src/")) return normalize(`.gui-build${path}`);
  return "src/gui/index.html";
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendError(response: ServerResponse, error: unknown, statusCode = 400): void {
  const message = error instanceof Error ? error.message : String(error);
  sendJson(response, statusCode, { ok: false, error: message });
}

async function handleApiRequest(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<boolean> {
  const path = new URL(request.url ?? "/", "http://localhost").pathname;
  if (!path.startsWith("/api/")) return false;

  if (request.method === "GET" && path === "/api/health") {
    sendJson(response, 200, { ok: true, service: "content-flow-agent" });
    return true;
  }

  if (request.method === "POST" && path === "/api/workflow/run") {
    try {
      const input = createContentPackageFromWorkflowRequest(
        (await readJson(request)) as WorkflowRunRequest,
      );
      const result = await runContentPublishWorkflow(input, createDefaultSkillGateway());
      sendJson(response, 200, { ok: true, input, result });
    } catch (error) {
      sendError(response, error);
    }
    return true;
  }

  if (request.method === "POST" && path === "/api/workflow/review") {
    try {
      const body = asRecord(await readJson(request));
      const input = parseContentPackage(body.input);
      const action = requiredString(body.action, "action");
      const result = await runReviewedPublishWorkflow(
        input,
        createDefaultSkillGateway(),
        createReviewDecisions(input, action),
      );
      sendJson(response, 200, { ok: true, input, result });
    } catch (error) {
      sendError(response, error);
    }
    return true;
  }

  sendJson(response, 404, { ok: false, error: "API 不存在" });
  return true;
}

export function createContentFlowServer(
  options: ContentFlowServerOptions = {},
): Server {
  const rootDir = options.rootDir ?? process.cwd();

  return createServer(async (request, response) => {
    if (await handleApiRequest(request, response)) return;

    try {
      const relativePath = resolveStaticRequest(request.url ?? "/");
      const filePath = join(rootDir, relativePath);
      const content = await readFile(filePath);
      response.writeHead(200, { "content-type": contentType(filePath) });
      response.end(content);
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("文件不存在");
    }
  });
}

export async function listen(port: number, options?: ContentFlowServerOptions): Promise<Server> {
  const server = createContentFlowServer(options);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, resolve);
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 4173);
  await listen(port);
  console.log(`内容流转服务已启动：http://localhost:${port}`);
}
