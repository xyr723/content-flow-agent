import type { ContentPackage } from "../core/types.js";
import type { WorkflowResult } from "../workflows/content-publish-workflow.js";

export const STATIC_PAGES_API_MESSAGE =
  "当前页面没有可用的 Node 后端 API。GitHub Pages 只能提供静态界面，请使用 npm run demo:gui，或访问已部署 Node 服务的 IP 入口。";

export type WorkflowApiResponse = {
  ok: boolean;
  input: ContentPackage;
  result: WorkflowResult;
  error?: string;
};

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export async function postWorkflow(
  url: string,
  body: unknown,
  fetchImpl: FetchLike = fetch,
): Promise<WorkflowApiResponse> {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(STATIC_PAGES_API_MESSAGE);
  }

  const payload = (await response.json()) as WorkflowApiResponse;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? "后端 workflow 请求失败");
  }

  return payload;
}
