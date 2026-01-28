const tabs = document.querySelectorAll(".tab");
const content = document.getElementById("content");

let activeTab = "position";

let state = {
  token: "BTC",
  side: "long",
  priceMode: "market",
  entryPrice: "",
  stopLoss: "",
  riskAmount: "",
  priceSource: null,
  isFetchingPrice: false
};

let riskState = {
  token: "BTC",
  side: "long",
  priceMode: "market",
  positionSizeMode: "usdt",
  positionSize: "",
  entryPrice: "",
  stopLoss: "",
  priceSource: null,
  isFetchingPrice: false
};

let tokenCache = {
  tokens: [
    "BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "DOGE", "AVAX", "LINK", "MATIC",
    "DOT", "SHIB", "ARB", "TRX", "OP", "NEAR", "LTC", "BCH", "ATOM", "XMR",
    "ICP", "VET", "FIL", "UNI", "APT", "GMX", "FTM", "LDO", "CRV", "PEPE"
  ],
  lastFetch: 0,
  isLoading: false
};

tabs.forEach(function (tab) {
  tab.addEventListener("click", function () {
    tabs.forEach(function (t) {
      t.classList.remove("active");
    });
    tab.classList.add("active");
    activeTab = tab.dataset.tab;
    render();
  });
});

function render() {
  if (activeTab === "position") {
    renderPositionSize();
  } else if (activeTab === "risk") {
    renderRiskCalculator();
  } else {
    content.innerHTML = "<p>Stop loss calculator coming soon...</p>";
  }
}

function renderPositionSize() {
  const priceDisplay = state.isFetchingPrice
    ? "Fetching..."
    : state.entryPrice
    ? "$" + Number(state.entryPrice).toLocaleString()
    : "";

  content.innerHTML =
    '<h2>Position Size Calculator</h2>' +
    '<label>Token</label>' +
    '<div class="autocomplete-wrapper">' +
      '<input id="token" type="text" value="' + state.token + '" placeholder="BTC, ETH, SOL" />' +
      '<div id="tokenSuggestions" class="autocomplete-dropdown"></div>' +
    '</div>' +
    '<label>Position Type</label>' +
    '<div class="toggle">' +
      '<button id="longBtn">Long</button>' +
      '<button id="shortBtn">Short</button>' +
    '</div>' +
    '<label>Price Mode</label>' +
    '<div class="radio-group">' +
      '<label>' +
        '<input type="radio" name="priceMode" value="market" ' + (state.priceMode === "market" ? "checked" : "") + ' />' +
        ' Market Price' + (priceDisplay ? " (" + priceDisplay + ")" : "") +
      '</label>' +
      '<label>' +
        '<input type="radio" name="priceMode" value="limit" ' + (state.priceMode === "limit" ? "checked" : "") + ' />' +
        ' Limit Price' +
      '</label>' +
    '</div>' +
    '<label>Entry Price</label>' +
    '<input id="entryPrice" type="number" step="any" ' +
    (state.priceMode === "market" ? 'disabled value="' + (state.entryPrice || "") + '"' : 'value="' + (state.entryPrice || "") + '" placeholder="Enter limit price"') +
    ' />' +
    '<label>Stop Loss Price</label>' +
    '<input id="stopLoss" type="number" step="any" value="' + (state.stopLoss || "") + '" placeholder="Enter stop loss price" />' +
    '<label>Risk Amount (USDT)</label>' +
    '<input id="riskAmount" type="number" step="any" value="' + (state.riskAmount || "") + '" placeholder="Enter risk amount" />' +
    '<hr />' +
    '<div id="result"></div>';

  updateSideUI();
  bindPositionEvents();
  calculate();
  
  // Focus on token input after a short delay to trigger autocomplete setup
  setTimeout(function() {
    const tokenInput = document.getElementById("token");
    if (tokenInput) {
      tokenInput.focus();
    }
  }, 100);
}

function updateSideUI() {
  const longBtn = document.getElementById("longBtn");
  const shortBtn = document.getElementById("shortBtn");
  if (longBtn && shortBtn) {
    longBtn.classList.toggle("active", state.side === "long");
    shortBtn.classList.toggle("active", state.side === "short");
  }
}

