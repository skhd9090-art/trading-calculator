const tabs = document.querySelectorAll(".tab");
const content = document.getElementById("content");

let activeTab = "position";

let state = {
  token: "BTC",
  side: "long",
  priceMode: "market", // market | limit
  entryPrice: "",
  stopLoss: "",
  riskAmount: "",
  priceSource: null,
  marketPrice: null
};


// Tab switching
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
    content.innerHTML = "<p>Risk calculator coming next 🙂</p>";
  } else {
    content.innerHTML = "<p>Stop loss calculator coming next 🙂</p>";
  }
}

function renderPositionSize() {
  content.innerHTML =
    '<h2>Position Size Calculator</h2>' +

    '<label>Token</label>' +
    '<input id="token" type="text" value="' + state.token + '" />' +

    '<label>Position Type</label>' +
    '<div class="toggle">' +
      '<button id="longBtn">Long</button>' +
      '<button id="shortBtn">Short</button>' +
    '</div>' +

    '<label>Price Mode</label>' +
    '<div class="radio-group">' +
      '<label>' +
        '<input type="radio" name="priceMode" value="market" ' + (state.priceMode === "market" ? "checked" : "") + ' />' +
        ' Market Price (mock: 90000)' +
      '</label>' +
      '<label>' +
        '<input type="radio" name="priceMode" value="limit" ' + (state.priceMode === "limit" ? "checked" : "") + ' />' +
        ' Limit Price' +
      '</label>' +
    '</div>' +
    
    '<label>Entry Price</label>' +
    '<input id="entryPrice" type="number" ' +
    (state.priceMode === "market" ? 'disabled value="90000"' : 'placeholder="Enter limit price"') +
    ' />' +


    '<label>Stop Loss Price</label>' +
    '<input id="stopLoss" type="number" placeholder="89000" />' +

    '<label>Risk Amount (USDT)</label>' +
    '<input id="riskAmount" type="number" placeholder="20" />' +

    '<hr />' +
    '<div id="result"></div>';

  updateSideUI();
  bindPositionEvents();
}

function updateSideUI() {
  document.getElementById("longBtn").classList.toggle("active", state.side === "long");
  document.getElementById("shortBtn").classList.toggle("active", state.side === "short");
}

function bindPositionEvents() {
  document.getElementById("token").addEventListener("input", function (e) {
    state.token = e.target.value.toUpperCase();
  });

  document.getElementById("longBtn").addEventListener("click", function () {
    state.side = "long";
    updateSideUI();
    calculate();
  });

  document.getElementById("shortBtn").addEventListener("click", function () {
    state.side = "short";
    updateSideUI();
    calculate();
  });

  document.getElementById("entryPrice").addEventListener("input", function (e) {
    state.entryPrice = e.target.value;
    calculate();
  });

  document.getElementById("stopLoss").addEventListener("input", function (e) {
    state.stopLoss = e.target.value;
    calculate();
  });

  document.getElementById("riskAmount").addEventListener("input", function (e) {
    state.riskAmount = e.target.value;
    calculate();
  });

  document.querySelectorAll('input[name="priceMode"]').forEach(function (radio) {
    radio.addEventListener("change", function (e) {
      state.priceMode = e.target.value;

      if (state.priceMode === "market") {
        state.entryPrice = "";
        state.priceSource = "Fetching price...";
        renderPositionSize();

        getBestPrice(state.token)
          .then(result => {
            state.entryPrice = result.price;
            state.priceSource = result.exchange + " " + result.market;
            renderPositionSize();
          })
          .catch(() => {
            state.entryPrice = "";
            state.priceSource = "Unavailable";
            renderPositionSize();
          });
      } else {
        state.entryPrice = "";
        renderPositionSize();
      }
    });
  });
}

function calculate() {
  const entry = Number(state.entryPrice);
  const sl = Number(state.stopLoss);
  const risk = Number(state.riskAmount);

  if (!entry || !sl || !risk) {
    document.getElementById("result").innerHTML = "";
    return;
  }

  let riskPerUnit =
    state.side === "long"
      ? entry - sl
      : sl - entry;

  if (riskPerUnit <= 0) {
    document.getElementById("result").innerHTML =
      '<p style="color:red">Invalid stop loss for ' + state.side + ' position</p>';
    return;
  }

  const size = risk / riskPerUnit;
  const notional = size * entry;

  let resultHtml =
    '<h3>Result</h3>' +
    '<p><strong>Position Size:</strong> ' + size.toFixed(6) + ' ' + state.token + '</p>' +
    '<p><strong>Notional Value:</strong> $' + notional.toFixed(2) + '</p>' +
    '<p><strong>Risk per Unit:</strong> $' + riskPerUnit.toFixed(2) + '</p>';

  if (state.priceSource) {
    resultHtml +=
      '<p><small>Price source: ' + state.priceSource + '</small></p>';
  }

  document.getElementById("result").innerHTML = resultHtml;
}


// Initial render
render();

async function getBestPrice(token) {
  const symbol = token.toUpperCase() + "USDT";

  // 1️⃣ Binance Futures
  try {
    const res = await fetch(
      "https://fapi.binance.com/fapi/v1/ticker/price?symbol=" + symbol
    );
    if (res.ok) {
      const data = await res.json();
      return {
        price: Number(data.price),
        exchange: "Binance",
        market: "Futures"
      };
    }
  } catch (e) {}

  // 2️⃣ Binance Spot
  try {
    const res = await fetch(
      "https://api.binance.com/api/v3/ticker/price?symbol=" + symbol
    );
    if (res.ok) {
      const data = await res.json();
      return {
        price: Number(data.price),
        exchange: "Binance",
        market: "Spot"
      };
    }
  } catch (e) {}

  // 3️⃣ MEXC Futures
  try {
    const res = await fetch(
      "https://contract.mexc.com/api/v1/contract/ticker?symbol=" + token + "_USDT"
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
  } catch (e) {}

  // 4️⃣ MEXC Spot
  try {
    const res = await fetch(
      "https://api.mexc.com/api/v3/ticker/price?symbol=" + symbol
    );
    if (res.ok) {
      const data = await res.json();
      return {
        price: Number(data.price),
        exchange: "MEXC",
        market: "Spot"
      };
    }
  } catch (e) {}

  throw new Error("Price not available");
}
