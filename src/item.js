// src/item.js — 아이템 개별 클래스 + ItemManager (랜덤 드롭)

import { ITEM, ITEM_TYPES, ITEM_DROP_RATE, MAX_ITEMS_ON_MAP, ZONES } from './constants.js';
import { randomBetween, randomItem, circleCircle } from './utils.js';

// ─── 단일 아이템 ──────────────────────────────────────────────
class GameItem {
  constructor(x, y, type) {
    this.x      = x;
    this.y      = y;
    this.type   = type;
    this.config = ITEM[type];
    this.radius = this.config.radius;
    this.alive  = true;
    this._bob   = randomBetween(0, Math.PI * 2); // 초기 위상 랜덤
  }

  update(dt) {
    this._bob += dt * 2.2;
  }

  render(ctx) {
    const { x, config, radius } = this;
    const y = this.y + Math.sin(this._bob) * 3; // 위아래 부유

    ctx.save();

    // 외부 글로우 링
    ctx.beginPath();
    ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
    ctx.fillStyle = config.color + '30';
    ctx.fill();

    // 반투명 배경 원 (이모지 가독성 향상)
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle   = 'rgba(0,0,0,0.55)';
    ctx.strokeStyle = config.color;
    ctx.lineWidth   = 2;
    ctx.shadowColor = config.color;
    ctx.shadowBlur  = 14;
    ctx.fill();
    ctx.stroke();

    // 이모지 렌더링
    ctx.shadowBlur   = 0;
    ctx.font         = `${Math.round(radius * 1.3)}px sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(config.emoji, x, y + 1);

    ctx.restore();
  }
}

// ─── 아이템 매니저 ────────────────────────────────────────────
export class ItemManager {
  constructor() {
    this.items = [];
    this._zoneTimers = {};
    this._resetTimers();
  }

  _resetTimers() {
    ZONES.forEach(z => {
      this._zoneTimers[z.id] = randomBetween(0, 3);
    });
  }

  reset() {
    this.items = [];
    this._resetTimers();
  }

  update(dt) {
    // 스폰 (맵 전체 아이템 수 제한)
    if (this.items.length < MAX_ITEMS_ON_MAP) {
      for (const zone of ZONES) {
        this._zoneTimers[zone.id] -= dt;
        if (this._zoneTimers[zone.id] <= 0) {
          this._zoneTimers[zone.id] = 1 / ITEM_DROP_RATE[zone.type];
          this._spawnItem(zone);
        }
      }
    }

    for (const item of this.items) item.update(dt);

    this.items = this.items.filter(i => i.alive);
  }

  _spawnItem(zone) {
    const margin = 40;
    const x = randomBetween(zone.x + margin, zone.x + zone.w - margin);
    const y = randomBetween(zone.y + margin, zone.y + zone.h - margin);

    // 존 타입에 따라 아이템 드롭 가중치 조정
    let pool;
    switch (zone.type) {
      case 'safe':
        pool = ['health', 'health', 'exp', 'exp', 'slow'];
        break;
      case 'high-risk':
        pool = ['exp', 'exp', 'exp', 'slow', 'shield', 'health'];
        break;
      case 'event':
        pool = ['slow', 'slow', 'exp', 'shield', 'shield'];
        break;
      default: // normal
        pool = ITEM_TYPES;
    }

    this.items.push(new GameItem(x, y, randomItem(pool)));
  }

  // 플레이어와 겹치는 아이템 회수 → 회수된 아이템 배열 반환
  checkPickup(playerX, playerY, pickupRadius) {
    const picked = [];
    for (const item of this.items) {
      if (!item.alive) continue;
      if (circleCircle(playerX, playerY, pickupRadius, item.x, item.y, item.radius)) {
        item.alive = false;
        picked.push(item);
      }
    }
    return picked;
  }

  render(ctx, camera) {
    for (const item of this.items) {
      if (!camera.isVisible(item.x, item.y, item.radius + 8)) continue;
      item.render(ctx);
    }
  }
}
