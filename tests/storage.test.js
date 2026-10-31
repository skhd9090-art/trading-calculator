import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_TRADE,
  clone,
  mergeSetupIntoTrade,
  saveNamedSetup,
  updateNamedSetup,
  getSavedSetups,
  loadUIState,
  saveUIState
} from '../beta-src/src/services/storage.js';

test('mergeSetupIntoTrade: loaded setup with targets restores its own targets', () => {
  const currentBchTrade = {
    ...clone(INITIAL_TRADE),
    symbol: 'BCH',
    targets: [
      { id: 1, price: '287', label: 'TP1', exit: '50' },
      { id: 2, price: '304', label: 'TP2', exit: '25' }
    ]
  };

  const hypeSetup = {
    id: 'setup_hype_1',
    name: 'HYPE LONG',
    scope: 'full',
    trade: {
      symbol: 'HYPE',
      direction: 'long',
      leverage: '10',
      stopLoss: '84.115',
      entries: [
        { id: 1, price: '92.8', allocation: '40', filled: true },
        { id: 2, price: '85.85', allocation: '60', filled: false }
      ],
      targets: [
        { id: 1, price: '100', label: 'TP1', exit: '50' },
        { id: 2, price: '110', label: 'TP2', exit: '50' }
      ]
    }
  };

  const merged = mergeSetupIntoTrade(currentBchTrade, hypeSetup);
  assert.equal(merged.symbol, 'HYPE');
  assert.equal(merged.entries[0].price, '92.8');
  assert.equal(merged.targets.length, 2);
  assert.equal(merged.targets[0].price, '100', 'Should load HYPE targets, NOT BCH targets');
  assert.equal(merged.targets[1].price, '110');
});

test('mergeSetupIntoTrade: legacy setup with NO targets NEVER inherits targets from current trade', () => {
  // Current trade is BCH with BCH targets
  const currentBchTrade = {
    ...clone(INITIAL_TRADE),
    symbol: 'BCH',
    targets: [
      { id: 1, price: '287', label: 'TP1', exit: '50' },
      { id: 2, price: '304', label: 'TP2', exit: '25' }
    ]
  };

  // Legacy HYPE setup saved with scope: 'position' and no targets array
  const legacyHypeSetup = {
    id: 'setup_hype_legacy',
    name: 'HYPE LONG (Altman 2 entries)',
    scope: 'position',
    trade: {
      symbol: 'HYPE',
      direction: 'long',
      leverage: '10',
      stopLoss: '84.115',
      entries: [
        { id: 1, price: '92.8', allocation: '40', filled: true },
        { id: 2, price: '85.85', allocation: '60', filled: false }
      ]
      // No targets!
    }
  };

  const merged = mergeSetupIntoTrade(currentBchTrade, legacyHypeSetup);
  assert.equal(merged.symbol, 'HYPE');
  // Targets MUST NOT be BCH's 287 or 304!
  assert.notEqual(merged.targets[0]?.price, '287', 'HYPE must not inherit BCH target prices');
  assert.equal(merged.targets[0]?.price, '', 'Legacy setup without targets should have clean empty target');
});

// Setup mock localStorage for Node test runner
const store = new Map();
globalThis.localStorage = {
  getItem: k => store.get(k) || null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
  clear: () => store.clear()
};

test('saveNamedSetup & updateNamedSetup: always preserves targets and upgrades scope to full', () => {

  const tradeWithTargets = {
    symbol: 'SOL',
    direction: 'long',
    leverage: '15',
    stopLoss: '160',
    entries: [{ id: 1, price: '180', allocation: '100', filled: true }],
    targets: [{ id: 1, price: '210', label: 'TP1', exit: '100' }]
  };

  const saved = saveNamedSetup('SOL Long Test', tradeWithTargets);
  assert.equal(saved.scope, 'full');
  assert.equal(saved.trade.targets.length, 1);
  assert.equal(saved.trade.targets[0].price, '210');

  // Now update with updated targets
  const updatedTrade = {
    ...tradeWithTargets,
    targets: [
      { id: 1, price: '215', label: 'TP1', exit: '50' },
      { id: 2, price: '230', label: 'TP2', exit: '50' }
    ]
  };

  const updated = updateNamedSetup(saved.id, updatedTrade);
  assert.equal(updated.scope, 'full');
  assert.equal(updated.trade.targets.length, 2);
  assert.equal(updated.trade.targets[0].price, '215');
  assert.equal(updated.trade.targets[1].price, '230');
});

test('saveUIState & loadUIState: preserves active setup and mobile tab across browser discards', () => {
  const state = { activeSetupId: 'setup_test_123', mobileTab: 'targets' };
  saveUIState(state);
  const loaded = loadUIState();
  assert.equal(loaded.activeSetupId, 'setup_test_123');
  assert.equal(loaded.mobileTab, 'targets');
});
