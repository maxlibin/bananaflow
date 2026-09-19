import { test } from "node:test";
import assert from "node:assert/strict";

import { expandWildcards } from "../src/lib/bulk-wildcards";

test("no braces returns input unchanged", () => {
  const r = expandWildcards("A red hat", 1000);
  assert.deepEqual(r.prompts, ["A red hat"]);
  assert.equal(r.count, 1);
  assert.equal(r.truncated, false);
});

test("single group → N prompts", () => {
  const r = expandWildcards("A {red|blue|green} hat", 1000);
  assert.deepEqual(r.prompts, ["A red hat", "A blue hat", "A green hat"]);
  assert.equal(r.count, 3);
});

test("two groups → cartesian", () => {
  const r = expandWildcards("A {red|blue} {hat|cap}", 1000);
  assert.equal(r.count, 4);
  assert.deepEqual(r.prompts, [
    "A red hat",
    "A red cap",
    "A blue hat",
    "A blue cap",
  ]);
});

test("three groups → cartesian (2x2x2)", () => {
  const r = expandWildcards("{a|b} {c|d} {e|f}", 1000);
  assert.equal(r.count, 8);
});

test("escape produces literal brace", () => {
  const r = expandWildcards("A \\{literal\\} brace", 1000);
  assert.deepEqual(r.prompts, ["A {literal} brace"]);
  assert.equal(r.count, 1);
});

test("empty option produces blank substitution", () => {
  const r = expandWildcards("A {a||c} hat", 1000);
  assert.deepEqual(r.prompts, ["A a hat", "A  hat", "A c hat"]);
  assert.equal(r.count, 3);
});

test("single-option group is a no-op", () => {
  const r = expandWildcards("just {one} option", 1000);
  assert.deepEqual(r.prompts, ["just one option"]);
});

test("count beyond cap returns truncated", () => {
  const r = expandWildcards("{a|b|c|d|e|f}", 5);
  assert.equal(r.prompts.length, 5);
  assert.equal(r.count, 6);
  assert.equal(r.truncated, true);
});

test("malformed unclosed brace throws", () => {
  assert.throws(() => expandWildcards("A {red|blue hat", 1000), /unclosed/i);
});

test("nested braces are not supported v1; throw helpful error", () => {
  assert.throws(
    () => expandWildcards("A {a {b|c}}", 1000),
    /nested|not supported/i,
  );
});
