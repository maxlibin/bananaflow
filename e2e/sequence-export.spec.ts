import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ALL_FORMATS, BufferSource, Input } from "mediabunny";

test("exports a clip, a silent clip and a still into one 1080x1920 MP4", async ({ page }) => {
  const boardId = execFileSync("npx", ["tsx", "--env-file=.env", "e2e/seed-sequence-board.mts"]).toString().trim();
  let failedOnce = false;
  await page.route("**/api/uploads/**", async (route) => {
    if (!failedOnce) {
      failedOnce = true;
      await route.fulfill({ status: 500, body: "injected failure" });
      return;
    }
    await route.continue();
  });

  await page.goto(`/board/${boardId}`);
  await page.getByTestId("sequence-open-panel").click();
  await expect(page.getByTestId("sequence-check")).toHaveText("6.0s");
  await page.getByTestId("sequence-export-button").click();
  await expect(page.getByTestId("sequence-export-error")).toContainText("HTTP 500", { timeout: 120_000 });
  await page.getByTestId("sequence-export-retry").click();
  await expect(page.getByTestId("sequence-export-done")).toBeVisible({ timeout: 60_000 });

  const href = await page.getByTestId("sequence-export-done").getAttribute("href");
  const file = await readFile(path.join("data", "uploads", decodeURIComponent(href!.replace(/^\/uploads\//, ""))));
  const input = new Input({ source: new BufferSource(file), formats: ALL_FORMATS });
  const video = await input.getPrimaryVideoTrack();
  const audio = await input.getPrimaryAudioTrack();
  expect(await video!.getDisplayWidth()).toBe(1080);
  expect(await video!.getDisplayHeight()).toBe(1920);
  expect(audio).not.toBeNull();
  expect(Math.abs((await input.computeDuration()) - 6)).toBeLessThan(0.1);
});
