import React, { useState, useEffect, useMemo } from 'react';
import { createLayeredAllocations } from '../core/calculator-core.js';

export default function LayerModal({
  isOpen,
  onClose,
  entry,
  entryIndex,
  trade,
  onApplyLayers
}) {
  const [startPrice, setStartPrice] = useState('');
  const [endPrice, setEndPrice] = useState('');
  const [count, setCount] = useState('4');
  const [error, setError] = useState('');

  // Initialize and pre-populate defaults when opened
  useEffect(() => {
    if (!isOpen || !entry) return;
    setError('');

    const basePrice = Number(entry.price);
    const sl = Number(trade.stopLoss);
    const countVal = entry.layerCount ? entry.layerCount.toString() : '4';
    setCount(countVal);

    if (entry.isLayered && entry.rangeStart && entry.rangeEnd) {
      setStartPrice(entry.rangeStart);
      setEndPrice(entry.rangeEnd);
      return;
    }

    if (Number.isFinite(basePrice) && basePrice > 0) {
      const isLong = trade.direction === 'long';
      const hasValidSl = Number.isFinite(sl) && sl > 0 && (isLong ? basePrice > sl : basePrice < sl);

      if (hasValidSl) {
        const distToSl = Math.abs(basePrice - sl);
        if (isLong) {
          // Front-run buffer slightly above base; deep dip buffer down into support
          const frontRun = basePrice >= 1000 ? Math.round(basePrice + Math.min(basePrice * 0.002, 100)) : Number((basePrice * 1.002).toFixed(4));
          const deepDip = basePrice >= 1000 ? Math.round(basePrice - Math.min(distToSl * 0.35, basePrice * 0.03)) : Number((basePrice * 0.97).toFixed(4));
          setStartPrice(frontRun.toString());
          setEndPrice(deepDip.toString());
        } else {
          // Short: Front-run slightly below base; deep wick up into resistance
          const frontRun = basePrice >= 1000 ? Math.round(basePrice - Math.min(basePrice * 0.002, 100)) : Number((basePrice * 0.998).toFixed(4));
          const deepWick = basePrice >= 1000 ? Math.round(basePrice + Math.min(distToSl * 0.35, basePrice * 0.03)) : Number((basePrice * 1.03).toFixed(4));
          setStartPrice(frontRun.toString());
          setEndPrice(deepWick.toString());
        }
      } else {
        // Fallback percentage offsets
        const s = isLong ? basePrice * 1.002 : basePrice * 0.998;
        const e = isLong ? basePrice * 0.98 : basePrice * 1.02;
        setStartPrice(basePrice >= 1000 ? Math.round(s).toString() : s.toFixed(4));
        setEndPrice(basePrice >= 1000 ? Math.round(e).toString() : e.toFixed(4));
      }
    } else {
      setStartPrice('');
      setEndPrice('');
    }
  }, [isOpen, entry, trade.direction, trade.stopLoss]);

  const parentAlloc = Number(entry?.allocation) || 0;

  // Live computed preview of layers
  const previewLayers = useMemo(() => {
    if (!isOpen || !entry) return null;
    const start = Number(startPrice);
    const end = Number(endPrice);
    const n = parseInt(count, 10);
    const sl = Number(trade.stopLoss);

    if (!Number.isFinite(start) || start <= 0 || !Number.isFinite(end) || end <= 0) return null;
    if (start === end || !Number.isInteger(n) || n < 2 || n > 10 || parentAlloc <= 0) return null;

    try {
      return createLayeredAllocations({
        startPrice: start,
        endPrice: end,
        count: n,
        parentAllocation: parentAlloc,
        stopLoss: sl,
        direction: trade.direction,
        allocationBasis: trade.allocationBasis
      });
    } catch {
      return null;
    }
  }, [isOpen, entry, startPrice, endPrice, count, parentAlloc, trade.stopLoss, trade.direction, trade.allocationBasis]);

  if (!isOpen || !entry) return null;

  const handleApply = () => {
    setError('');
    const start = Number(startPrice);
    const end = Number(endPrice);
    const n = parseInt(count, 10);

    if (!Number.isFinite(start) || start <= 0 || !Number.isFinite(end) || end <= 0) {
      setError('Please provide valid positive start and end prices.');
      return;
    }
    if (start === end) {
      setError('Start price and end price must be different.');
      return;
    }
    if (!Number.isInteger(n) || n < 2 || n > 10) {
      setError('Number of layers must be between 2 and 10.');
      return;
    }

    try {
      const generated = createLayeredAllocations({
        startPrice: start,
        endPrice: end,
        count: n,
        parentAllocation: parentAlloc,
        stopLoss: Number(trade.stopLoss),
        direction: trade.direction,
        allocationBasis: trade.allocationBasis
      });

      const updated = {
        ...entry,
        isLayered: true,
        rangeStart: startPrice.toString(),
        rangeEnd: endPrice.toString(),
        layerCount: n,
        layers: generated.map((layer, i) => ({
          id: entry.layers?.[i]?.id || `${entry.id}_layer_${Date.now()}_${i}`,
          price: layer.price,
          allocation: layer.allocation,
          filled: entry.layers?.[i]?.filled ?? false
        }))
      };

      onApplyLayers(updated);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFlatten = () => {
    // Unlayer back to a single flat entry
    const avgPrice = entry.layers && entry.layers.length > 0
      ? (entry.layers.reduce((s, l) => s + Number(l.price), 0) / entry.layers.length).toFixed(2)
      : entry.price;

    const flattened = {
      ...entry,
      isLayered: false,
      price: avgPrice,
      rangeStart: undefined,
      rangeEnd: undefined,
      layerCount: undefined,
      layers: undefined
    };
    onApplyLayers(flattened);
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card modal-card-layering">
        <div className="modal-header">
          <div className="modal-title-with-badge">
            <span className="badge-entry-modal">E{entryIndex + 1}</span>
            <h3>🪜 Layer Entry into Scaled Orders</h3>
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        <p className="modal-desc">
          Split <strong>E{entryIndex + 1} ({parentAlloc}% allocation)</strong> across a price buffer zone to defend against front-running and improve average entry.
        </p>

        {error && <div className="modal-error">{error}</div>}

        <div className="layer-config-grid">
          <div className="field-group">
            <label className="field-label">
              {trade.direction === 'long' ? 'Front-Run Top Price' : 'Front-Run Bottom Price'}
            </label>
            <input
              type="number"
              step="any"
              className="input-base"
              placeholder="e.g. 84500"
              value={startPrice}
              onChange={e => setStartPrice(e.target.value)}
            />
            <span className="field-hint">Initial entry / front-run limit</span>
          </div>

          <div className="field-group">
            <label className="field-label">
              {trade.direction === 'long' ? 'Deep Dip Bottom Price' : 'Deep Wick Top Price'}
            </label>
            <input
              type="number"
              step="any"
              className="input-base"
              placeholder="e.g. 82250"
              value={endPrice}
              onChange={e => setEndPrice(e.target.value)}
            />
            <span className="field-hint">Deepest limit order in zone</span>
          </div>

          <div className="field-group">
            <label className="field-label">Number of Splits</label>
            <div className="stepper-wrap">
              {[2, 3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  type="button"
                  className={`btn-step-count ${parseInt(count, 10) === n ? 'active' : ''}`}
                  onClick={() => setCount(n.toString())}
                >
                  {n}
                </button>
              ))}
            </div>
            <span className="field-hint">Generates {count} scaled limit orders</span>
          </div>

          <div className="field-group">
            <label className="field-label">Sizing Model</label>
            <div className="sizing-model-badge">
              <span className="icon">⚖️</span>
              <div>
                <strong>Equal Risk Budget</strong>
                <p>Each layer risks identical dollar loss at Stop Loss</p>
              </div>
            </div>
          </div>
        </div>

        {/* Live Preview of the layers */}
        {previewLayers && (
          <div className="layer-preview-box">
            <div className="layer-preview-header">
              <span>Layer</span>
              <span>Limit Price</span>
              <span>Alloc (%)</span>
              <span>Risk</span>
            </div>
            <div className="layer-preview-rows">
              {previewLayers.map((l, i) => (
                <div key={i} className="layer-preview-row">
                  <span className="layer-id-tag">L{i + 1}</span>
                  <strong>{Number(l.price).toLocaleString()}</strong>
                  <span>{l.allocation}%</span>
                  <span className="text-success font-mono">Equal</span>
                </div>
              ))}
            </div>
            <div className="layer-preview-footer">
              <span>{previewLayers.length} Layers Total</span>
              <span>Sum Allocation: <strong>{parentAlloc}%</strong></span>
            </div>
          </div>
        )}

        <div className="modal-actions space-between">
          <div>
            {entry.isLayered && (
              <button
                type="button"
                className="btn-danger-outline btn-compact"
                onClick={handleFlatten}
                title="Remove layers and revert to single flat entry"
              >
                ↩ Flatten to Single Entry
              </button>
            )}
          </div>
          <div className="actions-right">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!previewLayers}
              onClick={handleApply}
            >
              {entry.isLayered ? 'Update Layers' : 'Apply Layers'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
