/**
 * Scan the widget with axe-core 4.10.x. No npm packages are added.
 * Chrome or Edge is driven with the built-in WebSocket client, and axe-core
 * is downloaded at run time.
 *
 * In a browser, without this script: serve the repo, open demo/blank.html and
 * savanna/pages/concept-with-navigation.html, open the chat panel, each
 * accessibility tab, and Talk to a person, then run axe in the console:
 *   axe.run(document.querySelector("db-assistant").shadowRoot)
 *   axe.run(document, { exclude: [["db-assistant"]] })
 */

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AXE_URLS = [
  "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.3/axe.min.js",
  "https://unpkg.com/axe-core@4.10.3/axe.min.js",
];
const PAGES = [
  { name: "demo/blank.html", path: "/demo/blank.html" },
  { name: "savanna/pages/concept-with-navigation.html", path: "/savanna/pages/concept-with-navigation.html" },
  { name: "savanna/pages/jobs.html", path: "/savanna/pages/jobs.html" },
];

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function browserPath() {
  const local = process.env.LOCALAPPDATA || "";
  const candidates = [
    path.join(local, "Google", "Chrome", "Application", "chrome.exe"),
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  return candidates.find(function (file) {
    return file && fs.existsSync(file);
  });
}

function serve() {
  const server = createServer(function (req, res) {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const decoded = decodeURIComponent(url.pathname);
    const file = path.normalize(path.join(root, decoded));
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(file, function (error, body) {
      if (error) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
      res.end(body);
    });
  });
  return new Promise(function (resolve) {
    server.listen(0, "127.0.0.1", function () {
      resolve({ server: server, port: server.address().port });
    });
  });
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

async function axeSource() {
  let last = "";
  for (const url of AXE_URLS) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        last = response.status + " " + url;
        continue;
      }
      return await response.text();
    } catch (error) {
      last = error.message;
    }
  }
  throw new Error("Could not download axe-core 4.10.3 (" + last + "). " + inBrowser());
}

function inBrowser() {
  return [
    "In-browser method: serve this repo, open demo/blank.html and",
    "savanna/pages/concept-with-navigation.html, open the chat panel,",
    "each accessibility tab, and Talk to a person, then in the console run",
    "axe.run(document.querySelector('db-assistant').shadowRoot) and",
    "axe.run(document, { exclude: [['db-assistant']] }).",
  ].join(" ");
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const listeners = [];
  return new Promise(function (resolve, reject) {
    ws.addEventListener("open", function () {
      resolve({
        send(method, params) {
          const msgId = ++id;
          return new Promise(function (ok, fail) {
            pending.set(msgId, { ok: ok, fail: fail });
            ws.send(JSON.stringify({ id: msgId, method: method, params: params || {} }));
          });
        },
        close() {
          ws.close();
        },
      });
    });
    ws.addEventListener("error", function () {
      reject(new Error("Could not connect to the browser debugger."));
    });
    ws.addEventListener("message", function (event) {
      const raw = typeof event.data === "string" ? event.data : String(event.data);
      const msg = JSON.parse(raw);
      if (msg.id && pending.has(msg.id)) {
        const waiter = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) waiter.fail(new Error(msg.error.message));
        else waiter.ok(msg.result);
      } else {
        listeners.forEach(function (fn) {
          fn(msg);
        });
      }
    });
  });
}

