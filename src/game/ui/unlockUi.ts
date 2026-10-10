import Phaser from 'phaser';
import { COLORS, textStyle } from './theme';
import { drawOutlinedRect, ensureUi, sparkBurst } from './widgets';
import { KINDS, fitImage, towerSprite, type TowerIconKind, type TowerUnlock } from '../scenes/metaData';

/** Glowing tower icon with a level badge: the "something new is available" marker used by the unlock UI. */
export function unlockIcon(scene: Phaser.Scene, x: number, y: number, u: TowerUnlock, size = 76): Phaser.GameObjects.Container {
  ensureUi(scene);
  const root = scene.add.container(x, y);
  const glow = scene.add.image(0, 2, 'ui_glow').setDisplaySize(size * 2.3, size * 2.3).setTint(0xffe27a).setAlpha(0.85);
  scene.tweens.add({ targets: glow, alpha: 0.35, scale: glow.scale * 1.12, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  const plate = scene.add.graphics();
  drawOutlinedRect(plate, -size / 2, -size / 2, size, size, 20, 0x2a2038, 4);
  plate.lineStyle(3, COLORS.gold, 1);
  plate.strokeRoundedRect(-size / 2 + 3, -size / 2 + 3, size - 6, size - 6, 17);
  root.add([glow, plate]);
  const kinds: TowerIconKind[] = u.kind === 'all' ? [...KINDS] : [u.kind];
  if (kinds.length === 1) {
    root.add(fitImage(scene.add.image(0, -2, towerSprite(kinds[0], u.level)), size * 0.82, size * 0.82));
  } else {
    // 2 x 2 grid for the four tower kinds
    const s = size * 0.42;
    const pos: [number, number][] = [[-size * 0.21, -size * 0.2], [size * 0.21, -size * 0.2], [-size * 0.21, size * 0.18], [size * 0.21, size * 0.18]];
    kinds.forEach((k, i) => root.add(fitImage(scene.add.image(pos[i][0], pos[i][1], towerSprite(k, u.level)), s, s)));
  }
  // level badge
  const badge = scene.add.container(size / 2 - 6, size / 2 - 6);
  const bg = scene.add.graphics();
  bg.fillStyle(COLORS.ink, 1);
  bg.fillCircle(0, 0, 19);
  bg.fillStyle(0xe5484d, 1);
  bg.fillCircle(0, 0, 15);
  bg.fillStyle(0xffffff, 0.25);
  bg.fillEllipse(-2, -8, 18, 6);
  const lv = scene.add.text(0, 1, `Lv${u.level}`, textStyle(15, COLORS.text, { strokeThickness: 3 })).setOrigin(0.5);
  badge.add([bg, lv]);
  root.add(badge);
  scene.tweens.add({ targets: badge, scale: 1.12, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return root;
}

/** Headline for several simultaneous unlocks (normally there is exactly one). */
export function unlockTitle(list: TowerUnlock[]): string {
  return list.map((u) => u.title).join(' + ');
}

/** "NEW UPGRADE UNLOCKED" highlight panel for the level-info modal. Container is centred on (x, y). */
export function unlockBanner(scene: Phaser.Scene, x: number, y: number, w: number, list: TowerUnlock[]): Phaser.GameObjects.Container {
  const h = 100;
  const root = scene.add.container(x, y);
  const glow = scene.add.graphics();
  glow.fillStyle(0xffd34e, 0.4);
  glow.fillRoundedRect(-w / 2 - 7, -h / 2 - 7, w + 14, h + 14, 26);
  scene.tweens.add({ targets: glow, alpha: 0.1, duration: 760, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  const g = scene.add.graphics();
  drawOutlinedRect(g, -w / 2, -h / 2, w, h, 20, 0x4b3a2a, 4);
  g.lineStyle(3, COLORS.gold, 1);
  g.strokeRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 17);
  g.fillStyle(0xffffff, 0.08);
  g.fillRoundedRect(-w / 2 + 8, -h / 2 + 8, w - 16, 26, { tl: 14, tr: 14, bl: 4, br: 4 });
  const icon = unlockIcon(scene, -w / 2 + 68, 0, list[0], 72);
  const tx = -w / 2 + 138;
  const head = scene.add.text(tx, -30, 'NEW UPGRADE UNLOCKED', textStyle(20, COLORS.textGold, { strokeThickness: 4 })).setOrigin(0, 0.5);
  const title = scene.add.text(tx, 2, unlockTitle(list), textStyle(30, COLORS.text, { strokeThickness: 5 })).setOrigin(0, 0.5);
  const desc = scene.add.text(tx, 33, list.length === 1 ? list[0].text : 'New tower tiers are available', textStyle(19, '#ffe9bf', { strokeThickness: 0 })).setOrigin(0, 0.5);
  // keep long lines inside the banner
  const maxW = w - 138 - 18;
  for (const t of [head, title, desc]) {
    if (t.width > maxW) t.setScale(maxW / t.width);
  }
  root.add([glow, g, icon, head, title, desc]);
  // sparkle bursts now and then
  scene.time.addEvent({
    delay: 1400,
    loop: true,
    callback: () => {
      if (!root.scene) return;
      const m = root.getWorldTransformMatrix();
      sparkBurst(scene, m.tx - w / 2 + 68 + (Math.random() - 0.5) * 50, m.ty + (Math.random() - 0.5) * 50, { count: 4, radius: 26, size: 14, depth: root.depth + 5 });
    },
  });
  return root;
}

/** Slim pill used after a victory: "Next: Archer Lv3 unlocked!". Slides in at (x, y), stays, then fades. */
export function unlockToast(scene: Phaser.Scene, x: number, y: number, list: TowerUnlock[], holdMs = 4200): Phaser.GameObjects.Container {
  const label = scene.add.text(0, 1, `Next: ${unlockTitle(list)} unlocked!`, textStyle(26, COLORS.text, { strokeThickness: 5 })).setOrigin(0.5);
  const h = 70;
  const w = label.width + 150;
  const root = scene.add.container(x, y).setDepth(80);
  const g = scene.add.graphics();
  g.fillStyle(0xffd34e, 0.3);
  g.fillRoundedRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12, 30);
  drawOutlinedRect(g, -w / 2, -h / 2, w, h, 26, 0x4b3a2a, 4);
  g.lineStyle(3, COLORS.gold, 1);
  g.strokeRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 22);
  const icon = unlockIcon(scene, -w / 2 + 44, 0, list[0], 50);
  icon.setScale(0.9);
  label.setX(30);
  root.add([g, icon, label]);
  root.setAlpha(0).setY(y - 24);
  scene.tweens.add({ targets: root, alpha: 1, y, duration: 380, ease: 'Back.easeOut' });
  scene.time.delayedCall(holdMs, () => {
    if (!root.scene) return;
    scene.tweens.add({ targets: root, alpha: 0, y: y - 16, duration: 360, onComplete: () => root.destroy() });
  });
  return root;
}
