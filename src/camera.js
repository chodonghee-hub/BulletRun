// src/camera.js — 플레이어 추적 카메라

import { MAP_WIDTH, MAP_HEIGHT } from './constants.js';
import { clamp } from './utils.js';

export class Camera {
  constructor(viewW, viewH) {
    this.viewW = viewW;
    this.viewH = viewH;
    this.x = 0;
    this.y = 0;
  }

  // 타겟 위치를 기준으로 카메라 이동 (맵 경계 클램프)
  follow(targetX, targetY) {
    this.x = clamp(targetX - this.viewW / 2, 0, Math.max(0, MAP_WIDTH  - this.viewW));
    this.y = clamp(targetY - this.viewH / 2, 0, Math.max(0, MAP_HEIGHT - this.viewH));
  }

  apply(ctx) {
    ctx.save();
    ctx.translate(-Math.floor(this.x), -Math.floor(this.y));
  }

  restore(ctx) {
    ctx.restore();
  }

  // 화면 내에 오브젝트가 보이는지 여부 (컬링용)
  isVisible(worldX, worldY, margin = 0) {
    return (
      worldX + margin > this.x &&
      worldX - margin < this.x + this.viewW &&
      worldY + margin > this.y &&
      worldY - margin < this.y + this.viewH
    );
  }
}
