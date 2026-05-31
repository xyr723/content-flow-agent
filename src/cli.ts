import {
  createDefaultSkillGateway,
  createPlannerChatModel,
  planContentPackage,
  planContentPackageWithLangChain,
  runContentPublishWorkflow,
} from "./index.js";
import type { MediaAsset, PublishMode } from "./index.js";

type PlannerMode = "rules" | "hybrid" | "langchain";

type CliOptions = {
  text?: string;
  instruction?: string;
  title?: string;
  mode?: PublishMode;
  planner: PlannerMode;
  plannerModel?: string;
  images: string[];
  videos: string[];
};

const USAGE = `Usage:
  npm start -- --text <content> --instruction <target platforms> [options]

Required:
  --text <content>             原始正文
  --instruction <instruction>  发布目标，例如 "发到公众号和 B 站"

Options:
  --title <title>              原始标题
  --image <path>               图片素材，可重复
  --video <path>               视频素材，可重复
  --mode <mock|manual_review>  发布模式，默认从 instruction 推断
  --planner <rules|hybrid|langchain>
                              Planner 模式，默认 rules
  --planner-model <model>      LangChain 模型名，例如 openai:gpt-4.1-mini
  --review                     等同于 --mode manual_review`;

function readValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parseMode(value: string): PublishMode {
  if (value === "mock" || value === "manual_review") {
    return value;
  }
  throw new Error("--mode only supports mock or manual_review in MVP");
}

function parsePlannerMode(value: string): PlannerMode {
  if (value === "rules" || value === "hybrid" || value === "langchain") {
    return value;
  }
  throw new Error("--planner only supports rules, hybrid, or langchain");
}

export function parseCliArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    planner: "rules",
    images: [],
    videos: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case "--text":
        options.text = readValue(args, index, arg);
        index += 1;
        break;
      case "--instruction":
        options.instruction = readValue(args, index, arg);
        index += 1;
        break;
      case "--title":
        options.title = readValue(args, index, arg);
        index += 1;
        break;
      case "--image":
        options.images.push(readValue(args, index, arg));
        index += 1;
        break;
      case "--video":
        options.videos.push(readValue(args, index, arg));
        index += 1;
        break;
      case "--mode":
        options.mode = parseMode(readValue(args, index, arg));
        index += 1;
        break;
      case "--planner":
        options.planner = parsePlannerMode(readValue(args, index, arg));
        index += 1;
        break;
      case "--planner-model":
        options.plannerModel = readValue(args, index, arg);
        index += 1;
        break;
      case "--review":
        options.mode = "manual_review";
        break;
      case "--help":
      case "-h":
        throw new Error(USAGE);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function toAssets(paths: string[], type: MediaAsset["type"]): MediaAsset[] {
  return paths.map((path, index) => ({
    id: `${type}-${index + 1}`,
    type,
    path,
  }));
}

function assertRequiredOptions(options: CliOptions): asserts options is CliOptions & {
  text: string;
  instruction: string;
} {
  const missing: string[] = [];
  if (!options.text) {
    missing.push("--text");
  }
  if (!options.instruction) {
    missing.push("--instruction");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required arguments: ${missing.join(", ")}`);
  }
}

async function createContentPackageFromCliOptions(
  options: CliOptions & {
    text: string;
    instruction: string;
  },
) {
  const planOptions = {
    title: options.title,
    publishMode: options.mode,
    images: toAssets(options.images, "image"),
    videos: toAssets(options.videos, "video"),
  };

  if (options.planner === "rules") {
    return planContentPackage(options.text, options.instruction, planOptions);
  }

  const plannerResult = await planContentPackageWithLangChain(
    options.text,
    options.instruction,
    {
      ...planOptions,
      model:
        options.planner === "langchain" || options.plannerModel
          ? createPlannerChatModel({ modelName: options.plannerModel })
          : undefined,
      strategy: options.planner === "langchain" ? "force_langchain" : "hybrid",
    },
  );

  return plannerResult.contentPackage;
}

export async function runCli(args: string[]): Promise<void> {
  const options = parseCliArgs(args);
  assertRequiredOptions(options);

  const contentPackage = await createContentPackageFromCliOptions(options);

  const report = await runContentPublishWorkflow(
    contentPackage,
    createDefaultSkillGateway(),
  );

  console.log(JSON.stringify(report, null, 2));
}

runCli(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${message}\n\n${USAGE}`);
  process.exitCode = 1;
});
