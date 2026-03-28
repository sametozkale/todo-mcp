import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string; name: string };

/** Published npm version (keeps MCP server `version` in sync with `package.json`). */
export const PACKAGE_VERSION = pkg.version;
