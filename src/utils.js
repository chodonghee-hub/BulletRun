// src/utils.js — 공통 수학/충돌 헬퍼

export function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
}

export function randomItem(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function dist(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distSq(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  return dx * dx + dy * dy;
}

export function normalize(dx, dy) {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}

// Circle-circle overlap test
export function circleCircle(x1, y1, r1, x2, y2, r2) {
  return distSq(x1, y1, x2, y2) < (r1 + r2) * (r1 + r2);
}

// Closest point on segment (x1,y1)→(x2,y2) to point (px,py), within r
export function pointNearSegment(px, py, x1, y1, x2, y2, r) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distSq(px, py, x1, y1) < r * r;
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = clamp(t, 0, 1);
  return distSq(px, py, x1 + t * dx, y1 + t * dy) < r * r;
}
