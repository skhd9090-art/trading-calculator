import React, { useState, useEffect, useMemo } from 'react';
import PositionSetup from './components/PositionSetup.jsx';
import EntryOrders from './components/EntryOrders.jsx';
import FillScenario from './components/FillScenario.jsx';
import TakeProfit from './components/TakeProfit.jsx';
import SignalParserModal from './components/SignalParserModal.jsx';
import SetupsModal from './components/SetupsModal.jsx';
import {
  calculatePosition,
  validateTrade,
  calculateScenario,
  calculateTargetPnl,
  calculatePartialExitPnl
} from './core/calculator-core.js';
import {
  loadDraft,
  saveDraft,
  exportSetupToFile,
  INITIAL_TRADE,
  clone,
  getSavedSetups,
  saveNamedSetup,
  mergeSetupIntoTrade
} from './services/storage.js';

export default function App() {
  const [trade, setTrade] = useState(() => loadDraft());
  const [livePrice, setLivePrice] = useState(null);
  const [saveStatus, setSaveStatus] = useState('Saved locally');
  const [savedSetups, setSavedSetups] = useState(() => getSavedSetups());
  const [isParserOpen, setIsParserOpen] = useState(false);
  const [isSetupsOpen, setIsSetupsOpen] = useState(false);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [notification, setNotification] = useState('');

  // Mobile Hybrid state
  const [mobileTab, setMobileTab] = useState('setup'); // 'setup' | 'entries' | 'targets'
  const [isHudExpanded, setIsHudExpanded] = useState(false);
  const [mobileMode, setMobileMode] = useState('tabs'); // 'tabs' | 'continuous'

  const refreshSetups = () => {
    setSavedSetups(getSavedSetups());
  };



  // Debounced autosave
  useEffect(() => {
    setSaveStatus('Saving…');
    const timer = setTimeout(() => {
      const ok = saveDraft(trade);
      setSaveStatus(ok ? 'Saved locally' : 'Storage error');
    }, 250);
    return () => clearTimeout(timer);
  }, [trade]);

  // Dismiss notification after 5s
  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(''), 5000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  // Parse numeric values for validation & calculation, flattening layered entries if present
  const parsedEntries = useMemo(() => {
    const list = [];
    trade.entries.forEach(entry => {
      if (entry.isLayered && Array.isArray(entry.layers) && entry.layers.length > 0) {
        entry.layers.forEach((layer, layerIdx) => {
          list.push({
            ...layer,
            parentId: entry.id,
            isLayer: true,
            layerIndex: layerIdx,
            type: entry.type || 'limit',
            price: layer.price !== '' && Number.isFinite(Number(layer.price)) ? Number(layer.price) : null,
            allocationPercent: layer.allocation !== '' && Number.isFinite(Number(layer.allocation)) ? Number(layer.allocation) : null
          });
        });
      } else {
        list.push({
          ...entry,
          isLayer: false,
          price: entry.price !== '' && Number.isFinite(Number(entry.price)) ? Number(entry.price) : null,
          allocationPercent: entry.allocation !== '' && Number.isFinite(Number(entry.allocation)) ? Number(entry.allocation) : null
        });
      }
    });
    return list;
  }, [trade.entries]);

  const validation = useMemo(() => {
    return validateTrade({
      direction: trade.direction,
      entries: parsedEntries,
      stopLoss: trade.stopLoss !== '' && Number.isFinite(Number(trade.stopLoss)) ? Number(trade.stopLoss) : null,
      leverage: trade.leverage !== '' && Number.isFinite(Number(trade.leverage)) ? Number(trade.leverage) : null,
      riskBudget: trade.riskBudget !== '' && Number.isFinite(Number(trade.riskBudget)) ? Number(trade.riskBudget) : null,
      fixedSize: trade.fixedSize !== '' && Number.isFinite(Number(trade.fixedSize)) ? Number(trade.fixedSize) : null,
      allocationBasis: trade.allocationBasis,
      sizingMethod: trade.sizingMethod
    });
  }, [trade, parsedEntries]);

  const planned = useMemo(() => {
    if (!validation.valid) return null;
    try {
      return calculatePosition({
        direction: trade.direction,
        entries: parsedEntries,
        stopLoss: Number(trade.stopLoss),
        leverage: Number(trade.leverage) || 1,
        riskBudget: Number(trade.riskBudget),
        fixedSize: Number(trade.fixedSize),
        allocationBasis: trade.allocationBasis,
        sizingMethod: trade.sizingMethod
      });
    } catch (e) {
      return null;
    }
  }, [validation, trade, parsedEntries]);

  // Live Scenario and TP calculations for Mobile HUD
  const hudScenario = useMemo(() => {
    return calculateScenario({
      plannedEntries: planned?.entries || [],
      scenario: trade.scenario || 'filled',
      leverage: Number(trade.leverage) || 1
    });
  }, [planned, trade.scenario, trade.leverage]);

  const hudTpMetric = useMemo(() => {
    if (!planned || hudScenario.scenarioQty <= 0) return null;
    const activeEntries = hudScenario.entries;

    if (trade.exitMode === 'partial') {
      const targetRows = trade.targets.map(t => {
        const priceNum = t.price !== '' && Number.isFinite(Number(t.price)) ? Number(t.price) : null;
        const pnl = priceNum != null ? calculateTargetPnl({
          direction: trade.direction,
          entries: activeEntries,
          targetPrice: priceNum
        }) : null;
        const exitPercentNum = t.exit !== '' && Number.isFinite(Number(t.exit)) ? Number(t.exit) : null;
        return { ...t, priceNum, pnl, exitPercent: exitPercentNum };
      });
      return calculatePartialExitPnl({ targetRows });
    } else {
      const firstTarget = trade.targets.find(t => t.price !== '' && Number.isFinite(Number(t.price)));
      if (!firstTarget) return null;
      return calculateTargetPnl({
        direction: trade.direction,
        entries: activeEntries,
        targetPrice: Number(firstTarget.price)
      });
    }
  }, [planned, hudScenario, trade.exitMode, trade.targets, trade.direction]);


  // When live price is fetched, if first entry is Market and empty, populate it
  const handlePriceFetched = fetchedData => {
    setLivePrice(fetchedData);
    if (fetchedData && fetchedData.price) {
      setTrade(prev => {
        const first = prev.entries[0];
        if (first && first.type === 'market' && (!first.price || first.price === '')) {
          const updated = [...prev.entries];
          updated[0] = { ...first, price: fetchedData.price.toString() };
          return { ...prev, entries: updated };
        }
        return prev;
      });
    }
  };

  const handleApplyParsedTrade = parsedData => {
    setTrade(prev => {
      const next = clone(prev);
      if (parsedData.symbol) next.symbol = parsedData.symbol;
      if (parsedData.direction) next.direction = parsedData.direction;
      if (parsedData.leverage) next.leverage = parsedData.leverage.toString();
      if (parsedData.stopLoss != null) next.stopLoss = parsedData.stopLoss.toString();

      if (Array.isArray(parsedData.entries) && parsedData.entries.length > 0) {
        next.entries = parsedData.entries.map((e, idx) => ({
          id: idx + 1,
          price: e.price != null ? e.price.toString() : '',
          type: e.type || 'limit',
          allocation: e.allocation != null ? e.allocation.toString() : '',
          filled: e.filled ?? (idx === 0)
        }));
      }

      if (Array.isArray(parsedData.takeProfits) && parsedData.takeProfits.length > 0) {
        next.targets = parsedData.takeProfits.map((tp, idx) => ({
          id: idx + 1,
          price: tp.price != null ? tp.price.toString() : '',
          label: tp.label || `TP${idx + 1}`,
          exit: tp.exit != null ? tp.exit.toString() : ''
        }));
      }

      return next;
    });

    setNotification(`Applied ${parsedData.symbol || 'trade'} signal to calculator!`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoadSetup = loadedSetup => {
    const nextTrade = mergeSetupIntoTrade(trade, loadedSetup);
    setTrade(nextTrade);
    const scopeLabel = loadedSetup.scope === 'position' ? 'position setup' : 'full trade setup';
    const setupName = loadedSetup.name || loadedSetup.trade?.symbol || 'setup';
    setNotification(`Loaded ${scopeLabel} "${setupName}"!`);
    refreshSetups();
  };

  const handleLoadSetupById = id => {
    const found = savedSetups.find(s => s.id === id);
    if (found) {
      handleLoadSetup(found);
    }
  };

  const handleQuickSave = (scope = 'position') => {
    const defaultName = `${trade.symbol || 'Trade'} ${trade.direction.toUpperCase()} (${scope === 'position' ? `${trade.entries.length} entries` : 'Full Plan'})`;
    const promptMsg = scope === 'position'
      ? 'Enter a name to save this position setup (coin, leverage, sizing & entries) locally in your browser:'
      : 'Enter a name to save this full setup (including Take-Profit targets) locally in your browser:';
    const entered = window.prompt(promptMsg, defaultName);
    if (!entered || !entered.trim()) return;

    const saved = saveNamedSetup(entered.trim(), trade, scope);
    if (saved) {
      refreshSetups();
      setNotification(`Saved ${scope === 'position' ? 'position setup' : 'full setup'} "${saved.name}" to browser storage!`);
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset calculator to default BTC setup?')) {
      setTrade(clone(INITIAL_TRADE));
      setNotification('Reset calculator to defaults.');
    }
  };

  const { filledCount, totalEntriesCount } = useMemo(() => {
    let filled = 0;
    let total = 0;
    trade.entries.forEach(e => {
      if (e.isLayered && Array.isArray(e.layers)) {
        total += e.layers.length;
        filled += e.layers.filter(l => l.filled).length;
      } else {
        total += 1;
        if (e.filled) filled += 1;
      }
    });
    return { filledCount: filled, totalEntriesCount: total };
  }, [trade.entries]);
  const targetsCount = trade.targets.length;

  const handleTabSelect = tabKey => {
    setMobileTab(tabKey);
    if (mobileMode === 'continuous') {
      const el = document.querySelector(`.panel-section-${tabKey}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="beta-app-container">
      <header className="app-top-header">
        <div className="header-brand-line">
          <div className="brand-titles">
            <div className="badge-row">
              <span className="pill-beta">BETA</span>
              <span className="save-status-text">💾 {saveStatus}</span>
            </div>
            <h1 className="desktop-brand-title">Multi-Entry Fill Simulator</h1>
            <h1 className="mobile-brand-title">⚡ Trading Calc</h1>
            <p className="app-subtitle desktop-only-text">
              Sizing, fill scenarios, partial targets &amp; Groq AI Telegram parser
            </p>
          </div>

          <div className="header-nav-actions">
            <button
              type="button"
              className="btn-action-primary"
              onClick={() => setIsParserOpen(true)}
            >
              🤖 <span className="btn-label-text">Parse Signal</span>
            </button>
            <button
              type="button"
              className="btn-action-outline"
              onClick={() => {
                refreshSetups();
                setIsSetupsOpen(true);
              }}
            >
              📁 <span className="btn-label-text">Setups ({savedSetups.length})</span>
            </button>
            <a href="../" className="btn-action-nav" title="Switch to Classic Single-Entry Calculator">
              ← <span className="btn-label-text">Classic App</span>
            </a>
          </div>
        </div>

        {notification && (
          <div className="top-notification-banner">
            <span>{notification}</span>
            <button type="button" onClick={() => setNotification('')}>✕</button>
          </div>
        )}
      </header>

      {/* Mobile Stepped Tab Navigation (Hidden on desktop via CSS) */}
      <nav className="mobile-hybrid-nav" aria-label="Calculation steps">
        <div className="mobile-tabs-container">
          <button
            type="button"
            className={`m-tab-btn ${mobileTab === 'setup' ? 'active' : ''}`}
            onClick={() => handleTabSelect('setup')}
          >
            <span className="tab-pill-num">1</span>
            <span className="tab-pill-title">Setup</span>
            <span className="tab-pill-sub">{trade.symbol} • {trade.leverage}x</span>
          </button>

          <button
            type="button"
            className={`m-tab-btn ${mobileTab === 'entries' ? 'active' : ''}`}
            onClick={() => handleTabSelect('entries')}
          >
            <span className="tab-pill-num">2</span>
            <span className="tab-pill-title">Entries</span>
            <span className="tab-pill-sub">{filledCount}/{totalEntriesCount} filled</span>
          </button>

          <button
            type="button"
            className={`m-tab-btn ${mobileTab === 'targets' ? 'active' : ''}`}
            onClick={() => handleTabSelect('targets')}
          >
            <span className="tab-pill-num">3</span>
            <span className="tab-pill-title">Targets</span>
            <span className="tab-pill-sub">{targetsCount} TPs</span>
          </button>
        </div>
      </nav>

      <main className={`app-main-content mobile-mode-${mobileMode} active-tab-${mobileTab}`}>
        {/* Section 1: Position Setup */}
        <div className="panel-section-wrap panel-section-setup">
          <PositionSetup
            trade={trade}
            onChange={setTrade}
            onPriceFetched={handlePriceFetched}
            savedSetups={savedSetups}
            onLoadSetupById={handleLoadSetupById}
            onQuickSave={handleQuickSave}
            onOpenSetupsModal={() => {
              refreshSetups();
              setIsSetupsOpen(true);
            }}
          />
          <div className="mobile-step-nav">
            <button
              type="button"
              className="btn-primary full-width"
              onClick={() => {
                setMobileTab('entries');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              Continue to Entries Ladder (2/3) →
            </button>
          </div>
        </div>

        {/* Section 2 & 3: Entry Orders & Fill Scenario */}
        <div className="panel-section-wrap panel-section-entries">
          <EntryOrders
            trade={trade}
            planned={planned}
            validation={validation}
            livePrice={livePrice}
            onChange={setTrade}
          />

          <FillScenario
            trade={trade}
            planned={planned}
            onChange={setTrade}
          />

          <div className="mobile-step-nav dual">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setMobileTab('setup');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              ← Setup
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setMobileTab('targets');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              Next: Targets (3/3) →
            </button>
          </div>
        </div>

        {/* Section 4: Take-Profit Targets */}
        <div className="panel-section-wrap panel-section-targets">
          <TakeProfit
            trade={trade}
            planned={planned}
            onChange={setTrade}
          />

          <div className="mobile-step-nav dual">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setMobileTab('entries');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              ← Entries
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => handleQuickSave('full')}
            >
              💾 Save Setup
            </button>
          </div>
        </div>

        {/* Footer controls: assumptions & JSON export */}
        <section className="calc-panel footer-control-panel">
          <button
            type="button"
            className="btn-link"
            onClick={() => setShowAssumptions(prev => !prev)}
          >
            {showAssumptions ? '▲ Hide Calculation Assumptions' : '▼ Show Calculation Assumptions'}
          </button>

          {showAssumptions && (
            <div className="assumptions-box">
              <p>
                <strong>USDT Notional Sizing:</strong> Total notional is calculated as risk budget divided by the sum of each entry's weighted stop distance divided by its price.
              </p>
              <p>
                <strong>Quantity Sizing:</strong> Total quantity is calculated as risk budget divided by the weighted average stop distance.
              </p>
              <p>
                <strong>Leverage &amp; Margin:</strong> Estimated margin is Notional divided by Leverage. Leverage does not alter gross P&amp;L or stop dollar risk.
              </p>
              <p>
                <strong>Fill Scenarios:</strong> Unchecked entries are excluded from active calculations without distorting planned percentage allocations.
              </p>
            </div>
          )}

          <div className="footer-quick-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => exportSetupToFile(trade)}
            >
              📤 Export Current JSON
            </button>
            <button
              type="button"
              className="btn-secondary btn-danger-text"
              onClick={handleReset}
            >
              🔄 Reset to Defaults
            </button>
          </div>
        </section>
      </main>

      {/* Sticky Bottom Live HUD (Mobile only, hidden on desktop via CSS) */}
      <aside className="mobile-sticky-hud" aria-label="Live position and profit summary">
        <div
          className="hud-collapsed-bar"
          onClick={() => setIsHudExpanded(prev => !prev)}
          role="button"
          tabIndex={0}
        >
          <div className="hud-metric-cell">
            <span className="hud-metric-label">⚡ Margin</span>
            <strong className="hud-metric-val">
              {hudScenario.estimatedMargin ? `$${hudScenario.estimatedMargin.toFixed(2)}` : '—'}
            </strong>
          </div>

          <div className="hud-divider"></div>

          <div className="hud-metric-cell">
            <span className="hud-metric-label">🛡️ Risk</span>
            <strong className="hud-metric-val text-danger">
              {hudScenario.scenarioRisk ? `$${hudScenario.scenarioRisk.toFixed(2)}` : '—'}
            </strong>
          </div>

          <div className="hud-divider"></div>

          <div className="hud-metric-cell highlight">
            <span className="hud-metric-label">
              {trade.exitMode === 'partial' ? '🎯 Blended TP' : '🎯 TP1 Target'}
            </span>
            <strong
              className={`hud-metric-val ${
                hudTpMetric == null ? '' : hudTpMetric >= 0 ? 'text-success' : 'text-danger'
              }`}
            >
              {hudTpMetric == null
                ? '—'
                : `${hudTpMetric >= 0 ? '+' : ''}$${hudTpMetric.toFixed(2)}`}
            </strong>
          </div>

          <button
            type="button"
            className="hud-toggle-btn"
            title={isHudExpanded ? 'Collapse breakdown' : 'Expand full live breakdown'}
            onClick={e => {
              e.stopPropagation();
              setIsHudExpanded(prev => !prev);
            }}
          >
            {isHudExpanded ? '▼' : '▲'}
          </button>
        </div>

        {isHudExpanded && (
          <div className="hud-drawer-panel">
            <div className="hud-drawer-header">
              <span className="hud-drawer-title">
                📊 Live Breakdown ({trade.scenario === 'all' ? 'All Planned' : 'Filled Only'})
              </span>
              <button
                type="button"
                className="btn-tiny"
                onClick={() => setIsHudExpanded(false)}
              >
                ✕ Close
              </button>
            </div>

            <div className="hud-drawer-grid">
              <div className="hud-drawer-item">
                <span className="d-label">Token &amp; Direction:</span>
                <strong>{trade.symbol} • {trade.direction.toUpperCase()} ({trade.leverage}x)</strong>
              </div>
              <div className="hud-drawer-item">
                <span className="d-label">Average Entry:</span>
                <strong>{hudScenario.averageEntry ? `$${hudScenario.averageEntry.toFixed(2)}` : '—'}</strong>
              </div>
              <div className="hud-drawer-item">
                <span className="d-label">Active Position Qty:</span>
                <strong>{hudScenario.scenarioQty ? hudScenario.scenarioQty.toFixed(4) : '—'} {trade.symbol}</strong>
              </div>
              <div className="hud-drawer-item">
                <span className="d-label">Active Notional:</span>
                <strong>{hudScenario.scenarioNotional ? `$${hudScenario.scenarioNotional.toFixed(2)} USDT` : '—'}</strong>
              </div>
              <div className="hud-drawer-item">
                <span className="d-label">Estimated Margin:</span>
                <strong>{hudScenario.estimatedMargin ? `$${hudScenario.estimatedMargin.toFixed(2)} USDT` : '—'}</strong>
              </div>
              <div className="hud-drawer-item">
                <span className="d-label">Scenario Stop Risk:</span>
                <strong className="text-danger">
                  {hudScenario.scenarioRisk ? `$${hudScenario.scenarioRisk.toFixed(2)} USDT` : '—'}
                </strong>
              </div>
              <div className="hud-drawer-item">
                <span className="d-label">Planned Total Risk:</span>
                <strong>
                  {planned?.totalStopLossRisk ? `$${planned.totalStopLossRisk.toFixed(2)} USDT` : '—'}
                </strong>
              </div>
              <div className="hud-drawer-item highlight-item">
                <span className="d-label">Profit Target:</span>
                <strong className={hudTpMetric >= 0 ? 'text-success' : 'text-danger'}>
                  {hudTpMetric != null
                    ? `${hudTpMetric >= 0 ? '+' : ''}$${hudTpMetric.toFixed(2)} USDT`
                    : '—'}
                </strong>
              </div>
            </div>
          </div>
        )}
      </aside>


      <footer className="app-footer">
        <p>Private Trading Tool • Gross estimates exclude exchange fees, funding &amp; slippage • No trades are placed</p>
        <div className="footer-links">
          <a href="../">Classic Single-Entry Calculators</a>
          <span>•</span>
          <a href="https://github.com/skhd9090-art/trading-calculator" target="_blank" rel="noopener noreferrer">
            GitHub Repository ↗
          </a>
        </div>
      </footer>

      <SignalParserModal
        isOpen={isParserOpen}
        onClose={() => setIsParserOpen(false)}
        onApplyParsedTrade={handleApplyParsedTrade}
      />

      <SetupsModal
        isOpen={isSetupsOpen}
        onClose={() => {
          setIsSetupsOpen(false);
          refreshSetups();
        }}
        currentTrade={trade}
        onLoadSetup={handleLoadSetup}
      />
    </div>
  );
}
