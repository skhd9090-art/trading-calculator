import React, { useState } from 'react';
import RangeModal from './RangeModal.jsx';
import LayerModal from './LayerModal.jsx';
import { equalAllocations } from '../core/calculator-core.js';

export default function EntryOrders({
  trade,
  planned,
  validation,
  livePrice,
  onChange
}) {
  const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);
  const [layerModalEntry, setLayerModalEntry] = useState(null);
  const [layerModalIndex, setLayerModalIndex] = useState(0);

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
    const updated = trade.entries.map((e, idx) => {
      if (e.isLayered && Array.isArray(e.layers) && e.layers.length > 0) {
        // Distribute the new parent allocation across existing layers proportionally
        const oldParentAlloc = Number(e.allocation) || 1;
        const newParentAlloc = allocations[idx];
        const ratio = newParentAlloc / oldParentAlloc;
        const updatedLayers = e.layers.map(l => ({
          ...l,
          allocation: (Number(l.allocation) * ratio).toFixed(2)
        }));
        return {
          ...e,
          allocation: newParentAlloc.toFixed(2),
          layers: updatedLayers
        };
      }
      return {
        ...e,
        allocation: allocations[idx].toFixed(2)
      };
    });
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

  // Layering Actions
  const openLayerModal = (entry, index) => {
    setLayerModalEntry(entry);
    setLayerModalIndex(index);
  };

  const handleApplyLayers = (updatedEntry) => {
    const updatedEntries = trade.entries.map(e => e.id === updatedEntry.id ? updatedEntry : e);
    onChange({ ...trade, entries: updatedEntries });
  };

  const toggleLayerFilled = (entryId, layerId, filled) => {
    const updatedEntries = trade.entries.map(e => {
      if (e.id !== entryId) return e;
      const updatedLayers = (e.layers || []).map(l => l.id === layerId ? { ...l, filled } : l);
      const allFilled = updatedLayers.length > 0 && updatedLayers.every(l => l.filled);
      return {
        ...e,
        layers: updatedLayers,
        filled: allFilled
      };
    });
    onChange({ ...trade, entries: updatedEntries });
  };

  const toggleParentFilled = (entry, isMasterFilled) => {
    if (entry.isLayered && Array.isArray(entry.layers)) {
      const targetState = !isMasterFilled;
      const updatedLayers = entry.layers.map(l => ({ ...l, filled: targetState }));
      const updatedEntries = trade.entries.map(e =>
        e.id === entry.id ? { ...e, layers: updatedLayers, filled: targetState } : e
      );
      onChange({ ...trade, entries: updatedEntries });
    } else {
      updateEntry(entry.id, 'filled', !entry.filled);
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
          if (entry.isLayered && Array.isArray(entry.layers)) {
            // Layered Entry Card (Approach 2: Grouped / Nested Layer Card)
            const childCalcs = planned?.entries?.filter(e => e.parentId === entry.id) || [];
            const parentQuantity = childCalcs.reduce((s, c) => s + (c.quantity || 0), 0);
            const parentNotional = childCalcs.reduce((s, c) => s + (c.notional || 0), 0);
            const parentRisk = childCalcs.reduce((s, c) => s + (c.stopLossRisk || 0), 0);
            const filledLayersCount = entry.layers.filter(l => l.filled).length;
            const totalLayersCount = entry.layers.length;
            const allLayersFilled = totalLayersCount > 0 && filledLayersCount === totalLayersCount;
            const someLayersFilled = filledLayersCount > 0 && !allLayersFilled;

            return (
              <div key={entry.id} className={`entry-card entry-card-layered ${allLayersFilled ? 'is-filled' : someLayersFilled ? 'is-partial' : ''}`}>
                <div className="entry-card-header">
                  <div className="entry-tag-group">
                    <label className="checkbox-label filled-toggle">
                      <input
                        type="checkbox"
                        checked={allLayersFilled}
                        ref={el => { if (el) el.indeterminate = someLayersFilled; }}
                        onChange={() => toggleParentFilled(entry, allLayersFilled)}
                      />
                      <span>Filled</span>
                    </label>
                    <span className="entry-badge">E{index + 1}</span>
                    <span className="badge-layer-tag">
                      🪜 {totalLayersCount} Layers ({entry.allocation}%)
                    </span>
                    <span className={`badge-fill-ratio ${filledLayersCount > 0 ? 'text-success' : 'text-muted'}`}>
                      {filledLayersCount}/{totalLayersCount} filled
                    </span>
                  </div>

                  <div className="entry-actions-right">
                    <button
                      type="button"
                      className="btn-tiny-action"
                      title="Edit layer price zone and count"
                      onClick={() => openLayerModal(entry, index)}
                    >
                      ⚙️ Edit Layers
                    </button>
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
                </div>

                {/* Nested Micro-Table of Layers */}
                <div className="nested-layers-container">
                  <div className="layers-table-header">
                    <span className="th-layer">Layer</span>
                    <span className="th-price">Limit Price</span>
                    <span className="th-coins">Coins</span>
                    <span className="th-notional">Notional</span>
                    <span className="th-risk">Stop Risk</span>
                    <span className="th-fill">Fill</span>
                  </div>
                  <div className="layers-table-body">
                    {entry.layers.map((layer, lIdx) => {
                      const layerCalc = planned?.entries?.find(e => e.id === layer.id);
                      return (
                        <div key={layer.id} className={`layer-row ${layer.filled ? 'is-layer-filled' : ''}`}>
                          <span className="col-layer font-bold">L{lIdx + 1}</span>
                          <span className="col-price font-mono">{Number(layer.price).toLocaleString()}</span>
                          <span className="col-coins font-mono">
                            {layerCalc ? Number(layerCalc.quantity).toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—'}
                          </span>
                          <span className="col-notional font-mono">
                            {layerCalc ? `$${Number(layerCalc.notional).toFixed(2)}` : '—'}
                          </span>
                          <span className="col-risk font-mono text-danger">
                            {layerCalc ? `$${Number(layerCalc.stopLossRisk).toFixed(2)}` : '—'}
                          </span>
                          <span className="col-fill">
                            <input
                              type="checkbox"
                              className="layer-row-check"
                              checked={layer.filled}
                              onChange={e => toggleLayerFilled(entry.id, layer.id, e.target.checked)}
                            />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Layered Summary Footer */}
                <div className="entry-metrics-footer">
                  <div className="entry-metric-item">
                    <span>Total Coins:</span>
                    <strong>
                      {Number(parentQuantity).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                      {trade.symbol ? ` ${trade.symbol}` : ''}
                    </strong>
                  </div>
                  <div className="entry-metric-item">
                    <span>Total Notional:</span>
                    <strong>${Number(parentNotional).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="entry-metric-item">
                    <span>Equal Risk Total:</span>
                    <strong className="text-danger">${Number(parentRisk).toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            );
          }

          // Regular Single Entry Card
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

                <div className="entry-actions-right">
                  <button
                    type="button"
                    className="btn-tiny-action btn-layer-action"
                    title="Split into layered limit orders (Equal Risk)"
                    onClick={() => openLayerModal(entry, index)}
                  >
                    🪜 Layer
                  </button>
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

      <LayerModal
        isOpen={Boolean(layerModalEntry)}
        onClose={() => setLayerModalEntry(null)}
        entry={layerModalEntry}
        entryIndex={layerModalIndex}
        trade={trade}
        onApplyLayers={handleApplyLayers}
      />
    </section>
  );
}