async function evaluate(page, expression) {
  const result = await page.send("Runtime.evaluate", {
    expression: expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    const text = result.exceptionDetails.text || "evaluate failed";
    const extra = result.exceptionDetails.exception && result.exceptionDetails.exception.description;
    throw new Error(extra || text);
  }
  return result.result && result.result.value;
}

async function waitFor(page, expression) {
  const start = Date.now();
  while (Date.now() - start < 20000) {
    const value = await evaluate(page, expression);
    if (value) return value;
    await sleep(200);
  }
  throw new Error("Timed out waiting for the widget.");
}

function count(list) {
  const nodes = { critical: 0, serious: 0 };
  const rules = { critical: 0, serious: 0 };
  for (const item of list) {
    rules[item.impact] += 1;
    nodes[item.impact] += item.nodes.length;
  }
  return { rules: rules, nodes: nodes };
}

function addCounts(total, part) {
  total.rules.critical += part.rules.critical;
  total.rules.serious += part.rules.serious;
  total.nodes.critical += part.nodes.critical;
  total.nodes.serious += part.nodes.serious;
}

async function main() {
  const exe = browserPath();
  if (!exe) {
    console.error("Chrome or Edge was not found. " + inBrowser());
    process.exitCode = 1;
    return;
  }
  const source = await axeSource();
  const site = await serve();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "db-axe-"));
  const debugPort = 9300 + Math.floor(Math.random() * 400);
  const browser = spawn(exe, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=" + profile,
    "--remote-debugging-port=" + debugPort,
    "about:blank",
  ], { stdio: "ignore" });
  let page;
  try {
    let version;
    for (let i = 0; i < 40; i += 1) {
      try {
        const response = await fetch("http://127.0.0.1:" + debugPort + "/json/version");
        if (response.ok) {
          version = await response.json();
          break;
        }
      } catch {
        await sleep(250);
      }
    }
    if (!version) throw new Error("The browser debugger did not start. " + inBrowser());
    const listResponse = await fetch("http://127.0.0.1:" + debugPort + "/json/list");
    const targets = await listResponse.json();
    const target = targets.find(function (item) {
      return item.type === "page";
    });
    page = await connect(target.webSocketDebuggerUrl);
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: source });

    const moduleTotal = { rules: { critical: 0, serious: 0 }, nodes: { critical: 0, serious: 0 } };
    const hostTotal = { rules: { critical: 0, serious: 0 }, nodes: { critical: 0, serious: 0 } };
    let moduleProblems = 0;

    for (const item of PAGES) {
      console.log("\n" + item.name);
      await page.send("Page.navigate", { url: "http://127.0.0.1:" + site.port + item.path });
      await waitFor(page, "document.readyState === 'complete' && !!document.querySelector('db-assistant') && !document.querySelector('db-assistant').hidden && !!document.querySelector('db-assistant').shadowRoot");
      const states = await evaluate(page, `(() => {
        const root = document.querySelector("db-assistant").shadowRoot;
        return JSON.stringify(Array.from(root.querySelectorAll("[role='tab']")).map((tab, index) => ({
          index: index,
          name: (tab.textContent || "").trim() || ("tab-" + index)
        })));
      })()`);
      const tabs = JSON.parse(states);
      const runs = [{ id: "chat", open: "chat" }];
      for (const tab of tabs) runs.push({ id: "a11y:" + tab.name, open: "a11y", index: tab.index });
      runs.push({ id: "person", open: "person" });

      for (const run of runs) {
        await evaluate(page, `(() => {
          const root = document.querySelector("db-assistant").shadowRoot;
          const mode = ${JSON.stringify(run.open)};
          const index = ${JSON.stringify(run.index || 0)};
          if (mode === "chat") {
            const dialog = root.querySelector("#db-panel");
            if (!dialog.open) root.querySelector(".launcher-chat").click();
          } else if (mode === "a11y") {
            const dialog = root.querySelector("#db-a11y-panel");
            if (!dialog.open) root.querySelector(".launcher-a11y").click();
            const tabs = root.querySelectorAll("[role='tab']");
            if (tabs[index]) tabs[index].click();
          } else {
            const chat = root.querySelector("#db-panel");
            if (!chat.open) root.querySelector(".launcher-chat").click();
            const person = root.querySelector("dialog.person");
            if (!person.open) root.querySelector(".talk").click();
          }
          return true;
        })()`);
        await waitFor(page, `(() => {
          const root = document.querySelector("db-assistant").shadowRoot;
          const mode = ${JSON.stringify(run.open)};
          if (mode === "chat") return root.querySelector("#db-panel").open;
          if (mode === "a11y") return root.querySelector("#db-a11y-panel").open;
          return root.querySelector("dialog.person").open;
        })()`);
        const raw = await evaluate(page, `(async () => {
          const host = document.querySelector("db-assistant");
          const pick = (result) => (result.violations || [])
            .filter((item) => item.impact === "critical" || item.impact === "serious")
            .map((item) => ({
              id: item.id,
              impact: item.impact,
              help: item.help,
              nodes: item.nodes.slice(0, 15).map((node) => ({
                target: (node.target || []).join(" "),
                html: String(node.html || "").slice(0, 220)
              }))
            }));
          const widget = Array.from(host.shadowRoot.children).filter((el) => el.tagName !== "STYLE");
          const moduleResult = await axe.run(widget);
          const hostResult = await axe.run(document.body, { exclude: [["db-assistant"]] });
          return JSON.stringify({ module: pick(moduleResult), host: pick(hostResult) });
        })()`);
        const report = JSON.parse(raw);
        const moduleCount = count(report.module);
        const hostCount = count(report.host);
        addCounts(moduleTotal, moduleCount);
        addCounts(hostTotal, hostCount);
        moduleProblems += moduleCount.rules.critical + moduleCount.rules.serious;
        console.log(
          "  " + run.id +
          "  module " + moduleCount.rules.critical + " critical / " + moduleCount.rules.serious + " serious" +
          "  host " + hostCount.rules.critical + " critical / " + hostCount.rules.serious + " serious"
        );
        for (const side of ["module", "host"]) {
          for (const violation of report[side]) {
            console.log("    " + side + " " + violation.impact + " " + violation.id + " — " + violation.help);
            for (const node of violation.nodes) {
              console.log("      " + node.target + " " + node.html);
            }
          }
        }
      }
    }

    console.log(
      "\nmodule total: " + moduleTotal.rules.critical + " critical, " + moduleTotal.rules.serious +
      " serious (" + moduleTotal.nodes.critical + " / " + moduleTotal.nodes.serious + " nodes, summed across states)"
    );
    console.log(
      "host total: " + hostTotal.rules.critical + " critical, " + hostTotal.rules.serious +
      " serious (" + hostTotal.nodes.critical + " / " + hostTotal.nodes.serious + " nodes, summed across states)"
    );
    if (moduleProblems) process.exitCode = 1;
  } finally {
    try {
      if (page) page.close();
    } catch {
      /* The debugger socket may already be closed. */
    }
    if (browser.exitCode == null && browser.signalCode == null) {
      browser.kill();
      await new Promise(function (resolve) {
        const timer = setTimeout(resolve, 1500);
        browser.once("exit", function () {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    site.server.close();
    try {
      fs.rmSync(profile, { recursive: true, force: true });
    } catch {
      /* Chrome can keep the profile locked for a moment. The folder is temporary. */
    }
  }
}

main().catch(function (error) {
  console.error(error && error.stack ? error.stack : error);
  console.error(inBrowser());
  process.exitCode = 1;
});
