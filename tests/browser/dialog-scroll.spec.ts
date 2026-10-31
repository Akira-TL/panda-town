import { expect, test, type Page } from "@playwright/test";
import { begin, arrive, choose, advance, finish } from "./helpers";

async function closeAfterScrolling(
  page: Page,
  name: string,
  screenshot: string,
) {
  const dialog = page.getByRole("dialog");
  const dimensions = await dialog.evaluate((element) => ({
    total: element.scrollHeight,
    visible: element.clientHeight,
  }));
  expect(dimensions.total).toBeGreaterThan(dimensions.visible);
  await dialog.hover();
  await page.mouse.wheel(0, 5_000);
  await expect
    .poll(() =>
      dialog.evaluate(
        (element) =>
          element.scrollHeight - element.scrollTop - element.clientHeight,
      ),
    )
    .toBeLessThanOrEqual(2);
  const close = dialog.getByRole("button", { name, exact: true });
  const bounds = await close.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.width).toBeGreaterThanOrEqual(44);
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
  expect(
    await close.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const target = document.elementFromPoint(
        box.x + box.width / 2,
        box.y + box.height / 2,
      );
      return target === element || element.contains(target);
    }),
  ).toBe(true);
  await page.screenshot({ path: screenshot });
  // 按已核验坐标点击，避免自动滚动掩盖关闭按钮离开视口的缺陷。
  await page.mouse.click(
    bounds!.x + bounds!.width / 2,
    bounds!.y + bounds!.height / 2,
  );
  await expect(dialog).toHaveCount(0);
}

test("360像素长手记与真实事件证据滚到底仍能关闭并返回来源焦点", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await begin(page);
  for (let day = 1; day <= 8; day++) {
    await arrive(page, 1);
    await choose(page, day === 1 ? "ordinary" : "work");
    await advance(page);
  }
  const inventory = page.getByRole("button", {
    name: "资产与旅程手记",
    exact: true,
  });
  await inventory.click();
  await closeAfterScrolling(
    page,
    "关闭资产手记",
    "logs/validation-mobile-inventory-scrolled.png",
  );
  await expect(inventory).toBeFocused();
  await finish(page);
  const source = page.locator(".journal-days button").first();
  await source.click();
  await closeAfterScrolling(
    page,
    "关闭证据",
    "logs/validation-mobile-evidence-scrolled.png",
  );
  await expect(source).toBeFocused();
});
