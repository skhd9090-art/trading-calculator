import React from 'react';
import { calculateTargetPnl, calculatePartialExitPnl, calculateScenario } from '../core/calculator-core.js';

export default function TakeProfit({ trade, planned, onChange }) {
  const scenarioResult = calculateScenario({
    plannedEntries: planned?.entries || [],
    scenario: trade.scenario || 'filled',
    leverage: Number(trade.leverage) || 1
  });

  const activeEntries = scenarioResult.entries;
  const activeQty = scenarioResult.scenarioQty;

  const updateTarget = (id, key, value) => {
    const updated = trade.targets.map(t => (t.id === id ? { ...t, [key]: value } : t));
    onChange({ ...trade, targets: updated });
  };

  const addTarget = () => {
    const nextId = Math.max(0, ...trade.targets.map(t => t.id)) + 1;
    const label = `TP${nextId}`;
    const updated = [...trade.targets, { id: nextId, price: '', label, exit: '' }];
    onChange({ ...trade, targets: updated });
  };

  const removeTarget = id => {
    if (trade.targets.length <= 1) return;
    const updated = trade.targets.filter(t => t.id !== id);
    onChange({ ...trade, targets: updated });
  };

  const targetRows = trade.targets.map(t => {
    const priceNum = t.price !== '' && Number.isFinite(Number(t.price)) ? Number(t.price) : null;
    const pnl =
      planned && priceNum != null && activeQty > 0
        ? calculateTargetPnl({
            direction: trade.direction,
            entries: activeEntries,
            targetPrice: priceNum
          })
        : null;

    const exitPercentNum = t.exit !== '' && Number.isFinite(Number(t.exit)) ? Number(t.exit) : null;
    return { ...t, priceNum, pnl, exitPercent: exitPercentNum };
  });

  const partialPnl = calculatePartialExitPnl({ targetRows });

  const exitSum = trade.targets.reduce(
    (sum, t) => sum + (t.exit !== '' && Number.isFinite(Number(t.exit)) ? Number(t.exit) : 0),
    0
  );
  const isPartialValid = Math.abs(exitSum - 100) < 1e-4;

  return (
    <section className="calc-panel">
      <div className="panel-header-row">
        <div>
          <h2>4. Take-Profit Targets</h2>
          <p className="panel-sub">Evaluate profit projections for individual targets or a blended partial exit plan.</p>
        </div>
        <span className="badge-pill">{trade.targets.length} Targets</span>
      </div>

      <div className="field-group">
        <label className="field-label">Exit Calculation Mode</label>
        <div className="radio-pill-group">
          <label className={`radio-pill ${trade.exitMode === 'full' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="exitMode"
              checked={trade.exitMode === 'full'}
              onChange={() => onChange({ ...trade, exitMode: 'full' })}
            />
            <span>Full-Position Exit per Target</span>
          </label>
          <label className={`radio-pill ${trade.exitMode === 'partial' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="exitMode"
              checked={trade.exitMode === 'partial'}
              onChange={() => onChange({ ...trade, exitMode: 'partial' })}
            />
            <span>Partial Exit Plan (Exits = 100%)</span>
          </label>
        </div>
      </div>

      <div className="targets-list">
        {targetRows.map((target, idx) => (
          <div key={target.id} className="target-card">
            <div className="target-card-header">
              <span className="target-badge">{target.label || `TP${idx + 1}`}</span>
              <button
                type="button"
                className="btn-remove-entry"
                disabled={trade.targets.length <= 1}
                title="Remove target"
                onClick={() => removeTarget(target.id)}
              >
                ✕
              </button>
            </div>

            <div className="two-col-grid">
              <div className="field-group">
                <label className="field-label">Target Price</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  className="input-base"
                  placeholder="e.g. 70000"
                  value={target.price}
                  onChange={e => updateTarget(target.id, 'price', e.target.value)}
                />
              </div>

              <div className="field-group">
                <label className="field-label">Exit Allocation (%)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  className="input-base"
                  placeholder={trade.exitMode === 'partial' ? 'e.g. 50' : 'Optional'}
                  value={target.exit}
                  onChange={e => updateTarget(target.id, 'exit', e.target.value)}
                />
              </div>
            </div>

            <div className="target-pnl-row">
              <span className="pnl-label">Full Position Gross P&amp;L:</span>
              <strong
                className={`pnl-value ${
                  target.pnl == null ? '' : target.pnl >= 0 ? 'text-success' : 'text-danger'
                }`}
              >
                {target.pnl == null
                  ? '—'
                  : `${target.pnl >= 0 ? '+' : ''}$${Number(target.pnl).toFixed(2)} USDT`}
              </strong>
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="btn-add-entry full-width" onClick={addTarget}>
        ＋ Add Take-Profit Target
      </button>

      {trade.exitMode === 'partial' && (
        <div className={`partial-plan-box ${isPartialValid ? 'valid-box' : 'invalid-box'}`}>
          {isPartialValid ? (
            <div>
              <div className="partial-plan-header">
                <span>Blended Partial Exit Plan P&amp;L:</span>
                <strong className={partialPnl >= 0 ? 'text-success' : 'text-danger'}>
                  {partialPnl >= 0 ? '+' : ''}${Number(partialPnl).toFixed(2)} USDT
                </strong>
              </div>
              <small>All targets combined total 100% of the active position quantity.</small>
            </div>
          ) : (
            <div>
              <strong>⚠️ Incomplete Partial Plan</strong>
              <p>Exit percentages currently total {exitSum.toFixed(2)}%. They must total exactly 100%.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
