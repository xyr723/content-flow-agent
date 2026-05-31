import type {
  ContentPackage,
  PlatformDraft,
  PlatformId,
  PublishResult,
  ValidationResult,
} from "../core/types.js";
import type { SkillGateway } from "../core/skill-gateway.js";

export type WorkflowNodeName =
  | "plan_platforms"
  | "adapt_by_platform_skills"
  | "validate_platform_drafts"
  | "human_review_hook"
  | "apply_review_decisions"
  | "publish_or_mock_publish";

export type WorkflowNodeStep = {
  node: WorkflowNodeName;
  status: "completed";
  message: string;
};

export type WorkflowResult = {
  drafts: PlatformDraft[];
  validations: ValidationResult[];
  publishResults: PublishResult[];
  steps: WorkflowNodeStep[];
  reviewResults?: ReviewResult[];
};

export type ReviewAction = "approve" | "reject" | "edit";

export type ReviewDraftPatch = Partial<
  Pick<PlatformDraft, "title" | "body" | "summary" | "tags" | "assets" | "warnings">
>;

export type ReviewDecision = {
  platform: PlatformId;
  action: ReviewAction;
  reason?: string;
  patch?: ReviewDraftPatch;
};

export type ReviewResult = {
  platform: PlatformId;
  action: ReviewAction;
  status: "approved" | "rejected" | "edited";
  draft: PlatformDraft;
  message: string;
};

function completedStep(node: WorkflowNodeName, message: string): WorkflowNodeStep {
  return {
    node,
    status: "completed",
    message,
  };
}

export function planPlatformsNode(input: ContentPackage): ContentPackage {
  return input;
}

export async function adaptByPlatformSkillsNode(
  input: ContentPackage,
  gateway: SkillGateway,
): Promise<PlatformDraft[]> {
  return gateway.adapt(input);
}

export async function validatePlatformDraftsNode(
  drafts: PlatformDraft[],
  gateway: SkillGateway,
): Promise<ValidationResult[]> {
  return Promise.all(
    drafts.map((draft) => gateway.get(draft.platform).validate(draft)),
  );
}

export function humanReviewHookNode(drafts: PlatformDraft[]): PublishResult[] {
  return drafts.map((draft) => ({
    platform: draft.platform,
    status: "review_required",
    message: "Waiting for human review before publishing.",
  }));
}

export function applyReviewDecisionsNode(
  drafts: PlatformDraft[],
  decisions: ReviewDecision[],
): ReviewResult[] {
  const decisionsByPlatform = new Map(
    decisions.map((decision) => [decision.platform, decision]),
  );

  return drafts.map((draft) => {
    const decision = decisionsByPlatform.get(draft.platform);
    if (!decision) {
      throw new Error(`Missing review decision for platform: ${draft.platform}`);
    }

    if (decision.action === "reject") {
      return {
        platform: draft.platform,
        action: decision.action,
        status: "rejected",
        draft,
        message: decision.reason ?? "人工审核拒绝发布",
      };
    }

    if (decision.action === "edit") {
      return {
        platform: draft.platform,
        action: decision.action,
        status: "edited",
        draft: {
          ...draft,
          ...decision.patch,
          platform: draft.platform,
        },
        message: decision.reason ?? "人工审核已修改草稿",
      };
    }

    return {
      platform: draft.platform,
      action: decision.action,
      status: "approved",
      draft,
      message: decision.reason ?? "人工审核通过",
    };
  });
}

