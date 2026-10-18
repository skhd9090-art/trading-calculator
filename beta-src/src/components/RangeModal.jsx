import React, { useState } from 'react';
import { expandRange, equalAllocations } from '../core/calculator-core.js';

export default function RangeModal({ isOpen, onClose, onApplyRange, currentDirection }) {
  const [lowerPrice, setLowerPrice] = useState('');
  const [upperPrice, setUpperPrice] = useState('');
  const [count, setCount] = useState('3');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleGenerate = () => {
    setError('');
    const low = Number(lowerPrice);
    const high = Number(upperPrice);
    const n = parseInt(count, 10);

    if (!Number.isFinite(low) || low <= 0 || !Number.isFinite(high) || high <= 0) {
      setError('Please provide valid positive lower and upper prices.');
      return;
    }
    if (low >= high) {
      setError('Lower price must be strictly less than upper price.');
      return;
    }
    if (!Number.isInteger(n) || n < 2 || n > 20) {
      setError('Entry count must be an integer between 2 and 20.');
      return;
    }

    try {
      // If short, order entries from highest to lowest or preserve
      const prices = expandRange(low, high, n);
      // For short positions, limit entries are often hit going up; for long, going down
      // Let's sort descending for long (buying dips) or ascending for short
      if (currentDirection === 'long') {
        prices.sort((a, b) => b - a); // Buy highest to lowest (CMP down to limits)
      } else {
        prices.sort((a, b) => a - b); // Sell lowest to highest
      }

      const allocations = equalAllocations(n);
      const generatedEntries = prices.map((price, i) => ({
        id: Date.now() + i,
        price: price.toString(),
        allocation: allocations[i].toFixed(2),
        type: i === 0 ? 'market' : 'limit',
        filled: i === 0
      }));

      onApplyRange(generatedEntries);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3>⚡ Generate Entry Range</h3>
          <button type="button" className="btn-close" onClick={onClose}>✕</button>
        </div>
        <p className="modal-desc">
          Generate evenly spaced entry price levels across a range with equal allocations.
        </p>

        {error && <div className="modal-error">{error}</div>}

        <div className="range-inputs-grid">
          <div className="field-group">
            <label className="field-label">Lower Price</label>
            <input
              type="number"
              step="any"
              className="input-base"
              placeholder="e.g. 11.0"
              value={lowerPrice}
              onChange={e => setLowerPrice(e.target.value)}
            />
          </div>
          <div className="field-group">
            <label className="field-label">Upper Price</label>
            <input
              type="number"
              step="any"
              className="input-base"
              placeholder="e.g. 13.0"
              value={upperPrice}
              onChange={e => setUpperPrice(e.target.value)}
            />
          </div>
          <div className="field-group">
            <label className="field-label">Number of Entries</label>
            <input
              type="number"
              min="2"
              max="20"
              className="input-base"
              value={count}
              onChange={e => setCount(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleGenerate}>Generate &amp; Replace</button>
        </div>
      </div>
    </div>
  );
}
