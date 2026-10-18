/**
 * Market Data Service
 * Provides token list discovery and multi-exchange live price cascading
 * (Binance Futures -> Binance Spot -> MEXC Futures -> MEXC Spot)
 */

export const POPULAR_TOKENS = [
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI',
  'PEPE', 'NEAR', 'APT', 'ARB', 'OP', 'BCH', 'LTC', 'DOT', 'SHIB', 'TRX'
];

const CACHE_KEY = 'tc_token_cache_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function fetchAvailableTokens() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS && Array.isArray(parsed.tokens) && parsed.tokens.length > 0) {
        return parsed.tokens;
      }
    }
  } catch (e) {
    // Ignore storage errors
  }

  const tokenSet = new Set(POPULAR_TOKENS);

  // Binance Spot
  try {
    const res = await fetch('https://api.binance.com/api/v3/exchangeInfo');
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.symbols)) {
        data.symbols.forEach(s => {
          if (s.quoteAsset === 'USDT' && s.status === 'TRADING') {
            tokenSet.add(s.baseAsset.toUpperCase());
          }
        });
      }
    }
  } catch (err) {
    console.warn('[MarketData] Binance token fetch failed:', err.message);
  }

  // MEXC Spot
  try {
    const res = await fetch('https://api.mexc.com/api/v3/exchangeInfo');
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.symbols)) {
        data.symbols.forEach(s => {
          if (s.quoteAsset === 'USDT' && s.status === 'ENABLED') {
            tokenSet.add(s.baseAsset.toUpperCase());
          }
        });
      }
    }
  } catch (err) {
    console.warn('[MarketData] MEXC token fetch failed:', err.message);
  }

  const tokens = Array.from(tokenSet).sort();
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), tokens }));
  } catch (e) {
    // Ignore storage quota
  }

  return tokens;
}

export function formatSmartPrice(num) {
  if (num == null || !Number.isFinite(Number(num))) return '0';
  const val = Number(num);
  if (val === 0) return '0';
  if (val < 0.0001 && val > 0) {
    return val.toFixed(8).replace(/\.?0+$/, '');
  }
  if (val < 1) {
    return val.toFixed(4).replace(/\.?0+$/, '');
  }
  if (val < 1000) {
    return val.toFixed(2).replace(/\.?0+$/, '');
  }
  return val.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export async function getBestPrice(token) {
  if (!token || typeof token !== 'string') return null;
  const cleanToken = token.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleanToken) return null;
  const symbol = cleanToken + 'USDT';

  // 1. Binance Futures
  try {
    const res = await fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.price) {
        const price = Number(data.price);
        return { price, exchange: 'Binance', market: 'Futures', formatted: formatSmartPrice(price) };
      }
    }
  } catch (e) {
    // fallback
  }

  // 2. Binance Spot
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.price) {
        const price = Number(data.price);
        return { price, exchange: 'Binance', market: 'Spot', formatted: formatSmartPrice(price) };
      }
    }
  } catch (e) {
    // fallback
  }

  // 3. MEXC Futures
  try {
    const res = await fetch(`https://contract.mexc.com/api/v1/contract/ticker?symbol=${cleanToken}_USDT`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.data && data.data.lastPrice) {
        const price = Number(data.data.lastPrice);
        return { price, exchange: 'MEXC', market: 'Futures', formatted: formatSmartPrice(price) };
      }
    }
  } catch (e) {
    // fallback
  }

  // 4. MEXC Spot
  try {
    const res = await fetch(`https://api.mexc.com/api/v3/ticker/price?symbol=${symbol}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.price) {
        const price = Number(data.price);
        return { price, exchange: 'MEXC', market: 'Spot', formatted: formatSmartPrice(price) };
      }
    }
  } catch (e) {
    // fallback
  }

  return null;
}

export function getTradingViewUrl(token) {
  if (!token) return '';
  const clean = token.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `https://www.tradingview.com/chart/?symbol=BINANCE:${clean}USDT.P`;
}
