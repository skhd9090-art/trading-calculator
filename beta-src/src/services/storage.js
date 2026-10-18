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

export function saveNamedSetup(name, trade) {
  const setups = getSavedSetups();
  const id = 'setup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  const newSetup = {
    id,
    name: name.trim() || `${trade.symbol || 'Trade'} ${trade.direction.toUpperCase()} (${new Date().toLocaleDateString()})`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    trade: clone(trade)
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
  return saveNamedSetup(`${target.name} (Copy)`, target.trade);
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

export function exportSetupToFile(trade, filename) {
  const safeName = (trade.symbol || filename || 'trade')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase();
  const exportPayload = {
    schemaVersion: '1.0',
    exportedAt: new Date().toISOString(),
    trade: clone(trade)
  };
  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}_setup.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
