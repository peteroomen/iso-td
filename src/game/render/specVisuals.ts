import Phaser from 'phaser';
import type { SpecId } from '../../core';
import { INK, ink, make, vgrad } from './textures';

/**
 * Visuals shared by the tower specializations (docs/DESIGN.md section 12): code-drawn emblems (flat pack look, dark outline),
 * and the small runtime textures of their effects (net, rope, rocket, launcher pod, bow, flame, pennant).
 */

export const SPEC_TEX: Record<SpecId, string> = {
  eagle_eye: 'e_eagle_eye',
  hunting_nets: 'e_hunting_nets',
  chain_lightning: 'e_chain_lightning',
  fire_mages: 'e_fire_mages',
  bigger_bombs: 'e_bigger_bombs',
  homing_missiles: 'e_homing_missiles',
  bow_training: 'e_bow_training',
  extra_recruits: 'e_extra_recruits',
};

/** Plaque colour of each spec (menu disc, burst rings). */
export const SPEC_COLOR: Record<SpecId, number> = {
  eagle_eye: 0xd9a21f,
  hunting_nets: 0x3f8a55,
  chain_lightning: 0x3d6fd8,
  fire_mages: 0xe0562a,
  bigger_bombs: 0x6a5f86,
  homing_missiles: 0xc0392b,
  bow_training: 0x8a6a2a,
  extra_recruits: 0x3a63c9,
};

export const FXTEX = {
  net: 'g_net',
  netMesh: 'g_netmesh',
  rope: 'g_rope',
  rocket: 'g_rocket',
  pod: 'g_pod',
  kbow: 'g_kbow',
  flame: 'g_flame',
  pennant: 'g_pennant',
} as const;

const hex = (n: number): string => '#' + n.toString(16).padStart(6, '0');

/** Thick ink line with a coloured core: the pack's outlined stroke. */
function line(c: CanvasRenderingContext2D, pts: [number, number][], col: string, w: number, closed = false, pad = 4): void {
  c.lineJoin = 'round';
  c.lineCap = 'round';
  for (const [lw, st] of [[w + pad, INK], [w, col]] as const) {
    c.lineWidth = lw;
    c.strokeStyle = st;
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    if (closed) c.closePath();
    c.stroke();
  }
}

function plaque(c: CanvasRenderingContext2D, color: number): void {
  const base = hex(color);
  c.beginPath();
  c.arc(32, 32, 29, 0, Math.PI * 2);
  ink(c, vgrad(c, 3, 61, hexMix(color, 0.35), base), 5);
  c.strokeStyle = 'rgba(255,255,255,0.4)';
  c.lineWidth = 2;
  c.beginPath();
  c.arc(32, 32, 24, Math.PI * 1.05, Math.PI * 1.75);
  c.stroke();
}

