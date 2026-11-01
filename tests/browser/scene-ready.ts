import { expect, type Locator, type Page } from "@playwright/test";

const models = [
  "panda",
  "tree",
  "bakery",
  "grocery",
  "market",
  "research",
  "bank",
  "gifts",
  "rival",
  "cafe",
] as const;
const materials = [
  "material-grass-earth",
  "material-cobblestone-path",
  "material-stone-wall",
] as const;
const outdoorLocations = [
  "notice",
  "repair",
  "garden",
  "music",
  "dock",
  "riverside",
  "square",
] as const;

export async function readyVisualScene(page: Page): Promise<Locator> {
  const selector = [
    ...[...models, ...materials].map((id) => `[data-loaded-models~="${id}"]`),
    ...outdoorLocations.map((id) => `[data-outdoor-locations~="${id}"]`),
  ].join("");
  const scene = page.locator(selector);
  await expect(scene).toBeVisible({ timeout: 60_000 });
  await expect(scene).toHaveAttribute("data-resident-count", "7");
  await expect(scene).toHaveAttribute("data-outdoor-resident-count", "7");
  for (const location of outdoorLocations)
    await expect(scene).toHaveAttribute(
      "data-outdoor-resident-locations",
      new RegExp(`(?:^| )${location}(?: |$)`),
    );
  const mobile = (page.viewportSize()?.width ?? 1440) < 720;
  const expected = models.map(
    (id) =>
      `/models/${id}${mobile ? "-mobile" : ""}${id === "panda" ? "-rigged" : ""}-v2.glb`,
  );
  const actual = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => new URL(entry.name).pathname),
  );
  expect(actual).toEqual(expect.arrayContaining(expected));
  return scene;
}
