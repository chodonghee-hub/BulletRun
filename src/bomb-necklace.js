// src/bomb-necklace.js — 폭탄 목걸이 시스템 (레벨 10 이후 반복)

import { BOMB_NECKLACE, MAP_WIDTH, MAP_HEIGHT } from './constants.js';

export class BombNecklaceManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.state         = 'inactive'; // 'inactive' | 'active' | 'cooldown'
    this.timer         = 0;
    this.cooldownTimer = 0;
    this.keys          = [];         // [{ x, y, collected }]
    this.keysTotal     = 0;
    this.keysCollected = 0;
    this._msgText      = '';
    this._msgTimer     = 0;
    this._triggered    = false;      // 최초 발동 여부 (레벨10)
  }

  onLevelReached(level) {
    if (level >= 7 && !this._triggered) {
      this._triggered = true;
      this._start();
    }
  }

  _start() {
    const count = BOMB_NECKLACE.KEY_MIN +
      Math.floor(Math.random() * (BOMB_NECKLACE.KEY_MAX - BOMB_NECKLACE.KEY_MIN + 1));
    this.keys = [];
    for (let i = 0; i < count; i++) {
      this.keys.push({
        x: 150 + Math.random() * (MAP_WIDTH  - 300),
        y: 150 + Math.random() * (MAP_HEIGHT - 300),
        collected: false,
      });
    }
    this.keysTotal     = count;
    this.keysCollected = 0;
    this.timer         = BOMB_NECKLACE.DURATION;
    this.state         = 'active';
  }

  // dt: delta time in seconds
  // returns: null | 'explode'
  update(dt) {
    if (this._msgTimer > 0) this._msgTimer -= dt;

    if (this.state === 'active') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 0;
        return 'explode';
      }
    } else if (this.state === 'cooldown') {
      this.cooldownTimer -= dt;
      if (this.cooldownTimer <= 0) this._start();
    }
    return null;
  }

  // returns: null | 'key' | 'cleared'
  checkKeyPickup(px, py, radius) {
    if (this.state !== 'active') return null;
    for (const key of this.keys) {
      if (key.collected) continue;
      const dx = px - key.x, dy = py - key.y;
      if (dx * dx + dy * dy < (radius + 24) * (radius + 24)) {
        key.collected = true;
        this.keysCollected++;
        if (this.keysCollected >= this.keysTotal) {
          this.state         = 'cooldown';
          this.cooldownTimer = BOMB_NECKLACE.COOLDOWN;
          this._msgText      = '폭탄 목걸이가 해제되었습니다!';
          this._msgTimer     = 2.0;
          return 'cleared';
        }
        return 'key';
      }
    }
    return null;
  }

  // "SS:cs" 형식 타이머 문자열
  getTimerText() {
    const secs = Math.max(0, this.timer);
    const s  = Math.floor(secs);
    const cs = Math.floor((secs - s) * 100);
    return `${String(s).padStart(2, '0')}:${String(cs).padStart(2, '0')}`;
  }

  // 월드 공간 렌더 (camera.apply 이후)
  renderWorld(ctx) {
    if (this.state !== 'active') return;
    for (const key of this.keys) {
      if (key.collected) continue;
      const t = performance.now() / 1000;
      const bob = Math.sin(t * 2.5 + key.x * 0.01) * 5;

      ctx.save();
      // 발광 링
      ctx.beginPath();
      ctx.arc(key.x, key.y + bob, 18, 0, Math.PI * 2);
      ctx.fillStyle   = 'rgba(255,235,59,0.15)';
      ctx.strokeStyle = 'rgba(255,235,59,0.5)';
      ctx.lineWidth   = 2;
      ctx.shadowColor = '#ffeb3b';
      ctx.shadowBlur  = 14;
      ctx.fill();
      ctx.stroke();

      // 🔑 이모지
      ctx.font         = '24px sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur   = 0;
      ctx.fillText('🔑', key.x, key.y + bob);
      ctx.restore();
    }
  }

  // 스크린 공간 렌더 (camera.restore 이후)
  renderHUD(ctx, canvasW, canvasH, player, camera) {
    // 완료 메세지
    if (this._msgTimer > 0) {
      const alpha = Math.min(1, this._msgTimer);
      ctx.save();
      ctx.globalAlpha  = alpha;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.font         = 'bold 28px "Courier New", monospace';
      ctx.fillStyle    = '#69f0ae';
      ctx.shadowColor  = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur   = 12;
      ctx.fillText('폭탄 목걸이가 해제되었습니다! 💚', canvasW / 2, canvasH / 2 + 80);
      ctx.restore();
    }

    if (this.state !== 'active') return;

    const progress = Math.max(0, this.timer / BOMB_NECKLACE.DURATION);
    const danger   = progress < 0.3;

    // 상단 타이머 + 열쇠 카운트
    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.font         = `bold 22px "Courier New", monospace`;
    ctx.fillStyle    = danger ? '#ef5350' : '#ffeb3b';
    ctx.shadowColor  = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur   = 8;
    ctx.fillText(
      `💣  ${this.getTimerText()}    🔑 ${this.keysCollected} / ${this.keysTotal}`,
      canvasW / 2, 22
    );
    ctx.restore();

    // 플레이어 주변 빨간 카운트다운 링 (스크린 좌표)
    const sx    = Math.round(player.x - camera.x);
    const sy    = Math.round(player.y - camera.y);
    const ringR = player.radius + 24;
    const endA  = -Math.PI / 2 + Math.PI * 2 * progress;

    ctx.save();
    // 빈 배경 링
    ctx.beginPath();
    ctx.arc(sx, sy, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(239,83,80,0.2)';
    ctx.lineWidth   = 3;
    ctx.stroke();
    // 진행 호
    ctx.beginPath();
    ctx.arc(sx, sy, ringR, -Math.PI / 2, endA);
    ctx.strokeStyle = danger
      ? `rgba(239,83,80,${0.7 + Math.sin(performance.now() / 200) * 0.3})`
      : 'rgba(239,83,80,0.75)';
    ctx.lineWidth   = 3;
    ctx.shadowColor = '#ef5350';
    ctx.shadowBlur  = danger ? 14 : 6;
    ctx.lineCap     = 'round';
    ctx.stroke();
    ctx.restore();
  }
}
