import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const targetUrl = process.env.GUI_URL ?? "http://127.0.0.1:4173/";
const chromeBin = process.env.CHROME_BIN ?? "/usr/bin/google-chrome";
const debugPort = Number(process.env.CHROME_DEBUG_PORT ?? 9333);

function assert(value, message) {
  if (!value) throw new Error(message);
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
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

async function createCdpClient(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  let nextId = 1;

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const callbacks = pending.get(message.id);
    if (!callbacks) return;
    pending.delete(message.id);
    if (message.error) {
      callbacks.reject(new Error(message.error.message));
    } else {
      callbacks.resolve(message.result);
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

async function main() {
  const profileDir = await mkdtemp(join(tmpdir(), "cfa-chrome-"));
  const chrome = spawn(chromeBin, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    targetUrl,
  ], {
    stdio: ["ignore", "ignore", "pipe"],
  });

  let client;
  try {
    const targets = await waitForJson(`http://127.0.0.1:${debugPort}/json/list`);
    const pageTarget = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
    assert(pageTarget, "未找到 Chrome 页面调试目标");
    client = await createCdpClient(pageTarget.webSocketDebuggerUrl);
    await client.send("Runtime.enable");
    await client.send("Page.enable");
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
    }));

    await evaluate(client, browserStep(() => {
      if (!document.querySelector("#content-form")) throw new Error("缺少内容表单");
      if (!document.querySelector("[data-mode='mock']")) throw new Error("缺少模拟发布按钮");
      if (!document.querySelector("[data-mode='manual_review']")) throw new Error("缺少人工审核按钮");
      if (!document.querySelector("[data-mode='real']")) throw new Error("缺少真实发布预检按钮");
    }));

    await evaluate(client, browserStep(async () => {
      const waitForText = async (text) => {
        await new Promise((resolve, reject) => {
          const startedAt = Date.now();
          const tick = () => {
            const pageText = document.body.textContent ?? "";
            if (pageText.includes(text)) resolve(undefined);
            else if (Date.now() - startedAt > 6000) reject(new Error(`等待文本超时: ${text}`));
            else setTimeout(tick, 80);
          };
          tick();
        });
      };
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

      setValue("#title-input", "浏览器自动化 Mock");
      setValue("#source-text", "这是一段由浏览器自动化填入并提交到后端的正文。");
      setValue("#image-paths", "cover.png\ndetail.png");
      setValue("#video-paths", "demo.mp4");
      setPlatforms(["wechat", "bilibili"]);
      document.querySelector("[data-mode='mock']").click();
      await waitForText("模拟发布完成");
      await waitForText("公众号");
      await waitForText("B 站");
      await waitForText("模拟发布成功");

      setValue("#title-input", "浏览器自动化审核");
      setValue("#source-text", "这是一段由浏览器自动化进入人工审核的正文。");
      setPlatforms(["wechat", "zhihu"]);
      document.querySelector("[data-mode='manual_review']").click();
      await waitForText("等待人工审核");
      document.querySelector("[data-review-action='approve']").click();
      await waitForText("审核后模拟发布完成");
      await waitForText("模拟发布成功");

      document.querySelector("[data-mode='manual_review']").click();
      await waitForText("等待人工审核");
      document.querySelector("[data-review-action='reject']").click();
      await waitForText("人工审核已拒绝");
      await waitForText("审核拒绝");

      document.querySelector("[data-mode='manual_review']").click();
      await waitForText("等待人工审核");
      document.querySelector("[data-review-action='edit_first']").click();
      await waitForText("审核后模拟发布完成");
      await waitForText("已审核");

      setValue("#title-input", "浏览器自动化真实预检");
      setValue("#source-text", "这是一段由浏览器自动化进入真实发布预检的正文。");
      setPlatforms(["wechat"]);
      document.querySelector("[data-mode='real']").click();
      await waitForText("真实发布预检完成");
      await waitForText("真实发布未配置: 公众号");
    }));

    console.log("GUI browser smoke passed");
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
