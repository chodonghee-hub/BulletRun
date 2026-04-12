// src/minimap.js — 좌측 상단 미니맵 렌더링

import { MAP_WIDTH, MAP_HEIGHT, ZONES, ZONE_STYLE, ITEM } from './constants.js';

const MM_W = 300;
const MM_H = Math.round(MM_W * (MAP_HEIGHT / MAP_WIDTH)); // 비율 유지 ≈ 128px
const SCALE_X = MM_W / MAP_WIDTH;
const SCALE_Y = MM_H / MAP_HEIGHT;

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.canvas.width  = MM_W;
    this.canvas.height = MM_H;
    this.ctx = this.canvas.getContext('2d');
  }

  render(player, items) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, MM_W, MM_H);

    // 배경
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, MM_W, MM_H);

    // 존 배경 + 경계
    for (const zone of ZONES) {
      const s = ZONE_STYLE[zone.type];
      ctx.fillStyle   = s.fill;
      ctx.fillRect(zone.x * SCALE_X, zone.y * SCALE_Y, zone.w * SCALE_X, zone.h * SCALE_Y);

      ctx.strokeStyle = s.borderColor + '80';
      ctx.lineWidth   = 0.5;
      ctx.strokeRect(zone.x * SCALE_X, zone.y * SCALE_Y, zone.w * SCALE_X, zone.h * SCALE_Y);
    }

    // 아이템 드롭 상태 (종류별 색상 점)
    for (const item of items) {
      if (!item.alive) continue;
      ctx.beginPath();
      ctx.arc(item.x * SCALE_X, item.y * SCALE_Y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = ITEM[item.type].color;
      ctx.fill();
    }

    // 플레이어 (흰 점 + 파란 테두리)
    const px = player.x * SCALE_X;
    const py = player.y * SCALE_Y;

    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.strokeStyle = '#64b5f6';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // 외곽 테두리
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(0, 0, MM_W, MM_H);
  }
}
