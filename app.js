const tabs = document.querySelectorAll(".tab");
const content = document.getElementById("content");

let activeTab = "position";

// Shared state
let state = {
  token: "BTC",
  side: "long",
  entryPrice: 0,
  stopLoss: 0,
  riskAmount: 0
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
    content.innerHTML = `<h2>Risk Calculator (next step)</h2>`;
  } else {
    content.innerHTML = `<h2>Stop Loss Calculator (next step)</h2>`;
  }
}

function renderPositionSize() {
  content.innerHTML = `
    <h2>Position Size Calculator</h2>

    <label>Token</label>
    <input type="text" id="token" value="${state.token}" />

    <label>Position Type</label>
    <div class="toggle">
      <button class="${state.side === "long" ? "active" : ""}" data-side="long">Long</button>
      <button class="${state.side === "short" ? "active" : ""}" data-side="short">Short</button>
    </div>

    <label>Entry Price</label>
    <input type="number" id="entryPrice" placeholder="e.g. 90000" />

    <label>Stop Loss Price</label>
    <input type="number" id="stopLoss" placeholder="e.g. 89000" />

    <label>Risk Amount (USDT)</label>
    <input type="number" id="riskAmount" placeholder="e.g. 20" />

    <hr />

    <div id="result"></div>
  `;

  attachPositionEvents();
}

function attachPositionEvents() {
  document.getElementById("token").on
