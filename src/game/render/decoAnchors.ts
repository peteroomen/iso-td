import type Phaser from 'phaser';

/**
 * Per-sprite anchor of every pack decoration (public/assets/sprites/deco/*.png): the pixel that must sit exactly on the
 * cell centre (like FOOT in TowerView). All decorations are drawn at native scale (never magnified, so outlines stay as
 * thin as the tiles' / towers'). Measured with PIL on the alpha>128 silhouette (bbox x0..x1, y0..y1):
 *   - x = bbox centre (all sprites are symmetric about their trunk / base).
 *   - trees, cacti, crystals: y = bottom row - 5 px (half of the ~10 px outline, so the visible base touches the centre).
 *   - stones: y = 30% of the silhouette height above the bottom (lower third of the blob).
 *   - flat tufts (grass / sand / snow decorations): y = bbox centre.
 */
export const DECO_ANCHOR: Record<string, [number, number]> = {
  crystal_1: [40.5, 125],
  crystal_2: [56, 126],
  crystal_3: [60.5, 138],
  desert_cactus_1: [37, 114],
  desert_cactus_2: [37, 108],
  desert_cactus_3: [37, 115],
  desert_cactus_4: [37, 116],
  desert_cactus_5: [37, 110],
  desert_sand_decoration_1: [19.5, 12],
  desert_sand_decoration_2: [19.5, 12],
  desert_sand_decoration_3: [21, 10],
  desert_sand_decoration_4: [21, 10],
  desert_sand_decoration_5: [16.5, 10],
  desert_sand_decoration_6: [15.5, 10],
  desert_sand_decoration_7: [11, 10],
  desert_sand_decoration_8: [19, 10],
  desert_sand_decoration_9: [19, 10],
  desert_stone_sand_1: [19, 25],
  desert_stone_sand_2: [27, 34],
  desert_stone_sand_3: [30.5, 38],
  desert_stone_sand_4: [35, 39],
  spring_grass_decoration_1: [19.5, 11],
  spring_grass_decoration_2: [19, 11],
  spring_grass_decoration_2_1: [20, 11],
  spring_grass_decoration_4: [20, 11],
  spring_grass_decoration_5: [15.5, 10],
  spring_grass_decoration_6: [16.5, 10],
  spring_grass_decoration_7: [11, 9],
  spring_grass_decoration_8: [19, 10],
  spring_grass_decoration_9: [19, 9],
  spring_stone_1: [19, 26],
  spring_stone_2: [26.5, 34],
  spring_stone_3: [30, 38],
  spring_stone_4: [35, 38],
  spring_stone_ground_1: [19, 25],
  spring_stone_ground_2: [26, 34],
  spring_stone_ground_3: [30, 38],
  spring_stone_ground_4: [35.5, 38],
  spring_tree_1: [34.5, 92],
  spring_tree_2: [28.5, 93],
  winter_snow_decoration_1: [19, 11],
  winter_snow_decoration_2: [19, 11],
  winter_snow_decoration_3: [20, 11],
  winter_snow_decoration_4: [20, 11],
  winter_snow_decoration_5: [15.5, 10],
  winter_snow_decoration_6: [16.5, 10],
  winter_snow_decoration_7: [11, 8],
  winter_snow_decoration_8: [19, 10],
  winter_snow_decoration_9: [18.5, 9],
  winter_tree_winter_1: [35, 92],
  winter_tree_winter_2: [28, 93],
};

/** Sets the origin of a deco image from its anchor so that the anchor sits at the image's position. */
export function anchorDeco(img: Phaser.GameObjects.Image, key: string): Phaser.GameObjects.Image {
  const a = DECO_ANCHOR[key.replace(/^deco\//, '')];
  if (a) img.setOrigin(a[0] / img.width, a[1] / img.height);
  else img.setOrigin(0.5, 0.9);
  return img;
}
