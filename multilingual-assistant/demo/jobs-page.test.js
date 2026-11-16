import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const page = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../savanna/pages/jobs.html"),
  "utf8"
);

test("jobs.html has one JobPosting block for each test listing", function () {
  const blocks = page.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || [];
  assert.equal(blocks.length, 5);
  for (const block of blocks) {
    const data = JSON.parse(block.replace(/<\/?script[^>]*>/g, ""));
    assert.equal(data["@type"], "JobPosting");
    for (const key of ["title", "description", "datePosted", "employmentType", "jobLocationType", "hiringOrganization", "jobLocation", "jobBenefits"]) {
      assert.ok(data[key], key);
    }
    assert.match(data.description, /not a real vacancy/);
  }
  assert.match(page, /db-assistant\.js/);
  assert.match(page, /<h1>Test listings<\/h1>/);
  assert.equal((page.match(/<h2>/g) || []).length, 5);
});
