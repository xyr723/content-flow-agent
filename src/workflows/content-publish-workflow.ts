import type { ContentPackage, PlatformDraft, PublishResult, ValidationResult } from "../core/types.js";
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

  const publishResults = await gateway.publish(drafts);
  return { drafts, validations, publishResults };
}
