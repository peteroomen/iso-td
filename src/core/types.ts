/**
 * Shared types for the pure simulation core. No Phaser / DOM here.
 * All positions are in grid ("tile") units: cell (x, y) has its centre at (x + 0.5, y + 0.5).
 */

export type Biome = 'spring' | 'desert' | 'winter';
export type TowerKind = 'archer' | 'wizard' | 'barracks';
export type EnemyId = 'scout' | 'dart' | 'skimmer' | 'plated' | 'prism' | 'carrier' | 'dread' | 'mothership';
export type DamageType = 'physical' | 'magic' | 'true';
export type AbilityId = 'orbital' | 'reinforce';

export interface Vec2 {
  x: number;
  y: number;
}

// --------------------------------------------------------------------------------------------
// Level definition
// --------------------------------------------------------------------------------------------

/**
 * Tile characters in `LevelDef.tiles`:
 *  '.' ground, '#' road, 'B' build spot, 'T' tree, 'r' rock, 'c' crystal, 'd' small decoration, ' ' void (nothing drawn).
 */
export type TileChar = '.' | '#' | 'B' | 'T' | 'r' | 'c' | 'd' | ' ';

/** Per-cell biome for `biome: 'mixed'` levels: 's' spring, 'd' desert, 'w' winter. */
export type BiomeChar = 's' | 'd' | 'w';

export interface SpawnGroup {
  enemy: EnemyId;
  count: number;
  /** Seconds between two spawns of this group. */
  interval: number;
  /** Seconds from wave start until the first spawn of this group. */
  delay: number;
  /** Index into `LevelDef.paths`. */
  path: number;
}

export interface WaveDef {
  groups: SpawnGroup[];
}

export interface TowerCap {
  archer: number;
  wizard: number;
  barracks: number;
}

export interface LevelHint {
  /**
   * The hint is relevant while `state.wave.index === waveIndex`
   * (wave.index = number of waves started so far; 0 = level start, before the first wave is called).
   */
  waveIndex: number;
  text: string;
}

export interface LevelDef {
  id: string;
  name: string;
  biome: Biome | 'mixed';
  /** ASCII rows, tiles[y][x]. See TileChar. All rows must have equal length. */
  tiles: string[];
  /** For `biome: 'mixed'`: same dimensions as tiles, one BiomeChar per cell. */
  biomeMap?: string[];
  /**
   * Explicit enemy paths: polylines of cell-centre coordinates (grid units), axis-aligned segments, running over
   * '#' cells only. The first point is just off-map (e.g. x = -0.5) and the last point just off-map past the exit.
   */
  paths: Vec2[][];
  startGold: number;
  /** Starting lives (20). */
  lives: number;
  /** Seconds between the end of a wave's spawning and the automatic start of the next wave (default 18). */
  waveGap?: number;
  towerCap: TowerCap;
  waves: WaveDef[];
  hints?: LevelHint[];
}

/** A fixed build spot, derived from the 'B' cells (id = index in row-major order). */
export interface BuildSpot {
  id: number;
  /** Cell coordinates. */
  col: number;
  row: number;
  /** Cell centre in grid units. */
  x: number;
  y: number;
}

// --------------------------------------------------------------------------------------------
// Star upgrade tree
// --------------------------------------------------------------------------------------------

export type UpgradeTrack = 'archers' | 'wizards' | 'barracks' | 'orbital' | 'reinforcements';

/** Purchased tiers per track (0..3). */
export type UpgradeState = Record<UpgradeTrack, number>;

// --------------------------------------------------------------------------------------------
// Commands
// --------------------------------------------------------------------------------------------

export type FailReason =
  | 'gold' // not enough gold
  | 'capped' // level cap of this stage forbids it
  | 'max_level' // already level 3
  | 'occupied' // build spot already has a tower
  | 'no_spot' // unknown build spot
  | 'no_tower' // unknown tower id
  | 'wrong_kind' // e.g. setRally on a non-barracks
  | 'out_of_range' // rally point too far from tower / target outside map
  | 'not_on_road' // point not close enough to an enemy path
  | 'cooldown' // ability on cooldown
  | 'wave_in_progress' // callNextWave while the current wave is still spawning
  | 'no_more_waves' // callNextWave after the last wave started
  | 'not_running' // abilities before the first wave
  | 'ended'; // level already won/lost

export interface CommandResult {
  ok: boolean;
  reason?: FailReason;
}

// --------------------------------------------------------------------------------------------
// Snapshot types (read-only views of the simulation)
// --------------------------------------------------------------------------------------------

export type SimStatus = 'pre' | 'running' | 'won' | 'lost';

