// Unit tests for pure lib functions. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
// @ts-expect-error: Node runs .ts directly (--experimental-strip-types)
import { findContactInfo, scrubContactInfo } from "../../src/lib/contact.ts";
// @ts-expect-error: as above
import { looksLikeUrl, normaliseUrl, readUrlParam, slugify } from "../../src/lib/url.ts";

test("normaliseUrl: the board identity", () => {
  const want = "https://luma.com/dde-ldn-hack";
  for (const u of ["lu.ma/dde-ldn-hack", "https://www.luma.com/dde-ldn-hack/?utm_source=x", "LUMA.COM/dde-ldn-hack#top", "http://luma.com/dde-ldn-hack"]) {
    assert.equal(normaliseUrl(u), want, u);
  }
  assert.equal(normaliseUrl("https://www.runfestsilverstone.com"), "https://runfestsilverstone.com");
  assert.equal(normaliseUrl("https://www.runfestsilverstone.com/"), "https://runfestsilverstone.com");
  assert.equal(normaliseUrl("https://github.com/vercel/mcp-handler"), "https://github.com/vercel/mcp-handler");
  assert.equal(normaliseUrl("twitter.com/someone"), "https://x.com/someone");
  assert.equal(normaliseUrl("m.facebook.com/events/1"), "https://facebook.com/events/1");
  for (const bad of ["", "silverstone half", "localhost", "ftp://x.com/a", "mailto:a@b.com"]) {
    assert.equal(normaliseUrl(bad), null, bad);
  }
});

test("looksLikeUrl", () => {
  for (const u of ["https://x.com", "lu.ma/dde-ldn-hack", "runfestsilverstone.com"]) assert.ok(looksLikeUrl(u), u);
  for (const q of ["silverstone half marathon", "silverstone-half", "Silverstone Half Marathon"]) assert.ok(!looksLikeUrl(q), q);
});

test("slugify", () => {
  assert.equal(slugify("Silverstone Half Marathon"), "silverstone-half-marathon");
  assert.equal(slugify("DevDay Community Hackathon: London!"), "devday-community-hackathon-london");
  assert.equal(slugify("Café Crème"), "cafe-creme");
  assert.ok(slugify("a".repeat(80)).length <= 40);
  assert.equal(slugify("!!!"), "board");
});

test("findContactInfo: innocent posts pass", () => {
  for (const s of [
    "My human needs a lift from east London to the Silverstone Half. Whose human is driving?",
    "My human needs a lift on 2026-11-22 from E8, leaving 6:15am, sub 1:45 pace, £15 fuel.",
    "Race number 12345, 2 seats, 13.1 miles, 22/11/2026, 22-11-2026",
    "My human is stuck adding OAuth to an MCP server built with Next.js 16 on Vercel.",
  ]) assert.deepEqual(findContactInfo(s), [], s);
});

test("findContactInfo: contact details are caught", () => {
  assert.deepEqual(findContactInfo("Call 07700 900123 so drivers can reach me"), ["phone"]);
  assert.deepEqual(findContactInfo("My human (+44 7700 900123) needs a lift"), ["phone"]);
  assert.deepEqual(findContactInfo("My human is sam@example.com"), ["email"]);
  assert.deepEqual(findContactInfo("DM @samruns"), ["handle"]);
  assert.deepEqual(findContactInfo("see instagram.com/samruns"), ["url"]);
  assert.deepEqual(findContactInfo("wa.me/447700900123"), ["phone", "url"]);
});

test("scrubContactInfo", () => {
  assert.equal(scrubContactInfo("Call 07700 900123 or sam@example.com, @samruns"), "Call [removed] or [removed], [removed]");
  assert.equal(scrubContactInfo("Can get to Dalston by 6am."), "Can get to Dalston by 6am.");
});

test("readUrlParam: raw or encoded ?url=", () => {
  const B = "https://awkwardboard.com/agents.md";
  assert.equal(readUrlParam(`${B}?url=https://luma.com/dde-ldn-hack`), "https://luma.com/dde-ldn-hack");
  assert.equal(readUrlParam(`${B}?url=https%3A%2F%2Fluma.com%2Fdde-ldn-hack`), "https://luma.com/dde-ldn-hack");
  assert.equal(readUrlParam(`${B}?url=https://www.runfestsilverstone.com&a=x`), "https://www.runfestsilverstone.com");
  assert.equal(readUrlParam(`${B}?a=x&url=lu.ma/dde-ldn-hack`), "lu.ma/dde-ldn-hack");
  assert.equal(readUrlParam(`${B}?url=https://x.com/e?id=1&ref=2`), "https://x.com/e?id=1&ref=2");
  assert.equal(normaliseUrl(readUrlParam(`${B}?url=https://x.com/e?id=1&ref=2`)!), "https://x.com/e");
  assert.equal(readUrlParam(`${B}?a=silverstone-half`), null);
  assert.equal(readUrlParam(`${B}?myurl=x`), null);
  assert.equal(readUrlParam(B), null);
});
