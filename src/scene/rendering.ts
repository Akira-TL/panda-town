import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/** 复用现有 Three.js 附带后处理；小屏直接渲染，保留场景而降低采样成本。 */
export function createRendering(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
) {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const occlusion = new SSAOPass(scene, camera, 512, 512, 12);
  occlusion.kernelRadius = 2.4;
  occlusion.minDistance = 0.002;
  occlusion.maxDistance = 0.16;
  const output = new OutputPass();
  composer.addPass(renderPass);
  composer.addPass(occlusion);
  composer.addPass(output);
  let enabled = false;
  return {
    resize(width: number, height: number) {
      enabled = width >= 720;
      renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, enabled ? 1.5 : 1.25),
      );
      renderer.setSize(width, height);
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(width, height);
      // 遮蔽以较低分辨率计算，细节交给原始场景颜色通道。
      occlusion.setSize(
        Math.max(1, Math.round(width * 0.65)),
        Math.max(1, Math.round(height * 0.65)),
      );
    },
    render(delta: number) {
      if (enabled) composer.render(delta);
      else renderer.render(scene, camera);
    },
    dispose() {
      occlusion.dispose();
      output.dispose();
      renderPass.dispose();
      composer.dispose();
    },
  };
}
