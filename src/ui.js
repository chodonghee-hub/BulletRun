// src/ui.js — HUD 업데이트 (DOM 조작)

import { SCORE, SKILLS } from './constants.js';
const SLOW_MAX = SKILLS.SLOW_MODE.MAX_STACK;

export class UIManager {
  constructor() {
    this._scoreVal    = document.getElementById('hud-score-value');
    this._waveVal     = document.getElementById('hud-wave-value');
    this._levelVal    = document.getElementById('hud-level-value');
    this._expFill     = document.getElementById('hud-exp-bar-fill');
    this._progFill    = document.getElementById('hud-score-progress-fill');
    this._progText    = document.getElementById('hud-score-progress-text');

    // 스킬 슬로우
    this._skillSlowEl   = document.getElementById('skill-slow-status');
    this._skillSlowBar  = document.getElementById('skill-slow-bar');
    this._skillSlowSlot = document.getElementById('skill-slot-slow');

    // 스킬 스피드
    this._skillSpeedEl   = document.getElementById('skill-speed-status');
    this._skillSpeedBar  = document.getElementById('skill-speed-bar');
    this._skillSpeedSlot = document.getElementById('skill-slot-speed');

    // 스킬 대시
    this._skillDashEl = document.getElementById('skill-dash-status');

    this._levelupTimer = 0; // 하위 호환 유지용 (미사용)
  }

  update(_dt, score, wave, level, life, maxLife, expProgress, dashStacks, dashStacksMax, shield,
         slowActive, slowStack, speedActive, speedCooldown) {
    void life; void maxLife; void shield; // 캔버스에서 처리

    // 점수 / 웨이브 / 레벨
    this._scoreVal.textContent = score;
    this._waveVal.textContent  = wave;
    this._levelVal.textContent = level;

    // 점수 진행 바 (목표: 1000점)
    const pct = Math.min(100, (score / SCORE.CLEAR_TARGET) * 100).toFixed(1);
    this._progFill.style.width = `${pct}%`;
    this._progText.textContent = `${score} / ${SCORE.CLEAR_TARGET}`;

    // EXP 바
    this._expFill.style.width = `${(expProgress * 100).toFixed(1)}%`;

    // ── 대시 스택 상태 (스킬 슬롯)
    if (this._skillDashEl) {
      if (dashStacks >= dashStacksMax) {
        this._skillDashEl.textContent = `${dashStacksMax}/${dashStacksMax}`;
        this._skillDashEl.className   = 'skill-status ready';
      } else {
        this._skillDashEl.textContent = `${dashStacks}/${dashStacksMax}`;
        this._skillDashEl.className   = 'skill-status cooldown';
      }
    }

    // ── 스킬 슬로우 (W) — 스택 방식
    this._updateSlowSlot(slowActive, slowStack);

    // ── 스킬 스피드 (Q)
    this._updateSkillSlot(
      this._skillSpeedEl, this._skillSpeedBar, this._skillSpeedSlot,
      speedActive, speedCooldown, SKILLS.SPEED_BOOST.COOLDOWN
    );

    // 레벨업은 캔버스(player.js)에서 처리
  }

  _updateSlowSlot(active, stack) {
    const el   = this._skillSlowEl;
    const bar  = this._skillSlowBar;
    const slot = this._skillSlowSlot;
    if (!el) return;
    if (active) {
      el.textContent = `${stack.toFixed(1)}s`;
      el.className   = 'skill-status active';
      slot?.classList.add('skill-on');
    } else if (stack < SLOW_MAX) {
      el.textContent = `${stack.toFixed(1)}s`;
      el.className   = 'skill-status cooldown';
      slot?.classList.remove('skill-on');
    } else {
      el.textContent = 'READY';
      el.className   = 'skill-status ready';
      slot?.classList.remove('skill-on');
    }
    if (bar) bar.style.width = `${(stack / SLOW_MAX * 100).toFixed(1)}%`;
  }

  _updateSkillSlot(statusEl, barEl, slotEl, active, cooldown, maxCooldown) {
    if (!statusEl) return;

    if (active) {
      statusEl.textContent = 'ON';
      statusEl.className   = 'skill-status active';
      slotEl?.classList.add('skill-on');
      if (barEl) barEl.style.width = '0%';
    } else if (cooldown > 0) {
      statusEl.textContent = `${cooldown.toFixed(1)}s`;
      statusEl.className   = 'skill-status cooldown';
      slotEl?.classList.remove('skill-on');
      if (barEl) barEl.style.width = `${(cooldown / maxCooldown * 100).toFixed(1)}%`;
    } else {
      statusEl.textContent = 'READY';
      statusEl.className   = 'skill-status ready';
      slotEl?.classList.remove('skill-on');
      if (barEl) barEl.style.width = '0%';
    }
  }

  showLevelUp(level, bonus) {
    void level;
    const parts = [];
    if (bonus.speed)        parts.push(`이동 속도 +${bonus.speed}`);
    if (bonus.maxLife)      parts.push(`최대 라이프 +${bonus.maxLife}`);
    if (bonus.dashRecharge) parts.push(`대시 충전 속도 향상`);

    this._levelupMsg.textContent = parts.join('  /  ');
    this._levelupEl.classList.remove('hidden');
    this._levelupTimer = 1.0;
  }

  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden');
  }
}