export interface TowerState {
  readonly id: number;
  readonly spotId: number;
  readonly kind: TowerKind;
  /** 1..3 */
  readonly level: number;
  readonly x: number;
  readonly y: number;
  /** Total gold invested (build + upgrades). */
  readonly invested: number;
  /** Refund if sold now. */
  readonly sellValue: number;
  /** Effective range in tiles (archer/wizard attack range, barracks rally range). */
  readonly range: number;
  /** Seconds until the next shot (archer/wizard). 0 = ready. */
  readonly cooldown: number;
  /** Current target (first enemy in range), if any. Archer/wizard only. */
  readonly targetId: number | null;
  readonly targetX: number | null;
  readonly targetY: number | null;
  /** Unit vector facing (towards target, or last target). */
  readonly facingX: number;
  readonly facingY: number;
  /** True for ~0.3 s after a shot: use for bow/wand animation. */
  readonly attacking: boolean;
  /** Incremented on every shot (handy for triggering animations without events). */
  readonly shotCount: number;
  /** Barracks only: rally post (grid units). */
  readonly rallyX: number | null;
  readonly rallyY: number | null;
  /** Barracks only: ids of its knights (alive or dead-awaiting-respawn). */
  readonly knightIds: readonly number[];
}

export type KnightKind = 'knight' | 'militia';
export type KnightMode = 'idle' | 'walking' | 'fighting' | 'dead';

export interface KnightState {
  readonly id: number;
  readonly kind: KnightKind;
  /** Owning barracks, or null for militia. */
  readonly towerId: number | null;
  /** Barracks level (1..3) for knights; 1 for militia. */
  readonly level: number;
  readonly x: number;
  readonly y: number;
  /** Unit facing vector. */
  readonly facingX: number;
  readonly facingY: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly armor: number;
  readonly mode: KnightMode;
  /** Enemy currently being fought / chased. */
  readonly targetId: number | null;
  /** True for ~0.25 s after a swing. */
  readonly attacking: boolean;
  /** Rally post the knight defends (engagement radius is measured from here). */
  readonly postX: number;
  readonly postY: number;
  /** Idle slot (post + formation offset) the knight walks back to. */
  readonly homeX: number;
  readonly homeY: number;
  /** Seconds until respawn when mode === 'dead' (knights only). */
  readonly respawnTimer: number;
  /** Seconds of life left (militia only; -1 for barracks knights, who live until killed). */
  readonly lifeLeft: number;
}

export interface EnemyState {
  readonly id: number;
  readonly type: EnemyId;
  readonly x: number;
  readonly y: number;
  /** Unit direction of travel (grid units). */
  readonly dirX: number;
  readonly dirY: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly flier: boolean;
  readonly boss: boolean;
  /** True while a knight/militia is in melee contact (enemy has stopped to fight). */
  readonly engaged: boolean;
  /** Knight ids in contact with this enemy this tick. */
  readonly engagedBy: readonly number[];
  readonly slowed: boolean;
  /** True for ~0.25 s after its melee swing. */
  readonly attacking: boolean;
  readonly pathIndex: number;
  /** Distance travelled along the path (tiles). */
  readonly progress: number;
  /** Total path length (tiles); progress/pathLength is the 0..1 route fraction. */
  readonly pathLength: number;
  /** Lateral offset (tiles, perpendicular to path). */
  readonly lateral: number;
  readonly slowTimer: number;
  readonly slowFactor: number;
  readonly attackTimer: number;
  readonly launchTimer: number;
  /** Internal: set when killed/leaked this tick before sweeping. Never true in a snapshot read between steps. */
  readonly dead: boolean;
}

export type ProjectileKind = 'arrow' | 'bolt';

export interface ProjectileState {
  readonly id: number;
  readonly kind: ProjectileKind;
  readonly x: number;
  readonly y: number;
  readonly fromX: number;
  readonly fromY: number;
  /** Target enemy id (may no longer exist: then the projectile flies to tx,ty and fizzles). */
  readonly targetId: number;
  readonly tx: number;
  readonly ty: number;
  readonly speed: number;
  /** Raw (pre-resistance) damage. */
  readonly damage: number;
  readonly damageType: DamageType;
  readonly towerId: number;
  /** Armor reduction (archer tier-3 star upgrade). */
  readonly armorPierce: number;
  /** Wizard tier-3 star upgrade: speed multiplier applied for slowDuration seconds (1 = none). */
  readonly slowFactor: number;
  readonly slowDuration: number;
  /** Number of additional chain targets on impact (wizard L3). */
  readonly chainCount: number;
  readonly chainRange: number;
  readonly chainFactor: number;
  /** Unit direction of travel (for rotating the sprite). */
  readonly dirX: number;
  readonly dirY: number;
}

export interface StrikeState {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** Seconds until the beam lands. */
  readonly timer: number;
  readonly delay: number;
  readonly damage: number;
}

export interface BurnState {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly timer: number;
  readonly duration: number;
  readonly dps: number;
}

export interface AbilityState {
  /** Seconds remaining; 0 = ready. */
  readonly cooldown: number;
  readonly cooldownMax: number;
  readonly ready: boolean;
}

export interface OrbitalAbilityState extends AbilityState {
  readonly radius: number;
  readonly damage: number;
  readonly delay: number;
  readonly burn: boolean;
}

export interface ReinforceAbilityState extends AbilityState {
  /** Max distance from an enemy path for the target point. */
  readonly pathRange: number;
  readonly count: number;
  readonly duration: number;
  readonly hp: number;
}

