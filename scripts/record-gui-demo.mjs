import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";

const targetUrl = process.env.GUI_URL ?? "http://127.0.0.1:4173/";
const chromeBin = process.env.CHROME_BIN ?? "/usr/bin/google-chrome";
const debugPort = Number(process.env.CHROME_DEBUG_PORT ?? 9334);
const outputVideo = process.env.DEMO_VIDEO ?? "docs/assets/demo/content-flow-agent-demo.webm";
const outputPoster = process.env.DEMO_POSTER ?? "docs/assets/demo/content-flow-agent-demo.png";
const viewport = { width: 1365, height: 768 };

function assert(value, message) {
  if (!value) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJson(url, timeoutMs = 5000) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }

  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

async function createCdpClient(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  const listeners = new Map();
  let nextId = 1;

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const callbacks = pending.get(message.id);
      if (!callbacks) return;
      pending.delete(message.id);
      if (message.error) {
        callbacks.reject(new Error(message.error.message));
      } else {
        callbacks.resolve(message.result);
      }
      return;
    }

    const handlers = listeners.get(message.method);
    if (handlers) {
      handlers.forEach((handler) => handler(message.params));
    }
  });

  return {
    send(method, params = {}) {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
    },
    on(method, handler) {
      const handlers = listeners.get(method) ?? [];
      handlers.push(handler);
      listeners.set(method, handlers);
    },
    close() {
      socket.close();
    },
  };
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    const exception = result.exceptionDetails.exception;
    throw new Error(exception?.description ?? exception?.value ?? result.exceptionDetails.text);
  }
  return result.result.value;
}

function browserStep(script) {
  return `(${script.toString()})()`;
}

function sampleFrames(frames, maxFrames) {
  if (frames.length <= maxFrames) return frames;
  const sampled = [];
  const stride = (frames.length - 1) / (maxFrames - 1);
  for (let index = 0; index < maxFrames; index += 1) {
    sampled.push(frames[Math.round(index * stride)]);
  }
  return sampled;
}

async function encodeWebm(client, jpegFrames) {
  const dataUrls = sampleFrames(jpegFrames, 96).map((frame) => `data:image/jpeg;base64,${frame}`);
  await client.send("Page.navigate", { url: "about:blank" });
  await sleep(300);

  return evaluate(
    client,
    `(${async function createVideo(frames, width, height) {
      document.body.style.margin = "0";
      document.body.style.background = "#f7f4ec";

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      document.body.appendChild(canvas);
      const context = canvas.getContext("2d");
      const stream = canvas.captureStream(24);
      const mimeTypes = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      const mimeType = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error("当前 Chrome 不支持 WebM MediaRecorder");

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2500000,
      });
      const chunks = [];
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      });
      const stopped = new Promise((resolve) => {
        recorder.addEventListener("stop", resolve, { once: true });
      });

      const loadImage = (src) =>
        new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = src;
        });

      const images = [];
      for (const frame of frames) {
        images.push(await loadImage(frame));
      }

      const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      recorder.start();
      for (const image of images) {
        context.fillStyle = "#f7f4ec";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        await pause(120);
      }
      recorder.stop();
      await stopped;

      const blob = new Blob(chunks, { type: mimeType });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      const chunkSize = 0x8000;
      for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
      }
      return btoa(binary);
    }})(${JSON.stringify(dataUrls)}, ${viewport.width}, ${viewport.height})`,
  );
}

