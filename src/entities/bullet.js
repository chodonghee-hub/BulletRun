// src/bullet.js — 탄막 개별 클래스 + BulletManager (맵 전체 스폰)

import { BULLET, MAX_BULLETS, WAVE, ZONES, MAP_WIDTH, MAP_HEIGHT } from '../core/constants.js';
import { randomBetween, randomInt, pointNearSegment } from '../core/utils.js';

// ─── 단일 탄막 ────────────────────────────────────────────────
class Bullet {
  constructor(x, y, vx, vy, type) {
    this.x    = x;
    this.y    = y;
    this.vx   = vx;
    this.vy   = vy;
    this.type = type;
    this.radius = BULLET.RADIUS;
    this.alive  = true;
  }

  update(dt, _tx, _ty, speedMult, slowMult) {
    const mult = speedMult * slowMult;

    this.x += this.vx * mult * dt;
    this.y += this.vy * mult * dt;

    if (this.x < -60 || this.x > MAP_WIDTH + 60 ||
        this.y < -60 || this.y > MAP_HEIGHT + 60) {
      this.alive = false;
    }
  }

  render(ctx) {
    const colorMap = {
      straight:   '#ff5252',
      circular:   '#ff6e40',
      fan:        '#ff9100',
      tracking:   '#ff4081',
      fast:       '#ffab40',
      slow_dense: '#ea80fc',
    };
    const color = colorMap[this.type] ?? '#ff5252';

    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle   = color;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 7;
    ctx.fill();
    ctx.restore();
  }
}

// ─── 탄막 매니저 ──────────────────────────────────────────────
export class BulletManager {
  constructor() {
    this.bullets = [];
    this._zoneTimers = {};
    this._resetTimers();
  }

  _resetTimers() {
    ZONES.forEach(z => {
      this._zoneTimers[z.id] = randomBetween(0, 1);
    });
  }

  reset() {
    this.bullets = [];
    this._resetTimers();
  }

  update(dt, wave, playerX, playerY, slowActive) {
    const speedMult   = 1 + (wave - 1) * WAVE.SPEED_MULT_PER_WAVE;
    const densityMult = 1 + (wave - 1) * WAVE.DENSITY_MULT_PER_WAVE;
    const slowMult    = slowActive ? 0.38 : 1.0;

    // 각 존에서 스폰
    for (const zone of ZONES) {
      this._zoneTimers[zone.id] -= dt;
      // 기본 인터벌 = 1 / (density * densityMult) * 0.5
      const interval = 0.5 / (zone.density * densityMult);
      if (this._zoneTimers[zone.id] <= 0) {
        // interval × 2 = 생성량 50% 감소
        this._zoneTimers[zone.id] = interval * 2;
        if (this.bullets.length < MAX_BULLETS) {
          this._spawnBullet(zone, wave, playerX, playerY);
        }
      }
    }

    // 전체 탄막 업데이트
    for (const b of this.bullets) {
      b.update(dt, playerX, playerY, speedMult, slowMult);
    }

    // 맵 밖으로 나간 탄막 제거
    this.bullets = this.bullets.filter(b => b.alive);
  }

  _spawnBullet(zone, wave, playerX, playerY) {
    const spd    = BULLET.BASE_SPEED;
    const margin = 32;
    const sx = randomBetween(zone.x + margin, zone.x + zone.w - margin);
    const sy = randomBetween(zone.y + margin, zone.y + zone.h - margin);

    // 웨이브가 높을수록 다양한 패턴 등장 (유도 탄막 제외)
    const pool = ['straight', 'circular', 'fan'];
    if (wave >= 3) pool.push('fast');
    if (wave >= 4) pool.push('slow_dense');

    const type = pool[randomInt(0, pool.length - 1)];

    switch (type) {
      case 'straight': {
        const angle = randomBetween(0, Math.PI * 2);
        this.bullets.push(new Bullet(sx, sy, Math.cos(angle) * spd, Math.sin(angle) * spd, type));
        break;
      }
      case 'circular': {
        const count = 8 + (wave - 1) * 2;
        for (let i = 0; i < count; i++) {
          const a = (Math.PI * 2 / count) * i;
          this.bullets.push(new Bullet(sx, sy, Math.cos(a) * spd * 0.8, Math.sin(a) * spd * 0.8, type));
        }
        break;
      }
      case 'fan': {
        const toward = Math.atan2(playerY - sy, playerX - sx);
        const spread = Math.PI / 3;
        const count  = 5;
        for (let i = 0; i < count; i++) {
          const a = toward - spread / 2 + (spread / (count - 1)) * i;
          this.bullets.push(new Bullet(sx, sy, Math.cos(a) * spd, Math.sin(a) * spd, type));
        }
        break;
      }
      case 'fast': {
        const a = Math.atan2(playerY - sy, playerX - sx) + randomBetween(-0.25, 0.25);
        this.bullets.push(new Bullet(sx, sy, Math.cos(a) * spd * 2.2, Math.sin(a) * spd * 2.2, type));
        break;
      }
      case 'slow_dense': {
        for (let i = 0; i < 6; i++) {
          const a = randomBetween(0, Math.PI * 2);
          this.bullets.push(new Bullet(sx, sy, Math.cos(a) * spd * 0.44, Math.sin(a) * spd * 0.44, type));
        }
        break;
      }
    }
  }

  // 반경 내 탄막 모두 파괴 (피버타임용)
  clearInRadius(cx, cy, radius) {
    const r2 = radius * radius;
    for (const b of this.bullets) {
      if (!b.alive) continue;
      const dx = b.x - cx, dy = b.y - cy;
      if (dx * dx + dy * dy < r2) b.alive = false;
    }
  }

  // 대시 경로 위의 탄막 모두 파괴 → 파괴 개수 반환
  handleDash(x1, y1, x2, y2, sweepRadius) {
    let count = 0;
    for (const b of this.bullets) {
      if (!b.alive) continue;
      if (pointNearSegment(b.x, b.y, x1, y1, x2, y2, sweepRadius + b.radius)) {
        b.alive = false;
        count++;
      }
    }
    return count;
  }

  render(ctx, camera) {
    for (const b of this.bullets) {
      if (!camera.isVisible(b.x, b.y, b.radius + 6)) continue;
      b.render(ctx);
    }
  }
}
