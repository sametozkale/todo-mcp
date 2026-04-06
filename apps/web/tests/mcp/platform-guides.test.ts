import { describe, expect, it } from "vitest";
import { DEFAULT_PLATFORM_ORDER, getTryToolGuide } from "@/lib/mcp-platform-guides";

describe("mcp platform try-tool guides", () => {
  it("provides examples for every platform", () => {
    for (const id of DEFAULT_PLATFORM_ORDER) {
      const guide = getTryToolGuide(id);
      expect(guide.title.length).toBeGreaterThan(0);
      expect(guide.examples.length).toBeGreaterThan(0);
    }
  });

  it("includes slash alias and exact MCP tool names in non-CLI flows", () => {
    const guide = getTryToolGuide("claudeWeb");
    expect(guide.examples.some((x) => x.includes("/create-todo"))).toBe(true);
    expect(guide.examples.some((x) => x.includes("create_todo"))).toBe(true);
    expect(guide.examples.some((x) => x.includes("list_todos"))).toBe(true);
  });
});
