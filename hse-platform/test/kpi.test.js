import assert from 'node:assert/strict';
import test from 'node:test';
import { ltifr, riskBand, trir } from '../src/kpi.js';

test('TRIR uses 200,000 hours and LTIFR uses 1,000,000', () => {
  assert.equal(trir(1, 486000), 0.41);
  assert.equal(ltifr(0, 486000), 0);
  assert.equal(trir(2, 200000), 2);
  assert.equal(ltifr(1, 1000000), 1);
  assert.equal(trir(0, 0), null);
  assert.equal(ltifr(1, 0), null);
});

test('risk bands follow the 5 by 5 matrix', () => {
  assert.equal(riskBand(4), 'low');
  assert.equal(riskBand(5), 'medium');
  assert.equal(riskBand(9), 'medium');
  assert.equal(riskBand(10), 'high');
  assert.equal(riskBand(16), 'high');
  assert.equal(riskBand(17), 'extreme');
  assert.equal(riskBand(25), 'extreme');
});
