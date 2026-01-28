const tabs = document.querySelectorAll(".tab");
const content = document.getElementById("content");

let activeTab = "position";

let state = {
  token: "BTC",
  side: "long",
  entryPrice: "",
  stopLoss: "",
  riskAmount: ""
};

// Tab switching
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    activeTab = tab.dataset.tab;
    render();
  });
});

function render() {
  if (activeTab === "position") {
    renderPositionSize();
  } else if (activeTab === "risk") {
    remember("Risk calculator coming next 🙂");
  } else {
    remember("Stop loss calculator coming next 🙂");
  }
}

function renderPositionSize() {
  content.innerHTML = `
    <h2>Position Size Calculator</h2>

    <label>Token</label>
    <input id="token" type="text" value="${state.token}" />

    <label>Position Type</label>
    <div class="toggle">
      <button data-side="long" class="${state.side === "long" ? "active" : ""}">Long</button>
      <button data-side="short" class="${state.side === "short" ? "active" : ""}">Short</button>
    </div>

    <label>Entry Price</label>
    <input id="entryPrice" type="number" placeholder="90000" />

    <label>Stop Loss Price</label>
    <input id="stopLoss" type="number" placeholder="89000" />

    <label>Risk Amount (USDT)</label>
    <input id="riskAmount" type="number" placeholder="20" />

    <hr />

    <div id="result"></div>
  `;

  bindPositionEvents();
}

function bindPositionEvents() {
  document.getElementById("token").addEventListener("input", e => {
    state.token = e.target.value.toUpperCase();
  });

  document.querySelectorAll(".toggle button").forEach(btn => {
    btn.addEventListener("click", () => {
      state.side = btn.dataset.side;
      renderPositionSize();
    });
  });

  ["entryPrice", "stopLoss", "riskAmount"].forEach(id => {
    document.getElementById(id).addEventListener("input", e => {
      state[id] = e.target.value;
      calculate();
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

  const riskPerUnit =
    state.side === "long" ? entry - sl : sl - entry;

  if (riskPerUnit <= 0) {
    document.getElementById("result").innerHTML =
      `<p style="color:red">Invalid stop loss for ${state.side} position</p>`;
    return;
  }

  const size = risk / riskPerUnit;
  const notional = size * entry;

  document.getElementById("result").innerHTML = `
    <h3>Result</h3>
    <p><strong>Position Size:</strong> ${size.toFixed(6)} ${state.token}</p>
    <p><strong>Notional Value:</strong> $${notional.toFixed(2)}</p>
    <p><strong>Risk per Unit:</strong> $${riskPerUnit.toFixed(2)}</p>
  `;
}

function remember(msg) {
  content.innerHTML = `<p>${msg}</p>`;
}

// Initial render
render();
