// src/map.js — 맵 렌더링 및 구역(Zone) 관리

import { MAP_WIDTH, MAP_HEIGHT, ZONES, ZONE_STYLE } from '../core/constants.js';

export class GameMap {
  constructor() {
    this.width  = MAP_WIDTH;
    this.height = MAP_HEIGHT;
    this.zones  = ZONES;
  }

  // 월드 좌표 (wx, wy) 가 속한 존 반환
  getZoneAt(wx, wy) {
    for (const zone of this.zones) {
      if (wx >= zone.x && wx < zone.x + zone.w &&
          wy >= zone.y && wy < zone.y + zone.h) {
        return zone;
      }
    }
    return null;
  }

  render(ctx) {
    // 배경
    ctx.fillStyle = '#12122a';
    ctx.fillRect(0, 0, this.width, this.height);

    // 존 배경 + 라벨
    for (const zone of this.zones) {
      const style = ZONE_STYLE[zone.type];

      ctx.fillStyle = style.fill;
      ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle   = style.borderColor;
      ctx.font        = 'bold 52px monospace';
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(zone.label, zone.x + zone.w / 2, zone.y + zone.h / 2);
      ctx.restore();
    }

    // 미세 그리드
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth   = 1;
    const GRID = 64;
    for (let gx = 0; gx <= this.width; gx += GRID) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, this.height); ctx.stroke();
    }
    for (let gy = 0; gy <= this.height; gy += GRID) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(this.width, gy); ctx.stroke();
    }
  }
}
