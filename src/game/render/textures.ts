import Phaser from 'phaser';

/** Runtime-generated textures (particles + HUD icons). No image files needed. */
export const TEX = {
  dot: 'g_dot',
  glow: 'g_glow',
  spark: 'g_spark',
  smoke: 'g_smoke',
  ring: 'g_ring',
  shadow: 'g_shadow',
  debris: 'g_debris',
  beam: 'g_beam',
  vignette: 'g_vignette',
  cloud: 'g_cloud',
  flake: 'g_flake',
  bubble: 'g_bubble',
  heart: 'i_heart',
  coin: 'i_coin',
  ufo: 'i_ufo',
  orbital: 'i_orbital',
  reinforce: 'i_reinforce',
  lock: 'i_lock',
  flag: 'i_flag',
  sell: 'i_sell',
  upgrade: 'i_upgrade',
  pause: 'i_pause',
  play: 'i_play',
  ff: 'i_ff',
  close: 'i_close',
  starFull: 'i_star_full',
  starEmpty: 'i_star_empty',
  shield: 'i_shield',
  skull: 'i_skull',
  wing: 'i_wing',
  gear: 'i_gear',
  check: 'i_check',
} as const;

const INK = '#2e222f';

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: Draw): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, w, h);
  draw(ctx, w, h);
  tex.refresh();
}

function radial(ctx: CanvasRenderingContext2D, w: number, h: number, stops: [number, string][]): void {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) / 2);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function ink(ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, lw = 4): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.stroke();
}

