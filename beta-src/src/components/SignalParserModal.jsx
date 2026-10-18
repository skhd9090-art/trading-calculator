import React, { useState, useEffect } from 'react';
import {
  parseSignalWithGroq,
  fetchGroqModels,
  getStoredApiKey,
  setStoredApiKey,
  getStoredModel,
  setStoredModel,
  DEFAULT_GROQ_MODELS
} from '../services/groq-client.js';

const SIGNAL_EXAMPLES = [
  {
    name: 'BCH Multi-Entry',
    text: `#BCH/USDT LONG
Market 277 Taken 30%
Limit 2 $257.8 30%
Limit 3 $246 40%
SL: $240.6 (@-7% wider than usual SL)
T: $291 - $377 - $610`
  },
  {
    name: 'LINK CMP Range',
    text: `Long $LINK
Entry: CMP 12.71 — 12.15
SL: 11.88 -4.2%
TP: 12.99 13.8`
  },
  {
    name: 'BTC Range (3 Entries)',
    text: `LONG BTCUSDT
Entry range: 81500–80500, 3 entries
SL 79000
TP1 83000
TP2 84500`
  }
];

export default function SignalParserModal({ isOpen, onClose, onApplyParsedTrade }) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('llama-3.3-70b-versatile');
  const [availableModels, setAvailableModels] = useState(DEFAULT_GROQ_MODELS);
  const [customModelMode, setCustomModelMode] = useState(false);
  const [signalText, setSignalText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [error, setError] = useState('');
  const [parsedResult, setParsedResult] = useState(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const savedKey = getStoredApiKey();
    let savedModel = getStoredModel();
    if (savedModel && savedModel.includes('prompt-guard')) {
      savedModel = 'llama-3.3-70b-versatile';
      setStoredModel(savedModel);
    }
    setApiKey(savedKey);
    setModel(savedModel);

    if (savedKey) {
      fetchGroqModels(savedKey).then(list => {
        if (list && list.length > 0) setAvailableModels(list);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveApiKey = newKey => {
    setApiKey(newKey);
    setStoredApiKey(newKey);
    if (newKey) {
      refreshModels(newKey);
    }
  };

  const handleSelectModel = newModel => {
    if (newModel === '__custom__') {
      setCustomModelMode(true);
      return;
    }
    setModel(newModel);
    setStoredModel(newModel);
  };

  const refreshModels = async (keyToUse) => {
    setIsLoadingModels(true);
    try {
      const list = await fetchGroqModels(keyToUse || apiKey);
      if (list && list.length > 0) {
        setAvailableModels(list);
        // If current model is not in list and not custom, pick first recommended
        if (!list.some(m => m.id === model) && !customModelMode) {
          const rec = list.find(m => m.id === 'llama-3.3-70b-versatile' || m.id.includes('70b') || m.id.includes('120b')) || list[0];
          if (rec) {
            setModel(rec.id);
            setStoredModel(rec.id);
          }
        }
      }
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleParse = async () => {
    setError('');
    setParsedResult(null);
    if (!apiKey) {
      setError('Please provide a Groq API Key first.');
      return;
    }
    if (!signalText.trim()) {
      setError('Please paste a trading signal in the box below.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await parseSignalWithGroq({
        signalText,
        apiKey,
        model
      });

      if (!res.success) {
        setError(res.error);
      } else {
        setParsedResult(res.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (!parsedResult) return;
    onApplyParsedTrade(parsedResult);
    onClose();
  };

  // Group models by category
  const categories = {};
  availableModels.forEach(m => {
    const cat = m.category || 'Other Models';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(m);
  });

  const isPromptGuard = model.toLowerCase().includes('prompt-guard');

  return (
    <div className="modal-backdrop">
      <div className="modal-card parser-modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <h3>🤖 AI Telegram Signal Parser</h3>
            <span className="badge-pill">Powered by Groq</span>
          </div>
          <button type="button" className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="parser-config-bar">
          <div className="field-group flex-1">
            <div className="label-with-action">
              <label className="field-label">Groq API Key (Saved in browser)</label>
              <button
                type="button"
                className="btn-tiny"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              type={showKey ? 'text' : 'password'}
              className="input-base"
              placeholder="gsk_..."
              value={apiKey}
              onChange={e => handleSaveApiKey(e.target.value)}
            />
          </div>

          <div className="field-group flex-1">
            <div className="label-with-action">
              <label className="field-label">Model ({availableModels.length} available)</label>
              <div className="mini-actions-row">
                <button
                  type="button"
                  className="btn-tiny"
                  onClick={() => setCustomModelMode(!customModelMode)}
                >
                  {customModelMode ? 'List' : 'Custom'}
                </button>
                <button
                  type="button"
                  className="btn-tiny"
                  disabled={isLoadingModels}
                  onClick={() => refreshModels()}
                >
                  {isLoadingModels ? '…' : 'Refresh'}
                </button>
              </div>
            </div>

            {customModelMode ? (
              <input
                type="text"
                className="input-base"
                placeholder="Enter exact Groq model ID (e.g. openai/gpt-oss-120b)"
                value={model}
                onChange={e => {
                  setModel(e.target.value);
                  setStoredModel(e.target.value);
                }}
              />
            ) : (
              <select
                className="input-base select-base"
                value={model}
                onChange={e => handleSelectModel(e.target.value)}
              >
                {Object.entries(categories).map(([category, items]) => (
                  <optgroup key={category} label={category}>
                    {items.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name || m.id}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value="__custom__">➕ Type Custom Model ID…</option>
              </select>
            )}
          </div>
        </div>

        {isPromptGuard && (
          <div className="modal-warning-banner">
            ⚠️ <strong>Notice:</strong> <code>{model}</code> is a moderation guardrail classifier, not a chat reasoning model. For signal parsing, select a chat model like <strong>llama-3.3-70b-versatile</strong>, <strong>openai/gpt-oss-120b</strong>, or <strong>qwen/qwen3.8-27b</strong>.
          </div>
        )}

        <div className="quick-examples-row">
          <span className="examples-label">Try example:</span>
          {SIGNAL_EXAMPLES.map((ex, idx) => (
            <button
              key={idx}
              type="button"
              className="btn-example-chip"
              onClick={() => {
                setSignalText(ex.text);
                setError('');
                setParsedResult(null);
              }}
            >
              {ex.name}
            </button>
          ))}
        </div>

        <div className="field-group">
          <label className="field-label">Paste Telegram / Discord Signal</label>
          <textarea
            className="input-base textarea-base"
            rows="5"
            placeholder="Paste your raw crypto trade signal here..."
            value={signalText}
            onChange={e => setSignalText(e.target.value)}
          />
        </div>

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={isLoading || !signalText.trim()}
            onClick={handleParse}
          >
            {isLoading ? '⏳ Parsing with Groq…' : '⚡ Extract & Validate Signal'}
          </button>
        </div>

        {parsedResult && (
          <div className="parsed-preview-panel">
            <div className="preview-header">
              <h4>Extracted Signal Preview</h4>
              <span className="badge-pill pill-success">Validated JSON</span>
            </div>

            <div className="preview-meta-grid">
              <div>
                <span className="p-label">Symbol:</span>
                <strong>{parsedResult.symbol || 'Unknown'}</strong>
              </div>
              <div>
                <span className="p-label">Direction:</span>
                <strong className={parsedResult.direction === 'long' ? 'text-success' : 'text-danger'}>
                  {parsedResult.direction ? parsedResult.direction.toUpperCase() : 'Unknown'}
                </strong>
              </div>
              <div>
                <span className="p-label">Stop-Loss:</span>
                <strong>{parsedResult.stopLoss ? `$${parsedResult.stopLoss}` : 'None'}</strong>
              </div>
              <div>
                <span className="p-label">Targets:</span>
                <strong>{parsedResult.takeProfits?.length || 0} levels</strong>
              </div>
            </div>

            <div className="preview-entries-table">
              <h5>Extracted Entries ({parsedResult.entries?.length || 0})</h5>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Type</th>
                    <th>Price</th>
                    <th>Planned Alloc</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedResult.entries?.map((e, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{e.type.toUpperCase()}</td>
                      <td>{e.price != null ? `$${e.price}` : 'CMP (Market)'}</td>
                      <td>{e.allocation != null ? `${e.allocation}%` : 'Equal'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {parsedResult.ambiguities?.length > 0 && (
              <div className="preview-warning-box">
                <strong>Ambiguities:</strong>
                <ul>
                  {parsedResult.ambiguities.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}

            {parsedResult.validation_warnings?.length > 0 && (
              <div className="preview-warning-box">
                <strong>Warnings:</strong>
                <ul>
                  {parsedResult.validation_warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="apply-action-bar">
              <button type="button" className="btn-success full-width" onClick={handleApply}>
                📥 Apply This Signal to Calculator
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
