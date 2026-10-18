import React, { useState, useEffect, useRef } from 'react';
import { fetchAvailableTokens, getBestPrice, getTradingViewUrl, POPULAR_TOKENS, formatSmartPrice } from '../services/market-data.js';

export default function TokenSelector({ symbol, onSelectSymbol, onPriceFetched }) {
  const [tokens, setTokens] = useState(POPULAR_TOKENS);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(symbol || '');
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [priceData, setPriceData] = useState(null);
  const wrapperRef = useRef(null);

  // Load tokens from cache or APIs
  useEffect(() => {
    fetchAvailableTokens().then(list => {
      if (list && list.length > 0) setTokens(list);
    });
  }, []);

  // Sync internal search state with external symbol prop
  useEffect(() => {
    setSearch(symbol || '');
    if (symbol) {
      fetchPrice(symbol);
    }
  }, [symbol]);

  // Click outside listener to close dropdown
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchPrice = async tokenSymbol => {
    if (!tokenSymbol) return;
    setIsFetchingPrice(true);
    try {
      const data = await getBestPrice(tokenSymbol);
      setPriceData(data);
      if (data && onPriceFetched) {
        onPriceFetched(data);
      }
    } finally {
      setIsFetchingPrice(false);
    }
  };

  const handleSelect = token => {
    setSearch(token);
    setIsOpen(false);
    onSelectSymbol(token);
    fetchPrice(token);
  };

  const handleInputChange = e => {
    const val = e.target.value.toUpperCase();
    setSearch(val);
    setIsOpen(true);
    onSelectSymbol(val);
  };

  const filtered = search.trim()
    ? tokens.filter(t => t.toUpperCase().includes(search.trim().toUpperCase())).slice(0, 30)
    : POPULAR_TOKENS;

  const tvUrl = getTradingViewUrl(symbol || search);

  return (
    <div className="token-selector-wrapper" ref={wrapperRef}>
      <label className="field-label">Token Symbol</label>
      <div className="token-input-row">
        <div className="autocomplete-container">
          <input
            type="text"
            className="input-base token-input"
            value={search}
            placeholder="e.g. BTC, ETH, SOL"
            onChange={handleInputChange}
            onFocus={() => setIsOpen(true)}
          />
          {isOpen && (
            <div className="autocomplete-menu">
              <div className="autocomplete-header">
                {search.trim() ? `Matching Tokens (${filtered.length})` : 'Popular Tokens'}
              </div>
              {filtered.map(t => (
                <div key={t} className="autocomplete-item" onClick={() => handleSelect(t)}>
                  <strong>{t}</strong>
                  <span className="pair-sub">/USDT</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn-refresh"
          title="Refresh Live Price"
          disabled={isFetchingPrice || !search}
          onClick={() => fetchPrice(search)}
        >
          {isFetchingPrice ? '⏳' : '🔄'}
        </button>
      </div>

      <div className="token-meta-bar">
        {isFetchingPrice ? (
          <span className="live-price-fetching">Fetching live market price…</span>
        ) : priceData ? (
          <span className="live-price-tag">
            Live: <strong>${priceData.formatted}</strong>
            <small>({priceData.exchange} {priceData.market})</small>
          </span>
        ) : (
          <span className="live-price-hint">Select or type token to fetch live price</span>
        )}

        {tvUrl && symbol && (
          <a href={tvUrl} target="_blank" rel="noopener noreferrer" className="tv-link-btn">
            TradingView ↗
          </a>
        )}
      </div>
    </div>
  );
}
