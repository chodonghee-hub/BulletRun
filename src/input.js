// src/input.js — 키보드 입력 관리 (held + just-pressed 구분)

export class InputManager {
  constructor() {
    this._keys        = {};
    this._justPressed = {};
    this._onDown = this._onDown.bind(this);
    this._onUp   = this._onUp.bind(this);
    window.addEventListener('keydown', this._onDown);
    window.addEventListener('keyup',   this._onUp);
  }

  _onDown(e) {
    // 처음 눌리는 순간만 justPressed 등록
    if (!this._keys[e.code]) {
      this._justPressed[e.code] = true;
    }
    this._keys[e.code] = true;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  }

  _onUp(e) {
    this._keys[e.code] = false;
  }

  // 매 프레임 끝에 호출 — justPressed 초기화
  flushJustPressed() {
    this._justPressed = {};
  }

  isDown(code)        { return !!this._keys[code]; }
  wasJustPressed(code){ return !!this._justPressed[code]; }

  // 이동 방향 (방향키만)
  getMovementDir() {
    let dx = 0, dy = 0;
    if (this.isDown('ArrowUp'))    dy -= 1;
    if (this.isDown('ArrowDown'))  dy += 1;
    if (this.isDown('ArrowLeft'))  dx -= 1;
    if (this.isDown('ArrowRight')) dx += 1;
    return { dx, dy };
  }

  // 대시: E 키 (원샷)
  isDashPressed() { return this.wasJustPressed('KeyE'); }

  // 슬로우 모드: W (hold)
  isSlowModeHeld() { return this.isDown('KeyW'); }

  // 가속 모드: Q (hold)
  isSpeedBoostHeld() { return this.isDown('KeyQ'); }

  destroy() {
    window.removeEventListener('keydown', this._onDown);
    window.removeEventListener('keyup',   this._onUp);
  }
}
