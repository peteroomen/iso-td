import Phaser from 'phaser';
import type { Biome } from '../../core';
import { GAME_H, GAME_W } from '../ui/theme';
import { TEX } from './textures';

const SKY: Record<Biome, [string, string, string]> = {
  spring: ['#5fb7e8', '#a5dcf5', '#e4f6e0'],
  desert: ['#f2a65a', '#f7cd88', '#fbe9c4'],
  winter: ['#7f9fd6', '#bcd3f0', '#eef6ff'],
};

/** Soft sky gradient with drifting clouds (and snow flakes / dust motes per biome). */
export class Background {
  private readonly clouds: { img: Phaser.GameObjects.Image; speed: number }[] = [];

  constructor(scene: Phaser.Scene, biome: Biome, mixed: boolean) {
    const key = `g_sky_${biome}${mixed ? '_m' : ''}`;
    if (!scene.textures.exists(key)) {
      const tex = scene.textures.createCanvas(key, 4, 256)!;
      const ctx = tex.getContext();
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      const [a, b, c] = mixed ? ['#6a5aa8', '#e08aa0', '#f9d7a0'] : SKY[biome];
      g.addColorStop(0, a);
      g.addColorStop(0.55, b);
      g.addColorStop(1, c);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 4, 256);
      tex.refresh();
    }
    scene.add.image(GAME_W / 2, GAME_H / 2, key).setDisplaySize(GAME_W, GAME_H).setDepth(-1000);

    const tint = biome === 'desert' ? 0xfff2dc : biome === 'winter' ? 0xffffff : 0xffffff;
    for (let i = 0; i < 9; i++) {
      const img = scene.add
        .image(Math.random() * (GAME_W + 300) - 150, 40 + Math.random() * (GAME_H - 80), TEX.cloud)
        .setTint(tint)
        .setAlpha(0.18 + Math.random() * 0.22)
        .setScale(0.8 + Math.random() * 1.3)
        .setDepth(-900);
      this.clouds.push({ img, speed: 4 + Math.random() * 10 });
    }

    if (biome === 'winter') {
      scene.add
        .particles(0, 0, TEX.flake, {
          x: { min: 0, max: GAME_W },
          y: -10,
          lifespan: 9000,
          speedY: { min: 20, max: 50 },
          speedX: { min: -15, max: 10 },
          scale: { min: 0.25, max: 0.7 },
          alpha: { min: 0.4, max: 0.9 },
          frequency: 220,
          quantity: 1,
        })
        .setDepth(-800);
    }
  }

  update(dt: number): void {
    for (const c of this.clouds) {
      c.img.x += c.speed * dt;
      if (c.img.x > GAME_W + 200) c.img.x = -200;
    }
  }
}