export interface WavePreviewEntry {
  readonly enemy: EnemyId;
  readonly count: number;
}

export interface WavePreview {
  /** 1-based wave number. */
  readonly number: number;
  /** Aggregated by enemy id, in order of first appearance. */
  readonly entries: readonly WavePreviewEntry[];
  /** Distinct path indices this wave spawns on (where to show incoming buttons). */
  readonly paths: readonly number[];
  readonly hasFlier: boolean;
  readonly hasBoss: boolean;
}

export interface WaveState {
  /** Number of waves started so far (0 before the first). */
  readonly index: number;
  readonly total: number;
  /** True while the current wave is still spawning enemies. */
  readonly spawning: boolean;
  /** Seconds until the next wave starts automatically; null if none is pending (pre, spawning, or last wave out). */
  readonly countdown: number | null;
  readonly countdownMax: number;
  /** Composition of the next wave to be called, or null after the last. */
  readonly next: WavePreview | null;
  /** What callNextWave would pay out right now (0 if not callable early). */
  readonly earlyBonus: number;
}

export interface SimStats {
  readonly kills: number;
  readonly leaked: number;
  readonly spawned: number;
  readonly goldEarned: number;
  readonly goldSpent: number;
}

export interface BossInfo {
  readonly id: number;
  readonly hp: number;
  readonly maxHp: number;
}

export interface SimState {
  readonly status: SimStatus;
  /** Simulated seconds. */
  readonly time: number;
  readonly gold: number;
  readonly lives: number;
  readonly maxLives: number;
  readonly wave: WaveState;
  readonly towers: readonly TowerState[];
  readonly knights: readonly KnightState[];
  readonly enemies: readonly EnemyState[];
  readonly projectiles: readonly ProjectileState[];
  readonly strikes: readonly StrikeState[];
  readonly burns: readonly BurnState[];
  readonly abilities: {
    readonly orbital: OrbitalAbilityState;
    readonly reinforce: ReinforceAbilityState;
  };
  /** Alive mothership, if any (for the top-of-screen HP bar). */
  readonly boss: BossInfo | null;
  /** Set when won (1..3), else 0. */
  readonly stars: number;
  readonly stats: SimStats;
}

// --------------------------------------------------------------------------------------------
// Events
// --------------------------------------------------------------------------------------------

export type HitSource = 'arrow' | 'bolt' | 'chain' | 'orbital' | 'knight' | 'militia';
export type SpawnSource = 'wave' | 'carrier' | 'mothership';

export type SimEvent =
  | { type: 'build'; towerId: number; spotId: number; kind: TowerKind; x: number; y: number; cost: number }
  | { type: 'upgrade'; towerId: number; kind: TowerKind; level: number; x: number; y: number; cost: number }
  | { type: 'sell'; towerId: number; kind: TowerKind; x: number; y: number; refund: number }
  | { type: 'rally'; towerId: number; x: number; y: number }
  | { type: 'waveStart'; number: number; total: number; early: boolean }
  | { type: 'waveCalledEarly'; number: number; bonus: number; remaining: number }
  | { type: 'spawn'; enemyId: number; enemy: EnemyId; x: number; y: number; source: SpawnSource }
  | { type: 'bossSpawn'; enemyId: number; enemy: EnemyId }
  | { type: 'escortLaunch'; fromId: number; x: number; y: number }
  | { type: 'shoot'; towerId: number; kind: TowerKind; projectileId: number; x: number; y: number; targetId: number; tx: number; ty: number }
  | { type: 'hit'; enemyId: number; enemy: EnemyId; x: number; y: number; amount: number; raw: number; damageType: DamageType; source: HitSource }
  | { type: 'chain'; towerId: number; fromX: number; fromY: number; toX: number; toY: number; targetId: number }
  | { type: 'fizzle'; projectileId: number; x: number; y: number }
  | { type: 'kill'; enemyId: number; enemy: EnemyId; x: number; y: number; gold: number; flier: boolean; boss: boolean }
  | { type: 'leak'; enemyId: number; enemy: EnemyId; x: number; y: number; lives: number }
  | { type: 'meleeHit'; attacker: 'knight' | 'militia' | 'enemy'; attackerId: number; targetId: number; x: number; y: number; amount: number }
  | { type: 'knightDeath'; knightId: number; towerId: number | null; kind: KnightKind; x: number; y: number }
  | { type: 'knightRespawn'; knightId: number; towerId: number }
  | { type: 'militiaExpire'; knightId: number; x: number; y: number }
  | { type: 'orbitalWarn'; strikeId: number; x: number; y: number; radius: number; delay: number }
  | { type: 'orbitalHit'; strikeId: number; x: number; y: number; radius: number; damage: number; hits: number }
  | { type: 'burnStart'; burnId: number; x: number; y: number; radius: number; duration: number }
  | { type: 'reinforce'; x: number; y: number; knightIds: number[] }
  | { type: 'abilityReady'; ability: AbilityId }
  | { type: 'won'; lives: number; stars: number }
  | { type: 'lost'; wave: number };

export type SimEventType = SimEvent['type'];
