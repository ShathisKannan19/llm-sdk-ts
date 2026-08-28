import test from "node:test";
import assert from "node:assert/strict";

import { CAPABILITY_NAMES } from "../src/llm/index.js";

test("sdk capability list excludes realtime", () => {
  assert.ok(CAPABILITY_NAMES.includes("text"));
  assert.ok(CAPABILITY_NAMES.includes("structured"));
  assert.equal(CAPABILITY_NAMES.includes("realtime" as never), false);
});