function vgrad(ctx: CanvasRenderingContext2D, y0: number, y1: number, a: string, b: string): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, ro: number, ri: number, n = 5): void {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function generateTextures(scene: Phaser.Scene): void {
  // ---------------- particles / fx ----------------
  make(scene, TEX.dot, 16, 16, (c, w, h) => radial(c, w, h, [[0, '#fff'], [0.55, '#fff'], [0.62, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0)']]));
  make(scene, TEX.glow, 64, 64, (c, w, h) => radial(c, w, h, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.55)'], [0.6, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0)']]));
  make(scene, TEX.smoke, 48, 48, (c, w, h) => radial(c, w, h, [[0, 'rgba(255,255,255,0.9)'], [0.5, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]));
  make(scene, TEX.spark, 32, 32, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(w / 2, 0);
    c.quadraticCurveTo(w / 2, h / 2, w, h / 2);
    c.quadraticCurveTo(w / 2, h / 2, w / 2, h);
    c.quadraticCurveTo(w / 2, h / 2, 0, h / 2);
    c.quadraticCurveTo(w / 2, h / 2, w / 2, 0);
    c.fill();
    c.globalAlpha = 0.9;
    c.beginPath();
    c.arc(w / 2, h / 2, 4, 0, Math.PI * 2);
    c.fill();
  });
  make(scene, TEX.ring, 128, 128, (c, w, h) => {
    c.strokeStyle = '#fff';
    c.lineWidth = 6;
    c.beginPath();
    c.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2);
    c.stroke();
  });
  make(scene, TEX.shadow, 64, 32, (c, w, h) => {
    c.save();
    c.translate(w / 2, h / 2);
    c.scale(1, h / w);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, w / 2);
    g.addColorStop(0, 'rgba(20,10,30,0.75)');
    g.addColorStop(0.7, 'rgba(20,10,30,0.5)');
    g.addColorStop(1, 'rgba(20,10,30,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, w / 2, 0, Math.PI * 2);
    c.fill();
    c.restore();
  });
  make(scene, TEX.debris, 12, 12, (c) => {
    c.fillStyle = '#fff';
    c.beginPath();
    c.moveTo(1, 3);
    c.lineTo(8, 1);
    c.lineTo(11, 8);
    c.lineTo(4, 11);
    c.closePath();
    c.fill();
  });
  make(scene, TEX.beam, 64, 8, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.5, '#fff');
    g.addColorStop(0.7, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
  make(scene, TEX.vignette, 256, 144, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.58);
    g.addColorStop(0, 'rgba(255,0,0,0)');
    g.addColorStop(0.55, 'rgba(255,30,30,0.3)');
    g.addColorStop(1, 'rgba(255,30,30,1)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
  make(scene, TEX.cloud, 256, 96, (c) => {
    c.fillStyle = 'rgba(255,255,255,1)';
    const blobs: [number, number, number][] = [[60, 60, 34], [100, 44, 40], [150, 50, 42], [195, 62, 32], [128, 68, 40]];
    for (const [x, y, r] of blobs) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
    c.fillRect(60, 62, 140, 40);
  });
  // Prism shield bubble: a soft ellipse with a rim and a highlight; tinted/faded per frame by an Image (no Graphics redraw).
  make(scene, TEX.bubble, 128, 112, (c, w, h) => {
    c.save();
    c.translate(w / 2, h / 2);
    c.scale(1, h / w);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, w / 2 - 4);
    g.addColorStop(0, 'rgba(158,230,255,0.35)');
    g.addColorStop(0.8, 'rgba(158,230,255,0.5)');
    g.addColorStop(1, 'rgba(158,230,255,0.7)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, w / 2 - 4, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 4;
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.stroke();
    c.restore();
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.beginPath();
    c.ellipse(w * 0.3, h * 0.22, w * 0.09, h * 0.055, -0.5, 0, Math.PI * 2);
    c.fill();
  });
  make(scene, TEX.flake, 12, 12, (c, w, h) => radial(c, w, h, [[0, '#fff'], [0.7, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]));

  // ---------------- icons (64x64 unless noted) ----------------
  make(scene, TEX.heart, 64, 64, (c) => {
    c.beginPath();
    c.moveTo(32, 56);
    c.bezierCurveTo(6, 38, 4, 20, 16, 12);
    c.bezierCurveTo(24, 7, 30, 12, 32, 18);
    c.bezierCurveTo(34, 12, 40, 7, 48, 12);
    c.bezierCurveTo(60, 20, 58, 38, 32, 56);
    c.closePath();
    ink(c, vgrad(c, 10, 56, '#ff6b78', '#d6303f'), 5);
    c.fillStyle = 'rgba(255,255,255,0.65)';
    c.beginPath();
    c.ellipse(19, 21, 5, 3, -0.7, 0, Math.PI * 2);
    c.fill();
  });
  make(scene, TEX.coin, 64, 64, (c) => {
    c.beginPath();
    c.arc(32, 32, 24, 0, Math.PI * 2);
    ink(c, vgrad(c, 8, 56, '#ffe27a', '#f0a91e'), 5);
    c.beginPath();
    c.arc(32, 32, 15, 0, Math.PI * 2);
    c.strokeStyle = '#c6781a';
    c.lineWidth = 3;
    c.stroke();
    c.fillStyle = '#c6781a';
    c.fillRect(29, 22, 6, 20);
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.beginPath();
    c.ellipse(21, 20, 4, 2.2, -0.8, 0, Math.PI * 2);
    c.fill();
  });
  make(scene, TEX.ufo, 64, 64, (c) => {
    c.beginPath();
    c.ellipse(32, 40, 26, 11, 0, 0, Math.PI * 2);
    ink(c, '#e8edf2', 4);
    c.beginPath();
    c.arc(32, 36, 14, Math.PI, 0);
    c.closePath();
    ink(c, '#9ee6ff', 4);
    c.fillStyle = '#ff5a5f';
    for (const x of [18, 32, 46]) {
      c.beginPath();
      c.arc(x, 43, 2.6, 0, Math.PI * 2);
      c.fill();
    }
  });
  make(scene, TEX.orbital, 64, 64, (c) => {
    c.lineWidth = 8;
    c.strokeStyle = INK;
    c.beginPath();
    c.arc(32, 36, 17, 0, Math.PI * 2);
    c.moveTo(32, 10);
    c.lineTo(32, 22);
    c.moveTo(32, 50);
    c.lineTo(32, 62);
    c.moveTo(6, 36);
    c.lineTo(18, 36);
    c.moveTo(46, 36);
    c.lineTo(58, 36);
    c.stroke();
    c.lineWidth = 4;
    c.strokeStyle = '#ff7a59';
    c.stroke();
    c.beginPath();
    c.arc(32, 36, 5, 0, Math.PI * 2);
    ink(c, '#ffe27a', 3);
    // beam from the top
    c.beginPath();
    c.moveTo(26, 0);
    c.lineTo(38, 0);
    c.lineTo(35, 30);
    c.lineTo(29, 30);
    c.closePath();
    c.fillStyle = 'rgba(255,240,180,0.9)';
    c.fill();
  });
  make(scene, TEX.reinforce, 64, 64, (c) => {
    // shield + sword
    c.beginPath();
    c.moveTo(32, 58);
    c.bezierCurveTo(10, 46, 8, 28, 10, 14);
    c.lineTo(32, 8);
    c.lineTo(54, 14);
    c.bezierCurveTo(56, 28, 54, 46, 32, 58);
    c.closePath();
    ink(c, vgrad(c, 8, 58, '#6aa2ff', '#3a63c9'), 5);
    c.beginPath();
    c.moveTo(32, 12);
    c.lineTo(32, 54);
    c.moveTo(14, 28);
    c.lineTo(50, 28);
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 4;
    c.stroke();
  });
  make(scene, TEX.lock, 64, 64, (c) => {
    c.beginPath();
    c.arc(32, 26, 12, Math.PI, 0);
    c.lineWidth = 11;
    c.strokeStyle = INK;
    c.stroke();
    c.lineWidth = 5;
    c.strokeStyle = '#d4d8e0';
    c.stroke();
    c.beginPath();
    c.roundRect(14, 26, 36, 28, 6);
    ink(c, vgrad(c, 26, 54, '#ffd34e', '#e69a1c'), 5);
    c.fillStyle = INK;
    c.beginPath();
    c.arc(32, 38, 4, 0, Math.PI * 2);
    c.fill();
    c.fillRect(30, 38, 4, 10);
  });
  make(scene, TEX.flag, 64, 64, (c) => {
    c.lineWidth = 9;
    c.strokeStyle = INK;
    c.beginPath();
    c.moveTo(18, 58);
    c.lineTo(18, 8);
    c.stroke();
    c.lineWidth = 4;
    c.strokeStyle = '#e8d9b0';
    c.stroke();
    c.beginPath();
    c.moveTo(20, 10);
    c.quadraticCurveTo(36, 4, 48, 12);
    c.quadraticCurveTo(38, 22, 48, 32);
    c.quadraticCurveTo(34, 26, 20, 34);
    c.closePath();
    ink(c, vgrad(c, 8, 34, '#6aa2ff', '#3a63c9'), 4);
  });
  make(scene, TEX.sell, 64, 64, (c) => {
    c.beginPath();
    c.arc(32, 32, 24, 0, Math.PI * 2);
    ink(c, vgrad(c, 8, 56, '#ffe27a', '#f0a91e'), 5);
    c.fillStyle = '#8a4b12';
    c.font = 'bold 34px "Trebuchet MS", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('$', 32, 34);
  });
  make(scene, TEX.upgrade, 64, 64, (c) => {
    for (const dy of [0, 16]) {
      c.beginPath();
      c.moveTo(32, 6 + dy);
      c.lineTo(54, 28 + dy);
      c.lineTo(42, 28 + dy);
      c.lineTo(42, 34 + dy);
      c.lineTo(22, 34 + dy);
      c.lineTo(22, 28 + dy);
      c.lineTo(10, 28 + dy);
      c.closePath();
      ink(c, vgrad(c, 6 + dy, 34 + dy, '#9bf06a', '#4fb23a'), 4);
    }
  });
  make(scene, TEX.pause, 64, 64, (c) => {
    for (const x of [14, 36]) {
      c.beginPath();
      c.roundRect(x, 12, 15, 40, 4);
      ink(c, '#fff4d6', 4);
    }
  });
  make(scene, TEX.play, 64, 64, (c) => {
    c.beginPath();
    c.moveTo(18, 10);
    c.lineTo(54, 32);
    c.lineTo(18, 54);
    c.closePath();
    ink(c, '#fff4d6', 5);
  });
  make(scene, TEX.ff, 64, 64, (c) => {
    for (const x of [6, 30]) {
      c.beginPath();
      c.moveTo(x, 14);
      c.lineTo(x + 26, 32);
      c.lineTo(x, 50);
      c.closePath();
      ink(c, '#fff4d6', 4);
    }
  });
  make(scene, TEX.close, 64, 64, (c) => {
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(16, 16);
    c.lineTo(48, 48);
    c.moveTo(48, 16);
    c.lineTo(16, 48);
    c.lineWidth = 14;
    c.strokeStyle = INK;
    c.stroke();
    c.lineWidth = 7;
    c.strokeStyle = '#fff4d6';
    c.stroke();
  });
  make(scene, TEX.starFull, 96, 96, (c) => {
    star(c, 48, 52, 42, 19);
    ink(c, vgrad(c, 8, 90, '#ffe98a', '#f2a81d'), 6);
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.beginPath();
    c.ellipse(36, 34, 7, 3.5, -0.9, 0, Math.PI * 2);
    c.fill();
  });
  make(scene, TEX.starEmpty, 96, 96, (c) => {
    star(c, 48, 52, 42, 19);
    ink(c, '#5a4d6d', 6);
  });
  make(scene, TEX.shield, 64, 64, (c) => {
    c.beginPath();
    c.moveTo(32, 58);
    c.bezierCurveTo(10, 46, 8, 28, 10, 14);
    c.lineTo(32, 8);
    c.lineTo(54, 14);
    c.bezierCurveTo(56, 28, 54, 46, 32, 58);
    c.closePath();
    ink(c, '#9aa7b8', 5);
  });
  make(scene, TEX.skull, 64, 64, (c) => {
    c.beginPath();
    c.arc(32, 28, 20, 0, Math.PI * 2);
    c.roundRect(20, 38, 24, 18, 5);
    ink(c, '#f4f0e6', 4);
    c.fillStyle = INK;
    for (const x of [24, 40]) {
      c.beginPath();
      c.arc(x, 30, 5.5, 0, Math.PI * 2);
      c.fill();
    }
    c.fillRect(30, 46, 2, 8);
    c.fillRect(35, 46, 2, 8);
  });
  make(scene, TEX.wing, 64, 64, (c) => {
    c.beginPath();
    c.moveTo(6, 40);
    c.quadraticCurveTo(10, 10, 58, 8);
    c.quadraticCurveTo(44, 22, 50, 28);
    c.quadraticCurveTo(36, 30, 40, 38);
    c.quadraticCurveTo(26, 38, 28, 48);
    c.quadraticCurveTo(14, 46, 6, 40);
    c.closePath();
    ink(c, '#fff4d6', 4);
  });
  make(scene, TEX.gear, 64, 64, (c) => {
    c.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8;
      const r = i % 2 === 0 ? 27 : 20;
      const a2 = a + Math.PI / 16;
      c.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
      c.lineTo(32 + Math.cos(a2) * r, 32 + Math.sin(a2) * r);
    }
    c.closePath();
    ink(c, '#fff4d6', 4);
    c.beginPath();
    c.arc(32, 32, 8, 0, Math.PI * 2);
    ink(c, '#584a73', 4);
  });
  make(scene, TEX.check, 64, 64, (c) => {
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(14, 34);
    c.lineTo(27, 47);
    c.lineTo(51, 17);
    c.lineWidth = 14;
    c.strokeStyle = INK;
    c.stroke();
    c.lineWidth = 7;
    c.strokeStyle = '#9bf06a';
    c.stroke();
  });
}
