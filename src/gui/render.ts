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
  if (result.status === "rejected") return "审核拒绝";
  if (result.status === "failed") return "发布失败";
  return "已生成草稿";
}

function modeText(input: ContentPackage): string {
  if (input.publishMode === "real") return "真实发布预检";
  if (input.publishMode === "mock") return "模拟发布";
  return "人工审核";
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
  const visibleMessage =
    result.status === "rejected" || (result.status === "failed" && validation?.ok !== false)
      ? result.message
      : issues[0] ?? statusText(result);

  return `
    <article class="report-card">
      <strong>${platformNames[result.platform] ?? result.platform}</strong>
      <span>${statusText(result)}</span>
      <p>${escapeHtml(visibleMessage)}</p>
    </article>
  `;
}

function renderExtensionStatus(input: ContentPackage): string {
  const realStatus = input.publishMode === "real" ? "未配置" : "预检待运行";

  return `
    <div class="extension-status" aria-label="扩展层状态">
      <strong>扩展层状态</strong>
      <span>外部 Skill 适配层：可用</span>
      <span>真实发布：${realStatus}</span>
    </div>
  `;
}

function renderReviewActions(result: WorkflowResult): string {
  const needsReview = result.publishResults.some(
    (publishResult) => publishResult.status === "review_required",
  );
  if (!needsReview) return "";

  return `
    <div class="review-actions" aria-label="人工审核动作">
      <button type="button" data-review-action="approve">通过审核并模拟发布</button>
      <button type="button" data-review-action="reject">拒绝发布</button>
      <button type="button" data-review-action="edit_first">编辑首个平台标题后发布</button>
    </div>
  `;
}

export function renderWorkbench(input: ContentPackage, result: WorkflowResult): string {
  const warningCount = result.validations.reduce(
    (count, validation) => count + validation.errors.length + validation.warnings.length,
    0,
  );
  const failedCount = Math.max(
    result.validations.filter((validation) => !validation.ok).length,
    result.publishResults.filter((publishResult) => publishResult.status === "failed").length,
  );

  return `
    <section class="content-panel">
      <h2>内容包</h2>
      <div class="field"><strong>${escapeHtml(input.title ?? "未命名内容")}</strong></div>
      <p class="source-text">${escapeHtml(input.sourceText)}</p>
      <div class="mode">当前模式：${modeText(input)}</div>
      ${renderExtensionStatus(input)}
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
      ${renderReviewActions(result)}
      <div class="report-list">
        ${result.publishResults
          .map((publishResult, index) => renderReport(publishResult, result.validations[index]))
          .join("")}
      </div>
    </section>
  `;
}
