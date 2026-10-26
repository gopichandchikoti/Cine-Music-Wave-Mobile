import assert from 'node:assert/strict';
import test from 'node:test';
import { physicsOf, SPRINGS, type SpringName } from '../src/design/springPhysics';

const NAMES = Object.keys(SPRINGS) as SpringName[];

/** Position of a unit step response of a damped spring at time `t`, by the closed form for under- and critically-damped springs. */
function position(name: SpringName, t: number): number {
  const { stiffness, damping, mass } = physicsOf(SPRINGS[name]);
  const omega = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta >= 1) return 1 - (1 + omega * t) * Math.exp(-omega * t);
  const damped = omega * Math.sqrt(1 - zeta ** 2);
  return 1 - Math.exp(-zeta * omega * t) * (Math.cos(damped * t) + (zeta * omega / damped) * Math.sin(damped * t));
}

test('response and damping fraction become the stiffness and damping Animated.spring expects', () => {
  for (const name of NAMES) {
    const { response, dampingFraction } = SPRINGS[name];
    const { mass, stiffness, damping } = physicsOf(SPRINGS[name]);
    assert.equal(mass, 1);
    assert.ok(Math.abs(Math.sqrt(stiffness) - (2 * Math.PI) / response) < 1e-9, `${name}: natural frequency is 2π / response`);
    assert.ok(Math.abs(damping / (2 * Math.sqrt(stiffness)) - dampingFraction) < 1e-9, `${name}: damping ratio is the damping fraction`);
  }
});

test('the smooth spring never overshoots; the bouncy and snappy springs do, a little', () => {
  const peak = (name: SpringName): number => Math.max(...Array.from({ length: 400 }, (_value, step) => position(name, step * 0.005)));
  assert.ok(peak('smooth') <= 1 + 1e-9, 'smooth stays at or below its target');
  assert.ok(peak('snappy') > 1 && peak('snappy') < 1.02, 'snappy overshoots by under 2%');
  assert.ok(peak('bouncy') > 1.03 && peak('bouncy') < 1.08, 'bouncy overshoots by 3% to 8%');
});

test('every spring has arrived within a second', () => {
  for (const name of NAMES) {
    assert.ok(Math.abs(position(name, 1) - 1) < 0.005, `${name} is within half a percent of its target after 1s`);
  }
});

test('springs get quicker as the response shrinks', () => {
  assert.ok(SPRINGS.snappy.response < SPRINGS.bouncy.response && SPRINGS.bouncy.response < SPRINGS.smooth.response);
});
