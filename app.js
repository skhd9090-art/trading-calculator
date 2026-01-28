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
    content.innerHTML = "<p>Risk calculator coming soon...</p>";
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
    '<input id="token" type="text" value="' + state.token + '" placeholder="BTC, ETH, SOL" />' +
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

  tokenInput.addEventListener("input", function (e) {
    state.token = e.target.value.trim().toUpperCase();
    if (state.priceMode === "market" && state.token) {
      fetchMarketPrice();
    }
  });

  tokenInput.addEventListener("blur", function () {
    if (state.priceMode === "market" && state.token) {
      fetchMarketPrice();
    }
  });

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

render();