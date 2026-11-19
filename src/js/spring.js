// Damped spring solver (semi-implicit Euler, fixed 1/120 s sub-steps).
export function springStep(s, target, k = 170, c = 24, dt = 1 / 120) {
  s.v += (-k * (s.x - target) - c * s.v) * dt;
  s.x += s.v * dt;
}
export const settled = (s, target, eps = 0.02) => Math.abs(s.x - target) < eps && Math.abs(s.v) < eps;