function bindPositionEvents() {
  const tokenInput = document.getElementById("token");
  const longBtn = document.getElementById("longBtn");
  const shortBtn = document.getElementById("shortBtn");
  const entryPriceInput = document.getElementById("entryPrice");
  const stopLossInput = document.getElementById("stopLoss");
  const riskAmountInput = document.getElementById("riskAmount");

  // Setup token input with autocomplete
  handleTokenInput("token", "tokenSuggestions", "position");

  longBtn.addEventListener("click", function () {
    state.side = "long";
    updateSideUI();
    calculate();
  });

  shortBtn.addEventListener("click", function () {
    state.side = "short";
    updateSideUI();
    calculate();
  });

  if (entryPriceInput) {
    entryPriceInput.addEventListener("input", function (e) {
      state.entryPrice = e.target.value;
      calculate();
    });
  }

  stopLossInput.addEventListener("input", function (e) {
    state.stopLoss = e.target.value;
    calculate();
  });

  riskAmountInput.addEventListener("input", function (e) {
    state.riskAmount = e.target.value;
    calculate();
  });

  document.querySelectorAll('input[name="priceMode"]').forEach(function (radio) {
    radio.addEventListener("change", function (e) {
      state.priceMode = e.target.value;

      if (state.priceMode === "market") {
        if (state.token) {
          fetchMarketPrice();
        }
      } else {
        state.entryPrice = "";
        state.priceSource = null;
        renderPositionSize();
      }
    });
  });

  if (state.priceMode === "market" && state.token && !state.entryPrice && !state.isFetchingPrice) {
    fetchMarketPrice();
  }
}

function renderRiskCalculator() {
  const priceDisplay = riskState.isFetchingPrice
    ? "Fetching..."
    : riskState.entryPrice
    ? "$" + Number(riskState.entryPrice).toLocaleString()
    : "";

  content.innerHTML =
    '<h2>Risk Calculator</h2>' +
    '<label>Token</label>' +
    '<div class="autocomplete-wrapper">' +
      '<input id="riskToken" type="text" value="' + riskState.token + '" placeholder="BTC, ETH, SOL" />' +
      '<div id="riskTokenSuggestions" class="autocomplete-dropdown"></div>' +
    '</div>' +
    '<label>Position Type</label>' +
    '<div class="toggle">' +
      '<button id="riskLongBtn">Long</button>' +
      '<button id="riskShortBtn">Short</button>' +
    '</div>' +
    '<label>Price Mode</label>' +
    '<div class="radio-group">' +
      '<label>' +
        '<input type="radio" name="riskPriceMode" value="market" ' + (riskState.priceMode === "market" ? "checked" : "") + ' />' +
        ' Market Price' + (priceDisplay ? " (" + priceDisplay + ")" : "") +
      '</label>' +
      '<label>' +
        '<input type="radio" name="riskPriceMode" value="limit" ' + (riskState.priceMode === "limit" ? "checked" : "") + ' />' +
        ' Limit Price' +
      '</label>' +
    '</div>' +
    '<label>Position Size</label>' +
    '<div class="size-mode-options">' +
      '<label>' +
        '<input type="radio" name="positionSizeMode" value="usdt" ' + (riskState.positionSizeMode === "usdt" ? "checked" : "") + ' />' +
        ' In USDT (Notional Value)' +
      '</label>' +
      '<label>' +
        '<input type="radio" name="positionSizeMode" value="units" ' + (riskState.positionSizeMode === "units" ? "checked" : "") + ' />' +
        ' In ' + riskState.token + ' Units' +
      '</label>' +
    '</div>' +
    '<input id="riskPositionSize" type="number" step="any" value="' + (riskState.positionSize || "") + '" placeholder="Enter position size" />' +
    '<label>Entry Price</label>' +
    '<input id="riskEntryPrice" type="number" step="any" ' +
    (riskState.priceMode === "market" ? 'disabled value="' + (riskState.entryPrice || "") + '"' : 'value="' + (riskState.entryPrice || "") + '" placeholder="Enter entry price"') +
    ' />' +
    '<label>Stop Loss Price</label>' +
    '<input id="riskStopLoss" type="number" step="any" value="' + (riskState.stopLoss || "") + '" placeholder="Enter stop loss price" />' +
    '<hr />' +
    '<div id="riskResult"></div>';

  updateRiskSideUI();
  bindRiskEvents();
  calculateRisk();
}

function updateRiskSideUI() {
  const longBtn = document.getElementById("riskLongBtn");
  const shortBtn = document.getElementById("riskShortBtn");
  if (longBtn && shortBtn) {
    longBtn.classList.toggle("active", riskState.side === "long");
    shortBtn.classList.toggle("active", riskState.side === "short");
  }
}

