import { expect, test } from "@playwright/test";
import { begin, arrive, choose, advance } from "./helpers";
import { readyVisualScene } from "./scene-ready";

for (const location of ["research", "bank"] as const) {
  test(`${location}落点及资料面板的镜头截图供实际遮挡核对`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await begin(page);
    const scene = await readyVisualScene(page);
    if (location === "research") await arrive(page, 5, 0);
    else {
      await arrive(page, 6, 0);
      await choose(page, "work");
      await advance(page);
      const bank = await arrive(page, 1, 0);
      expect(bank.position).toBe("bank");
    }
    await page.waitForTimeout(500);
    await expect(scene).toHaveAttribute("data-camera-obstructed", "0");
    // 图片还需实际目视主角；标记为0不能代替遮挡验收。
    await page.screenshot({
      path: `logs/validation-camera-${location}-fixed.png`,
    });
    await page.getByRole("button", { name: /先看看资料/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.screenshot({
      path: `logs/validation-camera-${location}-study.png`,
    });
    expect(errors).toEqual([]);
  });
}