async function driveDemo(client) {
  await evaluate(client, browserStep(async () => {
    const waitForText = async (text) => {
      await new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const tick = () => {
          const pageText = document.body.textContent ?? "";
          if (pageText.includes(text)) resolve(undefined);
          else if (Date.now() - startedAt > 7000) reject(new Error(`等待文本超时: ${text}`));
          else setTimeout(tick, 80);
        };
        tick();
      });
    };
    const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const setValue = (selector, value) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`找不到元素: ${selector}`);
      element.value = value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const setPlatforms = (platforms) => {
      document.querySelectorAll("input[name='platform']").forEach((input) => {
        input.checked = platforms.includes(input.value);
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    };
    const showResults = async () => {
      document.querySelector("#status")?.scrollIntoView({ block: "start", behavior: "smooth" });
      await pause(900);
    };

    await pause(900);
    setValue("#title-input", "录屏演示：多平台内容发布闭环");
    setValue(
      "#source-text",
      "这是一段用于录屏验收的真实输入内容。系统会调用 Node 后端，经过 Planner、Workflow、Skill、校验器、人工审核和 Publisher，输出多平台草稿与发布报告。",
    );
    setValue("#image-paths", "assets/cover.png\\nassets/detail.png");
    setValue("#video-paths", "assets/demo.mp4");
    setPlatforms(["wechat", "zhihu", "xiaohongshu", "bilibili", "douyin"]);
    await pause(900);

    document.querySelector("[data-mode='mock']").click();
    await waitForText("模拟发布完成");
    await waitForText("模拟发布成功");
    await showResults();

    document.querySelector(".page-head")?.scrollIntoView({ block: "start", behavior: "smooth" });
    await pause(700);
    document.querySelector("[data-mode='manual_review']").click();
    await waitForText("等待人工审核");
    await showResults();
    document.querySelector("[data-review-action='approve']").click();
    await waitForText("审核后模拟发布完成");
    await showResults();

    document.querySelector(".page-head")?.scrollIntoView({ block: "start", behavior: "smooth" });
    await pause(700);
    document.querySelector("[data-mode='manual_review']").click();
    await waitForText("等待人工审核");
    await showResults();
    document.querySelector("[data-review-action='edit_first']").click();
    await waitForText("已审核");
    await showResults();

    document.querySelector(".page-head")?.scrollIntoView({ block: "start", behavior: "smooth" });
    await pause(700);
    setPlatforms(["wechat"]);
    document.querySelector("[data-mode='real']").click();
    await waitForText("真实发布预检完成");
    await waitForText("真实发布未配置: 公众号");
    await showResults();
    await pause(800);
  }));
}

async function main() {
  const profileDir = await mkdtemp(join(tmpdir(), "cfa-record-chrome-"));
  const chrome = spawn(chromeBin, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    `--window-size=${viewport.width},${viewport.height}`,
    targetUrl,
  ], {
    stdio: ["ignore", "ignore", "pipe"],
  });

  const frames = [];
  let client;

  try {
    const targets = await waitForJson(`http://127.0.0.1:${debugPort}/json/list`);
    const pageTarget = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
    assert(pageTarget, "未找到 Chrome 页面调试目标");
    client = await createCdpClient(pageTarget.webSocketDebuggerUrl);
    client.on("Page.screencastFrame", (params) => {
      frames.push(params.data);
      client.send("Page.screencastFrameAck", { sessionId: params.sessionId }).catch(() => undefined);
    });

    await client.send("Runtime.enable");
    await client.send("Page.enable");
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await client.send("Page.navigate", { url: targetUrl });

    await evaluate(client, browserStep(async () => {
      await new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const tick = () => {
          if (document.readyState === "complete") resolve(undefined);
          else if (Date.now() - startedAt > 5000) reject(new Error("页面加载超时"));
          else setTimeout(tick, 50);
        };
        tick();
      });
      if (!document.querySelector("#content-form")) throw new Error("缺少内容表单");
    }));

    await client.send("Page.startScreencast", {
      format: "jpeg",
      quality: 72,
      everyNthFrame: 1,
    });
    await driveDemo(client);
    await client.send("Page.stopScreencast");

    assert(frames.length > 2, "录屏帧数不足");
    const poster = await client.send("Page.captureScreenshot", { format: "png" });
    const webmBase64 = await encodeWebm(client, frames);

    await mkdir(dirname(outputVideo), { recursive: true });
    await writeFile(outputVideo, Buffer.from(webmBase64, "base64"));
    await writeFile(outputPoster, Buffer.from(poster.data, "base64"));
    console.log(`Recorded GUI demo: ${outputVideo}`);
    console.log(`Captured poster: ${outputPoster}`);
    console.log(`Captured frames: ${frames.length}`);
  } finally {
    client?.close();
    chrome.kill("SIGTERM");
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 1000);
      chrome.once("exit", () => {
        clearTimeout(timer);
        resolve(undefined);
      });
    });
    await rm(profileDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  }
}

await main();
