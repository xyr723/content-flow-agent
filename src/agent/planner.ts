import type {
  ContentPackage,
  MediaAsset,
  PlatformId,
  PublishMode,
} from "../core/types.js";
import type { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

const PLATFORM_ALIASES: Array<{ pattern: RegExp; id: PlatformId }> = [
  { pattern: /公众号|微信/i, id: "wechat" },
  { pattern: /知乎/i, id: "zhihu" },
  { pattern: /b\s*站|bilibili/i, id: "bilibili" },
  { pattern: /小红书|xhs/i, id: "xiaohongshu" },
  { pattern: /抖音|douyin/i, id: "douyin" },
];

const ALL_PLATFORMS: PlatformId[] = [
  "wechat",
  "zhihu",
  "bilibili",
  "xiaohongshu",
  "douyin",
];
const ARTICLE_PLATFORMS: PlatformId[] = ["wechat", "zhihu", "xiaohongshu"];
const VIDEO_PLATFORMS: PlatformId[] = ["bilibili", "douyin"];

const plannerOutputSchema = z.object({
  targetPlatforms: z.array(z.enum(ALL_PLATFORMS)).min(1),
  publishMode: z.enum(["mock", "manual_review"]),
  confidence: z.number().min(0).max(1).default(0.7),
  reasoning: z.string().optional(),
});

type PlannerStructuredOutput = z.infer<typeof plannerOutputSchema>;

export type PlannerSource = "rules" | "langchain" | "fallback";

export type PlannerMetadata = {
  source: PlannerSource;
  confidence: number;
  reasoning?: string;
  warnings: string[];
};

export type PlannerResult = {
  contentPackage: ContentPackage;
  metadata: PlannerMetadata;
};

export type LangChainPlannerModel = {
  withStructuredOutput(schema: typeof plannerOutputSchema): {
    invoke(input: BaseLanguageModelInput): Promise<unknown>;
  };
};

export type LangChainPlannerStrategy = "hybrid" | "force_langchain";

export type PlanContentPackageOptions = {
  title?: string;
  images?: MediaAsset[];
  videos?: MediaAsset[];
  targetPlatforms?: PlatformId[];
  publishMode?: PublishMode;
};

export type LangChainPlanContentPackageOptions = PlanContentPackageOptions & {
  model?: LangChainPlannerModel;
  strategy?: LangChainPlannerStrategy;
  minRuleConfidence?: number;
};

export type CreatePlannerChatModelOptions = {
  modelName?: string;
  temperature?: number;
  timeout?: number;
  maxRetries?: number;
  maxTokens?: number;
};

const plannerPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "你是内容发布 workflow 的 Agent Planner。",
      "只负责把自然语言发布目标解析为结构化配置，不执行发布。",
      "平台 ID 只能使用 wechat、zhihu、bilibili、xiaohongshu、douyin。",
      "发布模式只能使用 mock 或 manual_review；真实发布不在当前 MVP Planner 中自动选择。",
      "优先尊重用户明确指定的平台、排除平台和审核要求。",
    ].join("\n"),
  ],
  [
    "human",
    [
      "原始标题：{title}",
      "正文：{sourceText}",
      "图片数量：{imageCount}",
      "视频数量：{videoCount}",
      "用户发布要求：{instruction}",
      "规则快速路径初稿：{ruleDraft}",
      "请输出 targetPlatforms、publishMode、confidence 和 reasoning。",
    ].join("\n"),
  ],
]);

function uniquePlatforms(platforms: PlatformId[]): PlatformId[] {
  return platforms.filter((platform, index) => platforms.indexOf(platform) === index);
}

function detectExplicitPlatforms(instruction: string): PlatformId[] {
  return PLATFORM_ALIASES.filter(({ pattern }) => pattern.test(instruction)).map(
    ({ id }) => id,
  );
}

function detectExcludedPlatforms(instruction: string): PlatformId[] {
  return PLATFORM_ALIASES.filter(({ pattern }) => {
    const negativePattern = new RegExp(
      `(?:不要|别|不发|排除|剔除|不用|除了)[^，。；;]*${pattern.source}`,
      "i",
    );
    return negativePattern.test(instruction);
  }).map(({ id }) => id);
}

function detectPlatformGroup(instruction: string): PlatformId[] | undefined {
  if (/视频平台|短视频平台|视频渠道|短视频渠道/i.test(instruction)) {
    return VIDEO_PLATFORMS;
  }

  if (/图文平台|文章平台|长文平台/i.test(instruction)) {
    return ARTICLE_PLATFORMS;
  }

  if (/所有平台|全部平台|全平台|五个平台|都发/i.test(instruction)) {
    return ALL_PLATFORMS;
  }

  return undefined;
}

function recommendPlatforms(
  sourceText: string,
  instruction: string,
  options: PlanContentPackageOptions,
): PlatformId[] {
  const excludedPlatforms = detectExcludedPlatforms(instruction);
  const explicitPlatforms = detectExplicitPlatforms(instruction);
  const groupPlatforms = detectPlatformGroup(instruction);

  const preferredPlatforms =
    groupPlatforms ??
    (explicitPlatforms.length > 0 ? explicitPlatforms : undefined) ??
    (options.videos && options.videos.length > 0 && (!options.images || options.images.length === 0)
      ? VIDEO_PLATFORMS
      : undefined) ??
    (/图文|文章|长文|笔记/i.test(`${sourceText}\n${instruction}`)
      ? ARTICLE_PLATFORMS
      : undefined) ??
    ["wechat", "zhihu"];

  const filteredPlatforms = uniquePlatforms(preferredPlatforms).filter(
    (platform) => !excludedPlatforms.includes(platform),
  );

  return filteredPlatforms.length > 0 ? filteredPlatforms : ["wechat", "zhihu"];
}