function hexMix(color: number, t: number): string {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  const m = (v: number) => Math.round(v + (255 - v) * t);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

const EMBLEMS: Record<SpecId, (c: CanvasRenderingContext2D) => void> = {
  eagle_eye(c) {
    // an eye with a heavy feather brow
    c.beginPath();
    c.moveTo(11, 33);
    c.quadraticCurveTo(32, 12, 53, 33);
    c.quadraticCurveTo(32, 54, 11, 33);
    ink(c, '#fff8e0', 3.5);
    c.beginPath();
    c.arc(32, 33, 10.5, 0, Math.PI * 2);
    ink(c, '#c8741a', 3);
    c.beginPath();
    c.arc(32, 33, 5, 0, Math.PI * 2);
    ink(c, INK, 1);
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(29.5, 30.5, 2.2, 0, Math.PI * 2);
    c.fill();
    line(c, [[12, 21], [26, 15], [52, 17]], '#fff8e0', 3);
  },
  hunting_nets(c) {
    // a round web: spokes + two rings
    const cx = 32;
    const cy = 32;
    const spokes = 6;
    const pts = (r: number): [number, number][] => Array.from({ length: spokes }, (_, i) => [cx + Math.cos((i / spokes) * Math.PI * 2 - 0.5) * r, cy + Math.sin((i / spokes) * Math.PI * 2 - 0.5) * r]);
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2 - 0.5;
      line(c, [[cx, cy], [cx + Math.cos(a) * 21, cy + Math.sin(a) * 21]], '#f4f0dc', 2.5);
    }
    line(c, pts(21), '#f4f0dc', 2.5, true);
    line(c, pts(12), '#f4f0dc', 2.5, true);
  },
  chain_lightning(c) {
    c.beginPath();
    c.moveTo(38, 6);
    c.lineTo(18, 35);
    c.lineTo(29, 35);
    c.lineTo(24, 58);
    c.lineTo(47, 26);
    c.lineTo(35, 26);
    c.lineTo(43, 6);
    c.closePath();
    ink(c, vgrad(c, 6, 58, '#fffbc0', '#ffd34e'), 3.5);
  },
  fire_mages(c) {
    c.beginPath();
    c.moveTo(32, 6);
    c.bezierCurveTo(38, 18, 52, 24, 49, 40);
    c.bezierCurveTo(47, 52, 39, 57, 32, 57);
    c.bezierCurveTo(23, 57, 14, 51, 14, 40);
    c.bezierCurveTo(14, 31, 20, 27, 22, 20);
    c.bezierCurveTo(26, 25, 28, 26, 29, 27);
    c.bezierCurveTo(30, 20, 30, 12, 32, 6);
    c.closePath();
    ink(c, vgrad(c, 6, 57, '#ffb13a', '#e5322a'), 3.5);
    c.beginPath();
    c.moveTo(32, 30);
    c.bezierCurveTo(36, 37, 43, 40, 41, 47);
    c.bezierCurveTo(39, 53, 25, 53, 24, 46);
    c.bezierCurveTo(24, 40, 30, 38, 32, 30);
    c.closePath();
    c.fillStyle = '#ffe98a';
    c.fill();
  },
  bigger_bombs(c) {
    c.beginPath();
    c.arc(30, 37, 17, 0, Math.PI * 2);
    ink(c, vgrad(c, 20, 54, '#7b7596', '#2c2838'), 4);
    c.fillStyle = 'rgba(255,255,255,0.4)';
    c.beginPath();
    c.ellipse(24, 30, 6, 4, -0.6, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.rect(35, 15, 10, 8);
    ink(c, '#8a5a3a', 3);
    line(c, [[42, 15], [48, 9], [53, 10]], '#d9a35a', 2.5);
    c.fillStyle = '#ffe27a';
    c.strokeStyle = INK;
    c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? 3 : 7;
      const a = (i / 8) * Math.PI * 2;
      c.lineTo(53 + Math.cos(a) * r, 9 + Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
    c.stroke();
  },
  homing_missiles(c) {
    c.save();
    c.translate(32, 32);
    c.rotate(-Math.PI / 4);
    // flame
    c.beginPath();
    c.moveTo(-6, 22);
    c.lineTo(0, 36);
    c.lineTo(6, 22);
    c.closePath();
    ink(c, '#ffb13a', 3);
    // fins
    c.beginPath();
    c.moveTo(-7, 8);
    c.lineTo(-15, 22);
    c.lineTo(-7, 20);
    c.closePath();
    ink(c, '#c0392b', 3);
    c.beginPath();
    c.moveTo(7, 8);
    c.lineTo(15, 22);
    c.lineTo(7, 20);
    c.closePath();
    ink(c, '#c0392b', 3);
    // body + nose
    c.beginPath();
    c.moveTo(0, -27);
    c.quadraticCurveTo(9, -14, 8, 0);
    c.lineTo(8, 22);
    c.lineTo(-8, 22);
    c.lineTo(-8, 0);
    c.quadraticCurveTo(-9, -14, 0, -27);
    c.closePath();
    ink(c, '#e9edf5', 3.5);
    c.beginPath();
    c.moveTo(0, -27);
    c.quadraticCurveTo(7, -17, 8, -9);
    c.lineTo(-8, -9);
    c.quadraticCurveTo(-7, -17, 0, -27);
    c.closePath();
    c.fillStyle = '#e5484d';
    c.fill();
    c.beginPath();
    c.arc(0, 5, 3.2, 0, Math.PI * 2);
    ink(c, '#4fa8e8', 2);
    c.restore();
  },
  bow_training(c) {
    line(c, [[40, 11], [24, 20], [20, 32], [24, 44], [40, 53]], '#a8742e', 4.5);
    c.lineWidth = 1.6;
    c.strokeStyle = '#fff';
    c.beginPath();
    c.moveTo(40, 11);
    c.lineTo(40, 53);
    c.stroke();
    line(c, [[16, 32], [50, 32]], '#e7d3a2', 2.6);
    c.beginPath();
    c.moveTo(54, 32);
    c.lineTo(45, 26);
    c.lineTo(45, 38);
    c.closePath();
    ink(c, '#dfe5ee', 2.5);
    c.beginPath();
    c.moveTo(12, 32);
    c.lineTo(19, 27);
    c.lineTo(19, 37);
    c.closePath();
    ink(c, '#e5484d', 2);
  },
  extra_recruits(c) {
    // helmet with a plume and a bold +1
    c.beginPath();
    c.moveTo(10, 40);
    c.lineTo(10, 30);
    c.quadraticCurveTo(10, 14, 27, 14);
    c.quadraticCurveTo(44, 14, 44, 30);
    c.lineTo(44, 40);
    c.closePath();
    ink(c, vgrad(c, 14, 40, '#f2f5fa', '#9aa5b8'), 3.5);
    c.beginPath();
    c.rect(8, 38, 38, 6);
    ink(c, '#7d889b', 3);
    c.fillStyle = INK;
    c.fillRect(21, 26, 12, 4.5);
    c.fillRect(25.5, 26, 3, 12);
    c.beginPath();
    c.moveTo(27, 14);
    c.quadraticCurveTo(26, 5, 36, 6);
    c.quadraticCurveTo(33, 10, 33, 15);
    c.closePath();
    ink(c, '#e5484d', 2.5);
    c.font = 'bold 26px "Lilita One", Arial, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = 6;
    c.strokeStyle = INK;
    c.lineJoin = 'round';
    c.strokeText('+1', 47, 48);
    c.fillStyle = '#ffe27a';
    c.fillText('+1', 47, 48);
  },
};

let done = false;

/** Idempotent: safe to call from any scene before using an emblem. */
export function generateSpecTextures(scene: Phaser.Scene): void {
  for (const id of Object.keys(SPEC_TEX) as SpecId[]) {
    make(scene, SPEC_TEX[id], 64, 64, (c) => {
      plaque(c, SPEC_COLOR[id]);
      EMBLEMS[id](c);
    });
  }
  if (done && scene.textures.exists(FXTEX.net)) return;
  done = true;

  // lobbed net: a crumpled ball of rope with a few knots
  make(scene, FXTEX.net, 48, 48, (c) => {
    c.beginPath();
    c.arc(24, 24, 16, 0, Math.PI * 2);
    ink(c, 'rgba(226,214,170,0.55)', 4);
    c.save();
    c.beginPath();
    c.arc(24, 24, 15, 0, Math.PI * 2);
    c.clip();
    for (let i = -3; i <= 3; i++) {
      line(c, [[24 + i * 7 - 18, 6], [24 + i * 7 + 18, 42]], '#efe3b8', 1.8);
      line(c, [[24 + i * 7 + 18, 6], [24 + i * 7 - 18, 42]], '#efe3b8', 1.8);
    }
    c.restore();
    c.beginPath();
    c.arc(24, 24, 16, 0, Math.PI * 2);
    c.lineWidth = 3.5;
    c.strokeStyle = INK;
    c.stroke();
    c.strokeStyle = '#f4ead0';
    c.lineWidth = 1.5;
    c.stroke();
  });

  // spread net lying on the ground (iso ellipse 2:1): rings + spokes, drawn white so it can be tinted
  make(scene, FXTEX.netMesh, 256, 128, (c, w, h) => {
    c.save();
    c.translate(w / 2, h / 2);
    c.scale(1, h / w);
    const R = w / 2 - 6;
    c.fillStyle = 'rgba(235,225,185,0.16)';
    c.beginPath();
    c.arc(0, 0, R, 0, Math.PI * 2);
    c.fill();
    c.lineCap = 'round';
    const strokeAll = (col: string, lw: number) => {
      c.strokeStyle = col;
      c.lineWidth = lw;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + 0.2;
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(Math.cos(a) * R, Math.sin(a) * R);
        c.stroke();
      }
      for (const k of [0.4, 0.7, 1]) {
        c.beginPath();
        c.arc(0, 0, R * k, 0, Math.PI * 2);
        c.stroke();
      }
    };
    strokeAll('rgba(46,34,47,0.42)', 5);
    strokeAll('#f3ead0', 2.6);
    c.restore();
  });

  // rope bindings over a netted UFO: a loose diamond lattice, thin so the UFO stays readable
  make(scene, FXTEX.rope, 64, 64, (c) => {
    c.save();
    c.beginPath();
    c.ellipse(32, 32, 29, 27, 0, 0, Math.PI * 2);
    c.clip();
    for (let i = -1; i <= 1; i++) {
      line(c, [[32 + i * 20 - 26, 0], [32 + i * 20 + 26, 64]], '#f1e6bd', 2.4, false, 1.8);
      line(c, [[32 + i * 20 + 26, 0], [32 + i * 20 - 26, 64]], '#f1e6bd', 2.4, false, 1.8);
    }
    c.restore();
    for (const [x, y] of [[32, 32], [12, 32], [52, 32], [32, 12], [32, 52]]) {
      c.beginPath();
      c.arc(x, y, 2.6, 0, Math.PI * 2);
      ink(c, '#d6c58a', 1.6);
    }
  });

  // small rocket pointing up (ProjectileView rotates it along the velocity)
  make(scene, FXTEX.rocket, 20, 40, (c) => {
    c.beginPath();
    c.moveTo(4, 26);
    c.lineTo(0, 37);
    c.lineTo(8, 33);
    c.closePath();
    ink(c, '#c0392b', 2.5);
    c.beginPath();
    c.moveTo(16, 26);
    c.lineTo(20, 37);
    c.lineTo(12, 33);
    c.closePath();
    ink(c, '#c0392b', 2.5);
    c.beginPath();
    c.moveTo(10, 2);
    c.quadraticCurveTo(16, 9, 15, 15);
    c.lineTo(15, 31);
    c.lineTo(5, 31);
    c.lineTo(5, 15);
    c.quadraticCurveTo(4, 9, 10, 2);
    c.closePath();
    ink(c, '#e9edf5', 3);
    c.beginPath();
    c.moveTo(10, 2);
    c.quadraticCurveTo(14.5, 7, 15, 11);
    c.lineTo(5, 11);
    c.quadraticCurveTo(5.5, 7, 10, 2);
    c.closePath();
    c.fillStyle = '#e5484d';
    c.fill();
    c.fillStyle = INK;
    c.fillRect(5, 19, 10, 2.5);
  });

  // launcher pod: a short rack of two tubes tilted up-right, to sit beside the mortar
  make(scene, FXTEX.pod, 56, 48, (c) => {
    c.save();
    c.translate(28, 26);
    c.rotate(-0.35);
    c.beginPath();
    c.roundRect(-22, -10, 44, 24, 5);
    ink(c, vgrad(c, -10, 14, '#7c8696', '#454e60'), 4);
    for (const dy of [-3, 7]) {
      c.beginPath();
      c.ellipse(21, dy, 4.5, 5, 0, 0, Math.PI * 2);
      ink(c, '#1d1626', 2.5);
      c.beginPath();
      c.moveTo(21, dy - 3);
      c.lineTo(28, dy);
      c.lineTo(21, dy + 3);
      c.closePath();
      ink(c, '#e5484d', 2);
    }
    c.fillStyle = '#ffd34e';
    c.fillRect(-16, -6, 4, 4);
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.fillRect(-18, -8, 30, 3);
    c.restore();
    c.beginPath();
    c.rect(18, 36, 20, 8);
    ink(c, '#5a4a3a', 3);
  });

  // knight's bow, held at the side: limb curves to the right
  make(scene, FXTEX.kbow, 24, 40, (c) => {
    line(c, [[8, 3], [18, 12], [20, 20], [18, 28], [8, 37]], '#b07a34', 3.2);
    c.lineWidth = 1.2;
    c.strokeStyle = '#fff';
    c.beginPath();
    c.moveTo(8, 3);
    c.lineTo(8, 37);
    c.stroke();
  });

  // soft flame teardrop (additive particles / flicker)
  make(scene, FXTEX.flame, 24, 32, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h * 0.62, 1, w / 2, h * 0.62, h * 0.5);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(w / 2, 0);
    c.bezierCurveTo(w * 0.8, h * 0.35, w, h * 0.55, w * 0.5, h);
    c.bezierCurveTo(0, h * 0.55, w * 0.2, h * 0.35, w / 2, 0);
    c.fill();
  });

  // swallow-tail pennant, pole is its left edge
  make(scene, FXTEX.pennant, 36, 56, (c) => {
    c.beginPath();
    c.rect(2, 2, 4, 52);
    ink(c, '#6b4a2a', 2.5);
    c.beginPath();
    c.moveTo(6, 6);
    c.lineTo(32, 10);
    c.lineTo(25, 18);
    c.lineTo(32, 27);
    c.lineTo(6, 30);
    c.closePath();
    ink(c, '#3a63c9', 3);
    c.fillStyle = '#ffe27a';
    c.fillRect(11, 14, 10, 2.5);
  });
}
