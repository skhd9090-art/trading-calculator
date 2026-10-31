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
const UI_STATE_KEY = 'tc_beta_ui_state_v1';

export function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function loadUIState() {
  try {
    const raw = localStorage.getItem(UI_STATE_KEY);
    if (!raw) return { activeSetupId: null, mobileTab: 'setup' };
    const parsed = JSON.parse(raw);
    return {
      activeSetupId: parsed.activeSetupId || null,
      mobileTab: parsed.mobileTab || 'setup'
    };
  } catch {
    return { activeSetupId: null, mobileTab: 'setup' };
  }
}

export function saveUIState(state) {
  try {
    localStorage.setItem(UI_STATE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    return false;
  }
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

export function saveNamedSetup(name, trade, scope = 'full') {
  const setups = getSavedSetups();
  const id = 'setup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  
  // Always save complete trade payload to guarantee 100% data isolation and prevent cross-coin leakage
  const tradePayload = {
    symbol: trade.symbol || 'BTC',
    direction: trade.direction || 'long',
    leverage: trade.leverage != null ? String(trade.leverage) : '10',
    allocationBasis: trade.allocationBasis || 'notional',
    sizingMethod: trade.sizingMethod || 'risk',
    riskBudget: trade.riskBudget != null ? String(trade.riskBudget) : '100',
    fixedSize: trade.fixedSize != null ? String(trade.fixedSize) : '1000',
    stopLoss: trade.stopLoss != null ? String(trade.stopLoss) : '',
    entries: Array.isArray(trade.entries) ? clone(trade.entries) : [],
    targets: Array.isArray(trade.targets) ? clone(trade.targets) : [],
    scenario: trade.scenario || 'filled',
    exitMode: trade.exitMode || 'partial'
  };

  const newSetup = {
    id,
    name: name.trim() || `${tradePayload.symbol} ${tradePayload.direction.toUpperCase()} Setup`,
    scope: 'full', // Always full setup to preserve all targets and parameters
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

export function updateNamedSetup(id, trade, scope = null) {
  const setups = getSavedSetups();
  const target = setups.find(s => s.id === id);
  if (!target) return null;

  // Always save full trade payload including targets to prevent dropping targets on save
  const tradePayload = {
    symbol: trade.symbol || target.trade?.symbol || 'BTC',
    direction: trade.direction || target.trade?.direction || 'long',
    leverage: trade.leverage != null ? String(trade.leverage) : (target.trade?.leverage || '10'),
    allocationBasis: trade.allocationBasis || target.trade?.allocationBasis || 'notional',
    sizingMethod: trade.sizingMethod || target.trade?.sizingMethod || 'risk',
    riskBudget: trade.riskBudget != null ? String(trade.riskBudget) : (target.trade?.riskBudget || '100'),
    fixedSize: trade.fixedSize != null ? String(trade.fixedSize) : (target.trade?.fixedSize || '1000'),
    stopLoss: trade.stopLoss != null ? String(trade.stopLoss) : (target.trade?.stopLoss || ''),
    entries: Array.isArray(trade.entries) ? clone(trade.entries) : (target.trade?.entries || []),
    targets: Array.isArray(trade.targets) ? clone(trade.targets) : (target.trade?.targets || []),
    scenario: trade.scenario || target.trade?.scenario || 'filled',
    exitMode: trade.exitMode || target.trade?.exitMode || 'partial'
  };

  target.trade = tradePayload;
  target.scope = 'full'; // Upgrade to full setup so it retains all properties
  target.updatedAt = Date.now();

  try {
    localStorage.setItem(SETUPS_KEY, JSON.stringify(setups));
    return target;
  } catch (err) {
    console.error('[Storage] Update setup failed:', err.message);
    return null;
  }
}

export function mergeSetupIntoTrade(currentTrade, loadedSetup) {
  if (!loadedSetup) return currentTrade;
  const loadedTrade = loadedSetup.trade || loadedSetup;

  const merged = clone(INITIAL_TRADE);

  merged.symbol = loadedTrade.symbol ?? 'BTC';
  merged.direction = loadedTrade.direction ?? 'long';
  merged.leverage = loadedTrade.leverage != null ? String(loadedTrade.leverage) : '10';
  merged.allocationBasis = loadedTrade.allocationBasis ?? 'notional';
  merged.sizingMethod = loadedTrade.sizingMethod ?? 'risk';
  merged.riskBudget = loadedTrade.riskBudget != null ? String(loadedTrade.riskBudget) : '100';
  merged.fixedSize = loadedTrade.fixedSize != null ? String(loadedTrade.fixedSize) : '1000';
  merged.stopLoss = loadedTrade.stopLoss != null ? String(loadedTrade.stopLoss) : '';
  merged.entries = Array.isArray(loadedTrade.entries) ? clone(loadedTrade.entries) : clone(INITIAL_TRADE.entries);
  merged.scenario = loadedTrade.scenario ?? 'filled';
  merged.exitMode = loadedTrade.exitMode ?? 'partial';

  // Strict isolation for Take-Profit targets:
  // If the loaded setup has saved targets, load them.
  // If it's a legacy setup with NO targets saved, NEVER leak targets from the previously open coin!
  // Instead, provide clean/empty target rows so user can set targets for this token.
  if (Array.isArray(loadedTrade.targets) && loadedTrade.targets.length > 0) {
    merged.targets = clone(loadedTrade.targets);
  } else {
    merged.targets = [
      { id: 1, price: '', label: 'TP1', exit: '' }
    ];
  }

  return merged;
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

