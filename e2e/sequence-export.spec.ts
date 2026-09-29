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
  // The silent clip and the still must still contribute silence: the audio
  // track itself lasts as long as the video.
  expect(Math.abs((await audio!.computeDuration()) - (await video!.computeDuration()))).toBeLessThan(0.1);
});

test("trim values can be typed digit by digit", async ({ page }) => {
  const boardId = execFileSync("npx", ["tsx", "--env-file=.env", "e2e/seed-sequence-board.mts"]).toString().trim();
  await page.goto(`/board/${boardId}`);
  await page.getByTestId("sequence-open-panel").click();
  await expect(page.getByTestId("sequence-check")).toHaveText("6.0s");

  const start = page.getByTestId("sequence-trim-start-0");
  await start.fill("");
  await start.pressSequentially("2");
  await start.press("Enter");
  const end = page.getByTestId("sequence-trim-end-0");
  await end.selectText();
  await end.pressSequentially("2.5");
  await end.press("Enter");

  await expect(end).toHaveValue("2.5");
  await expect(page.getByTestId("sequence-check")).toHaveText("3.5s");
});

test("a voiced line is mixed into the export and keeps audio in step", async ({ page }) => {
  const boardId = execFileSync("npx", ["tsx", "--env-file=.env", "e2e/seed-sequence-board.mts"]).toString().trim();
  await page.goto(`/board/${boardId}`);
  await page.getByTestId("sequence-open-panel").click();
  await expect(page.getByTestId("sequence-voice-status-1")).toHaveText("voiced · 1.5s");
  await page.getByTestId("sequence-export-button").click();
  await expect(page.getByTestId("sequence-export-done")).toBeVisible({ timeout: 60_000 });
  const href = await page.getByTestId("sequence-export-done").getAttribute("href");
  const file = await readFile(path.join("data", "uploads", decodeURIComponent(href!.replace(/^\/uploads\//, ""))));
  const input = new Input({ source: new BufferSource(file), formats: ALL_FORMATS });
  const video = await input.getPrimaryVideoTrack();
  const audio = await input.getPrimaryAudioTrack();
  expect(Math.abs((await audio!.computeDuration()) - (await video!.computeDuration()))).toBeLessThan(0.1);

  // Loudness by window: the voice plays over the silent clip (3.0s-4.5s);
  // the still (5.0s-6.0s) stays silent.
  const rms = await page.evaluate(async (url) => {
    const bytes = await (await fetch(url)).arrayBuffer();
    const decoded = await new OfflineAudioContext(2, 1, 48000).decodeAudioData(bytes);
    const data = decoded.getChannelData(0);
    const window = (from: number, to: number) => {
      const slice = data.subarray(Math.round(from * decoded.sampleRate), Math.round(to * decoded.sampleRate));
      return Math.sqrt(slice.reduce((sum, sample) => sum + sample * sample, 0) / slice.length);
    };
    return { voice: window(3.2, 4.3), still: window(5.2, 5.8) };
  }, href!);
  // The fixture is a sine at ffmpeg's default amplitude 0.125 (RMS 0.088).
  expect(rms.voice).toBeGreaterThan(0.05);
  expect(rms.still).toBeLessThan(0.01);
});

test("an edited line blocks export until it is voiced again", async ({ page }) => {
  const boardId = execFileSync("npx", ["tsx", "--env-file=.env", "e2e/seed-sequence-board.mts"]).toString().trim();
  await page.goto(`/board/${boardId}`);
  await page.getByTestId("sequence-open-panel").click();
  const text = page.getByTestId("sequence-voice-text-1");
  await text.fill("Meet the new stand.");
  await text.blur();
  await expect(page.getByTestId("sequence-voice-status-1")).toHaveText("needs voicing");
  await expect(page.getByTestId("sequence-export-button")).toBeDisabled();
  await expect(page.getByTestId("sequence-export-reason")).toHaveText("Item 2's voiceover needs voicing again");
});
