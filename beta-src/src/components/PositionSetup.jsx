import React, { useState } from 'react';
import TokenSelector from './TokenSelector.jsx';

export default function PositionSetup({
  trade,
  onChange,
  onPriceFetched,
  savedSetups = [],
  activeSetupId = null,
  activeSetup = null,
  onLoadSetupById,
  onSaveCurrent,
  onSaveAs,
  onUnlinkSetup,
  onOpenSetupsModal
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const update = (key, value) => onChange({ ...trade, [key]: value });

  return (
    <section className="calc-panel position-setup-panel">
      <div className="panel-header-row">
        <div>
          <h2>1. Position Setup</h2>
          <p className="panel-sub">Configure token, leverage, direction and sizing method.</p>
        </div>
        <div className="panel-header-actions">
          {activeSetup ? (
            <>
              <button
                type="button"
                className="btn-quick-setup btn-quick-setup-save"
                onClick={() => onSaveCurrent()}
                title={`Overwrite & update "${activeSetup.name}" with current changes`}
              >
                💾 Save
              </button>
              <button
                type="button"
                className="btn-quick-setup btn-quick-setup-secondary"
                onClick={() => onSaveAs(activeSetup.scope || 'position')}
                title="Save as a new distinct setup with a new name"
              >
                📑 Save As...
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn-quick-setup"
                onClick={() => onSaveAs('position')}
                title="Save position setup (coin, leverage, sizing & entries) to browser storage"
              >
                💾 Save Position Only
              </button>
              <button
                type="button"
                className="btn-quick-setup btn-quick-setup-secondary"
                onClick={() => onSaveAs('full')}
                title="Save complete trade setup including take-profit targets to browser storage"
              >
                📋 Save Full Setup
              </button>
            </>
          )}
        </div>
      </div>

      <div className="quick-setups-banner">
        <div className="quick-setups-left">
          <span className="quick-setups-title">📂 Setups:</span>
          <select
            className="select-base quick-setup-select"
            value={activeSetupId || ''}
            onChange={e => {
              if (e.target.value === '__new__') {
                onUnlinkSetup?.();
              } else if (e.target.value) {
                onLoadSetupById(e.target.value);
              }
            }}
          >
            <option value="" disabled={Boolean(activeSetupId)}>
              {activeSetup
                ? `Active: ${activeSetup.name}`
                : savedSetups.length > 0
                ? `Saved Setups (${savedSetups.length})...`
                : 'No saved setups yet'}
            </option>
            {savedSetups.map(s => (
              <option key={s.id} value={s.id}>
                {s.id === activeSetupId ? '✓ ' : ''}{s.scope === 'position' ? '🎯 [Pos] ' : '📋 [Full] '}
                {s.name} ({s.trade?.symbol || 'Trade'} {s.trade?.direction?.toUpperCase()})
              </option>
            ))}
            {activeSetupId && <option value="__new__">＋ Start New / Unlink</option>}
          </select>

          {activeSetup && (
            <div className="active-setup-indicator">
              <span className="active-setup-pill">
                Editing: <strong>{activeSetup.name}</strong> ({activeSetup.scope === 'position' ? 'Pos' : 'Full'})
              </span>
              <button
                type="button"
                className="btn-tiny-unlink"
                title="Unlink from this setup (future saves will prompt for a new name)"
                onClick={onUnlinkSetup}
              >
                ✕ Unlink
              </button>
            </div>
          )}
        </div>
        <div className="quick-setups-right">
          <button
            type="button"
            className="btn-link-action"
            onClick={onOpenSetupsModal}
          >
            Manage ({savedSetups.length}) →
          </button>
        </div>
      </div>

      <div className="setup-compact-grid">
        <div className="setup-token-col">
          <TokenSelector
            symbol={trade.symbol}
            onSelectSymbol={val => update('symbol', val)}
            onPriceFetched={onPriceFetched}
          />
        </div>
        <div className="field-group setup-leverage-col">
          <label className="field-label">Leverage</label>
          <div className="leverage-input-wrapper">
            <input
              type="number"
              min="1"
              max="125"
              step="any"
              className="input-base"
              value={trade.leverage}
              onChange={e => update('leverage', e.target.value)}
            />
            <span className="leverage-unit">×</span>
          </div>
        </div>
      </div>

      <div className="direction-save-row">
        <div className="segmented-control flex-1">
          <button
            type="button"
            className={`seg-btn ${trade.direction === 'long' ? 'active long' : ''}`}
            onClick={() => update('direction', 'long')}
          >
            ▲ Long
          </button>
          <button
            type="button"
            className={`seg-btn ${trade.direction === 'short' ? 'active short' : ''}`}
            onClick={() => update('direction', 'short')}
          >
            ▼ Short
          </button>
        </div>
        {activeSetup ? (
          <div className="mobile-save-btn-group mobile-only-flex">
            <button
              type="button"
              className="btn-quick-save-pill btn-quick-save-overwrite"
              onClick={() => onSaveCurrent()}
              title={`Overwrite & update "${activeSetup.name}" with current changes`}
            >
              💾 Save
            </button>
            <button
              type="button"
              className="btn-quick-save-pill btn-quick-save-as"
              onClick={() => onSaveAs(activeSetup.scope || 'position')}
              title="Save as a new copy"
            >
              📑 Save As
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn-quick-save-pill mobile-only-inline"
            onClick={() => onSaveAs('position')}
            title="Save this position setup"
          >
            💾 Save
          </button>
        )}
      </div>

      <div className="two-col-grid risk-stop-row">
        {trade.sizingMethod === 'risk' ? (
          <div className="field-group">
            <label className="field-label">Risk Budget (USDT)</label>
            <input
              type="number"
              min="0"
              step="any"
              className="input-base"
              placeholder="e.g. 100"
              value={trade.riskBudget}
              onChange={e => update('riskBudget', e.target.value)}
            />
          </div>
        ) : (
          <div className="field-group">
            <label className="field-label">
              {trade.allocationBasis === 'notional' ? 'Total Notional (USDT)' : 'Total Quantity (Coins)'}
            </label>
            <input
              type="number"
              min="0"
              step="any"
              className="input-base"
              placeholder="e.g. 1000"
              value={trade.fixedSize}
              onChange={e => update('fixedSize', e.target.value)}
            />
          </div>
        )}

        <div className="field-group">
          <label className="field-label">Stop-Loss Price</label>
          <input
            type="number"
            min="0"
            step="any"
            className="input-base"
            placeholder="e.g. 59000"
            value={trade.stopLoss}
            onChange={e => update('stopLoss', e.target.value)}
          />
        </div>
      </div>

      <div className="advanced-sizing-section">
        <button
          type="button"
          className="btn-toggle-advanced mobile-only-block"
          onClick={() => setShowAdvanced(prev => !prev)}
        >
          <span>⚙️ Advanced Sizing ({trade.allocationBasis === 'notional' ? 'USDT %' : 'Coin %'} • {trade.sizingMethod === 'risk' ? 'Risk Budget' : 'Fixed'})</span>
          <span>{showAdvanced ? '▲' : '▼'}</span>
        </button>

        <div className={`advanced-sizing-content ${showAdvanced ? 'is-open' : ''}`}>
          <div className="field-group">
            <label className="field-label">Allocation Basis</label>
            <div className="radio-pill-group">
              <label className={`radio-pill ${trade.allocationBasis === 'notional' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="allocationBasis"
                  checked={trade.allocationBasis === 'notional'}
                  onChange={() => update('allocationBasis', 'notional')}
                />
                <span>USDT Notional (%)</span>
              </label>
              <label className={`radio-pill ${trade.allocationBasis === 'quantity' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="allocationBasis"
                  checked={trade.allocationBasis === 'quantity'}
                  onChange={() => update('allocationBasis', 'quantity')}
                />
                <span>Token Quantity (%)</span>
              </label>
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">Position Sizing Method</label>
            <div className="radio-pill-group">
              <label className={`radio-pill ${trade.sizingMethod === 'risk' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="sizingMethod"
                  checked={trade.sizingMethod === 'risk'}
                  onChange={() => update('sizingMethod', 'risk')}
                />
                <span>Calculate from Risk Budget</span>
              </label>
              <label className={`radio-pill ${trade.sizingMethod === 'fixed' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="sizingMethod"
                  checked={trade.sizingMethod === 'fixed'}
                  onChange={() => update('sizingMethod', 'fixed')}
                />
                <span>Specify Total Position Size</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
