import React from 'react';
import { calculateScenario } from '../core/calculator-core.js';
import { formatSmartPrice } from '../services/market-data.js';

export default function FillScenario({ trade, planned, onChange }) {
  const scenario = trade.scenario || 'filled';
  const leverageNum = Number(trade.leverage) > 0 ? Number(trade.leverage) : 1;

  const scenarioResult = calculateScenario({
    plannedEntries: planned?.entries || [],
    scenario,
    leverage: leverageNum
  });

  const filledCount = trade.entries.filter(e => e.filled).length;

  const updateScenario = mode => {
    onChange({ ...trade, scenario: mode });
  };

  return (
    <section className="calc-panel">
      <div className="panel-header-row">
        <div>
          <h2>3. Fill Scenario Simulator</h2>
          <p className="panel-sub">Simulate position and risk outcomes based on which entries have filled.</p>
        </div>
        <span className="badge-pill">
          {scenario === 'filled' ? `${filledCount} of ${trade.entries.length} filled` : `All ${trade.entries.length} entries`}
        </span>
      </div>

      <div className="scenario-segmented">
        <button
          type="button"
          className={`scenario-btn ${scenario === 'filled' ? 'active' : ''}`}
          onClick={() => updateScenario('filled')}
        >
          Use Checked Entries Only ({filledCount} Filled)
        </button>
        <button
          type="button"
          className={`scenario-btn ${scenario === 'all' ? 'active' : ''}`}
          onClick={() => updateScenario('all')}
        >
          Assume All Entries Fill ({trade.entries.length} Total)
        </button>
      </div>

      <div className="scenario-mobile-summary-strip mobile-only-flex">
        <div className="m-summary-cell">
          <span className="m-summary-label">Active Size:</span>
          <strong className="m-summary-val">
            {scenarioResult.scenarioQty > 0
              ? `${Number(scenarioResult.scenarioQty).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${trade.symbol}`
              : '0 coins'}
          </strong>
        </div>
        <div className="m-summary-cell">
          <span className="m-summary-label">Notional:</span>
          <strong className="m-summary-val">
            ${Number(scenarioResult.scenarioNotional).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
        </div>
        <div className="m-summary-cell">
          <span className="m-summary-label">Avg Entry:</span>
          <strong className="m-summary-val">
            {scenarioResult.averageEntry != null ? `$${formatSmartPrice(scenarioResult.averageEntry)}` : '—'}
          </strong>
        </div>
      </div>

      <div className="metrics-summary-grid">
        <div className="metric-card">
          <span className="metric-label">Active Position Size</span>
          <strong className="metric-value">
            {scenarioResult.scenarioQty > 0
              ? `${Number(scenarioResult.scenarioQty).toLocaleString(undefined, { maximumFractionDigits: 6 })} coins`
              : '0 coins'}
          </strong>
        </div>

        <div className="metric-card">
          <span className="metric-label">Weighted Average Entry</span>
          <strong className="metric-value">
            {scenarioResult.averageEntry != null
              ? `$${formatSmartPrice(scenarioResult.averageEntry)}`
              : '—'}
          </strong>
        </div>

        <div className="metric-card">
          <span className="metric-label">Active Notional</span>
          <strong className="metric-value">
            ${Number(scenarioResult.scenarioNotional).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
        </div>

        <div className="metric-card">
          <span className="metric-label">Estimated Margin ({trade.leverage}×)</span>
          <strong className="metric-value">
            ${Number(scenarioResult.estimatedMargin).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
        </div>
      </div>

      <div className="risk-banner-card">
        <div className="risk-banner-top">
          <span className="risk-banner-title">Scenario Stop-Loss Risk</span>
          <strong className="risk-banner-amount">
            ${Number(scenarioResult.scenarioRisk).toFixed(2)} USDT
          </strong>
        </div>
        <div className="risk-banner-footnote">
          Planned all-entries risk: <strong>${Number(planned?.totalStopLossRisk || 0).toFixed(2)} USDT</strong>
          {' • '}
          Gross estimates (excludes funding &amp; exchange fees).
        </div>
      </div>
    </section>
  );
}
