/**
 * Trade Setups Persistence & Local Draft Management
 */

export const INITIAL_TRADE = {
  symbol: 'BTC',
  direction: 'long',
  leverage: '10',
  allocationBasis: 'notional',
  sizingMethod: 'risk',
  riskBudget: '100',
  fixedSize: '1000',
  stopLoss: '62000',
  entries: [
    { id: 1, price: '65000', allocation: '50', filled: true, type: 'market' },
    { id: 2, price: '63500', allocation: '50', filled: false, type: 'limit' }
  ],
  targets: [
    { id: 1, price: '68000', label: 'TP1', exit: '' },
    { id: 2, price: '72000', label: 'TP2', exit: '' }
  ],
  scenario: 'filled',
  exitMode: 'full'
};

const DRAFT_KEY = 'tc_beta_draft_v1';
const SETUPS_KEY = 'tc_beta_setups_v1';

export function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return clone(INITIAL_TRADE);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.entries)) {
      return clone(INITIAL_TRADE);
    }
    return { ...clone(INITIAL_TRADE), ...parsed };
  } catch (err) {
    console.warn('[Storage] Failed to load draft:', err.message);
    return clone(INITIAL_TRADE);
  }
}

export function saveDraft(trade) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(trade));
    return true;
  } catch (err) {
    console.warn('[Storage] Failed to save draft:', err.message);
    return false;
  }
}

export function getSavedSetups() {
  try {
    const raw = localStorage.getItem(SETUPS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn('[Storage] Failed to load setups:', err.message);
    return [];
  }
}

export function saveNamedSetup(name, trade, scope = 'position') {
  const setups = getSavedSetups();
  const id = 'setup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  
  const tradePayload = scope === 'position' ? {
    symbol: trade.symbol,
    direction: trade.direction,
    leverage: trade.leverage,
    allocationBasis: trade.allocationBasis,
    sizingMethod: trade.sizingMethod,
    riskBudget: trade.riskBudget,
    fixedSize: trade.fixedSize,
    stopLoss: trade.stopLoss,
    entries: clone(trade.entries),
    scenario: trade.scenario || 'filled'
  } : clone(trade);

  const newSetup = {
    id,
    name: name.trim() || `${trade.symbol || 'Trade'} ${trade.direction.toUpperCase()} (${scope === 'position' ? 'Position' : 'Full'})`,
    scope: scope || 'position', // 'position' | 'full'
    createdAt: Date.now(),
    updatedAt: Date.now(),
    trade: tradePayload
  };
  setups.unshift(newSetup);
  try {
    localStorage.setItem(SETUPS_KEY, JSON.stringify(setups));
    return newSetup;
  } catch (err) {
    console.error('[Storage] Save setup failed:', err.message);
    return null;
  }
}

export function mergeSetupIntoTrade(currentTrade, loadedSetup) {
  if (!loadedSetup) return currentTrade;
  const loadedTrade = loadedSetup.trade || loadedSetup;
  const isPositionOnly = loadedSetup.scope === 'position' || (!loadedTrade.targets && Array.isArray(loadedTrade.entries));

  if (isPositionOnly) {
    return {
      ...currentTrade,
      symbol: loadedTrade.symbol ?? currentTrade.symbol,
      direction: loadedTrade.direction ?? currentTrade.direction,
      leverage: loadedTrade.leverage ?? currentTrade.leverage,
      allocationBasis: loadedTrade.allocationBasis ?? currentTrade.allocationBasis,
      sizingMethod: loadedTrade.sizingMethod ?? currentTrade.sizingMethod,
      riskBudget: loadedTrade.riskBudget ?? currentTrade.riskBudget,
      fixedSize: loadedTrade.fixedSize ?? currentTrade.fixedSize,
      stopLoss: loadedTrade.stopLoss ?? currentTrade.stopLoss,
      entries: Array.isArray(loadedTrade.entries) ? clone(loadedTrade.entries) : currentTrade.entries,
      scenario: loadedTrade.scenario ?? currentTrade.scenario
      // Current targets and exitMode are preserved!
    };
  }

  return {
    ...clone(INITIAL_TRADE),
    ...clone(loadedTrade)
  };
}

export function deleteNamedSetup(id) {
  const setups = getSavedSetups().filter(s => s.id !== id);
  try {
    localStorage.setItem(SETUPS_KEY, JSON.stringify(setups));
    return true;
  } catch {
    return false;
  }
}

export function duplicateNamedSetup(id) {
  const setups = getSavedSetups();
  const target = setups.find(s => s.id === id);
  if (!target) return null;
  return saveNamedSetup(`${target.name} (Copy)`, target.trade, target.scope || 'position');
}

export function renameNamedSetup(id, newName) {
  const setups = getSavedSetups();
  const target = setups.find(s => s.id === id);
  if (!target) return false;
  target.name = newName.trim();
  target.updatedAt = Date.now();
  try {
    localStorage.setItem(SETUPS_KEY, JSON.stringify(setups));
    return true;
  } catch {
    return false;
  }
}

export function exportSetupToFile(trade, filename, scope = 'full') {
  const safeName = (trade.symbol || filename || 'trade')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase();
  const exportPayload = {
    schemaVersion: '1.0',
    exportedAt: new Date().toISOString(),
    scope,
    trade: clone(trade)
  };
  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}_${scope === 'position' ? 'position' : 'setup'}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

