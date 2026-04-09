// src/constants.js — 게임 전체 상수 정의

// ─── Map ──────────────────────────────────────────────────────
export const MAP_WIDTH  = 2880;
export const MAP_HEIGHT = 2048;

// ─── Player ───────────────────────────────────────────────────
export const PLAYER = {
  RADIUS:          16,
  HITBOX_RADIUS:   7,
  BASE_SPEED:      200,   // px/s
  DASH_DISTANCE:   220,   // px
  DASH_DURATION:   0.13,  // seconds (animation)
  DASH_STACKS_MAX: 3,
  DASH_RECHARGE:   3.0,   // seconds per stack
  START_LIFE:      5,
  MAX_LIFE:        10,
  INVINCIBLE_SECS: 1.5,
};

// ─── Bullet ───────────────────────────────────────────────────
export const BULLET = {
  BASE_SPEED: 160,   // px/s
  RADIUS:     5,
};
export const MAX_BULLETS = 600;

// ─── Wave ─────────────────────────────────────────────────────
export const WAVE = {
  INTERVAL:              30,   // seconds per wave
  MAX:                   10,
  SPEED_MULT_PER_WAVE:   0.08, // +8% bullet speed per wave
  DENSITY_MULT_PER_WAVE: 0.15, // +15% spawn rate per wave
};

// ─── Score ────────────────────────────────────────────────────
export const SCORE = {
  CLEAR_TARGET:   100000,
  PER_SECOND:     1,
  ITEM_BASE:      50,
  NOHIT_BONUS:    100,
  NOHIT_INTERVAL: 15,  // seconds between no-hit bonuses
};

// ─── Level ────────────────────────────────────────────────────
// EXP_TABLE[n] = total cumulative EXP needed to reach level n
export const LEVEL = {
  MAX: 10,
  EXP_TABLE: [0, 0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700],
  // Stat bonuses applied automatically on reaching each level
  BONUSES: {
    2:  { speed: 10 },
    3:  { maxLife: 1 },
    4:  { speed: 10 },
    5:  { dashRecharge: -0.3 },
    6:  { speed: 10 },
    7:  { maxLife: 1 },
    8:  { speed: 15 },
    9:  { dashRecharge: -0.3 },
    10: { speed: 20, maxLife: 1 },
  },
};

// ─── Zones (3 cols × 2 rows, total 6 zones) ───────────────────
export const ZONES = [
  { id: 0, x: 0,    y: 0,    w: 960, h: 1024, type: 'safe',      label: '',   density: 0.3, rewardMult: 0.5 },
  { id: 1, x: 960,  y: 0,    w: 960, h: 1024, type: 'normal',    label: '',   density: 1.0, rewardMult: 1.0 },
  { id: 2, x: 1920, y: 0,    w: 960, h: 1024, type: 'high-risk', label: '', density: 2.0, rewardMult: 2.0 },
  { id: 3, x: 0,    y: 1024, w: 960, h: 1024, type: 'normal',    label: '',   density: 1.0, rewardMult: 1.0 },
  { id: 4, x: 960,  y: 1024, w: 960, h: 1024, type: 'event',     label: '', density: 1.5, rewardMult: 1.5 },
  { id: 5, x: 1920, y: 1024, w: 960, h: 1024, type: 'high-risk', label: '', density: 2.0, rewardMult: 2.0 },
];

export const ZONE_STYLE = {
  'safe':      { fill: 'rgba(76,175,80,0.07)',   borderColor: '#4caf50', blockColor: '#2e7d32', blockHighlight: '#66bb6a' },
  'normal':    { fill: 'rgba(255,235,59,0.07)',  borderColor: '#ffeb3b', blockColor: '#f9a825', blockHighlight: '#fff176' },
  'high-risk': { fill: 'rgba(244,67,54,0.10)',   borderColor: '#f44336', blockColor: '#b71c1c', blockHighlight: '#ef9a9a' },
  'event':     { fill: 'rgba(33,150,243,0.10)',  borderColor: '#2196f3', blockColor: '#0d47a1', blockHighlight: '#90caf9' },
};

export const BLOCK_SIZE = 16; // zone border block tile size (px)

// ─── Items ────────────────────────────────────────────────────
export const ITEM = {
  health: { color: '#ef5350', emoji: '❤️', radius: 12, exp: 0,  score: 30, slowDuration: 0 },
  exp:    { color: '#66bb6a', emoji: '⭐', radius: 10, exp: 60, score: 50, slowDuration: 0 },
  slow:   { color: '#29b6f6', emoji: '❄️', radius: 12, exp: 15, score: 40, slowDuration: 4 },
  shield: { color: '#ab47bc', emoji: '🛡️', radius: 12, exp: 15, score: 40, slowDuration: 0 },
};

export const ITEM_TYPES = ['health', 'exp', 'slow', 'shield'];

// Item drop rate (spawns per second) per zone type
export const ITEM_DROP_RATE = {
  'safe':      0.04,
  'normal':    0.07,
  'high-risk': 0.13,
  'event':     0.10,
};

export const MAX_ITEMS_ON_MAP = 40;

// ─── Player Skills ────────────────────────────────────────────
export const SKILLS = {
  SLOW_MODE: {
    DURATION:     5,    // 활성 지속 시간 (초)
    COOLDOWN:     12,   // 재사용 대기 시간 (초)
    BULLET_SLOW:  0.35, // 탄막 속도 배율
  },
  SPEED_BOOST: {
    DURATION:    3,     // 활성 지속 시간 (초)
    COOLDOWN:    8,     // 재사용 대기 시간 (초)
    SPEED_MULT:  1.7,   // 이동 속도 배율
  },
};
