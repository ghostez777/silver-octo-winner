import { globalScene } from "#app/global-scene";
import type { SceneBase } from "#app/scene-base";

/**
 * Runs a Phaser tween and resolves when it finishes.
 * This keeps the game code independent of the callback-style tween API.
 */
export async function playTween(
  config: Phaser.Types.Tweens.TweenBuilderConfig,
  scene: SceneBase = globalScene,
): Promise<void> {
  await new Promise<void>(resolve => {
    scene.tweens.add({
      ...config,
      onComplete: () => resolve(),
    });
  });
}
