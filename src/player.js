// src/player.js — 플레이어 이동/대시/피격/렌더링

import { PLAYER, MAP_WIDTH, MAP_HEIGHT } from './constants.js';
import { clamp, normalize } from './utils.js';

export class Player {
  constructor() {
    this.reset();
  }

  reset() {
    // 시작 위치: 안전 구역(zone 0) 중앙 근처
    this.x = 480;
    this.y = 512;

    this.radius       = PLAYER.RADIUS;
    this.hitboxRadius = PLAYER.HITBOX_RADIUS;

    // ─ 스탯
    this.life         = PLAYER.START_LIFE;
    this.maxLife      = PLAYER.MAX_LIFE;
    this.speed        = PLAYER.BASE_SPEED;
    this.dashRecharge = PLAYER.DASH_RECHARGE;

    // ─ 대시
    this.dashStacks        = PLAYER.DASH_STACKS_MAX;
    this.dashRechargeTimer = 0;
    this.isDashing         = false;
    this.dashTimer         = 0;
    this.dashStartX = 0; this.dashStartY = 0;
    this.dashEndX   = 0; this.dashEndY   = 0;
    this._lastDir = { x: 0, y: -1 };

    // ─ 무적
    this.invincible      = false;
    this.invincibleTimer = 0;
    this._blinkTimer     = 0;
    this.blinkOn         = true;

    // ─ 쉴드
    this.shield = 0;

    // ─ 방향 (렌더용)
    this.faceDirX = 0;
    this.faceDirY = -1;

    // ─ 스킬 배율
    this.speedMult = 1.0;
  }

  // 레벨업 자동 스탯 적용
  applyLevelBonus(bonus) {
    if (bonus.speed)        this.speed        = Math.min(this.speed + bonus.speed, 500);
    if (bonus.maxLife)      this.maxLife      = Math.min(this.maxLife + bonus.maxLife, PLAYER.MAX_LIFE);
    if (bonus.dashRecharge) this.dashRecharge = Math.max(0.5, this.dashRecharge + bonus.dashRecharge);
  }

  // 피격 처리 — true: 실제 데미지, false: 무적/쉴드로 흡수
  takeDamage() {
    if (this.invincible || this.isDashing) return false;
    if (this.shield > 0) {
      this.shield--;
      this._startInvincible();
      return false;
    }
    this.life--;
    this._startInvincible();
    return true;
  }

  heal(amount = 1) {
    this.life = Math.min(this.maxLife, this.life + amount);
  }

  addShield() {
    this.shield = Math.min(3, this.shield + 1);
  }

  _startInvincible() {
    this.invincible      = true;
    this.invincibleTimer = PLAYER.INVINCIBLE_SECS;
    this._blinkTimer     = 0;
  }

  // 대시 시도 — false: 스택 없음
  tryDash(inputDx, inputDy) {
    if (this.isDashing || this.dashStacks <= 0) return false;

    let dirX = inputDx, dirY = inputDy;
    if (dirX === 0 && dirY === 0) {
      dirX = this._lastDir.x;
      dirY = this._lastDir.y;
    }
    const n = normalize(dirX, dirY);

    this.dashStacks--;
    this.isDashing  = true;
    this.dashTimer  = PLAYER.DASH_DURATION;
    this.dashStartX = this.x;
    this.dashStartY = this.y;
    this.dashEndX   = clamp(this.x + n.x * PLAYER.DASH_DISTANCE, this.radius, MAP_WIDTH  - this.radius);
    this.dashEndY   = clamp(this.y + n.y * PLAYER.DASH_DISTANCE, this.radius, MAP_HEIGHT - this.radius);
    this.faceDirX   = n.x;
    this.faceDirY   = n.y;
    return true;
  }

  // 대시 경로 세그먼트 반환 (탄막 충돌 판정에 사용)
  getDashSegment() {
    return { x1: this.dashStartX, y1: this.dashStartY, x2: this.dashEndX, y2: this.dashEndY };
  }

