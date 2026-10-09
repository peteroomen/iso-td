import Phaser from 'phaser';
import { GAME_H, GAME_W } from './theme';
import { ensureUi } from './widgets';

export type SkyTheme = 'dusk' | 'day' | 'night';

interface SkySpec {
  stops: [number, number, number]; // top, middle (at 55%), bottom
  clouds: { tint: number; alpha: number };
  stars: boolean;
}

const SKIES: Record<SkyTheme, SkySpec> = {
  dusk: { stops: [0x1a1438, 0x5a3585, 0xf0906e], clouds: { tint: 0xffb9a8, alpha: 0.5 }, stars: true },
  day: { stops: [0x3f9be6, 0x86cffb, 0xe3f6ff], clouds: { tint: 0xffffff, alpha: 0.92 }, stars: false },
  night: { stops: [0x161030, 0x2a1f4d, 0x46346b], clouds: { tint: 0x7d6aa8, alpha: 0.22 }, stars: true },
};

/** Full-screen gradient sky with drifting clouds and (optionally) twinkling stars. Returns nothing; all tweens die with the scene. */
export function addSky(scene: Phaser.Scene, theme: SkyTheme, opts: { clouds?: number; depth?: number } = {}): void {
  ensureUi(scene);
  const spec = SKIES[theme];
  const d = opts.depth ?? -1000;
  const g = scene.add.graphics().setDepth(d);
  const [a, b, c] = spec.stops;
  const split = Math.round(GAME_H * 0.55);
  g.fillGradientStyle(a, a, b, b, 1);
  g.fillRect(0, 0, GAME_W, split + 1);
  g.fillGradientStyle(b, b, c, c, 1);
  g.fillRect(0, split, GAME_W, GAME_H - split);

  if (spec.stars) {
    const rng = new Phaser.Math.RandomDataGenerator(['sky-' + theme]);
    const n = theme === 'dusk' ? 70 : 55;
    for (let i = 0; i < n; i++) {
      const sx = rng.between(10, GAME_W - 10);
      const sy = rng.between(8, theme === 'dusk' ? 330 : 560);
      const size = rng.between(5, 14);
      const s = scene.add.image(sx, sy, i % 3 === 0 ? 'ui_spark' : 'ui_dot').setDepth(d + 1).setTint(0xfff4d6);
      s.setDisplaySize(size, size).setAlpha(0.25 + rng.frac() * 0.5);
      scene.tweens.add({
        targets: s,
        alpha: { from: s.alpha, to: 0.12 },
        duration: 900 + rng.between(0, 1800),
        yoyo: true,
        repeat: -1,
        delay: rng.between(0, 2000),
        ease: 'Sine.easeInOut',
      });
    }
  }

  const count = opts.clouds ?? 7;
  const rng = new Phaser.Math.RandomDataGenerator(['clouds-' + theme]);
  for (let i = 0; i < count; i++) {
    const layer = i % 3; // 0 far, 2 near
    const scale = 0.4 + layer * 0.22 + rng.frac() * 0.12;
    const cloud = scene.add
      .image(rng.between(-100, GAME_W + 100), 60 + rng.between(0, GAME_H - 160), 'ui_cloud')
      .setDepth(d + 2 + layer * 0.1)
      .setScale(scale)
      .setTint(spec.clouds.tint)
      .setAlpha(spec.clouds.alpha * (0.55 + layer * 0.22));
    const speed = 10 + layer * 9; // px / s
    const drift = (): void => {
      if (!cloud.scene) return;
      const target = GAME_W + cloud.displayWidth;
      const dist = target - cloud.x;
      scene.tweens.add({
        targets: cloud,
        x: target,
        duration: (dist / speed) * 1000,
        ease: 'Linear',
        onComplete: () => {
          cloud.x = -cloud.displayWidth;
          cloud.y = 60 + rng.between(0, GAME_H - 160);
          drift();
        },
      });
    };
    drift();
  }
}
