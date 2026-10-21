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
  calculatePartialExitPnl,
  distributeEqualExits,
  createLayeredAllocations
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

test('distributeEqualExits: distributes allocations equally totaling 100%', () => {
  const t1 = [{ id: 1, price: '100', exit: '' }];
  assert.deepEqual(distributeEqualExits(t1).map(t => Number(t.exit)), [100]);

  const t2 = [{ id: 1, exit: '' }, { id: 2, exit: '' }];
  assert.deepEqual(distributeEqualExits(t2).map(t => Number(t.exit)), [50, 50]);

  const t3 = [{ id: 1, exit: '' }, { id: 2, exit: '' }, { id: 3, exit: '' }];
  const res3 = distributeEqualExits(t3).map(t => Number(t.exit));
  assert.deepEqual(res3, [33.33, 33.33, 33.34]);
  assert.equal(res3.reduce((a, b) => a + b, 0), 100);

  const t4 = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  const res4 = distributeEqualExits(t4).map(t => Number(t.exit));
  assert.deepEqual(res4, [25, 25, 25, 25]);
  assert.equal(res4.reduce((a, b) => a + b, 0), 100);
});

test('createLayeredAllocations: generates equal risk budget across layers', () => {
  // Test user example: Long BTC, 84500 to 82250, 4 layers, parent 50% allocation, SL 80000
  const layers = createLayeredAllocations({
    startPrice: 84500,
    endPrice: 82250,
    count: 4,
    parentAllocation: 50,
    stopLoss: 80000,
    direction: 'long',
    allocationBasis: 'notional'
  });

  assert.equal(layers.length, 4);
  assert.equal(Number(layers[0].price), 84500);
  assert.equal(Number(layers[3].price), 82250);

  // Allocations must sum to exactly 50%
  const totalAlloc = layers.reduce((s, l) => s + Number(l.allocation), 0);
  assert.ok(Math.abs(totalAlloc - 50) < 1e-6);

  // Now feed into calculatePosition with another 50% entry and verify each layer has near-identical risk!
  const tradeCalc = calculatePosition({
    direction: 'long',
    entries: [
      ...layers.map((l, i) => ({ id: i + 1, price: Number(l.price), allocationPercent: Number(l.allocation) })),
      { id: 10, price: 80500, allocationPercent: 50 }
    ],
    stopLoss: 80000,
    leverage: 10,
    riskBudget: 100,
    allocationBasis: 'notional',
    sizingMethod: 'risk'
  });

  // All 4 layers must have virtually identical risk to each other
  const layerRisks = tradeCalc.entries.slice(0, 4).map(e => e.stopLossRisk);
  const minRisk = Math.min(...layerRisks);
  const maxRisk = Math.max(...layerRisks);
  assert.ok(maxRisk - minRisk < 0.05, `Max risk ${maxRisk} and min risk ${minRisk} should be equal`);
});

