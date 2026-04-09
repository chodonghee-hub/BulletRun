// src/game.js — 메인 게임 클래스 (게임 루프 / 시스템 통합)

import { Camera }               from './camera.js';
import { GameMap }              from './map.js';
import { Player }               from './player.js';
import { BulletManager }        from './bullet.js';
import { ItemManager }          from './item.js';
import { WaveManager }          from './wave.js';
import { LevelManager }         from './level.js';
import { ScoreManager }         from './score.js';
import { Minimap }              from './minimap.js';
import { UIManager }            from './ui.js';
import { InputManager }         from './input.js';
import { saveScore }            from './supabase-client.js';
import { BombNecklaceManager }  from './bomb-necklace.js';
import { SKILLS, FEVER }        from './constants.js';

export class Game {
  constructor(canvas, minimapCanvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');

    this._resize();
    window.addEventListener('resize', () => this._resize());

    // ─ 시스템 초기화
    this.camera  = new Camera(canvas.width, canvas.height);
    this.map     = new GameMap();
    this.player  = new Player();
    this.bullets = new BulletManager();
    this.items   = new ItemManager();
    this.waves   = new WaveManager();
    this.levels  = new LevelManager();
    this.scores  = new ScoreManager();
    this.minimap = new Minimap(minimapCanvas);
    this.ui      = new UIManager();
    this.input   = new InputManager();
    this.bomb    = new BombNecklaceManager();

    // 레벨업 콜백 등록
    this.levels.onLevelUp((level, bonus) => {
      this.player.applyLevelBonus(bonus);
      this.player.showLevelUp(bonus);
      this.bomb.onLevelReached(level);
    });

    // ─ 상태
    this.state        = 'start';
    this._rafId       = null;
    this._lastTime    = 0;

    // 아이템으로 인한 슬로우
    this._itemSlowActive = false;
    this._itemSlowTimer  = 0;

    // 스킬: 슬로우 모드 (W hold) — 스택 기반
    this._skillSlowActive = false;
    this._skillSlowStack  = SKILLS.SLOW_MODE.MAX_STACK;

    // 스킬: 스피드 부스트 (Q hold)
    this._skillSpeedActive   = false;
    this._skillSpeedCooldown = 0;

    // 피버타임
    this._starCount   = 0;
    this._feverActive = false;
    this._feverTimer  = 0;

    this._loop = this._loop.bind(this);
    this._setupButtons();
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.camera) {
      this.camera.viewW = this.canvas.width;
      this.camera.viewH = this.canvas.height;
    }
  }

  _setupButtons() {
    document.getElementById('btn-start').addEventListener('click',         () => this.start());
    document.getElementById('btn-restart').addEventListener('click',       () => this.start());
    document.getElementById('btn-clear-restart').addEventListener('click', () => this.start());

    // 점수 저장 버튼 (게임오버)
    document.getElementById('btn-save-gameover').addEventListener('click', async () => {
      const name = document.getElementById('gameover-name').value.trim() || 'PLAYER';
      const btn  = document.getElementById('btn-save-gameover');
      btn.disabled    = true;
      btn.textContent = '저장 완료 ✓';
      await saveScore(name, this.scores.score, this.waves.wave, this.levels.level);
    });

    // 점수 저장 버튼 (게임 클리어)
    document.getElementById('btn-save-clear').addEventListener('click', async () => {
      const name = document.getElementById('clear-name').value.trim() || 'PLAYER';
      const btn  = document.getElementById('btn-save-clear');
      btn.disabled    = true;
      btn.textContent = '저장 완료 ✓';
      await saveScore(name, this.scores.score, this.waves.wave, this.levels.level);
    });
  }

  start() {
    // 모든 시스템 리셋
    this.player.reset();
    this.bullets.reset();
    this.items.reset();
    this.waves.reset();
    this.levels.reset();
    this.scores.reset();
    this._itemSlowActive     = false;
    this._itemSlowTimer      = 0;
    this._skillSlowActive    = false;
    this._skillSlowStack     = SKILLS.SLOW_MODE.MAX_STACK;
    this._skillSpeedActive   = false;
    this._skillSpeedCooldown = 0;
    this.player.speedMult    = 1.0;
    this._nextDashMilestoneIdx = 0;
    this._starCount          = 0;
    this._feverActive        = false;
    this._feverTimer         = 0;
    this.bomb.reset();

    // UI 초기화 — 모든 스크린 숨김, HUD 표시
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('hud-overlay').style.display = '';

    this.state     = 'playing';
    this._lastTime = performance.now();

    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = requestAnimationFrame(this._loop);
  }

  // ─── 게임 루프 ───────────────────────────────────────────────
  _loop(ts) {
    const dt = Math.min((ts - this._lastTime) / 1000, 0.05); // 최대 50ms 캡
    this._lastTime = ts;

    if (this.state === 'playing') {
      this._update(dt);
      this._render();
    }

    // just-pressed 플래그 초기화 (매 프레임 끝)
    this.input.flushJustPressed();
    this._rafId = requestAnimationFrame(this._loop);
  }

  // ─── Update ─────────────────────────────────────────────────
  _update(dt) {
    // 1. 대시 (E 키, input에서 원샷 처리)
    if (this.input.isDashPressed()) {
      const { dx, dy } = this.input.getMovementDir();
      const dashed = this.player.tryDash(dx, dy);
      if (dashed) {
        const seg = this.player.getDashSegment();
        this.bullets.handleDash(seg.x1, seg.y1, seg.x2, seg.y2, this.player.radius + 6);
      }
    }

    // 2. 스킬: 슬로우 모드 (W hold) — 스택 소모/충전 방식
    const wHeld = this.input.isSlowModeHeld() && !this._skillSpeedActive;
    if (wHeld && this._skillSlowStack > 0) {
      this._skillSlowActive = true;
      this._skillSlowStack  = Math.max(0, this._skillSlowStack - dt);
      if (this._skillSlowStack <= 0) this._skillSlowActive = false;
    } else {
      this._skillSlowActive = false;
      if (this._skillSlowStack < SKILLS.SLOW_MODE.MAX_STACK) {
        this._skillSlowStack = Math.min(
          SKILLS.SLOW_MODE.MAX_STACK,
          this._skillSlowStack + SKILLS.SLOW_MODE.REGEN_RATE * dt
        );
      }
    }

    // 3. 스킬: 스피드 부스트 (Q hold) — 슬로우 스킬 활성 중이면 사용 불가 (아이템 슬로우는 허용)
    const qHeld = this.input.isSpeedBoostHeld() && !this._skillSlowActive;
    if (this._skillSpeedCooldown > 0) {
      this._skillSpeedCooldown -= dt;
      if (this._skillSpeedCooldown < 0) this._skillSpeedCooldown = 0;
      this._skillSpeedActive = false;
      this.player.speedMult  = 1.0;
    } else if (qHeld) {
      this._skillSpeedActive = true;
      this.player.speedMult  = SKILLS.SPEED_BOOST.SPEED_MULT;
    } else {
      if (this._skillSpeedActive) {
        this._skillSpeedCooldown = SKILLS.SPEED_BOOST.COOLDOWN;
      }
      this._skillSpeedActive = false;
      this.player.speedMult  = 1.0;
    }
    this.player.speedBoostActive = this._skillSpeedActive;

    // 4. 플레이어 이동
    this.player.update(dt, this.input);

    // 5. 웨이브 진행
    this.waves.update(dt);

    // 6. 아이템 슬로우 타이머
    if (this._itemSlowActive) {
      this._itemSlowTimer -= dt;
      if (this._itemSlowTimer <= 0) this._itemSlowActive = false;
    }

    // 슬로우 효과: 아이템 OR 스킬
    const slowActive = this._itemSlowActive || this._skillSlowActive;

    // 7. 탄막 업데이트
    this.bullets.update(dt, this.waves.wave, this.player.x, this.player.y, slowActive);

    // 8. 아이템 업데이트
    this.items.update(dt);

    // 9. 아이템 획득 판정
    const picked = this.items.checkPickup(this.player.x, this.player.y, this.player.radius + 5);
    if (picked.length > 0) {
      const zone = this.map.getZoneAt(this.player.x, this.player.y);
      const mult = zone?.rewardMult ?? 1.0;

      for (const item of picked) {
        this.scores.addItemScore(item.config.score, mult);
        this.levels.addExp(item.config.exp);

        if (item.type === 'health') this.player.heal(1);
        if (item.type === 'shield') this.player.addShield();
        if (item.type === 'slow') {
          this._itemSlowActive = true;
          this._itemSlowTimer  = item.config.slowDuration;
        }
        if (item.type === 'exp') {
          this._starCount++;
          if (this._starCount % FEVER.STAR_COUNT === 0) {
            this._feverActive = true;
            this._feverTimer  = FEVER.DURATION;
            this.player.setFever(true);
          }
        }
      }
    }

    // 9-1. 피버타임 업데이트
    if (this._feverActive) {
      this._feverTimer -= dt;
      this.player.speedMult = 2.5;  // 피버 중 이동속도 2.5×
      this.items.magnetToward(this.player.x, this.player.y, FEVER.MAGNET_RADIUS, FEVER.MAGNET_SPEED, dt);
      if (this._feverTimer <= 0) {
        this._feverActive = false;
        this._feverTimer  = 0;
        this.player.setFever(false);
        // speedMult는 다음 프레임 step 3에서 자동 복원
      }
    }

    // 9-2. 폭탄 목걸이 업데이트
    const bombResult = this.bomb.update(dt);
    if (bombResult === 'explode') { this._bombExplode(); return; }
    this.bomb.checkKeyPickup(this.player.x, this.player.y, this.player.radius);

    // 10. 탄막 충돌 판정 (히트박스 기준)
    // 피버 중: 접촉 탄막 파괴 (데미지 없음, break 없이 전부 처리)
    // 일반: 프레임당 1회 피격
    {
      const hbr = this.player.hitboxRadius;
      for (const b of this.bullets.bullets) {
        if (!b.alive) continue;
        const dx = this.player.x - b.x;
        const dy = this.player.y - b.y;
        if (dx * dx + dy * dy < (hbr + b.radius) * (hbr + b.radius)) {
          if (this.player.feverActive) {
            b.alive = false;
          } else if (!this.player.invincible && !this.player.isDashing) {
            const damaged = this.player.takeDamage();
            if (damaged) this.scores.onHit();
            b.alive = false;
            break;
          }
        }
      }
    }

    // 11. 점수 업데이트
    this.scores.update(dt);

    // 11-1. 대시 스택 마일스톤 (2000, 4000, 6000, 8000, 10000)
    const DASH_MILESTONES = [2000, 4000, 6000, 8000, 10000];
    while (
      this._nextDashMilestoneIdx < DASH_MILESTONES.length &&
      this.scores.score >= DASH_MILESTONES[this._nextDashMilestoneIdx]
    ) {
      this.player.dashStacksMax++;
      this.player.dashStacks = Math.min(this.player.dashStacks + 1, this.player.dashStacksMax);
      this._nextDashMilestoneIdx++;
    }

    // 12. 카메라 추적
    this.camera.follow(this.player.x, this.player.y);

    // 13. HUD 업데이트
    this.ui.update(
      dt,
      this.scores.score,
      this.waves.wave,
      this.levels.level,
      this.player.life,
      this.player.maxLife,
      this.levels.getExpProgress(),
      this.player.dashStacks,
      this.player.dashStacksMax,
      this.player.shield,
      // 스킬 상태
      this._skillSlowActive,
      this._skillSlowStack,
      this._skillSpeedActive,
      Math.max(0, this._skillSpeedCooldown)
    );

    // 14. 미니맵 렌더링
    this.minimap.render(this.player, this.items.items);

    // 15. 종료 조건 체크
    if (this.player.life <= 0) { this._gameOver(); return; }
    if (this.scores.isCleared()) { this._gameClear(); return; }
  }

  // ─── Render ─────────────────────────────────────────────────
  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 월드 공간 렌더링
    this.camera.apply(ctx);

    this.map.render(ctx);
    this.items.render(ctx, this.camera);
    this.bullets.render(ctx, this.camera);
    this.player.render(ctx);

    // 슬로우 필드 이펙트
    if (this._itemSlowActive || this._skillSlowActive) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.player.x, this.player.y, 130, 0, Math.PI * 2);
      ctx.fillStyle   = 'rgba(41,182,246,0.07)';
      ctx.strokeStyle = 'rgba(41,182,246,0.3)';
      ctx.lineWidth   = 1.5;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 슬로우 잔량 링 (플레이어 외곽, 월드 공간)
    {
      const slowStack = this._skillSlowStack;
      const SLOW_MAX  = SKILLS.SLOW_MODE.MAX_STACK;
      if (this._skillSlowActive || slowStack < SLOW_MAX) {
        const sr       = this.player.radius + 22;
        const progress = slowStack / SLOW_MAX;
        const endAngle = -Math.PI / 2 + Math.PI * 2 * progress;
        ctx.save();
        // 배경 전체 링
        ctx.beginPath();
        ctx.arc(this.player.x, this.player.y, sr, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(41,182,246,0.15)';
        ctx.lineWidth   = 2.5;
        ctx.stroke();
        // 잔량 호
        ctx.beginPath();
        ctx.arc(this.player.x, this.player.y, sr, -Math.PI / 2, endAngle);
        ctx.strokeStyle = this._skillSlowActive
          ? 'rgba(41,182,246,0.90)'
          : `rgba(41,182,246,${0.3 + progress * 0.5})`;
        ctx.lineWidth   = 2.5;
        ctx.shadowColor = '#29b6f6';
        ctx.shadowBlur  = this._skillSlowActive ? 10 : 4;
        ctx.lineCap     = 'round';
        ctx.stroke();
        ctx.restore();
      }
    }

    // 폭탄 목걸이 열쇠 (월드 공간)
    this.bomb.renderWorld(ctx);

    this.camera.restore(ctx);

    // ── 스크린 공간 오버레이 ──────────────────────────────
    // 피버타임 맵 테두리 효과
    if (this._feverActive) {
      const W = this.canvas.width, H = this.canvas.height;
      const progress  = this._feverTimer / FEVER.DURATION;
      const perimeter = 2 * (W + H);
      const dashLen   = perimeter * progress;
      ctx.save();
      ctx.strokeStyle = `rgba(255,50,50,0.85)`;
      ctx.lineWidth   = 8;
      ctx.shadowColor = '#ff3232';
      ctx.shadowBlur  = 20;
      ctx.setLineDash([dashLen, perimeter]);
      ctx.strokeRect(4, 4, W - 8, H - 8);
      ctx.setLineDash([]);
      ctx.restore();
    }

    // 폭탄 목걸이 HUD (스크린 공간)
    this.bomb.renderHUD(ctx, this.canvas.width, this.canvas.height, this.player, this.camera);
  }

  // ─── 게임 종료 처리 ─────────────────────────────────────────
  _gameOver() {
    this.state = 'gameover';
    document.getElementById('gameover-score').textContent = this.scores.score;
    // 저장 버튼 초기화
    const btn = document.getElementById('btn-save-gameover');
    btn.disabled    = false;
    btn.textContent = '저장하기';
    document.getElementById('gameover-name').value = '';
    document.getElementById('screen-gameover').classList.remove('hidden');
  }

  _bombExplode() {
    this.state = 'gameover';
    document.getElementById('gameover-score').textContent = this.scores.score;
    const btn = document.getElementById('btn-save-gameover');
    btn.disabled    = false;
    btn.textContent = '저장하기';
    document.getElementById('gameover-name').value = '';
    document.getElementById('screen-gameover').classList.remove('hidden');
  }

  _gameClear() {
    this.state = 'clear';
    document.getElementById('clear-score').textContent = this.scores.score;
    // 저장 버튼 초기화
    const btn = document.getElementById('btn-save-clear');
    btn.disabled    = false;
    btn.textContent = '저장하기';
    document.getElementById('clear-name').value = '';
    document.getElementById('screen-clear').classList.remove('hidden');
  }
}
