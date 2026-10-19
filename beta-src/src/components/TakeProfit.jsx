import React from 'react';
import {
  calculateTargetPnl,
  calculatePartialExitPnl,
  calculateScenario,
  distributeEqualExits
} from '../core/calculator-core.js';

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
    const nextTargets = [...trade.targets, { id: nextId, price: '', label, exit: '' }];
    if (trade.exitMode === 'partial') {
      onChange({ ...trade, targets: distributeEqualExits(nextTargets) });
    } else {
      onChange({ ...trade, targets: nextTargets });
    }
  };

  const removeTarget = id => {
    if (trade.targets.length <= 1) return;
    const remaining = trade.targets.filter(t => t.id !== id);
    if (trade.exitMode === 'partial') {
      onChange({ ...trade, targets: distributeEqualExits(remaining) });
    } else {
      onChange({ ...trade, targets: remaining });
    }
  };

  const handleSwitchExitMode = mode => {
    if (mode === 'partial') {
      // Auto-distribute exit allocations equally across current targets
      const distributed = distributeEqualExits(trade.targets);
      onChange({ ...trade, exitMode: 'partial', targets: distributed });
    } else {
      onChange({ ...trade, exitMode: 'full' });
    }
  };

  const handleDistributeEqually = () => {
    onChange({ ...trade, targets: distributeEqualExits(trade.targets) });
  };

  // Compute stage and cumulative metrics
  let runningExitSum = 0;
  let runningPnlSum = 0;

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
    const hasValidExit = exitPercentNum != null && exitPercentNum > 0;
    
    // Realized profit strictly for this closed stage size
    const stageRealizedPnl = (pnl != null && hasValidExit) ? pnl * (exitPercentNum / 100) : null;

    if (hasValidExit) {
      runningExitSum += exitPercentNum;
    }
    if (stageRealizedPnl != null) {
      runningPnlSum += stageRealizedPnl;
    }

    return {
      ...t,
      priceNum,
      pnl, // Full-position 100% reference
      exitPercent: exitPercentNum,
      stageRealizedPnl,
      cumulativeRealizedPnl: stageRealizedPnl != null ? runningPnlSum : null,
      cumulativeExitPercent: hasValidExit ? runningExitSum : null
    };
  });

  const partialPnl = calculatePartialExitPnl({ targetRows });

  const exitSum = trade.targets.reduce(
    (sum, t) => sum + (t.exit !== '' && Number.isFinite(Number(t.exit)) ? Number(t.exit) : 0),
    0
  );
  const isPartialValid = Math.abs(exitSum - 100) < 1e-4;
  const equalSplitPct = (100 / Math.max(1, trade.targets.length)).toFixed(1);

  return (
    <section className="calc-panel">
      <div className="panel-header-row">
        <div>
          <h2>4. Take-Profit Targets</h2>
          <p className="panel-sub">Evaluate profit projections for individual targets or a blended partial exit plan.</p>
        </div>
        <div className="panel-header-actions">
          <span className="badge-pill">{trade.targets.length} Targets</span>
        </div>
      </div>

      <div className="field-group">
        <div className="field-label-row">
          <label className="field-label">Exit Calculation Mode</label>
          {trade.exitMode === 'partial' && (
            <button
              type="button"
              className="btn-quick-equal"
              title="Distribute exit percentages equally across all targets (sums to 100%)"
              onClick={handleDistributeEqually}
            >
              ⚖️ Distribute Equally ({equalSplitPct}%)
            </button>
          )}
        </div>
        <div className="radio-pill-group">
          <label className={`radio-pill ${trade.exitMode === 'full' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="exitMode"
              checked={trade.exitMode === 'full'}
              onChange={() => handleSwitchExitMode('full')}
            />
            <span>Full-Position Exit per Target</span>
          </label>
          <label className={`radio-pill ${trade.exitMode === 'partial' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="exitMode"
              checked={trade.exitMode === 'partial'}
              onChange={() => handleSwitchExitMode('partial')}
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
                <label className="field-label">
                  Exit Allocation (%)
                  {trade.exitMode === 'partial' && <span className="text-primary-subtle"> (sums to 100)</span>}
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  className="input-base"
                  placeholder={trade.exitMode === 'partial' ? 'e.g. 33.33' : 'Optional'}
                  value={target.exit}
                  onChange={e => updateTarget(target.id, 'exit', e.target.value)}
                />
              </div>
            </div>

            {trade.exitMode === 'full' ? (
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
            ) : (
              <div className="target-pnl-summary-partial">
                <div className="target-pnl-row">
                  <span className="pnl-label">
                    Stage Realized Profit{' '}
                    {target.exitPercent != null ? (
                      <strong>({target.exitPercent}% closed)</strong>
                    ) : (
                      ''
                    )}:
                  </span>
                  <strong
                    className={`pnl-value ${
                      target.stageRealizedPnl == null
                        ? ''
                        : target.stageRealizedPnl >= 0
                        ? 'text-success'
                        : 'text-danger'
                    }`}
                  >
                    {target.stageRealizedPnl == null
                      ? target.pnl != null && !target.exit
                        ? 'Set Exit % above'
                        : '—'
                      : `${target.stageRealizedPnl >= 0 ? '+' : ''}$${Number(target.stageRealizedPnl).toFixed(2)} USDT`}
                  </strong>
                </div>

                <div className="pnl-sub-metrics">
                  <span className="sub-metric">
                    Cumulative Realized ({target.cumulativeExitPercent ? target.cumulativeExitPercent.toFixed(1) : '0'}% total):{' '}
                    <strong>
                      {target.cumulativeRealizedPnl != null
                        ? `${target.cumulativeRealizedPnl >= 0 ? '+' : ''}$${Number(target.cumulativeRealizedPnl).toFixed(2)} USDT`
                        : '—'}
                    </strong>
                  </span>
                  <span className="sub-metric ref-metric">
                    Full Position Ref:{' '}
                    <span>
                      {target.pnl != null
                        ? `${target.pnl >= 0 ? '+' : ''}$${Number(target.pnl).toFixed(2)} USDT`
                        : '—'}
                    </span>
                  </span>
                </div>
              </div>
            )}
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
              <div className="partial-warning-header">
                <strong>⚠️ Incomplete Partial Plan</strong>
                <button
                  type="button"
                  className="btn-tiny btn-action-outline"
                  onClick={handleDistributeEqually}
                >
                  Auto-Fix: Split Equally
                </button>
              </div>
              <p>Exit percentages currently total {exitSum.toFixed(2)}%. They must total exactly 100%.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

