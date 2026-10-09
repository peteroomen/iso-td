import Phaser from 'phaser';
import { ensureUiTextures } from '../ui/icons';

/** Loads the few assets the loading screen needs, registers generated UI textures and waits for the web font. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.image('ufo/ufo_1', 'assets/sprites/ufo/ufo_1.png');
  }

  create(): void {
    ensureUiTextures(this);
    document.getElementById('boot-msg')?.remove();
    const go = (): void => {
      if (this.scene.isActive()) this.scene.start('Preload');
    };
    // The bundled font is local, so this is nearly instant; the timeout only guards against odd browsers.
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts) return go();
    const timeout = new Promise<void>((r) => window.setTimeout(r, 3000));
    Promise.race([fonts.load('32px "Lilita One"').then(() => undefined), timeout]).then(go, go);
  }
}