function inferPublishMode(instruction: string): PublishMode {
  if (/模拟|mock|演示/i.test(instruction)) {
    return "mock";
  }

  if (/审核|确认|review|先看|人工/i.test(instruction)) {
    return "manual_review";
  }

  return "mock";
}

function createContentPackage(
  sourceText: string,
  instruction: string,
  options: PlanContentPackageOptions,
  targetPlatforms?: PlatformId[],
  publishMode?: PublishMode,
): ContentPackage {
  return {
    sourceText,
    title: options.title,
    images: options.images ?? [],
    videos: options.videos ?? [],
    targetPlatforms:
      options.targetPlatforms ??
      targetPlatforms ??
      recommendPlatforms(sourceText, instruction, options),
    publishMode: options.publishMode ?? publishMode ?? inferPublishMode(instruction),
  };
}

function estimateRuleConfidence(
  instruction: string,
  options: PlanContentPackageOptions,
): number {
  if (options.targetPlatforms && options.publishMode) {
    return 1;
  }

  const hasExplicitTarget =
    detectExplicitPlatforms(instruction).length > 0 || detectPlatformGroup(instruction);
  const hasExplicitMode = /模拟|mock|演示|审核|确认|review|先看|人工/i.test(instruction);

  if (hasExplicitTarget && hasExplicitMode) {
    return 0.9;
  }

  if (hasExplicitTarget) {
    return 0.82;
  }

  return 0.55;
}

function createRulePlannerResult(
  sourceText: string,
  instruction: string,
  options: PlanContentPackageOptions,
): PlannerResult {
  return {
    contentPackage: planContentPackage(sourceText, instruction, options),
    metadata: {
      source: "rules",
      confidence: estimateRuleConfidence(instruction, options),
      warnings: [],
    },
  };
}

function toKnownPlatforms(platforms: PlatformId[]): PlatformId[] {
  return uniquePlatforms(platforms).filter((platform) =>
    ALL_PLATFORMS.includes(platform),
  );
}

function createFallbackResult(
  fallback: PlannerResult,
  error: unknown,
): PlannerResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    contentPackage: fallback.contentPackage,
    metadata: {
      source: "fallback",
      confidence: fallback.metadata.confidence,
      warnings: [`LangChain Planner 失败，已回退到规则 Planner: ${message}`],
    },
  };
}

export function planContentPackage(
  sourceText: string,
  instruction: string,
  options: PlanContentPackageOptions = {},
): ContentPackage {
  return createContentPackage(sourceText, instruction, options);
}

export async function planContentPackageWithLangChain(
  sourceText: string,
  instruction: string,
  options: LangChainPlanContentPackageOptions = {},
): Promise<PlannerResult> {
  const fallback = createRulePlannerResult(sourceText, instruction, options);
  const minRuleConfidence = options.minRuleConfidence ?? 0.88;

  if (
    options.strategy !== "force_langchain" &&
    fallback.metadata.confidence >= minRuleConfidence
  ) {
    return fallback;
  }

  if (!options.model) {
    return {
      ...fallback,
      metadata: {
        ...fallback.metadata,
        warnings: ["未提供 LangChain model，已使用规则 Planner 快速路径。"],
      },
    };
  }

  try {
    const messages = await plannerPrompt.formatMessages({
      title: options.title ?? "未提供",
      sourceText,
      imageCount: String(options.images?.length ?? 0),
      videoCount: String(options.videos?.length ?? 0),
      instruction,
      ruleDraft: JSON.stringify(fallback.contentPackage),
    });
    const structuredPlanner = options.model.withStructuredOutput(plannerOutputSchema);
    const rawOutput = await structuredPlanner.invoke(messages);
    const output: PlannerStructuredOutput = plannerOutputSchema.parse(rawOutput);
    const targetPlatforms = toKnownPlatforms(output.targetPlatforms);

    return {
      contentPackage: createContentPackage(
        sourceText,
        instruction,
        options,
        targetPlatforms.length > 0
          ? targetPlatforms
          : fallback.contentPackage.targetPlatforms,
        output.publishMode,
      ),
      metadata: {
        source: "langchain",
        confidence: output.confidence,
        reasoning: output.reasoning,
        warnings: [],
      },
    };
  } catch (error) {
    return createFallbackResult(fallback, error);
  }
}

export function createPlannerChatModel(
  options: CreatePlannerChatModelOptions = {},
): LangChainPlannerModel {
  const modelName =
    options.modelName ?? process.env.CONTENT_FLOW_PLANNER_MODEL ?? "gpt-4.1-mini";
  const openAIModelName = modelName.startsWith("openai:")
    ? modelName.slice("openai:".length)
    : modelName;
  const modelOptions = {
    model: openAIModelName,
    temperature: options.temperature ?? 0,
    timeout: options.timeout ?? 15,
    maxRetries: options.maxRetries ?? 2,
    maxTokens: options.maxTokens ?? 600,
  };

  let model: ChatOpenAI | undefined;

  return {
    withStructuredOutput(schema: typeof plannerOutputSchema) {
      return {
        async invoke(input: BaseLanguageModelInput) {
          model ??= new ChatOpenAI(modelOptions);
          return model.withStructuredOutput(schema).invoke(input);
        },
      };
    },
  };
}
