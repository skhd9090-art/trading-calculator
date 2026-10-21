import React, { useState } from 'react';
import RangeModal from './RangeModal.jsx';
import { equalAllocations } from '../core/calculator-core.js';

export default function EntryOrders({
  trade,
  planned,
  validation,
  livePrice,
  onChange
}) {
  const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);

  const updateEntry = (id, key, value) => {
    const updatedEntries = trade.entries.map(e => (e.id === id ? { ...e, [key]: value } : e));
    onChange({ ...trade, entries: updatedEntries });
  };

  const addEntry = () => {
    const nextId = Math.max(0, ...trade.entries.map(e => e.id)) + 1;
    const newCount = trade.entries.length + 1;
    const equal = (100 / newCount).toFixed(2);
    const updatedEntries = [
      ...trade.entries,
      { id: nextId, price: '', allocation: equal, filled: false, type: 'limit' }
    ];
    onChange({ ...trade, entries: updatedEntries });
  };

  const removeEntry = id => {
    if (trade.entries.length <= 1) return;
    const remaining = trade.entries.filter(e => e.id !== id);
    onChange({ ...trade, entries: remaining });
  };

  const handleEqualize = () => {
    if (trade.entries.length === 0) return;
    const allocations = equalAllocations(trade.entries.length);
    const updated = trade.entries.map((e, idx) => ({
      ...e,
      allocation: allocations[idx].toFixed(2)
    }));
    onChange({ ...trade, entries: updated });
  };

  const handleApplyRange = generatedEntries => {
    onChange({ ...trade, entries: generatedEntries });
  };

  const handleUseLivePrice = (id) => {
    if (livePrice && Number.isFinite(livePrice.price)) {
      updateEntry(id, 'price', livePrice.price.toString());
    }
  };

  return (
    <section className="calc-panel">
      <div className="panel-header-row">
        <div>
          <h2>2. Entry Orders</h2>
          <p className="panel-sub">
            Tick <strong>Filled</strong> only for entries that have executed. Unchecked entries remain part of the planned setup.
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn-text-action"
            title="Equalize allocations across all entries"
            onClick={handleEqualize}
          >
            ⚖️ Equalize
          </button>
          <button
            type="button"
            className="btn-text-action"
            title="Generate a multi-entry price range"
            onClick={() => setIsRangeModalOpen(true)}
          >
            ⚡ Range
          </button>
          <button
            type="button"
            className="btn-text-action btn-text-primary"
            title="Add entry level"
            onClick={addEntry}
          >
            ＋ Add
          </button>
        </div>
      </div>

      <div className="entries-list">
        {trade.entries.map((entry, index) => {
          const calc = planned?.entries?.find(e => e.id === entry.id);

          return (
            <div key={entry.id} className={`entry-card ${entry.filled ? 'is-filled' : ''}`}>
              <div className="entry-card-header">
                <div className="entry-tag-group">
                  <label className="checkbox-label filled-toggle">
                    <input
                      type="checkbox"
                      checked={entry.filled}
                      onChange={e => updateEntry(entry.id, 'filled', e.target.checked)}
                    />
                    <span>Filled</span>
                  </label>
                  <span className="entry-badge">E{index + 1}</span>
                  {calc && (
                    <span className="entry-header-risk text-danger">Risk: ${Number(calc.stopLossRisk).toFixed(2)}</span>
                  )}
                </div>

                <button
                  type="button"
                  className="btn-remove-entry"
                  disabled={trade.entries.length <= 1}
                  title="Remove this entry"
                  onClick={() => removeEntry(entry.id)}
                >
                  ✕
                </button>
              </div>

              <div className="entry-grid">
                <div className="field-group">
                  <label className="field-label">Order Type</label>
                  <select
                    className="input-base select-base"
                    value={entry.type}
                    onChange={e => updateEntry(entry.id, 'type', e.target.value)}
                  >
                    <option value="market">Market (CMP)</option>
                    <option value="limit">Limit Order</option>
                  </select>
                </div>

                <div className="field-group">
                  <div className="label-with-action">
                    <label className="field-label">Entry Price</label>
                    {livePrice && (
                      <button
                        type="button"
                        className="btn-tiny"
                        title="Use current live price"
                        onClick={() => handleUseLivePrice(entry.id)}
                      >
                        Use Live
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="input-base"
                    placeholder="e.g. 64000"
                    value={entry.price}
                    onChange={e => updateEntry(entry.id, 'price', e.target.value)}
                  />
                </div>

                <div className="field-group">
                  <label className="field-label">Allocation (%)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max="100"
                    className="input-base"
                    placeholder="e.g. 50"
                    value={entry.allocation}
                    onChange={e => updateEntry(entry.id, 'allocation', e.target.value)}
                  />
                </div>
              </div>

              {calc && (
                <div className="entry-metrics-footer">
                  <div className="entry-metric-item">
                    <span>Planned Coins:</span>
                    <strong>
                      {Number(calc.quantity).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                      {trade.symbol ? ` ${trade.symbol}` : ''}
                    </strong>
                  </div>
                  <div className="entry-metric-item">
                    <span>Notional:</span>
                    <strong>${Number(calc.notional).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="entry-metric-item">
                    <span>Stop Risk:</span>
                    <strong className="text-danger">${Number(calc.stopLossRisk).toFixed(2)}</strong>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button type="button" className="btn-add-entry full-width" onClick={addEntry}>
        ＋ Add Entry Level
      </button>

      {validation && !validation.valid && (
        <div className="validation-alert-box">
          <strong>⚠️ Please review entries:</strong>
          <ul>
            {validation.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <RangeModal
        isOpen={isRangeModalOpen}
        onClose={() => setIsRangeModalOpen(false)}
        onApplyRange={handleApplyRange}
        currentDirection={trade.direction}
      />
    </section>
  );
}
