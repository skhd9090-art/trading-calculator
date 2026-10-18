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
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  const refreshList = () => {
    setSetups(getSavedSetups());
  };

  useEffect(() => {
    if (isOpen) {
      refreshList();
      setNewSetupName(
        `${currentTrade.symbol || 'Trade'} ${currentTrade.direction.toUpperCase()} (${new Date().toLocaleDateString()})`
      );
    }
  }, [isOpen, currentTrade]);

  if (!isOpen) return null;

  const handleSaveCurrent = e => {
    e.preventDefault();
    if (!newSetupName.trim()) return;
    saveNamedSetup(newSetupName, currentTrade);
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
    onLoadSetup(setup.trade);
    onClose();
  };

  const handleExport = setup => {
    exportSetupToFile(setup.trade, setup.name);
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
        const importedName = `Imported: ${tradeData.symbol || 'Trade'} (${new Date().toLocaleDateString()})`;
        saveNamedSetup(importedName, tradeData);
        refreshList();
        onLoadSetup(tradeData);
        onClose();
      } catch (err) {
        alert('Could not import setup: ' + err.message);
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card setups-modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <h3>📁 Saved Trade Setups</h3>
            <span className="badge-pill">{setups.length} Saved</span>
          </div>
          <button type="button" className="btn-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSaveCurrent} className="save-current-form">
          <label className="field-label">Save Current Calculator Setup</label>
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
        </form>

        <div className="setups-list-container">
          {setups.length === 0 ? (
            <div className="empty-setups-state">
              <p>No saved setups yet.</p>
              <small>Save your current trade above or import an existing setup JSON.</small>
            </div>
          ) : (
            <div className="setups-cards-list">
              {setups.map(s => {
                const isEditing = editingId === s.id;
                const token = s.trade?.symbol || 'Trade';
                const dir = (s.trade?.direction || 'long').toUpperCase();
                const entriesCount = s.trade?.entries?.length || 0;
                const risk = s.trade?.riskBudget ? `$${s.trade.riskBudget} risk` : '';

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
                          <strong className="setup-title">{s.name}</strong>
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
                        title="Export JSON"
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
