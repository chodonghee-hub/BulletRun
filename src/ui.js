// src/ui.js — HUD 업데이트 (DOM 조작)

import { PLAYER, SCORE } from './constants.js';

export class UIManager {
  constructor() {
    this._scoreVal    = document.getElementById('hud-score-value');
    this._waveVal     = document.getElementById('hud-wave-value');
    this._levelVal    = document.getElementById('hud-level-value');
    this._lifeCont    = document.getElementById('hud-life-container');
    this._expFill     = document.getElementById('hud-exp-bar-fill');
    this._dashCont    = document.getElementById('hud-dash-container');
    this._progFill    = document.getElementById('hud-score-progress-fill');
    this._progText    = document.getElementById('hud-score-progress-text');
    this._skillSlowEl  = document.getElementById('skill-slow-status');
    this._skillSpeedEl = document.getElementById('skill-speed-status');
    this._levelupEl   = document.getElementById('screen-levelup');
    this._levelupMsg  = document.getElementById('levelup-message');
    this._levelupTimer = 0;
  }

  update(dt, score, wave, level, life, maxLife, expProgress, dashStacks, shield,
         slowActive, slowCooldown, speedActive, speedCooldown) {
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

    // 라이프 아이콘 재빌드 (최대치 기준)
    this._lifeCont.innerHTML = '';
    for (let i = 0; i < maxLife; i++) {
      const s = document.createElement('span');
      s.className = 'life-icon' + (i < life ? '' : ' life-empty');
      this._lifeCont.appendChild(s);
    }
    // 쉴드 아이콘 추가
    for (let i = 0; i < shield; i++) {
      const s = document.createElement('span');
      s.className = 'life-icon shield-icon';
      this._lifeCont.appendChild(s);
    }

    // 대시 스택 아이콘
    this._dashCont.innerHTML = '';
    for (let i = 0; i < PLAYER.DASH_STACKS_MAX; i++) {
      const s = document.createElement('span');
      s.className = 'dash-icon' + (i < dashStacks ? '' : ' dash-empty');
      this._dashCont.appendChild(s);
    }

    // 스킬 상태 표시
    if (this._skillSlowEl) {
      if (slowActive) {
        this._skillSlowEl.textContent = `ON`;
        this._skillSlowEl.className = 'skill-status active';
      } else if (slowCooldown > 0) {
        this._skillSlowEl.textContent = `${slowCooldown.toFixed(1)}s`;
        this._skillSlowEl.className = 'skill-status cooldown';
      } else {
        this._skillSlowEl.textContent = `READY`;
        this._skillSlowEl.className = 'skill-status ready';
      }
    }
    if (this._skillSpeedEl) {
      if (speedActive) {
        this._skillSpeedEl.textContent = `ON`;
        this._skillSpeedEl.className = 'skill-status active';
      } else if (speedCooldown > 0) {
        this._skillSpeedEl.textContent = `${speedCooldown.toFixed(1)}s`;
        this._skillSpeedEl.className = 'skill-status cooldown';
      } else {
        this._skillSpeedEl.textContent = `READY`;
        this._skillSpeedEl.className = 'skill-status ready';
      }
    }

    // 레벨업 오버레이 자동 숨김
    if (this._levelupTimer > 0) {
      this._levelupTimer -= dt;
      if (this._levelupTimer <= 0) {
        this._levelupTimer = 0;
        this._levelupEl.classList.add('hidden');
      }
    }
  }

  showLevelUp(level, bonus) {
    void level; // 파라미터 유지 (외부 호출 시그니처 일치용)
    const parts = [];
    if (bonus.speed)        parts.push(`이동 속도 +${bonus.speed}`);
    if (bonus.maxLife)      parts.push(`최대 라이프 +${bonus.maxLife}`);
    if (bonus.dashRecharge) parts.push(`대시 충전 속도 향상`);

    this._levelupMsg.textContent = parts.join('  /  ');
    this._levelupEl.classList.remove('hidden');
    this._levelupTimer = 2.2;
  }

  // 특정 스크린만 표시 (나머지는 hidden)
  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden');
  }
}
