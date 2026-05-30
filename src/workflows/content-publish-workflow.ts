import type {
  ContentPackage,
  PlatformDraft,
  PublishResult,
  ValidationResult,
} from "../core/types.js";
import type { SkillGateway } from "../core/skill-gateway.js";

export type WorkflowResult = {
  drafts: PlatformDraft[];
  validations: ValidationResult[];
  publishResults: PublishResult[];
};

export async function runContentPublishWorkflow(
  input: ContentPackage,
  gateway: SkillGateway,
): Promise<WorkflowResult> {
  const drafts = await gateway.adapt(input);
  const validations = await Promise.all(
    drafts.map((draft) => gateway.get(draft.platform).validate(draft)),
  );

  if (input.publishMode === "manual_review") {
    return {
      drafts,
      validations,
      publishResults: drafts.map((draft) => ({
        platform: draft.platform,
        status: "review_required",
        message: "Waiting for human review before publishing.",
      })),
    };
  }

  if (input.publishMode === "real") {
    return {
      drafts,
      validations,
      publishResults: drafts.map((draft) => ({
        platform: draft.platform,
        status: "failed",
        message: "真实发布暂未在 MVP 中开放，请使用 mock 或 manual_review 模式。",
      })),
    };
  }

  const publishResults = await Promise.all(
    drafts.map((draft, index) => {
      const validation = validations[index];
      if (!validation?.ok) {
        return {
          platform: draft.platform,
          status: "failed" as const,
          message: validation?.errors.join("; ") ?? "平台草稿校验失败",
        };
      }

      return gateway.get(draft.platform).publish(draft);
    }),
  );

  return { drafts, validations, publishResults };
}
