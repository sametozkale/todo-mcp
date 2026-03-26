import { spawn } from "node:child_process";

// Simple smoke test against Flowdo /api/mcp endpoint (no MCP stdio framing).
// Usage:
//   FLOWDO_API_BASE_URL=http://localhost:3001 FLOWDO_API_KEY=flowdo_... node apps/mcp-server/scripts/smoke.mjs

const baseUrl = (process.env.FLOWDO_API_BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const apiKey = process.env.FLOWDO_API_KEY;

if (!apiKey) {
  console.error("Missing FLOWDO_API_KEY");
  process.exit(1);
}

async function call(tool, payload = {}) {
  const res = await fetch(`${baseUrl}/api/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool, apiKey, ...payload }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${tool} failed (${res.status}): ${text}`);
  }
  return JSON.parse(text);
}

const runId = `mcp-smoke-${Date.now()}`;

console.log(`[${runId}] list_lists`);
const lists = await call("list_lists");
const today = lists.find((l) => l.slug === "today") ?? lists[0];
console.log("Today:", today?.id, today?.title);

console.log(`[${runId}] create_todo (today)`);
const created = await call("create_todo", { title: `From MCP smoke ${runId}`, listId: today?.id ?? null });
console.log("Created todo:", created?.id);

console.log(`[${runId}] update_todo (complete)`);
const updated = await call("update_todo", { id: created.id, is_completed: true });
console.log("Updated todo completed:", updated?.is_completed);

console.log(`[${runId}] delete_todo`);
const del = await call("delete_todo", { id: created.id });
console.log("Delete result:", del);

console.log(`[${runId}] create_todo (listRef '/todo-work', creates list if missing)`);
const created2 = await call("create_todo", {
  title: `Work todo ${runId}`,
  listRef: "/todo-work",
});
console.log("Created2 todo:", created2?.id);

console.log("OK");

