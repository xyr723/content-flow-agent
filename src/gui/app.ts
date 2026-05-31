import type { PlatformId, PublishMode } from "../core/types.js";
import type { WorkflowResult } from "../workflows/content-publish-workflow.js";
import type { ContentPackage } from "../core/types.js";
import { postWorkflow } from "./api-client.js";
import { renderWorkbench } from "./render.js";

const appRoot = document.querySelector<HTMLElement>("#app");
const statusRoot = document.querySelector<HTMLElement>("#status");
const contentForm = document.querySelector<HTMLFormElement>("#content-form");
const reviewButton = document.querySelector<HTMLButtonElement>("[data-mode='manual_review']");
const mockButton = document.querySelector<HTMLButtonElement>("[data-mode='mock']");
const realButton = document.querySelector<HTMLButtonElement>("[data-mode='real']");

let currentMode: PublishMode = "manual_review";
let currentInput: ContentPackage | undefined;
let currentResult: WorkflowResult | undefined;

type WorkflowRunPayload = {
  title?: string;
  sourceText: string;
  targetPlatforms: PlatformId[];
  publishMode: PublishMode;
  images: string[];
  videos: string[];
};

const platformIds: PlatformId[] = [
  "wechat",
  "zhihu",
  "xiaohongshu",
  "bilibili",
  "douyin",
];

function splitPaths(value: FormDataEntryValue | null): string[] {
  return typeof value === "string"
    ? value
        .split(/\r?\n|,/)
        .map((path) => path.trim())
        .filter(Boolean)
    : [];
}

function selectedPlatforms(form: HTMLFormElement): PlatformId[] {
  const selected = Array.from(
    form.querySelectorAll<HTMLInputElement>("input[name='platform']:checked"),
  )
    .map((input) => input.value)
    .filter((value): value is PlatformId => platformIds.includes(value as PlatformId));

  return selected.length > 0 ? selected : ["wechat"];
}

function createPayloadFromForm(form: HTMLFormElement): WorkflowRunPayload {
  const formData = new FormData(form);
  const sourceText = String(formData.get("sourceText") ?? "").trim();
  if (!sourceText) {
    throw new Error("正文不能为空");
  }

  return {
    title: String(formData.get("title") ?? "").trim() || undefined,
    sourceText,
    targetPlatforms: selectedPlatforms(form),
    publishMode: currentMode,
    images: splitPaths(formData.get("images")),
    videos: splitPaths(formData.get("videos")),
  };
}

async function runWorkflowFromForm(): Promise<void> {
  if (!appRoot || !statusRoot) return;
  statusRoot.textContent = "正在调用后端生成平台草稿";

  try {
    if (!contentForm) throw new Error("内容表单不存在");
    const payload = await postWorkflow("/api/workflow/run", createPayloadFromForm(contentForm));
    currentInput = payload.input;
    currentResult = payload.result;
    appRoot.innerHTML = renderWorkbench(payload.input, payload.result);
    statusRoot.textContent =
      currentMode === "real"
        ? "真实发布预检完成"
        : currentMode === "mock"
          ? "模拟发布完成"
          : "等待人工审核";
  } catch (error) {
    statusRoot.textContent = error instanceof Error ? error.message : "运行失败";
  }
}

async function runReviewAction(action: string): Promise<void> {
  if (!appRoot || !statusRoot || !currentInput) return;
  statusRoot.textContent = "正在通过后端处理人工审核";

  try {
    const payload = await postWorkflow("/api/workflow/review", {
      input: currentInput,
      action,
    });
    currentInput = payload.input;
    currentResult = payload.result;
    appRoot.innerHTML = renderWorkbench(payload.input, payload.result);
    statusRoot.textContent = action === "reject" ? "人工审核已拒绝" : "审核后模拟发布完成";
  } catch (error) {
    statusRoot.textContent = error instanceof Error ? error.message : "审核处理失败";
  }
}

function setMode(mode: PublishMode): void {
  currentMode = mode;
  reviewButton?.classList.toggle("active", mode === "manual_review");
  mockButton?.classList.toggle("active", mode === "mock");
  realButton?.classList.toggle("active", mode === "real");
}

reviewButton?.addEventListener("click", () => {
  setMode("manual_review");
  void runWorkflowFromForm();
});

mockButton?.addEventListener("click", () => {
  setMode("mock");
  void runWorkflowFromForm();
});

realButton?.addEventListener("click", () => {
  setMode("real");
  void runWorkflowFromForm();
});

contentForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  void runWorkflowFromForm();
});

appRoot?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const button = target.closest<HTMLButtonElement>("[data-review-action]");
  if (!button) return;

  void runReviewAction(button.dataset.reviewAction ?? "approve");
});

void runWorkflowFromForm();
