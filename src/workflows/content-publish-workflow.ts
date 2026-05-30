import type {
  ContentPackage,
  PlatformDraft,
  PublishResult,
  ValidationResult,
} from "../core/types.js";
import type { SkillGateway } from "../core/skill-gateway.js";

export type WorkflowNodeName =
  | "plan_platforms"
  | "adapt_by_platform_skills"
  | "validate_platform_drafts"
  | "human_review_hook"
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
