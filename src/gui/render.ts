import type {
  ContentPackage,
  PlatformDraft,
  PublishResult,
  ValidationResult,
} from "../core/types.js";
import type { WorkflowResult } from "../workflows/content-publish-workflow.js";

const platformNames: Record<string, string> = {
  wechat: "公众号",
  zhihu: "知乎",
  xiaohongshu: "小红书",
  bilibili: "哔哩哔哩",
  douyin: "抖音",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function statusText(result: PublishResult): string {
  if (result.status === "review_required") return "等待人工审核";
  if (result.status === "mock_published") return "模拟发布成功";
  if (result.status === "failed") return "发布失败";
  return "已生成草稿";
}

function renderDraft(draft: PlatformDraft, validation?: ValidationResult): string {
  const badge = validation?.ok === false ? "需修改" : validation?.warnings.length ? "提醒" : "通过";
  const tags = draft.tags
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join("");

  return `
    <article class="draft-card">
      <div class="draft-title">
        <strong>${platformNames[draft.platform] ?? draft.platform}</strong>
        <span class="badge">${badge}</span>
      </div>
      <h3>${escapeHtml(draft.title)}</h3>
      <p>${escapeHtml(draft.body)}</p>
      <div class="tag-row">${tags}</div>
    </article>
  `;
}

function renderReport(result: PublishResult, validation?: ValidationResult): string {
  const issues = [...(validation?.errors ?? []), ...(validation?.warnings ?? [])];
  const visibleMessage = issues[0] ?? statusText(result);

  return `
    <article class="report-card">
      <strong>${platformNames[result.platform] ?? result.platform}</strong>
      <span>${statusText(result)}</span>
      <p>${escapeHtml(visibleMessage)}</p>
    </article>
  `;
}

export function renderWorkbench(input: ContentPackage, result: WorkflowResult): string {
  const warningCount = result.validations.reduce(
    (count, validation) => count + validation.errors.length + validation.warnings.length,
    0,
  );
  const failedCount = result.validations.filter((validation) => !validation.ok).length;

  return `
    <section class="content-panel">
      <h2>内容包</h2>
      <div class="field"><strong>${escapeHtml(input.title ?? "未命名内容")}</strong></div>
      <p class="source-text">${escapeHtml(input.sourceText)}</p>
      <div class="mode">当前模式：${input.publishMode === "mock" ? "模拟发布" : "人工审核"}</div>
    </section>
    <section class="draft-panel">
      <h2>平台草稿</h2>
      <div class="platform-row">
        ${input.targetPlatforms.map((platform) => `<span>${platformNames[platform]}</span>`).join("")}
      </div>
      <div class="draft-grid">
        ${result.drafts.map((draft, index) => renderDraft(draft, result.validations[index])).join("")}
      </div>
    </section>
    <section class="report-panel">
      <h2>审核与报告</h2>
      <div class="stats">
        <span>草稿 ${result.drafts.length}</span>
        <span>提醒 ${warningCount}</span>
        <span>失败 ${failedCount}</span>
      </div>
      <div class="report-list">
        ${result.publishResults
          .map((publishResult, index) => renderReport(publishResult, result.validations[index]))
          .join("")}
      </div>
    </section>
  `;
}
