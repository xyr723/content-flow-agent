import type { PublishMode } from "../core/types.js";
import { createDefaultSkillGateway } from "../skills/platform-skills.js";
import { runContentPublishWorkflow } from "../workflows/content-publish-workflow.js";
import { createDemoContentPackage } from "./demo-data.js";
import { renderWorkbench } from "./render.js";

const appRoot = document.querySelector<HTMLElement>("#app");
const statusRoot = document.querySelector<HTMLElement>("#status");
const reviewButton = document.querySelector<HTMLButtonElement>("[data-mode='manual_review']");
const mockButton = document.querySelector<HTMLButtonElement>("[data-mode='mock']");
const runButton = document.querySelector<HTMLButtonElement>("#run-workflow");

let currentMode: PublishMode = "manual_review";

async function runDemo(): Promise<void> {
  if (!appRoot || !statusRoot) return;
  statusRoot.textContent = "正在生成平台草稿";

  try {
    const input = createDemoContentPackage(currentMode);
    const result = await runContentPublishWorkflow(input, createDefaultSkillGateway());
    appRoot.innerHTML = renderWorkbench(input, result);
    statusRoot.textContent = currentMode === "mock" ? "模拟发布完成" : "等待人工审核";
  } catch (error) {
    statusRoot.textContent = error instanceof Error ? error.message : "运行失败";
  }
}

function setMode(mode: PublishMode): void {
  currentMode = mode;
  reviewButton?.classList.toggle("active", mode === "manual_review");
  mockButton?.classList.toggle("active", mode === "mock");
}

reviewButton?.addEventListener("click", () => {
  setMode("manual_review");
  void runDemo();
});

mockButton?.addEventListener("click", () => {
  setMode("mock");
  void runDemo();
});

runButton?.addEventListener("click", () => {
  void runDemo();
});

void runDemo();
