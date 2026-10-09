import Phaser from 'phaser';
import { getSave } from './save';

/**
 * Audio facade used by every scene. Keys match public/assets/audio/manifest.json.
 * Preload scene must call `loadAudio(scene)` and, once loaded, `initAudio(game)`.
 * Volumes come from the save's settings (0..1).
 */
export type SfxKey =
  | 'ui_click' | 'ui_hover' | 'ui_error' | 'build_tower' | 'upgrade_tower' | 'sell_tower' | 'coin'
  | 'arrow_shoot' | 'arrow_hit' | 'wizard_cast' | 'wizard_hit' | 'sword_clash' | 'knight_death'
  | 'ufo_explode_small' | 'ufo_explode_big' | 'ufo_hit' | 'leak' | 'wave_start' | 'boss_warning'
  | 'orbital_charge' | 'orbital_blast' | 'reinforcements' | 'star_earned' | 'level_victory' | 'level_defeat';
export type MusicKey = 'music_menu' | 'music_battle_1' | 'music_battle_2' | 'music_boss';

export interface SfxOptions {
  volume?: number; // multiplier, default 1
  detune?: number; // cents; small random detune helps repeated sounds
  /** Minimum ms between plays of this key (anti-spam for very frequent sounds). Default 40. */
  throttleMs?: number;
}

export const Audio = {
  /** Play a one-shot sound effect. Safe to call before audio is ready (no-op). */
  sfx(key: SfxKey, opts?: SfxOptions): void {
    impl?.sfx(key, opts);
  },
  /** Crossfade to a looping music track. Same key again = no-op. */
  music(key: MusicKey | null): void {
    impl?.music(key);
  },
  /** Re-read volumes from the save (call after settings change). */
  refreshVolumes(): void {
    impl?.refreshVolumes();
  },
};

interface AudioImpl {
  sfx(key: SfxKey, opts?: SfxOptions): void;
  music(key: MusicKey | null): void;
  refreshVolumes(): void;
}
let impl: AudioImpl | null = null;

const SFX_KEYS: SfxKey[] = [
  'ui_click', 'ui_hover', 'ui_error', 'build_tower', 'upgrade_tower', 'sell_tower', 'coin', 'arrow_shoot',
  'arrow_hit', 'wizard_cast', 'wizard_hit', 'sword_clash', 'knight_death', 'ufo_explode_small', 'ufo_explode_big',
  'ufo_hit', 'leak', 'wave_start', 'boss_warning', 'orbital_charge', 'orbital_blast', 'reinforcements',
  'star_earned', 'level_victory', 'level_defeat',
];
const MUSIC_KEYS: MusicKey[] = ['music_menu', 'music_battle_1', 'music_battle_2', 'music_boss'];

export function loadAudio(scene: Phaser.Scene): void {
  for (const k of [...SFX_KEYS, ...MUSIC_KEYS]) {
    scene.load.audio(k, [`assets/audio/${k}.ogg`, `assets/audio/${k}.mp3`]);
  }
}

export function initAudio(game: Phaser.Game): void {
  const sound = game.sound;
  const lastPlayed = new Map<string, number>();
  let currentKey: MusicKey | null = null;
  let current: Phaser.Sound.BaseSound | null = null;
  const musicVol = () => getSave().settings.music * 0.6;
  const sfxVol = () => getSave().settings.sfx;

  const fade = (snd: Phaser.Sound.BaseSound, to: number, ms: number, done?: () => void) => {
    const s = snd as Phaser.Sound.WebAudioSound;
    const from = s.volume;
    const start = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / ms);
      s.setVolume(from + (to - from) * t);
      if (t < 1) requestAnimationFrame(tick);
      else done?.();
    };
    tick();
  };

  impl = {
    sfx(key, opts) {
      const now = performance.now();
      const throttle = opts?.throttleMs ?? 40;
      if (now - (lastPlayed.get(key) ?? -1e9) < throttle) return;
      lastPlayed.set(key, now);
      const vol = sfxVol() * (opts?.volume ?? 1);
      if (vol <= 0) return;
      try {
        sound.play(key, { volume: vol, detune: opts?.detune ?? 0 });
      } catch {
        /* sound not loaded / locked */
      }
    },
    music(key) {
      if (key === currentKey) return;
      currentKey = key;
      const old = current;
      if (old) fade(old, 0, 600, () => old.destroy());
      current = null;
      if (!key) return;
      try {
        const next = sound.add(key, { loop: true, volume: 0 });
        next.play();
        fade(next, musicVol(), 800);
        current = next;
      } catch {
        current = null;
      }
    },
    refreshVolumes() {
      if (current) (current as Phaser.Sound.WebAudioSound).setVolume(musicVol());
    },
  };
}
