const tabs = document.querySelectorAll(".tab");
const content = document.getElementById("content");

let activeTab = "position";

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
    content.innerHTML = `<h2>Position Size Calculator</h2>`;
  } else if (activeTab === "risk") {
    content.innerHTML = `<h2>Risk Calculator</h2>`;
  } else {
    content.innerHTML = `<h2>Stop Loss Calculator</h2>`;
  }
}

render();