export async function publishOrMockPublishNode(
  input: ContentPackage,
  drafts: PlatformDraft[],
  validations: ValidationResult[],
  gateway: SkillGateway,
): Promise<PublishResult[]> {
  if (input.publishMode === "manual_review") {
    return humanReviewHookNode(drafts);
  }

  if (input.publishMode === "real") {
    return drafts.map((draft) => ({
      platform: draft.platform,
      status: "failed",
      message: "真实发布暂未在 MVP 中开放，请使用 mock 或 manual_review 模式。",
    }));
  }

  return Promise.all(
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
}

export async function publishReviewedDraftsNode(
  reviewResults: ReviewResult[],
  validations: ValidationResult[],
  gateway: SkillGateway,
): Promise<PublishResult[]> {
  return Promise.all(
    reviewResults.map((reviewResult, index) => {
      if (reviewResult.status === "rejected") {
        return {
          platform: reviewResult.platform,
          status: "rejected" as const,
          message: reviewResult.message,
        };
      }

      const validation = validations[index];
      if (!validation?.ok) {
        return {
          platform: reviewResult.platform,
          status: "failed" as const,
          message: validation?.errors.join("; ") ?? "平台草稿校验失败",
        };
      }

      return gateway.get(reviewResult.platform).publish(reviewResult.draft);
    }),
  );
}

export async function runContentPublishWorkflow(
  input: ContentPackage,
  gateway: SkillGateway,
): Promise<WorkflowResult> {
  const steps: WorkflowNodeStep[] = [];

  const plannedInput = planPlatformsNode(input);
  steps.push(
    completedStep(
      "plan_platforms",
      `Planned ${plannedInput.targetPlatforms.length} target platform(s).`,
    ),
  );

  const drafts = await adaptByPlatformSkillsNode(plannedInput, gateway);
  steps.push(
    completedStep(
      "adapt_by_platform_skills",
      `Created ${drafts.length} platform draft(s).`,
    ),
  );

  const validations = await validatePlatformDraftsNode(drafts, gateway);
  steps.push(
    completedStep(
      "validate_platform_drafts",
      `Validated ${validations.length} platform draft(s).`,
    ),
  );

  if (plannedInput.publishMode === "manual_review") {
    const publishResults = humanReviewHookNode(drafts);
    steps.push(
      completedStep(
        "human_review_hook",
        "Stopped before publishing for human review.",
      ),
    );

    return { drafts, validations, publishResults, steps };
  }

  const publishResults = await publishOrMockPublishNode(
    plannedInput,
    drafts,
    validations,
    gateway,
  );
  steps.push(
    completedStep(
      "publish_or_mock_publish",
      `Created ${publishResults.length} publish result(s).`,
    ),
  );

  return { drafts, validations, publishResults, steps };
}

export async function runReviewedPublishWorkflow(
  input: ContentPackage,
  gateway: SkillGateway,
  decisions: ReviewDecision[],
): Promise<WorkflowResult> {
  const steps: WorkflowNodeStep[] = [];

  const plannedInput = planPlatformsNode(input);
  steps.push(
    completedStep(
      "plan_platforms",
      `Planned ${plannedInput.targetPlatforms.length} target platform(s).`,
    ),
  );

  const originalDrafts = await adaptByPlatformSkillsNode(plannedInput, gateway);
  steps.push(
    completedStep(
      "adapt_by_platform_skills",
      `Created ${originalDrafts.length} platform draft(s).`,
    ),
  );

  const reviewResults = applyReviewDecisionsNode(originalDrafts, decisions);
  steps.push(
    completedStep(
      "apply_review_decisions",
      `Applied ${reviewResults.length} review decision(s).`,
    ),
  );

  const reviewedDrafts = reviewResults.map((reviewResult) => reviewResult.draft);
  const validations = await validatePlatformDraftsNode(reviewedDrafts, gateway);
  steps.push(
    completedStep(
      "validate_platform_drafts",
      `Validated ${validations.length} reviewed draft(s).`,
    ),
  );

  const publishResults = await publishReviewedDraftsNode(
    reviewResults,
    validations,
    gateway,
  );
  steps.push(
    completedStep(
      "publish_or_mock_publish",
      `Created ${publishResults.length} publish result(s).`,
    ),
  );

  return {
    drafts: reviewedDrafts,
    validations,
    publishResults,
    steps,
    reviewResults,
  };
}