  update(dt, input) {
    // 무적 타이머
    if (this.invincible) {
      this.invincibleTimer -= dt;
      this._blinkTimer     += dt;
      if (this.invincibleTimer <= 0) {
        this.invincible  = false;
        this.invincibleTimer = 0;
      }
      this.blinkOn = Math.floor(this._blinkTimer * 8) % 2 === 0;
    } else {
      this.blinkOn = true;
    }

    // 대시 스택 충전 (스택이 최대가 아닐 때만)
    if (this.dashStacks < PLAYER.DASH_STACKS_MAX) {
      this.dashRechargeTimer += dt;
      if (this.dashRechargeTimer >= this.dashRecharge) {
        this.dashRechargeTimer -= this.dashRecharge;
        this.dashStacks++;
      }
    }

    // 대시 이동 (보간)
    if (this.isDashing) {
      this.dashTimer -= dt;
      const t = 1 - Math.max(0, this.dashTimer) / PLAYER.DASH_DURATION;
      this.x = this.dashStartX + (this.dashEndX - this.dashStartX) * t;
      this.y = this.dashStartY + (this.dashEndY - this.dashStartY) * t;
      if (this.dashTimer <= 0) {
        this.x        = this.dashEndX;
        this.y        = this.dashEndY;
        this.isDashing = false;
      }
      return;
    }

    // 일반 이동 (speedMult: 스킬 배율 반영)
    const { dx, dy } = input.getMovementDir();
    if (dx !== 0 || dy !== 0) {
      const n = normalize(dx, dy);
      const effective = this.speed * this.speedMult;
      this.x = clamp(this.x + n.x * effective * dt, this.radius, MAP_WIDTH  - this.radius);
      this.y = clamp(this.y + n.y * effective * dt, this.radius, MAP_HEIGHT - this.radius);
      this._lastDir = { x: n.x, y: n.y };
      this.faceDirX = n.x;
      this.faceDirY = n.y;
    }
  }

  render(ctx) {
    if (!this.blinkOn) return;

    const { x, y, radius } = this;
    ctx.save();

    // ── 쉴드 링
    if (this.shield > 0) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 9, 0, Math.PI * 2);
      ctx.strokeStyle = '#ce93d8';
      ctx.lineWidth   = 3;
      ctx.shadowColor = '#ce93d8';
      ctx.shadowBlur  = 12;
      ctx.stroke();
    }

    // ── 대시 잔상 트레일
    if (this.isDashing) {
      const grad = ctx.createLinearGradient(this.dashStartX, this.dashStartY, x, y);
      grad.addColorStop(0, 'rgba(41,182,246,0)');
      grad.addColorStop(1, 'rgba(41,182,246,0.6)');
      ctx.beginPath();
      ctx.moveTo(this.dashStartX, this.dashStartY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = grad;
      ctx.lineWidth   = radius * 2.2;
      ctx.lineCap     = 'round';
      ctx.shadowBlur  = 0;
      ctx.stroke();
    }

    // ── 고스트 바디 (물방울/정령 형태)
    // 외부 글로우
    ctx.shadowColor = this.isDashing ? '#ffffff' : '#29b6f6';
    ctx.shadowBlur  = this.isDashing ? 24 : 14;

    // 몸통 bezier 경로
    const cx = x, cy = y + radius * 0.08; // 중심 약간 아래
    const r  = radius;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.88, cy + r * 0.38);
    ctx.quadraticCurveTo(cx,         cy + r * 1.05, cx + r * 0.88, cy + r * 0.38);  // 하단 둥근곡선
    ctx.quadraticCurveTo(cx + r * 1.0, cy - r * 0.18, cx + r * 0.32, cy - r * 0.82); // 우측 → 상단
    ctx.quadraticCurveTo(cx,         cy - r * 1.28, cx - r * 0.32, cy - r * 0.82); // 상단 뾰족
    ctx.quadraticCurveTo(cx - r * 1.0, cy - r * 0.18, cx - r * 0.88, cy + r * 0.38); // 좌측 → 하단
    ctx.closePath();

    // 몸통 그라디언트
    const bodyGrad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.3, r * 0.05, cx, cy, r * 1.25);
    bodyGrad.addColorStop(0,   '#b3e5fc');
    bodyGrad.addColorStop(0.35,'#29b6f6');
    bodyGrad.addColorStop(0.75,'#0277bd');
    bodyGrad.addColorStop(1,   '#01579b');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // ── 눈 (2개의 빛나는 타원)
    ctx.shadowColor = '#e0f7fa';
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = '#e0f7fa';

    const eyeY  = cy - r * 0.16;
    const eyeW  = r * 0.24;
    const eyeH  = r * 0.30;
    const eyeDX = r * 0.27;

    // 왼쪽 눈
    ctx.beginPath();
    ctx.ellipse(cx - eyeDX, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
    ctx.fill();
    // 오른쪽 눈
    ctx.beginPath();
    ctx.ellipse(cx + eyeDX, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
    ctx.fill();

    // 동공
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = '#0d47a1';
    const pupilR = r * 0.11;
    ctx.beginPath();
    ctx.arc(cx - eyeDX + r * 0.03, eyeY + r * 0.05, pupilR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + eyeDX + r * 0.03, eyeY + r * 0.05, pupilR, 0, Math.PI * 2);
    ctx.fill();

    // 눈 하이라이트
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(cx - eyeDX - r * 0.06, eyeY - r * 0.09, r * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + eyeDX - r * 0.06, eyeY - r * 0.09, r * 0.06, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
