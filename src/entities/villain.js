// src/villain.js — 빌런 몬스터 시스템 (레벨 7 등장, 대시로 처치 가능)
// 캔버스로 클래식 카툰 고스트 직접 드로잉, 좌우 방향 전환

import { VILLAIN, MAP_WIDTH, MAP_HEIGHT } from '../core/constants.js';
import { clamp } from '../core/utils.js';

export class VillainManager {
  constructor() {
    this._faceRight = true;  // true: 오른쪽, false: 왼쪽 (좌우 반전)
    this.reset();
  }

  reset() {
    this.state            = 'inactive';
    this.x                = 0;
    this.y                = 0;
    this.hp               = VILLAIN.MAX_HP;
    this.cooldownTimer    = 0;
    this._triggered       = false;
    this._playerX         = 0;
    this._playerY         = 0;
    this._faceDirX        = 0;
    this._faceDirY        = 1;
    this._hitFlash        = 0;
    this._spawnFlash      = 0;
    this._msgText         = '';
    this._msgTimer        = 0;
    this._currentRadius   = VILLAIN.RADIUS;
    this._growthTimer     = 0;
  }

  get _currentHitboxRadius() {
    return this._currentRadius * (VILLAIN.HITBOX_RADIUS / VILLAIN.RADIUS);
  }

  onLevelReached(level) {
    if (level >= VILLAIN.LEVEL_TRIGGER && !this._triggered) {
      this._triggered = true;
      this._spawn(this._playerX, this._playerY);
    }
  }

  _spawn(playerX, playerY) {
    const angle = Math.random() * Math.PI * 2;
    const dist  = VILLAIN.SPAWN_MIN_DIST + Math.random() * (VILLAIN.SPAWN_MAX_DIST - VILLAIN.SPAWN_MIN_DIST);
    this.x  = clamp(playerX + Math.cos(angle) * dist, VILLAIN.RADIUS, MAP_WIDTH  - VILLAIN.RADIUS);
    this.y  = clamp(playerY + Math.sin(angle) * dist, VILLAIN.RADIUS, MAP_HEIGHT - VILLAIN.RADIUS);
    this.hp             = VILLAIN.MAX_HP;
    this.state          = 'alive';
    this._spawnFlash    = 1.0;
    this._currentRadius = VILLAIN.RADIUS;
    this._growthTimer   = 0;
    this._msgText       = '빌런이 나타났다!';
    this._msgTimer      = 2.5;
  }

