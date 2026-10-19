import React, { useState, useEffect, useMemo } from 'react';
import PositionSetup from './components/PositionSetup.jsx';
import EntryOrders from './components/EntryOrders.jsx';
import FillScenario from './components/FillScenario.jsx';
import TakeProfit from './components/TakeProfit.jsx';
import SignalParserModal from './components/SignalParserModal.jsx';
import SetupsModal from './components/SetupsModal.jsx';
import { calculatePosition, validateTrade } from './core/calculator-core.js';
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

  // Parse numeric values for validation & calculation
  const parsedEntries = useMemo(() => {
    return trade.entries.map(e => ({
      ...e,
      price: e.price !== '' && Number.isFinite(Number(e.price)) ? Number(e.price) : null,
      allocationPercent: e.allocation !== '' && Number.isFinite(Number(e.allocation)) ? Number(e.allocation) : null
    }));
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

  return (
    <div className="beta-app-container">
      <header className="app-top-header">
        <div className="header-brand-line">
          <div className="brand-titles">
            <div className="badge-row">
              <span className="pill-beta">BETA</span>
              <span className="save-status-text">💾 {saveStatus}</span>
            </div>
            <h1>Multi-Entry Fill Simulator</h1>
            <p className="app-subtitle">
              Sizing, fill scenarios, partial targets &amp; Groq AI Telegram parser
            </p>
          </div>

          <div className="header-nav-actions">
            <button
              type="button"
              className="btn-action-primary"
              onClick={() => setIsParserOpen(true)}
            >
              🤖 Parse Signal
            </button>
            <button
              type="button"
              className="btn-action-outline"
              onClick={() => {
                refreshSetups();
                setIsSetupsOpen(true);
              }}
            >
              📁 Setups ({savedSetups.length})
            </button>
            <a href="../" className="btn-action-nav" title="Switch to Classic Single-Entry Calculator">
              ← Classic App
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

      <main className="app-main-content">
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

        <TakeProfit
          trade={trade}
          planned={planned}
          onChange={setTrade}
        />

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
