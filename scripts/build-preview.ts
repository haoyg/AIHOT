// A static, clearly labelled UI preview. No database, collection or paid calls.
import { createServer } from "node:http";
import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { startWebServer } from "../apps/web/tests/web-server.ts";

const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, ".data/pages-preview");
const at = "2026-10-07T04:00:00.000Z";
const items = [
  ["preview-model", "ai-models", "示例：AI 模型更新在这里展示", "正式启用采集后，这里会展示经过筛选的模型更新、原文链接与中文摘要。当前文字仅用于预览排版。"],
  ["preview-tool", "ai-products", "示例：AI 工具与产品动态", "你可以在这个区域查看工具更新，之后也可以增加原创使用教程与实战项目。"],
  ["preview-tutorial", "tip", "示例：从资讯走向实战教学", "这里展示文章卡片效果。课程、支付、学习进度尚未开发，当前没有真实新闻或付费服务。"],
].map(([id, category, title, summary]) => ({ id, category, title, summary, reason: "界面示例，不是自动采集的新闻。", source: { name: "预览示例" }, publishedAt: at, timelineAt: at, tags: [], score: null, selected: true, channel: "news", x: null }));
const api = createServer((req, res) => {
  const url = new URL(req.url!, "http://preview");
  const p = url.pathname;
  res.setHeader("Content-Type", "application/json");
  let value: unknown;
  if (p === "/api/site/meta") value = { changelogVersion: null };
  else if (p === "/api/site/timeline") value = { filters: { channel: "all", category: null, tag: null }, cards: items.map(item => ({ key: item.id, anchorAt: at, item, group: null })), nextCursor: null, hot: null, dayCounts: { "2026-10-07": 3 } };
  else if (p === "/api/site/pool") value = { filters: { channel: "all", category: null, tag: null, q: null, tab: "time" }, items, page: 1, pageCount: 1, total: 3, todayCount: 3, freshness: at };
  else if (p === "/api/site/hot") value = { computedAt: at, windowHours: 48, entries: [] };
  else if (p === "/api/site/topics") value = { groups: [], topics: [] };
  else if (p.match(/^\/api\/site\/reports\/(daily|weekly|monthly)\/latest-page$/)) value = { report: null, index: [] };
  else if (p.startsWith("/api/site/items/")) {
    const item = items.find(i => i.id === p.split("/").at(-1));
    if (item) value = { ...item, originalTitle: item.title, links: { original: null }, discoveredAt: at, story: null, readingMode: "summary", author: null, body: { zh: null, original: null, zhKind: null, complete: false }, outline: [], relatedStories: [], topics: [], indexable: false, markdownAvailable: false, group: null, hasTranslation: false, bodyLanguage: "zh" };
  }
  if (value === undefined) { res.statusCode = 404; value = { code: "not_found" }; }
  res.end(JSON.stringify(value));
});
await mkdir(output, { recursive: true });
await cp(path.join(root, "apps/web/build/client/assets"), path.join(output, "assets"), { recursive: true });
for (const file of ["favicon.ico", "icon.png", "icon-192.png", "apple-icon.png", "logo.svg"]) await cp(path.join(root, "site/brand", file), path.join(output, file));
const web = await startWebServer(api, { SITE_URL: "https://ai-learning.top" });
const banner = '<div style="background:#fff4d6;color:#624300;padding:12px 20px;text-align:center;font:14px/1.6 sans-serif">界面预览 · 内容为示例 · 采集、模型、后台及课程功能尚未启用</div>';
try {
  for (const route of ["/", "/all", "/hot", "/topics", "/daily", "/weekly", "/monthly", "/about", "/more", ...items.map(i => `/items/${i.id}`)]) {
    const response = await fetch(web.origin + route);
    if (!response.ok) throw new Error(`${route}: HTTP ${response.status}`);
    let html = await response.text();
    html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<link\b[^>]*rel="modulepreload"[^>]*>/gi, "");
    html = html.replace(/<head>/, '<head><meta name="robots" content="noindex,nofollow">').replace(/(<body[^>]*>)/, `$1${banner}`);
    html = html.replace(/<form\b[\s\S]*?<\/form>/gi, "");
    const directory = path.join(output, route.slice(1));
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "index.html"), html);
    console.log(`preview ${route}`);
  }
  const unavailable = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="robots" content="noindex"><title>界面预览</title><body>${banner}<main style="max-width:700px;margin:80px auto;font:18px/1.8 sans-serif"><h1>此功能尚未启用</h1><p>当前版本仅展示页面效果，完整后端仍在适配。</p><a href="/">返回首页</a></main></body></html>`;
  for (const route of ["admin", "admin/login", "terms", "privacy", "feedback", "agent", "starred", "changelog", "daily/archive"]) {
    await mkdir(path.join(output, route), { recursive: true });
    await writeFile(path.join(output, route, "index.html"), unavailable);
  }
  await writeFile(path.join(output, "404.html"), unavailable);
  await writeFile(path.join(output, "robots.txt"), "User-agent: *\nDisallow: /\n");
  await writeFile(path.join(output, "_headers"), "/*\n  X-Robots-Tag: noindex, nofollow\n  X-Content-Type-Options: nosniff\n  Cache-Control: no-store\n");
} finally { await web.stop(); }
console.log(output);
