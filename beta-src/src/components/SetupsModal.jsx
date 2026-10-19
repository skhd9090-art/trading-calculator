import React, { useState, useEffect } from 'react';
import {
  getSavedSetups,
  saveNamedSetup,
  deleteNamedSetup,
  duplicateNamedSetup,
  renameNamedSetup,
  exportSetupToFile
} from '../services/storage.js';

export default function SetupsModal({
  isOpen,
  onClose,
  currentTrade,
  onLoadSetup
}) {
  const [setups, setSetups] = useState([]);
  const [newSetupName, setNewSetupName] = useState('');
  const [saveScope, setSaveScope] = useState('position'); // 'position' | 'full'
  const [filterScope, setFilterScope] = useState('all'); // 'all' | 'position' | 'full'
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  const refreshList = () => {
    setSetups(getSavedSetups());
  };

  useEffect(() => {
    if (isOpen) {
      refreshList();
      const scopeLabel = saveScope === 'position' ? 'Position' : 'Full';
      setNewSetupName(
        `${currentTrade.symbol || 'Trade'} ${currentTrade.direction.toUpperCase()} (${scopeLabel})`
      );
    }
  }, [isOpen, currentTrade, saveScope]);

  if (!isOpen) return null;

  const handleSaveCurrent = e => {
    e.preventDefault();
    if (!newSetupName.trim()) return;
    saveNamedSetup(newSetupName, currentTrade, saveScope);
    setNewSetupName('');
    refreshList();
  };

  const handleDelete = id => {
    if (window.confirm('Are you sure you want to delete this saved setup?')) {
      deleteNamedSetup(id);
      refreshList();
    }
  };

  const handleDuplicate = id => {
    duplicateNamedSetup(id);
    refreshList();
  };

  const handleStartRename = setup => {
    setEditingId(setup.id);
    setEditingName(setup.name);
  };

  const handleSaveRename = id => {
    if (editingName.trim()) {
      renameNamedSetup(id, editingName);
    }
    setEditingId(null);
    refreshList();
  };

  const handleLoad = setup => {
    onLoadSetup(setup);
    onClose();
  };

  const handleExport = setup => {
    exportSetupToFile(setup.trade, setup.name, setup.scope || 'position');
  };

  const handleImportFile = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result));
        const tradeData = payload.trade || payload;
        if (!tradeData || !Array.isArray(tradeData.entries)) {
          throw new Error('Invalid setup file format');
        }
        const importedScope = payload.scope || (tradeData.targets ? 'full' : 'position');
        const importedName = `Imported: ${tradeData.symbol || 'Trade'} (${importedScope === 'position' ? 'Position' : 'Full'})`;
        const saved = saveNamedSetup(importedName, tradeData, importedScope);
        refreshList();
        onLoadSetup(saved);
        onClose();
      } catch (err) {
        alert('Could not import setup: ' + err.message);
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const filteredSetups = setups.filter(s => {
    if (filterScope === 'position') return s.scope === 'position';
    if (filterScope === 'full') return s.scope === 'full';
    return true;
  });

  const positionCount = setups.filter(s => s.scope === 'position').length;
  const fullCount = setups.filter(s => s.scope === 'full').length;

  return (
    <div className="modal-backdrop">
      <div className="modal-card setups-modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <h3>📁 Web-Side Trade Setups</h3>
            <span className="badge-pill">{setups.length} Saved in Browser</span>
          </div>
          <button type="button" className="btn-close" onClick={onClose}>✕</button>
        </div>

        <p className="modal-desc-subtle">
          🌐 <strong>Web-side storage:</strong> Setups are saved directly in your browser's localStorage. Private, instant, and available offline.
        </p>

        <form onSubmit={handleSaveCurrent} className="save-current-form">
          <div className="save-form-header">
            <label className="field-label">Save Current Calculator Setup</label>
            <div className="scope-radio-toggle">
              <label className={`scope-pill ${saveScope === 'position' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="saveScope"
                  checked={saveScope === 'position'}
                  onChange={() => setSaveScope('position')}
                />
                <span>🎯 Position Only</span>
              </label>
              <label className={`scope-pill ${saveScope === 'full' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="saveScope"
                  checked={saveScope === 'full'}
                  onChange={() => setSaveScope('full')}
                />
                <span>📋 Full (+ TPs)</span>
              </label>
            </div>
          </div>

          <div className="save-input-row">
            <input
              type="text"
              className="input-base"
              placeholder="Give your trade setup a name..."
              value={newSetupName}
              onChange={e => setNewSetupName(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={!newSetupName.trim()}>
              💾 Save Setup
            </button>
          </div>
          <small className="save-hint">
            {saveScope === 'position'
              ? '🎯 Position Only saves coin, leverage, direction, sizing & entries. Take profits will remain untouched when loaded.'
              : '📋 Full Setup saves entire trade configuration including Take-Profit targets and exit plan.'}
          </small>
        </form>

        <div className="setups-filter-tabs">
          <button
            type="button"
            className={`tab-btn ${filterScope === 'all' ? 'active' : ''}`}
            onClick={() => setFilterScope('all')}
          >
            All ({setups.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${filterScope === 'position' ? 'active' : ''}`}
            onClick={() => setFilterScope('position')}
          >
            🎯 Position Only ({positionCount})
          </button>
          <button
            type="button"
            className={`tab-btn ${filterScope === 'full' ? 'active' : ''}`}
            onClick={() => setFilterScope('full')}
          >
            📋 Full Setup ({fullCount})
          </button>
        </div>

        <div className="setups-list-container">
          {filteredSetups.length === 0 ? (
            <div className="empty-setups-state">
              <p>No {filterScope !== 'all' ? filterScope : ''} setups saved yet.</p>
              <small>Use the form above to save your current setup to your browser.</small>
            </div>
          ) : (
            <div className="setups-cards-list">
              {filteredSetups.map(s => {
                const isEditing = editingId === s.id;
                const token = s.trade?.symbol || 'Trade';
                const dir = (s.trade?.direction || 'long').toUpperCase();
                const entriesCount = s.trade?.entries?.length || 0;
                const risk = s.trade?.riskBudget ? `$${s.trade.riskBudget} risk` : '';
                const isPositionOnly = s.scope === 'position';

                return (
                  <div key={s.id} className="setup-item-card">
                    <div className="setup-card-main">
                      {isEditing ? (
                        <div className="rename-row">
                          <input
                            type="text"
                            className="input-base input-sm"
                            value={editingName}
                            onChange={e => setEditingName(e.target.value)}
                          />
                          <button
                            type="button"
                            className="btn-tiny btn-success"
                            onClick={() => handleSaveRename(s.id)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn-tiny"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="setup-title-row">
                            <strong className="setup-title">{s.name}</strong>
                            <span className={`badge-scope ${isPositionOnly ? 'badge-position' : 'badge-full'}`}>
                              {isPositionOnly ? '🎯 Position Only' : '📋 Full Setup'}
                            </span>
                          </div>
                          <div className="setup-meta-line">
                            <span className={`dir-badge ${dir === 'LONG' ? 'badge-long' : 'badge-short'}`}>
                              {dir}
                            </span>
                            <span>{token}</span>
                            <span>•</span>
                            <span>{entriesCount} entries</span>
                            {risk && (
                              <>
                                <span>•</span>
                                <span>{risk}</span>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="setup-card-actions">
                      <button
                        type="button"
                        className="btn-sm btn-primary"
                        onClick={() => handleLoad(s)}
                        title={isPositionOnly ? 'Load position parameters & entries (keeps current TPs)' : 'Load full trade setup'}
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        className="btn-sm btn-icon"
                        title="Rename"
                        onClick={() => handleStartRename(s)}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className="btn-sm btn-icon"
                        title="Duplicate"
                        onClick={() => handleDuplicate(s.id)}
                      >
                        📑
                      </button>
                      <button
                        type="button"
                        className="btn-sm btn-icon"
                        title="Export JSON backup"
                        onClick={() => handleExport(s)}
                      >
                        📤
                      </button>
                      <button
                        type="button"
                        className="btn-sm btn-icon btn-danger-icon"
                        title="Delete"
                        onClick={() => handleDelete(s.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="setups-footer-actions">
          <label className="btn-secondary btn-file-label">
            📥 Import Setup JSON
            <input
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
          </label>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
