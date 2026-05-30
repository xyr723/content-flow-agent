import {
  createDefaultSkillGateway,
  planContentPackage,
  runContentPublishWorkflow,
} from "./index.js";

const contentPackage = planContentPackage(
  "这篇内容介绍如何把一份原始素材适配到多个内容平台，并在发布前完成校验和人工审核。",
  "发到公众号、知乎、小红书、B 站和抖音",
  {
    title: "多平台内容分发 MVP",
    images: [{ id: "cover", type: "image", path: "assets/cover.png", alt: "封面图" }],
    videos: [{ id: "demo", type: "video", path: "assets/demo.mp4", alt: "演示视频" }],
  },
);

const gateway = createDefaultSkillGateway();
const result = await runContentPublishWorkflow(contentPackage, gateway);

console.log(JSON.stringify(result, null, 2));