  update(dt, wave, playerX, playerY) {
    this._playerX = playerX;
    this._playerY = playerY;

    if (this._msgTimer   > 0) this._msgTimer   -= dt;
    if (this._hitFlash   > 0) this._hitFlash   -= dt;
    if (this._spawnFlash > 0) this._spawnFlash -= dt;

    if (this.state === 'cooldown') {
      this.cooldownTimer -= dt;
      if (this.cooldownTimer <= 0) this._spawn(playerX, playerY);
      return;
    }
    if (this.state !== 'alive') return;

    // 크기 성장
    this._growthTimer += dt;
    if (this._growthTimer >= VILLAIN.GROWTH_INTERVAL) {
      this._growthTimer -= VILLAIN.GROWTH_INTERVAL;
      this._currentRadius = Math.min(this._currentRadius + VILLAIN.GROWTH_AMOUNT, VILLAIN.MAX_RADIUS);
    }

    // 플레이어 추적
    const speed = VILLAIN.BASE_SPEED + (wave - 1) * VILLAIN.SPEED_PER_WAVE;
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 1) {
      this._faceDirX = dx / len;
      this._faceDirY = dy / len;
      // 수평 이동이 뚜렷할 때만 방향 전환 (진동 방지)
      if (Math.abs(this._faceDirX) > 0.15) {
        this._faceRight = this._faceDirX > 0;
      }
      this.x = clamp(this.x + this._faceDirX * speed * dt, this._currentRadius, MAP_WIDTH  - this._currentRadius);
      this.y = clamp(this.y + this._faceDirY * speed * dt, this._currentRadius, MAP_HEIGHT - this._currentRadius);
    }
  }

  absorbItems(items, dt) {
    if (this.state !== 'alive') return;
    const pullR2  = VILLAIN.ABSORB_PULL_RADIUS * VILLAIN.ABSORB_PULL_RADIUS;
    const absorbR = this._currentHitboxRadius;
    for (const item of items) {
      if (!item.alive) continue;
      const dx = this.x - item.x, dy = this.y - item.y;
      const dist2 = dx * dx + dy * dy;
      if (dist2 >= pullR2 || dist2 < 0.01) continue;
      if (dist2 < absorbR * absorbR) { item.alive = false; continue; }
      const dist = Math.sqrt(dist2);
      const move = Math.min(VILLAIN.ABSORB_SPEED * dt, dist);
      item.x += (dx / dist) * move;
      item.y += (dy / dist) * move;
    }
  }

  checkDashHit(x1, y1, x2, y2, sweepR) {
    if (this.state !== 'alive') return null;
    const hitR   = this._currentHitboxRadius;
    const totalR = sweepR + hitR;
    const abx = x2 - x1, aby = y2 - y1;
    const acx = this.x - x1, acy = this.y - y1;
    const ab2 = abx * abx + aby * aby;
    let t = ab2 > 0 ? (acx * abx + acy * aby) / ab2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + abx * t, cy = y1 + aby * t;
    if ((this.x - cx) ** 2 + (this.y - cy) ** 2 > totalR * totalR) return null;
    this.hp--;
    this._hitFlash = 0.18;
    if (this.hp <= 0) {
      this.state         = 'cooldown';
      this.cooldownTimer = VILLAIN.RESPAWN_COOLDOWN;
      this._msgText      = `빌런 처치! +${VILLAIN.REWARD_SCORE}점`;
      this._msgTimer     = 2.5;
      return 'dead';
    }
    return 'hit';
  }

  checkPlayerContact(px, py, playerHitboxR) {
    if (this.state !== 'alive') return false;
    const hitR = this._currentHitboxRadius;
    const dx = px - this.x, dy = py - this.y;
    return (dx * dx + dy * dy) < (playerHitboxR + hitR) ** 2;
  }

  // ─── 빌런 캔버스 드로잉 ──────────────────────────────────────
  // 플레이어와 동일한 물방울/정령 형태, 보라색 계열
  // - 작은 뿔 2개 (본체 아래에 먼저 그림)
  // - 이동 방향에 따라 눈 이동 (플레이어와 동일 방식)
  _drawGhost(ctx, x, y, r, globalAlpha = 1) {
    ctx.save();
    ctx.globalAlpha = globalAlpha;

    const cx = x;
    const cy = y + r * 0.08;  // 중심 약간 아래 (플레이어와 동일)

    // ── 작은 뿔 (본체보다 먼저 그려 기저부가 몸통 아래에 깔림) ──
    ctx.shadowBlur = 0;
    ctx.lineJoin   = 'round';

    // 왼쪽 뿔
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.35, cy - r * 0.95);   // 기저 바깥쪽
    ctx.lineTo(cx - r * 0.52, cy - r * 1.42);   // 뾰족 끝
    ctx.lineTo(cx - r * 0.12, cy - r * 1.02);   // 기저 안쪽
    ctx.closePath();
    ctx.fillStyle   = '#4a148c';
    ctx.strokeStyle = 'rgba(20,0,50,0.7)';
    ctx.lineWidth   = Math.max(1, r * 0.025);
    ctx.fill();
    ctx.stroke();

    // 오른쪽 뿔
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.35, cy - r * 0.95);
    ctx.lineTo(cx + r * 0.52, cy - r * 1.42);
    ctx.lineTo(cx + r * 0.12, cy - r * 1.02);
    ctx.closePath();
    ctx.fillStyle   = '#4a148c';
    ctx.strokeStyle = 'rgba(20,0,50,0.7)';
    ctx.lineWidth   = Math.max(1, r * 0.025);
    ctx.fill();
    ctx.stroke();

    // ── 몸통 (플레이어와 완전히 동일한 물방울 형태) ──
    ctx.shadowColor = '#ab47bc';
    ctx.shadowBlur  = 14;

    ctx.beginPath();
    ctx.moveTo(cx - r * 0.88, cy + r * 0.38);
    ctx.quadraticCurveTo(cx,            cy + r * 1.05, cx + r * 0.88, cy + r * 0.38);  // 하단
    ctx.quadraticCurveTo(cx + r * 1.0,  cy - r * 0.18, cx + r * 0.32, cy - r * 0.82); // 우측
    ctx.quadraticCurveTo(cx,            cy - r * 1.28, cx - r * 0.32, cy - r * 0.82); // 상단
    ctx.quadraticCurveTo(cx - r * 1.0,  cy - r * 0.18, cx - r * 0.88, cy + r * 0.38); // 좌측
    ctx.closePath();

    // 보라색 그라디언트 (플레이어 파란색과 동일 구조)
    const bodyGrad = ctx.createRadialGradient(
      cx - r * 0.2, cy - r * 0.3, r * 0.05,
      cx,           cy,           r * 1.25
    );
    bodyGrad.addColorStop(0,    '#e1bee7');  // 밝은 보라
    bodyGrad.addColorStop(0.35, '#ab47bc');  // 중간 보라
    bodyGrad.addColorStop(0.75, '#7b1fa2');  // 어두운 보라
    bodyGrad.addColorStop(1,    '#4a148c');  // 딥 퍼플
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // ── 눈 (플레이어와 완전히 동일한 방식으로 방향 추적) ──
    const eyeShiftX = this._faceDirX * r * 0.10;
    const eyeShiftY = this._faceDirY * r * 0.10;

    ctx.shadowColor = '#f3e5f5';
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = '#f3e5f5';  // 연한 보라-화이트 (플레이어의 #e0f7fa 대응)

    const eyeBaseY = cy - r * 0.16;
    const eyeY  = eyeBaseY + eyeShiftY;
    const eyeW  = r * 0.24;
    const eyeH  = r * 0.30;
    const eyeDX = r * 0.27;

    // 왼쪽 눈 (흰자위)
    ctx.beginPath();
    ctx.ellipse(cx - eyeDX + eyeShiftX, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
    ctx.fill();
    // 오른쪽 눈 (흰자위)
    ctx.beginPath();
    ctx.ellipse(cx + eyeDX + eyeShiftX, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
    ctx.fill();

    // 동공 (시선 방향으로 추가 이동)
    const pupilShiftX = this._faceDirX * r * 0.07;
    const pupilShiftY = this._faceDirY * r * 0.07;
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = '#4a148c';  // 딥 퍼플 동공 (플레이어의 #0d47a1 대응)
    const pupilR = r * 0.11;
    ctx.beginPath();
    ctx.arc(cx - eyeDX + eyeShiftX + pupilShiftX, eyeY + pupilShiftY, pupilR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + eyeDX + eyeShiftX + pupilShiftX, eyeY + pupilShiftY, pupilR, 0, Math.PI * 2);
    ctx.fill();

    // 눈 하이라이트
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(cx - eyeDX + eyeShiftX - r * 0.06, eyeY - r * 0.09, r * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + eyeDX + eyeShiftX - r * 0.06, eyeY - r * 0.09, r * 0.06, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ─── 월드 렌더링 ──────────────────────────────────────────────
  renderWorld(ctx) {
    if (this.state === 'inactive') return;

    const t = performance.now() / 1000;
    const r = this._currentRadius;

    // cooldown: 반투명 + 재등장 카운트다운
    if (this.state === 'cooldown') {
      const alpha = 0.18 + Math.sin(t * 3) * 0.06;
      this._drawGhost(ctx, this.x, this.y, r * 0.70, alpha);
      ctx.save();
      ctx.globalAlpha  = alpha * 1.8;
      ctx.font         = `bold ${Math.max(12, r * 0.28)}px 'Courier New', monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle    = '#ef5350';
      ctx.shadowColor  = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur   = 6;
      ctx.fillText(`재등장 ${Math.ceil(this.cooldownTimer)}s`, this.x, this.y - r * 0.88);
      ctx.restore();
      return;
    }

    // 흡수 범위 (맥동 원)
    {
      const a = 0.048 + Math.sin(t * 2.5) * 0.022;
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, this.y, VILLAIN.ABSORB_PULL_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle   = `rgba(239,83,80,${a})`;
      ctx.strokeStyle = `rgba(239,83,80,${a * 3.2})`;
      ctx.lineWidth   = 1.5;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 등장 경고 플래시
    if (this._spawnFlash > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(239,83,80,${this._spawnFlash * 0.35})`;
      ctx.fill();
      ctx.restore();
    }

    // 위협 글로우 (맥동)
    {
      const a = 0.08 + Math.sin(t * 2.8) * 0.04;
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 1.5, 0, Math.PI * 2);
      ctx.fillStyle   = `rgba(239,83,80,${a})`;
      ctx.shadowColor = '#ef5350';
      ctx.shadowBlur  = 16;
      ctx.fill();
      ctx.restore();
    }

    // 피격 플래시 링
    if (this._hitFlash > 0) {
      const a = this._hitFlash / 0.18;
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, this.y, r + 8, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth   = 6;
      ctx.shadowColor = '#fff';
      ctx.shadowBlur  = 14;
      ctx.stroke();
      ctx.restore();
    }

    // 고스트 본체
    this._drawGhost(ctx, this.x, this.y, r);

    // HP 바
    {
      const barW  = r * 2.4;
      const barH  = Math.max(5, r * 0.11);
      const barX  = this.x - barW / 2;
      const barY  = this.y + r * 1.38;
      const ratio = this.hp / VILLAIN.MAX_HP;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.60)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
      ctx.fillStyle = ratio > 0.5 ? '#69f0ae' : ratio > 0.25 ? '#ffeb3b' : '#ef5350';
      ctx.fillRect(barX, barY, barW * ratio, barH);
      ctx.restore();
    }

    // 등장 직후 힌트
    if (this._spawnFlash > 0) {
      ctx.save();
      ctx.globalAlpha  = Math.min(1, this._spawnFlash * 2);
      ctx.font         = `${Math.max(11, r * 0.25)}px 'Courier New', monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle    = '#fff';
      ctx.shadowColor  = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur   = 6;
      ctx.fillText('대시(E)로 처치!', this.x, this.y - r * 1.22);
      ctx.restore();
    }
  }

  // ─── HUD 렌더링 ───────────────────────────────────────────────
  renderHUD(ctx, canvasW, canvasH, player, camera) {
    if (this._msgTimer > 0) {
      const elapsed = 2.5 - this._msgTimer;
      let alpha;
      if (elapsed < 0.3)       alpha = elapsed / 0.3;
      else if (elapsed < 1.8)  alpha = 1.0;
      else                     alpha = 1.0 - (elapsed - 1.8) / 0.7;

      ctx.save();
      ctx.globalAlpha  = Math.max(0, alpha);
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.font         = `bold 24px 'Courier New', monospace`;
      ctx.fillStyle    = this._msgText.includes('나타났다') ? '#ef5350' : '#69f0ae';
      ctx.shadowColor  = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur   = 10;
      ctx.fillText(this._msgText, canvasW / 2, canvasH / 2 + 110);
      ctx.restore();
    }

    if (this.state !== 'alive') return;

    // 화면 밖 방향 표시기
    const sx     = this.x - camera.x;
    const sy     = this.y - camera.y;
    const margin = 34;
    if (sx >= margin && sx <= canvasW - margin && sy >= margin && sy <= canvasH - margin) return;

    const cx   = canvasW / 2, cy = canvasH / 2;
    const dirX = sx - cx, dirY = sy - cy;
    const len  = Math.sqrt(dirX * dirX + dirY * dirY);
    if (len === 0) return;

    const nx    = dirX / len, ny = dirY / len;
    const halfW = canvasW / 2 - margin, halfH = canvasH / 2 - margin;
    const tMin  = Math.min(halfW / Math.abs(nx), halfH / Math.abs(ny));
    const arrowX = Math.round(cx + nx * tMin);
    const arrowY = Math.round(cy + ny * tMin);
    const dist   = Math.round(Math.sqrt((this.x - player.x) ** 2 + (this.y - player.y) ** 2));

    ctx.save();
    ctx.translate(arrowX, arrowY);
    ctx.rotate(Math.atan2(ny, nx));
    ctx.beginPath();
    ctx.moveTo(14, 0); ctx.lineTo(-9, -8); ctx.lineTo(-9, 8);
    ctx.closePath();
    ctx.fillStyle   = '#ef5350';
    ctx.shadowColor = '#ef5350';
    ctx.shadowBlur  = 10;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.font         = `bold 11px 'Courier New', monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#ef5350';
    ctx.shadowColor  = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur   = 5;
    ctx.fillText(`${dist}px`, arrowX + nx * 24, arrowY + ny * 24);
    ctx.restore();
  }
}