function bindRiskEvents() {
  const tokenInput = document.getElementById("riskToken");
  const longBtn = document.getElementById("riskLongBtn");
  const shortBtn = document.getElementById("riskShortBtn");
  const positionSizeInput = document.getElementById("riskPositionSize");
  const entryPriceInput = document.getElementById("riskEntryPrice");
  const stopLossInput = document.getElementById("riskStopLoss");

  // Setup token input with autocomplete
  handleTokenInput("riskToken", "riskTokenSuggestions", "risk");

  longBtn.addEventListener("click", function () {
    riskState.side = "long";
    updateRiskSideUI();
    calculateRisk();
  });

  shortBtn.addEventListener("click", function () {
    riskState.side = "short";
    updateRiskSideUI();
    calculateRisk();
  });

  if (positionSizeInput) {
    positionSizeInput.addEventListener("input", function (e) {
      riskState.positionSize = e.target.value;
      calculateRisk();
    });
  }

  if (entryPriceInput) {
    entryPriceInput.addEventListener("input", function (e) {
      riskState.entryPrice = e.target.value;
      calculateRisk();
    });
  }

  if (stopLossInput) {
    stopLossInput.addEventListener("input", function (e) {
      riskState.stopLoss = e.target.value;
      calculateRisk();
    });
  }

  document.querySelectorAll('input[name="riskPriceMode"]').forEach(function (radio) {
    radio.addEventListener("change", function (e) {
      riskState.priceMode = e.target.value;

      if (riskState.priceMode === "market") {
        if (riskState.token) {
          fetchRiskMarketPrice();
        }
      } else {
        riskState.entryPrice = "";
        riskState.priceSource = null;
        renderRiskCalculator();
      }
    });
  });

  document.querySelectorAll('input[name="positionSizeMode"]').forEach(function (radio) {
    radio.addEventListener("change", function (e) {
      riskState.positionSizeMode = e.target.value;
      renderRiskCalculator();
    });
  });

  if (riskState.priceMode === "market" && riskState.token && !riskState.entryPrice && !riskState.isFetchingPrice) {
    fetchRiskMarketPrice();
  }
}

function fetchRiskMarketPrice() {
  if (!riskState.token) return;

  riskState.isFetchingPrice = true;
  riskState.entryPrice = "";
  riskState.priceSource = null;
  renderRiskCalculator();

  getBestPrice(riskState.token)
    .then(result => {
      riskState.entryPrice = result.price;
      riskState.priceSource = result.exchange + " " + result.market;
      riskState.isFetchingPrice = false;
      renderRiskCalculator();
    })
    .catch((err) => {
      riskState.entryPrice = "";
      riskState.priceSource = "Price unavailable";
      riskState.isFetchingPrice = false;
      renderRiskCalculator();
    });
}

function calculateRisk() {
  const resultDiv = document.getElementById("riskResult");
  if (!resultDiv) return;

  let positionSize = Number(riskState.positionSize);
  const stopLoss = Number(riskState.stopLoss);
  let entry = Number(riskState.entryPrice);

  if (!positionSize || !stopLoss || !entry) {
    resultDiv.innerHTML = "";
    return;
  }

  // Calculate risk per unit
  let riskPerUnit =
    riskState.side === "long"
      ? entry - stopLoss
      : stopLoss - entry;

  if (riskPerUnit <= 0) {
    resultDiv.innerHTML =
      '<p class="error">Invalid stop loss for ' + riskState.side + ' position</p>';
    return;
  }

  // Calculate total risk
  let totalRisk = 0;
  if (riskState.positionSizeMode === "usdt") {
    // Position size is in USDT, need to convert to units
    const units = positionSize / entry;
    totalRisk = units * riskPerUnit;
  } else {
    // Position size is in units
    totalRisk = positionSize * riskPerUnit;
  }

  let resultHtml =
    '<h3>Total Risk</h3>' +
    '<p class="result-value">$' + totalRisk.toFixed(2) + '</p>' +
    '<p><strong>Risk per Unit:</strong> $' + riskPerUnit.toFixed(4) + '</p>';

  if (riskState.priceSource) {
    resultHtml +=
      '<p class="price-source">Price source: ' + riskState.priceSource + '</p>';
  }

  resultDiv.innerHTML = resultHtml;
}

function fetchMarketPrice() {
  if (!state.token) return;

  state.isFetchingPrice = true;
  state.entryPrice = "";
  state.priceSource = null;
  renderPositionSize();

  getBestPrice(state.token)
    .then(result => {
      state.entryPrice = result.price;
      state.priceSource = result.exchange + " " + result.market;
      state.isFetchingPrice = false;
      renderPositionSize();
    })
    .catch((err) => {
      state.entryPrice = "";
      state.priceSource = "Price unavailable";
      state.isFetchingPrice = false;
      renderPositionSize();
    });
}

