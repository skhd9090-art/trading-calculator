import test from 'node:test';
import assert from 'node:assert/strict';
import {
  expandRange,
  equalAllocations,
  validateAllocations,
  validateTrade,
  calculatePosition,
  calculateScenario,
  calculateTargetPnl,
  calculatePartialExitPnl
} from '../beta-src/src/core/calculator-core.js';

test('expandRange: includes endpoints when count specified', () => {
  assert.deepEqual(expandRange(11, 13, 3), [11, 12, 13]);
  assert.deepEqual(expandRange(10, 20, 5), [10, 12.5, 15, 17.5, 20]);
});

test('expandRange: returns endpoints when count is null', () => {
  assert.deepEqual(expandRange(11, 13), [11, 13]);
});

test('expandRange: rejects invalid inputs', () => {
  assert.throws(() => expandRange(0, 10, 3), /finite positive prices/);
  assert.throws(() => expandRange(10, -5, 3), /finite positive prices/);
  assert.throws(() => expandRange(10, 20, 1), /integer >= 2/);
});

test('equalAllocations: supports arbitrary counts', () => {
  assert.deepEqual(equalAllocations(1), [100]);
  assert.deepEqual(equalAllocations(2), [50, 50]);
  const three = equalAllocations(3);
  assert.ok(Math.abs(three.reduce((a, b) => a + b, 0) - 100) < 1e-8);
});

test('validateAllocations: checks exact 100% total', () => {
  assert.equal(validateAllocations([30, 30, 40]), true);
  assert.equal(validateAllocations([30, 30, 30]), false);
  assert.equal(validateAllocations([-10, 110]), false);
});

test('validateTrade: validates directional stop loss correctly', () => {
  const validLong = validateTrade({
    direction: 'long',
    entries: [{ price: 100, allocationPercent: 100 }],
    stopLoss: 90,
    leverage: 10,
    riskBudget: 50,
    fixedSize: 1000,
    allocationBasis: 'notional',
    sizingMethod: 'risk'
  });
  assert.equal(validLong.valid, true);

  const invalidLong = validateTrade({
    direction: 'long',
    entries: [{ price: 100, allocationPercent: 100 }],
    stopLoss: 105,
    leverage: 10,
    riskBudget: 50,
    fixedSize: 1000,
    allocationBasis: 'notional',
    sizingMethod: 'risk'
  });
  assert.equal(invalidLong.valid, false);
  assert.match(invalidLong.errors[0], /below every entry for a Long/);

  const validShort = validateTrade({
    direction: 'short',
    entries: [{ price: 100, allocationPercent: 100 }],
    stopLoss: 110,
    leverage: 10,
    riskBudget: 50,
    fixedSize: 1000,
    allocationBasis: 'notional',
    sizingMethod: 'risk'
  });
  assert.equal(validShort.valid, true);

  const invalidShort = validateTrade({
    direction: 'short',
    entries: [{ price: 100, allocationPercent: 100 }],
    stopLoss: 95,
    leverage: 10,
    riskBudget: 50,
    fixedSize: 1000,
    allocationBasis: 'notional',
    sizingMethod: 'risk'
  });
  assert.equal(invalidShort.valid, false);
  assert.match(invalidShort.errors[0], /above every entry for a Short/);
});

test('calculatePosition: notional sizing matches risk budget exactly', () => {
  const result = calculatePosition({
    direction: 'long',
    entries: [
      { id: 1, price: 277, allocationPercent: 30, filled: true },
      { id: 2, price: 257.8, allocationPercent: 30, filled: false },
      { id: 3, price: 246, allocationPercent: 40, filled: false }
    ],
    stopLoss: 240.6,
    leverage: 10,
    riskBudget: 100,
    fixedSize: 1000,
    allocationBasis: 'notional',
    sizingMethod: 'risk'
  });
  assert.ok(Math.abs(result.totalStopLossRisk - 100) < 1e-6);
  assert.ok(Math.abs(result.totalNotional - 1465.88) < 0.1);
  assert.ok(Math.abs(result.estimatedMargin - result.totalNotional / 10) < 1e-6);
  assert.equal(result.entries.length, 3);
});

test('calculatePosition: quantity sizing matches risk budget', () => {
  const result = calculatePosition({
    direction: 'long',
    entries: [
      { price: 100, allocationPercent: 50 },
      { price: 90, allocationPercent: 50 }
    ],
    stopLoss: 80,
    leverage: 5,
    riskBudget: 100,
    fixedSize: 10,
    allocationBasis: 'quantity',
    sizingMethod: 'risk'
  });
  assert.ok(Math.abs(result.totalStopLossRisk - 100) < 1e-6);
  assert.ok(Math.abs(result.estimatedMargin - result.totalNotional / 5) < 1e-6);
});

test('calculatePosition: fixed size mode adheres to specified size', () => {
  const result = calculatePosition({
    direction: 'long',
    entries: [
      { price: 100, allocationPercent: 50 },
      { price: 90, allocationPercent: 50 }
    ],
    stopLoss: 80,
    leverage: 10,
    riskBudget: 100,
    fixedSize: 1000,
    allocationBasis: 'notional',
    sizingMethod: 'fixed'
  });
  assert.ok(Math.abs(result.totalNotional - 1000) < 1e-6);
});

test('calculateScenario: scenario filtering calculates accurate subset risk', () => {
  const planned = calculatePosition({
    direction: 'long',
    entries: [
      { id: 1, price: 100, allocationPercent: 50, filled: true },
      { id: 2, price: 90, allocationPercent: 50, filled: false }
    ],
    stopLoss: 80,
    leverage: 10,
    riskBudget: 100,
    fixedSize: 1000,
    allocationBasis: 'notional',
    sizingMethod: 'risk'
  });

  const filledScenario = calculateScenario({
    plannedEntries: planned.entries,
    scenario: 'filled',
    leverage: 10
  });

  assert.equal(filledScenario.entries.length, 1);
  assert.equal(filledScenario.entries[0].price, 100);
  assert.ok(filledScenario.scenarioRisk < planned.totalStopLossRisk);

  const allScenario = calculateScenario({
    plannedEntries: planned.entries,
    scenario: 'all',
    leverage: 10
  });
  assert.equal(allScenario.entries.length, 2);
  assert.ok(Math.abs(allScenario.scenarioRisk - 100) < 1e-6);
});

test('calculateTargetPnl: direction aware profit calculation', () => {
  const longPnl = calculateTargetPnl({
    direction: 'long',
    entries: [{ price: 100, quantity: 2 }],
    targetPrice: 110
  });
  assert.equal(longPnl, 20);

  const shortPnl = calculateTargetPnl({
    direction: 'short',
    entries: [{ price: 100, quantity: 2 }],
    targetPrice: 90
  });
  assert.equal(shortPnl, 20);
});

test('calculatePartialExitPnl: calculates weighted exit gross PnL', () => {
  const targetRows = [
    { pnl: 100, exitPercent: 50 },
    { pnl: 200, exitPercent: 50 }
  ];
  assert.equal(calculatePartialExitPnl({ targetRows }), 150);

  const invalidRows = [
    { pnl: 100, exitPercent: 40 },
    { pnl: 200, exitPercent: 50 }
  ];
  assert.equal(calculatePartialExitPnl({ targetRows: invalidRows }), null);
});
