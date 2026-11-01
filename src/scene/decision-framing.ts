import type { PerspectiveCamera } from "three";

/** 为底部决策界面留出空间，不改变相机位置及遮挡检测的视线。 */
export function createDecisionFraming(camera: PerspectiveCamera) {
  let previousWidth = -1;
  let previousHeight = -1;
  let previousRaised: boolean | undefined;
  let previousFocusY = -1;
  let previousFocusX = -1;
  return (
    width: number,
    height: number,
    raised: boolean,
    focusY = 0.35,
    focusX = 0.5,
  ): void => {
    if (
      width === previousWidth &&
      height === previousHeight &&
      raised === previousRaised &&
      focusY === previousFocusY &&
      focusX === previousFocusX
    )
      return;
    previousWidth = width;
    previousHeight = height;
    previousRaised = raised;
    previousFocusY = focusY;
    previousFocusX = focusX;
    camera.aspect = width / height;
    if (raised) {
      // 正纵向偏移使注视点移到focusY；默认仍为画面顶部35%。
      camera.setViewOffset(
        width,
        height,
        width * (0.5 - focusX),
        height * (0.5 - focusY),
        width,
        height,
      );
    } else {
      camera.clearViewOffset();
    }
  };
}
