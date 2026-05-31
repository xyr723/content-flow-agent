import type { PublishMode } from "../core/types.js";
import { createDefaultSkillGateway } from "../skills/default-platform-skills.js";
import {
  runContentPublishWorkflow,
  runReviewedPublishWorkflow,
} from "../workflows/content-publish-workflow.js";
import type {
  ReviewDecision,
  WorkflowResult,
} from "../workflows/content-publish-workflow.js";
import type { ContentPackage } from "../core/types.js";
import { createDemoContentPackage } from "./demo-data.js";
import { renderWorkbench } from "./render.js";

const appRoot = document.querySelector<HTMLElement>("#app");
const statusRoot = document.querySelector<HTMLElement>("#status");
const reviewButton = document.querySelector<HTMLButtonElement>("[data-mode='manual_review']");
const mockButton = document.querySelector<HTMLButtonElement>("[data-mode='mock']");
const realButton = document.querySelector<HTMLButtonElement>("[data-mode='real']");
const runButton = document.querySelector<HTMLButtonElement>("#run-workflow");

let currentMode: PublishMode = "manual_review";
let currentInput: ContentPackage | undefined;
let currentResult: WorkflowResult | undefined;

async function runDemo(): Promise<void> {
  if (!appRoot || !statusRoot) return;
  statusRoot.textContent = "正在生成平台草稿";

  try {
    const input = createDemoContentPackage(currentMode);
    const result = await runContentPublishWorkflow(input, createDefaultSkillGateway());
    currentInput = input;
    currentResult = result;
    appRoot.innerHTML = renderWorkbench(input, result);
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

function createReviewDecisions(action: string): ReviewDecision[] {
  const drafts = currentResult?.drafts ?? [];
  return drafts.map((draft, index) => {
    if (action === "reject") {
      return {
        platform: draft.platform,
        action: "reject",
        reason: "人工审核拒绝发布",
      };
    }

    if (action === "edit_first" && index === 0) {
      return {
        platform: draft.platform,
        action: "edit",
        patch: {
          title: `${draft.title}（已审核）`,
        },
      };
    }

    return {
      platform: draft.platform,
      action: "approve",
    };
  });
}

async function runReviewAction(action: string): Promise<void> {
  if (!appRoot || !statusRoot || !currentInput) return;
  statusRoot.textContent = "正在处理人工审核";

  try {
    const result = await runReviewedPublishWorkflow(
      currentInput,
      createDefaultSkillGateway(),
      createReviewDecisions(action),
    );
    currentResult = result;
    appRoot.innerHTML = renderWorkbench(currentInput, result);
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
  void runDemo();
});

mockButton?.addEventListener("click", () => {
  setMode("mock");
  void runDemo();
});

realButton?.addEventListener("click", () => {
  setMode("real");
  void runDemo();
});

runButton?.addEventListener("click", () => {
  void runDemo();
});

appRoot?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const button = target.closest<HTMLButtonElement>("[data-review-action]");
  if (!button) return;

  void runReviewAction(button.dataset.reviewAction ?? "approve");
});

void runDemo();