function calculate() {
  const resultDiv = document.getElementById("result");
  if (!resultDiv) return;

  const entry = Number(state.entryPrice);
  const sl = Number(state.stopLoss);
  const risk = Number(state.riskAmount);

  if (!entry || !sl || !risk) {
    resultDiv.innerHTML = "";
    return;
  }

  let riskPerUnit =
    state.side === "long"
      ? entry - sl
      : sl - entry;

  if (riskPerUnit <= 0) {
    resultDiv.innerHTML =
      '<p class="error">Invalid stop loss for ' + state.side + ' position</p>';
    return;
  }

  const size = risk / riskPerUnit;
  const notional = size * entry;

  let resultHtml =
    '<h3>Position Size</h3>' +
    '<p class="result-value">' + size.toFixed(8) + ' ' + state.token + '</p>' +
    '<p><strong>Notional Value:</strong> $' + notional.toFixed(2) + '</p>' +
    '<p><strong>Risk per Unit:</strong> $' + riskPerUnit.toFixed(4) + '</p>';

  if (state.priceSource) {
    resultHtml +=
      '<p class="price-source">Price source: ' + state.priceSource + '</p>';
  }

  resultDiv.innerHTML = resultHtml;
}

async function getBestPrice(token) {
  const symbol = token.toUpperCase() + "USDT";

  // Binance Futures
  try {
    const res = await fetch(
      "https://fapi.binance.com/fapi/v1/ticker/price?symbol=" + symbol
    );
    if (res.ok) {
      const data = await res.json();
      if (data && data.price) {
        return {
          price: Number(data.price),
          exchange: "Binance",
          market: "Futures"
        };
      }
    }
  } catch (e) {
    console.log("Binance Futures failed:", e);
  }

  // Binance Spot
  try {
    const res = await fetch(
      "https://api.binance.com/api/v3/ticker/price?symbol=" + symbol
    );
    if (res.ok) {
      const data = await res.json();
      if (data && data.price) {
        return {
          price: Number(data.price),
          exchange: "Binance",
          market: "Spot"
        };
      }
    }
  } catch (e) {
    console.log("Binance Spot failed:", e);
  }

  // MEXC Futures
  try {
    const res = await fetch(
      "https://contract.mexc.com/api/v1/contract/ticker?symbol=" + token.toUpperCase() + "_USDT"
    );
    if (res.ok) {
      const data = await res.json();
      if (data && data.data && data.data.lastPrice) {
        return {
          price: Number(data.data.lastPrice),
          exchange: "MEXC",
          market: "Futures"
        };
      }
    }
  } catch (e) {
    console.log("MEXC Futures failed:", e);
  }

  // MEXC Spot
  try {
    const res = await fetch(
      "https://api.mexc.com/api/v3/ticker/price?symbol=" + symbol
    );
    if (res.ok) {
      const data = await res.json();
      if (data && data.price) {
        return {
          price: Number(data.price),
          exchange: "MEXC",
          market: "Spot"
        };
      }
    }
  } catch (e) {
    console.log("MEXC Spot failed:", e);
  }

  throw new Error("Price not available from any exchange");
}

async function fetchAvailableTokens() {
  // Check cache first (cache for 24 hours)
  const now = Date.now();
  if (tokenCache.tokens.length > 0 && (now - tokenCache.lastFetch) < 86400000) {
    return tokenCache.tokens;
  }

  if (tokenCache.isLoading) {
    return tokenCache.tokens;
  }

  tokenCache.isLoading = true;
  const allTokens = new Set();

  try {
    // Fetch from Binance
    const binanceRes = await fetch("https://api.binance.com/api/v3/exchangeInfo");
    if (binanceRes.ok) {
      const data = await binanceRes.json();
      if (data.symbols) {
        data.symbols.forEach(function (symbol) {
          if (symbol.quoteAsset === "USDT" && symbol.status === "TRADING") {
            const token = symbol.baseAsset;
            allTokens.add(token);
          }
        });
      }
    }
  } catch (e) {
    console.log("Binance token fetch failed:", e);
  }

  try {
    // Fetch from MEXC
    const mexcRes = await fetch("https://api.mexc.com/api/v3/exchangeInfo");
    if (mexcRes.ok) {
      const data = await mexcRes.json();
      if (data.symbols) {
        data.symbols.forEach(function (symbol) {
          if (symbol.quoteAsset === "USDT" && symbol.status === "TRADING") {
            const token = symbol.baseAsset;
            allTokens.add(token);
          }
        });
      }
    }
  } catch (e) {
    console.log("MEXC token fetch failed:", e);
  }

  // Sort tokens and cache
  tokenCache.tokens = Array.from(allTokens).sort();
  tokenCache.lastFetch = now;
  tokenCache.isLoading = false;

  return tokenCache.tokens;
}

