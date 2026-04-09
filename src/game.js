// src/game.js — 메인 게임 클래스 (게임 루프 / 시스템 통합)

import { Camera }          from './camera.js';
import { GameMap }         from './map.js';
import { Player }          from './player.js';
import { BulletManager }   from './bullet.js';
import { ItemManager }     from './item.js';
import { WaveManager }     from './wave.js';
import { LevelManager }    from './level.js';
import { ScoreManager }    from './score.js';
import { Minimap }         from './minimap.js';
import { UIManager }       from './ui.js';
import { InputManager }    from './input.js';
import { saveScore }       from './supabase-client.js';
import { SKILLS }          from './constants.js';

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

    // 레벨업 콜백 등록
    this.levels.onLevelUp((level, bonus) => {
      this.player.applyLevelBonus(bonus);
      this.ui.showLevelUp(level, bonus);
    });

    // ─ 상태
    this.state        = 'start';
    this._rafId       = null;
    this._lastTime    = 0;

    // 아이템으로 인한 슬로우
    this._itemSlowActive = false;
    this._itemSlowTimer  = 0;

    // 스킬: 슬로우 모드 (SPACE)
    this._skillSlowActive   = false;
    this._skillSlowTimer    = 0;
    this._skillSlowCooldown = 0;

    // 스킬: 스피드 부스트 (SHIFT)
    this._skillSpeedActive   = false;
    this._skillSpeedTimer    = 0;
    this._skillSpeedCooldown = 0;

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
    this._skillSlowTimer     = 0;
    this._skillSlowCooldown  = 0;
    this._skillSpeedActive   = false;
    this._skillSpeedTimer    = 0;
    this._skillSpeedCooldown = 0;
    this.player.speedMult    = 1.0;

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

    // 2. 스킬: 슬로우 모드 (SPACE)
    if (this.input.isSlowModePressed() && this._skillSlowCooldown <= 0 && !this._skillSlowActive) {
      this._skillSlowActive  = true;
      this._skillSlowTimer   = SKILLS.SLOW_MODE.DURATION;
    }
    if (this._skillSlowActive) {
      this._skillSlowTimer -= dt;
      if (this._skillSlowTimer <= 0) {
        this._skillSlowActive  = false;
        this._skillSlowCooldown = SKILLS.SLOW_MODE.COOLDOWN;
      }
    } else if (this._skillSlowCooldown > 0) {
      this._skillSlowCooldown -= dt;
    }

    // 3. 스킬: 스피드 부스트 (SHIFT)
    if (this.input.isSpeedBoostPressed() && this._skillSpeedCooldown <= 0 && !this._skillSpeedActive) {
      this._skillSpeedActive = true;
      this._skillSpeedTimer  = SKILLS.SPEED_BOOST.DURATION;
      this.player.speedMult  = SKILLS.SPEED_BOOST.SPEED_MULT;
    }
    if (this._skillSpeedActive) {
      this._skillSpeedTimer -= dt;
      if (this._skillSpeedTimer <= 0) {
        this._skillSpeedActive   = false;
        this._skillSpeedCooldown = SKILLS.SPEED_BOOST.COOLDOWN;
        this.player.speedMult    = 1.0;
      }
    } else if (this._skillSpeedCooldown > 0) {
      this._skillSpeedCooldown -= dt;
    }

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
      }
    }

    // 10. 탄막 충돌 판정 (히트박스 기준)
    if (!this.player.invincible && !this.player.isDashing) {
      const hbr = this.player.hitboxRadius;
      for (const b of this.bullets.bullets) {
        if (!b.alive) continue;
        const dx = this.player.x - b.x;
        const dy = this.player.y - b.y;
        if (dx * dx + dy * dy < (hbr + b.radius) * (hbr + b.radius)) {
          const damaged = this.player.takeDamage();
          if (damaged) this.scores.onHit();
          b.alive = false;
          break; // 프레임당 1회 피격
        }
      }
    }

    // 11. 점수 업데이트
    this.scores.update(dt);

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
      this.player.shield,
      // 스킬 상태
      this._skillSlowActive,
      Math.max(0, this._skillSlowCooldown),
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

    this.camera.restore(ctx);
  }

  // ─── 게임 종료 처리 ─────────────────────────────────────────
  async _gameOver() {
    this.state = 'gameover';
    document.getElementById('gameover-score').textContent = this.scores.score;
    document.getElementById('screen-gameover').classList.remove('hidden');
    await saveScore('PLAYER', this.scores.score, this.waves.wave, this.levels.level);
  }

  async _gameClear() {
    this.state = 'clear';
    document.getElementById('clear-score').textContent = this.scores.score;
    document.getElementById('screen-clear').classList.remove('hidden');
    await saveScore('PLAYER', this.scores.score, this.waves.wave, this.levels.level);
  }
}
