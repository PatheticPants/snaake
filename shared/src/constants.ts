// ============================================================
// SERPENT ARENA - Shared Constants & Balance Configuration
// ============================================================
// All tunable gameplay values are centralized here.
// Balance philosophy:
//   - Early game is forgiving: small snakes are fast and agile
//   - Growth is satisfying but not exponential
//   - Boosting is powerful but costly: good for escapes and kills
//   - Large snakes are strong but slower to turn, giving small snakes outplay options
//   - Pellet density keeps the arena interesting without overwhelming
//   - Spawn safety reduces cheap deaths

// --- World ---
export const WORLD_WIDTH = 6000;
export const WORLD_HEIGHT = 6000;
export const WORLD_BORDER_THICKNESS = 40;

// --- Tick Rate ---
export const SERVER_TICK_RATE = 20; // ticks per second
export const SERVER_TICK_MS = 1000 / SERVER_TICK_RATE;
export const CLIENT_RENDER_INTERPOLATION = true;

// --- Snake ---
export const SNAKE_INITIAL_LENGTH = 10; // number of segments
export const SNAKE_SEGMENT_SPACING = 12; // pixels between segment centers
export const SNAKE_BASE_RADIUS = 12; // head/body radius at base size
export const SNAKE_MAX_RADIUS = 40;
export const SNAKE_BASE_SPEED = 200; // pixels per second
export const SNAKE_MIN_SPEED = 120; // speed at very large sizes
export const SNAKE_TURN_RATE = 4.0; // radians per second
export const SNAKE_TURN_RATE_MIN = 1.8; // turn rate at max size
export const SNAKE_INITIAL_SCORE = 10;
export const SNAKE_MAX_SEGMENTS = 500;

// --- Growth ---
export const GROWTH_PER_PELLET = 1; // score per normal pellet
export const GROWTH_PER_DEATH_PELLET = 3; // score per death pellet
export const SCORE_TO_LENGTH_RATIO = 0.8; // how quickly score converts to segments
export const GROWTH_SMOOTHING_RATE = 0.1; // segments added per tick toward target

// --- Boost ---
export const BOOST_SPEED_MULTIPLIER = 1.8;
export const BOOST_MASS_DRAIN_RATE = 3; // score lost per second while boosting
export const BOOST_MIN_SCORE = 15; // minimum score to be able to boost
export const BOOST_PELLET_INTERVAL = 80; // pixels traveled between dropping pellets
export const BOOST_PELLET_VALUE = 1;

// --- Surge (special ability) ---
export const SURGE_CHARGE_MAX = 100;
export const SURGE_PASSIVE_CHARGE_RATE = 8; // charge per second while not boosting
export const SURGE_PELLET_CHARGE_MULTIPLIER = 1.5; // additional charge from eaten pellet value
export const SURGE_DURATION = 2.4; // seconds
export const SURGE_SPEED_MULTIPLIER = 2.25;
export const SURGE_PELLET_MAGNET_RADIUS = 140;

// --- Pellets ---
export const PELLET_BASE_COUNT = 1500; // pellets maintained in the world
export const PELLET_RADIUS = 5;
export const PELLET_SPAWN_MARGIN = 100; // stay away from borders
export const DEATH_PELLET_RADIUS = 7;
export const DEATH_PELLET_LIFETIME = 60000; // ms before death pellets despawn
export const PELLET_PICKUP_RADIUS_BONUS = 8; // extra forgiving pickup radius

// --- Collision ---
export const SELF_COLLISION_ENABLED = false;
export const HEAD_TO_HEAD_BOTH_DIE = true; // both snakes die on head-to-head
export const BOUNDARY_KILLS = true; // touching border = death
export const COLLISION_GRACE_SEGMENTS = 5; // ignore first N segments for self-collision

// --- Camera ---
export const CAMERA_ZOOM_BASE = 1.0;
export const CAMERA_ZOOM_MIN = 0.4; // zoomed out for large snakes
export const CAMERA_ZOOM_SCORE_FACTOR = 0.002; // how fast zoom scales with score
export const CAMERA_SMOOTHING = 0.08;

// --- Leaderboard ---
export const LEADERBOARD_SIZE = 10;
export const LEADERBOARD_UPDATE_INTERVAL = 1000; // ms

// --- Spawning ---
export const SPAWN_SAFETY_RADIUS = 400; // no snakes within this radius of a new spawn
export const SPAWN_MARGIN = 500; // stay away from borders when spawning
export const SPAWN_MAX_ATTEMPTS = 50;

// --- Bots ---
export const BOT_COUNT_DEFAULT = 8;
export const BOT_NAMES = [
  'Viper', 'Naga', 'Asp', 'Cobra', 'Mamba', 'Krait',
  'Adder', 'Boa', 'Python', 'Taipan', 'Coral', 'Sidewinder',
  'Rattler', 'Kingpin', 'Basilisk', 'Ouroboros', 'Slinky',
  'Noodle', 'Wiggles', 'Scales', 'Fang', 'Hisser',
  'Slick', 'Zigzag', 'Coil', 'Striker', 'Shadow',
  'Blaze', 'Frost', 'Storm', 'Ember', 'Venom'
];

// --- Network ---
export const INPUT_SEND_RATE = 30; // max input messages per second
export const SNAPSHOT_SEND_RATE = 20; // world updates per second
export const MAX_PLAYERS = 50;
export const NAME_MAX_LENGTH = 16;
export const NAME_MIN_LENGTH = 1;
export const RECONNECT_TIMEOUT = 5000;

// --- Skins ---
export const SKIN_COUNT = 12;

// --- Spatial ---
export const SPATIAL_CELL_SIZE = 200; // grid cell size for spatial hash

// --- Minimap ---
export const MINIMAP_SIZE = 180; // pixels on screen
export const MINIMAP_PADDING = 15;