function handleTokenInput(inputId, suggestionsId, stateType) {
  const input = document.getElementById(inputId);
  const suggestionsDiv = document.getElementById(suggestionsId);

  if (!input || !suggestionsDiv) {
    console.log("Token input or suggestions div not found:", inputId, suggestionsId);
    return;
  }

  // Input event - update suggestions
  input.addEventListener("input", function (e) {
    const value = e.target.value.trim().toUpperCase();
    
    if (stateType === "position") {
      state.token = value;
    } else if (stateType === "risk") {
      riskState.token = value;
    }

    // Show suggestions for any input
    if (value.length > 0) {
      updateTokenSuggestions(value, suggestionsId, stateType);
      
      // Fetch price if market mode
      if (stateType === "position" && state.priceMode === "market") {
        fetchMarketPrice();
      } else if (stateType === "risk" && riskState.priceMode === "market") {
        fetchRiskMarketPrice();
      }
    } else {
      // Clear suggestions if input is empty
      suggestionsDiv.innerHTML = "";
      suggestionsDiv.style.display = "none";
    }
  });

  // Blur event - hide suggestions
  input.addEventListener("blur", function () {
    setTimeout(function () {
      suggestionsDiv.style.display = "none";
    }, 200);
  });

  // Focus event - show suggestions if input has value
  input.addEventListener("focus", function () {
    console.log("Token input focused");
    const value = input.value.trim().toUpperCase();
    
    // Show suggestions on focus
    if (value.length > 0) {
      updateTokenSuggestions(value, suggestionsId, stateType);
    } else {
      // Show all tokens if input is empty
      updateTokenSuggestions("", suggestionsId, stateType);
    }
    
    // Load tokens on first focus (but we have hardcoded list now)
    if (tokenCache.tokens.length === 0 && !tokenCache.isLoading) {
      fetchAvailableTokens();
    }
  });
}

function updateTokenSuggestions(searchTerm, suggestionsId, stateType) {
  const suggestionsDiv = document.getElementById(suggestionsId);
  
  // Use hardcoded token list for faster suggestions
  displaySuggestions(searchTerm, suggestionsDiv, stateType);
  
  // Also fetch and merge with API tokens in background if needed
  if (tokenCache.isLoading === false && tokenCache.lastFetch === 0) {
    fetchAvailableTokens().then(function () {
      // Re-display with merged list
      displaySuggestions(searchTerm, suggestionsDiv, stateType);
    }).catch(function (err) {
      console.log("Failed to fetch additional tokens:", err);
    });
  }
}

function displaySuggestions(searchTerm, suggestionsDiv, stateType) {
  let filtered;
  
  if (searchTerm === "" || searchTerm.length === 0) {
    // Show first 10 tokens if search is empty
    filtered = tokenCache.tokens.slice(0, 10);
  } else {
    // Filter by search term
    filtered = tokenCache.tokens.filter(function (token) {
      return token.startsWith(searchTerm);
    }).slice(0, 10);
  }

  if (filtered.length === 0) {
    suggestionsDiv.innerHTML = '<div class="suggestion-item">No tokens found</div>';
    suggestionsDiv.style.display = "block";
    return;
  }

  let html = "";
  filtered.forEach(function (token) {
    html += '<div class="suggestion-item" data-token="' + token + '">' + token + '</div>';
  });

  suggestionsDiv.innerHTML = html;
  suggestionsDiv.style.display = "block";
  console.log("Displayed suggestions for:", searchTerm, "Count:", filtered.length);

  // Add click handlers to suggestions
  document.querySelectorAll(".suggestion-item[data-token]").forEach(function (item) {
    item.addEventListener("click", function () {
      const selectedToken = this.getAttribute("data-token");
      if (stateType === "position") {
        state.token = selectedToken;
        document.getElementById("token").value = selectedToken;
        if (state.priceMode === "market") {
          fetchMarketPrice();
        }
      } else if (stateType === "risk") {
        riskState.token = selectedToken;
        document.getElementById("riskToken").value = selectedToken;
        if (riskState.priceMode === "market") {
          fetchRiskMarketPrice();
        }
      }
      suggestionsDiv.style.display = "none";
    });
  });
}

render();