import Phaser from 'phaser';

/**
 * Procedurally drawn UI icons (HTML canvas 2D, so edges are properly anti-aliased). Every icon is a cream/gold shape
 * with the pack's dark outline and is registered as a texture `ui_<name>` by {@link ensureUiTextures}.
 */
export type IconName =
  | 'star' | 'star_off' | 'lock' | 'check' | 'cross' | 'home' | 'back' | 'gear' | 'play' | 'fullscreen'
  | 'sound' | 'music' | 'orbital' | 'reset' | 'upgrade' | 'credits' | 'glow' | 'dot' | 'cloud' | 'spark';

const INK = '#2e222f';
const CREAM = '#fff4d6';
const S = 128; // icon canvas size

type Ctx = CanvasRenderingContext2D;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx, w: number, h: number) => void): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx, w, h);
  tex.refresh();
}

function outline(c: Ctx, fill: string | CanvasGradient, width = 10): void {
  c.strokeStyle = INK;
  c.lineWidth = width;
  c.stroke();
  c.fillStyle = fill;
  c.fill();
}

function starPath(c: Ctx, cx: number, cy: number, ro: number, ri: number): void {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? ro : ri;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.closePath();
}

function roundRect(c: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

function drawStar(c: Ctx, on: boolean): void {
  starPath(c, 64, 69, 54, 26);
  const g = c.createLinearGradient(0, 15, 0, 120);
  if (on) {
    g.addColorStop(0, '#fff09a');
    g.addColorStop(0.55, '#ffd34e');
    g.addColorStop(1, '#f19a1c');
  } else {
    g.addColorStop(0, '#6a5b7c');
    g.addColorStop(1, '#4a3d5a');
  }
  outline(c, g, 11);
  if (on) {
    // highlight facet
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.beginPath();
    c.moveTo(64, 26);
    c.lineTo(76, 54);
    c.lineTo(64, 60);
    c.lineTo(52, 54);
    c.closePath();
    c.fill();
  }
}

export function ensureUiTextures(scene: Phaser.Scene): void {
  make(scene, 'ui_star', S, S, (c) => drawStar(c, true));
  make(scene, 'ui_star_off', S, S, (c) => drawStar(c, false));

  make(scene, 'ui_lock', S, S, (c) => {
    // shackle
    c.beginPath();
    c.arc(64, 54, 25, Math.PI, 0);
    c.lineTo(89, 64);
    c.moveTo(39, 54);
    c.lineTo(39, 64);
    c.strokeStyle = INK;
    c.lineWidth = 22;
    c.stroke();
    c.strokeStyle = '#c9ccd6';
    c.lineWidth = 10;
    c.stroke();
    // body
    roundRect(c, 24, 58, 80, 60, 14);
    const g = c.createLinearGradient(0, 58, 0, 118);
    g.addColorStop(0, '#ffe08a');
    g.addColorStop(1, '#e8a02b');
    outline(c, g, 10);
    // keyhole
    c.fillStyle = INK;
    c.beginPath();
    c.arc(64, 82, 8, 0, Math.PI * 2);
    c.fill();
    roundRect(c, 60, 84, 8, 18, 3);
    c.fill();
  });

  make(scene, 'ui_check', S, S, (c) => {
    c.beginPath();
    c.moveTo(24, 68);
    c.lineTo(52, 96);
    c.lineTo(104, 36);
    c.strokeStyle = INK;
    c.lineWidth = 30;
    c.stroke();
    c.strokeStyle = '#8fe06a';
    c.lineWidth = 16;
    c.stroke();
  });

  make(scene, 'ui_cross', S, S, (c) => {
    c.beginPath();
    c.moveTo(30, 30);
    c.lineTo(98, 98);
    c.moveTo(98, 30);
    c.lineTo(30, 98);
    c.strokeStyle = INK;
    c.lineWidth = 30;
    c.stroke();
    c.strokeStyle = CREAM;
    c.lineWidth = 16;
    c.stroke();
  });

  make(scene, 'ui_home', S, S, (c) => {
    c.beginPath();
    c.moveTo(64, 16);
    c.lineTo(114, 62);
    c.lineTo(100, 62);
    c.lineTo(100, 108);
    c.lineTo(28, 108);
    c.lineTo(28, 62);
    c.lineTo(14, 62);
    c.closePath();
    outline(c, CREAM, 10);
    roundRect(c, 52, 70, 24, 38, 4);
    c.fillStyle = '#e8a02b';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 6;
    c.stroke();
  });

  make(scene, 'ui_back', S, S, (c) => {
    c.beginPath();
    c.moveTo(18, 64);
    c.lineTo(62, 22);
    c.lineTo(62, 46);
    c.lineTo(110, 46);
    c.lineTo(110, 82);
    c.lineTo(62, 82);
    c.lineTo(62, 106);
    c.closePath();
    outline(c, CREAM, 10);
  });

  make(scene, 'ui_play', S, S, (c) => {
    c.beginPath();
    c.moveTo(34, 18);
    c.lineTo(110, 64);
    c.lineTo(34, 110);
    c.closePath();
    outline(c, CREAM, 10);
  });

  make(scene, 'ui_gear', S, S, (c) => {
    const teeth = 8;
    c.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const hw = 0.17;
      const pts: [number, number][] = [
        [a - hw * 1.5, 40],
        [a - hw, 56],
        [a + hw, 56],
        [a + hw * 1.5, 40],
      ];
      pts.forEach(([ang, r], j) => {
        const x = 64 + Math.cos(ang) * r;
        const y = 64 + Math.sin(ang) * r;
        if (i === 0 && j === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      });
    }
    c.closePath();
    outline(c, CREAM, 10);
    c.beginPath();
    c.arc(64, 64, 17, 0, Math.PI * 2);
    c.fillStyle = INK;
    c.fill();
  });

  make(scene, 'ui_fullscreen', S, S, (c) => {
    const L = 18;
    const R = 110;
    const a = 40;
    c.beginPath();
    c.moveTo(L, L + a); c.lineTo(L, L); c.lineTo(L + a, L);
    c.moveTo(R - a, L); c.lineTo(R, L); c.lineTo(R, L + a);
    c.moveTo(R, R - a); c.lineTo(R, R); c.lineTo(R - a, R);
    c.moveTo(L + a, R); c.lineTo(L, R); c.lineTo(L, R - a);
    c.strokeStyle = INK;
    c.lineWidth = 28;
    c.stroke();
    c.strokeStyle = CREAM;
    c.lineWidth = 14;
    c.stroke();
  });

  make(scene, 'ui_sound', S, S, (c) => {
    c.beginPath();
    c.moveTo(14, 48);
    c.lineTo(40, 48);
    c.lineTo(68, 22);
    c.lineTo(68, 106);
    c.lineTo(40, 80);
    c.lineTo(14, 80);
    c.closePath();
    outline(c, CREAM, 10);
    for (const r of [22, 40]) {
      c.beginPath();
      c.arc(68, 64, r, -0.9, 0.9);
      c.strokeStyle = INK;
      c.lineWidth = 17;
      c.stroke();
      c.strokeStyle = CREAM;
      c.lineWidth = 8;
      c.stroke();
    }
  });

  make(scene, 'ui_music', S, S, (c) => {
    c.beginPath();
    c.moveTo(48, 98);
    c.lineTo(48, 24);
    c.lineTo(104, 14);
    c.lineTo(104, 88);
    c.strokeStyle = INK;
    c.lineWidth = 24;
    c.stroke();
    c.strokeStyle = CREAM;
    c.lineWidth = 10;
    c.stroke();
    for (const [x, y] of [[34, 98], [90, 88]]) {
      c.beginPath();
      c.ellipse(x, y, 17, 13, -0.3, 0, Math.PI * 2);
      outline(c, CREAM, 9);
    }
  });

  make(scene, 'ui_orbital', S, S, (c) => {
    // sky-beam + target reticle
    const g = c.createLinearGradient(0, 0, 0, 90);
    g.addColorStop(0, 'rgba(255,120,120,0.0)');
    g.addColorStop(1, 'rgba(255,90,90,0.95)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(52, 0); c.lineTo(76, 0); c.lineTo(84, 82); c.lineTo(44, 82);
    c.closePath();
    c.fill();
    c.beginPath();
    c.ellipse(64, 88, 46, 22, 0, 0, Math.PI * 2);
    c.strokeStyle = INK;
    c.lineWidth = 18;
    c.stroke();
    c.strokeStyle = '#ff6b6b';
    c.lineWidth = 8;
    c.stroke();
    c.beginPath();
    c.ellipse(64, 88, 20, 9, 0, 0, Math.PI * 2);
    outline(c, '#ffe08a', 7);
  });

  make(scene, 'ui_reset', S, S, (c) => {
    c.beginPath();
    c.arc(64, 68, 38, -2.4, 3.9);
    c.strokeStyle = INK;
    c.lineWidth = 26;
    c.stroke();
    c.strokeStyle = CREAM;
    c.lineWidth = 12;
    c.stroke();
    c.beginPath();
    c.moveTo(18, 30);
    c.lineTo(52, 30);
    c.lineTo(36, 62);
    c.closePath();
    outline(c, CREAM, 9);
  });

  make(scene, 'ui_upgrade', S, S, (c) => {
    c.beginPath();
    c.moveTo(64, 14);
    c.lineTo(108, 62);
    c.lineTo(80, 62);
    c.lineTo(80, 110);
    c.lineTo(48, 110);
    c.lineTo(48, 62);
    c.lineTo(20, 62);
    c.closePath();
    const g = c.createLinearGradient(0, 14, 0, 110);
    g.addColorStop(0, '#9be06a');
    g.addColorStop(1, '#4fa83a');
    outline(c, g, 10);
  });

  make(scene, 'ui_credits', S, S, (c) => {
    c.beginPath();
    c.arc(64, 64, 48, 0, Math.PI * 2);
    outline(c, CREAM, 10);
    c.fillStyle = INK;
    c.beginPath();
    c.arc(64, 36, 8, 0, Math.PI * 2);
    c.fill();
    roundRect(c, 56, 52, 16, 46, 6);
    c.fill();
  });

  make(scene, 'ui_glow', S, S, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, S, S);
  });

  make(scene, 'ui_dot', 32, 32, (c) => {
    c.beginPath();
    c.arc(16, 16, 12, 0, Math.PI * 2);
    c.fillStyle = '#ffffff';
    c.fill();
  });

  make(scene, 'ui_spark', 64, 64, (c) => {
    // 4-point sparkle
    c.beginPath();
    c.moveTo(32, 2);
    c.quadraticCurveTo(36, 28, 62, 32);
    c.quadraticCurveTo(36, 36, 32, 62);
    c.quadraticCurveTo(28, 36, 2, 32);
    c.quadraticCurveTo(28, 28, 32, 2);
    c.fillStyle = '#ffffff';
    c.fill();
  });

  make(scene, 'ui_cloud', 360, 170, (c, w, h) => {
    const blobs: [number, number, number][] = [
      [70, 100, 44], [130, 70, 56], [200, 58, 62], [262, 84, 50], [304, 104, 36], [180, 104, 46], [110, 108, 38],
    ];
    c.fillStyle = '#ffffff';
    for (const [x, y, r] of blobs) {
      c.beginPath();
      c.arc(x, y + 24, r, 0, Math.PI * 2);
      c.fill();
    }
    // flat-ish bottom: erase anything below the base line
    c.globalCompositeOperation = 'destination-out';
    c.fillRect(0, 152, w, h - 152);
    c.globalCompositeOperation = 'source-over';
    c.globalCompositeOperation = 'source-atop';
    const g = c.createLinearGradient(0, h * 0.45, 0, h);
    g.addColorStop(0, 'rgba(160,190,230,0)');
    g.addColorStop(1, 'rgba(160,190,230,0.65)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'source-over';
  });
}
