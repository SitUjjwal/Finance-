
"use strict";

const $ = id => document.getElementById(id);

const STORAGE = {
  transactions: "finlogy_transactions_v1",
  calculations: "finlogy_calculations_v1",
  stocks: "finlogy_stocks_v1",
  receipts: "finlogy_receipts_v1"
};

function load(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

let transactions = load(STORAGE.transactions);
let calculations = load(STORAGE.calculations);
let stocks = load(STORAGE.stocks);
let receipts = load(STORAGE.receipts);
let latestCalculation = null;
let cashChart = null;

const currencies = {
  INR: { locale: "en-IN", digits: 2 },
  USD: { locale: "en-US", digits: 2 },
  EUR: { locale: "de-DE", digits: 2 },
  GBP: { locale: "en-GB", digits: 2 },
  AED: { locale: "en-AE", digits: 2 },
  OMR: { locale: "en-OM", digits: 3 }
};

function money(value, currency = "INR") {
  const config = currencies[currency] || { locale: "en-US", digits: 2 };

  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency,
    minimumFractionDigits: config.digits,
    maximumFractionDigits: config.digits
  }).format(value);
}

function number(id) {
  const value = $(id).value.trim();

  if (!value) throw new Error("Please fill in all required fields.");

  const result = Number(value);

  if (!Number.isFinite(result)) {
    throw new Error("Enter a valid number.");
  }

  return result;
}

function showError(element, error) {
  element.textContent = error.message || "Something went wrong.";
}

function createId(prefix) {
  if (crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function persist(key, value) {
  try {
    save(key, value);
    return true;
  } catch {
    alert("Unable to save data in this browser. Export your data or free up storage.");
    return false;
  }
}

// Navigation
document.querySelectorAll(".nav-btn").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    document.querySelectorAll(".page").forEach(page => {
      page.classList.toggle("active", page.id === button.dataset.page);
    });

    if (button.dataset.page === "receipts") renderReceipts();
  });
});

$("themeToggle").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem(
    "finlogy_theme",
    document.body.classList.contains("dark") ? "dark" : "light"
  );
});

if (localStorage.getItem("finlogy_theme") === "dark") {
  document.body.classList.add("dark");
}

$("year").textContent = new Date().getFullYear();
$("transactionDate").value = new Date().toLocaleDateString("en-CA");

// Interest calculator
$("interestForm").addEventListener("submit", event => {
  event.preventDefault();

  try {
    const principal = number("principal");
    const rate = number("rate");
    const years = number("years");
    const frequency = number("frequency");
    const type = $("interestType").value;

    if (principal < 0 || rate < 0 || rate > 1000 ||
        years < 0 || years > 1000) {
      throw new Error("Enter non-negative values within the permitted limits.");
    }

    let amount;
    let interest;

    if (type === "simple") {
      interest = principal * (rate / 100) * years;
      amount = principal + interest;
    } else {
      amount = principal * Math.pow(
        1 + rate / (100 * frequency),
        frequency * years
      );
      interest = amount - principal;
    }

    if (!Number.isFinite(amount) || !Number.isFinite(interest)) {
      throw new Error("The result is outside the supported numeric range.");
    }

    latestCalculation = {
      id: createId("calc"),
      type,
      principal,
      rate,
      years,
      frequency: type === "compound" ? frequency : null,
      interest,
      amount,
      currency: "INR",
      createdAt: new Date().toISOString()
    };

    $("interestResult").replaceChildren();

    [
      ["Principal", money(principal)],
      ["Interest earned", money(interest)],
      ["Final amount", money(amount)]
    ].forEach(([label, value]) => {
      const p = document.createElement("p");
      p.textContent = `${label}: ${value}`;
      $("interestResult").appendChild(p);
    });

    $("saveCalculation").disabled = false;
  } catch (error) {
    latestCalculation = null;
    $("saveCalculation").disabled = true;
    showError($("interestResult"), error);
  }
});

$("saveCalculation").addEventListener("click", () => {
  if (!latestCalculation) return;

  const next = [...calculations, latestCalculation];

  if (!persist(STORAGE.calculations, next)) return;

  calculations = next;
  latestCalculation = null;
  $("saveCalculation").disabled = true;

  renderCalculations();
  updateDashboard();

  alert("Calculation saved in this browser.");
});

// EMI calculator
$("emiForm").addEventListener("submit", event => {
  event.preventDefault();

  try {
    const principal = number("loanAmount");
    const annualRate = number("loanRate");
    const years = number("loanYears");

    if (principal <= 0 || annualRate < 0 ||
        annualRate > 1000 || years <= 0 || years > 100) {
      throw new Error("Enter a positive loan amount and valid rate and tenure.");
    }

    const n = Math.round(years * 12);
    const r = annualRate / 1200;

    const emi = r === 0
      ? principal / n
      : principal * r * Math.pow(1 + r, n) /
        (Math.pow(1 + r, n) - 1);

    const total = emi * n;
    const interest = total - principal;

    $("emiResult").textContent =
      `Monthly EMI: ${money(emi)} | Total interest: ${money(interest)} | Total repayment: ${money(total)} | Payments: ${n}`;
  } catch (error) {
    showError($("emiResult"), error);
  }
});

// ROI calculator
$("roiForm").addEventListener("submit", event => {
  event.preventDefault();

  try {
    const initial = number("roiInitial");
    const finalValue = number("roiFinal");

    if (initial <= 0 || finalValue < 0) {
      throw new Error("Initial investment must be positive; final value cannot be negative.");
    }

    const profit = finalValue - initial;
    const roi = profit / initial * 100;

    $("roiResult").textContent =
      `Profit / Loss: ${money(profit)} | ROI: ${roi.toFixed(2)}%`;
  } catch (error) {
    showError($("roiResult"), error);
  }
});

// Forex: no hardcoded exchange rates
$("forexForm").addEventListener("submit", async event => {
  event.preventDefault();

  const result = $("forexResult");
  result.textContent = "Fetching an exchange rate...";

  try {
    const amount = number("forexAmount");
    const from = $("fromCurrency").value;
    const to = $("toCurrency").value;

    if (amount < 0) throw new Error("Amount cannot be negative.");

    if (from === to) {
      result.textContent = `${money(amount, from)} = ${money(amount, to)}. Same currency; no exchange rate needed.`;
      return;
    }

    // Demo integration using a public rate endpoint.
    // For production, use a trusted provider through your own backend.
    const url = `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`;

    const response = await fetch(url);

    if (!response.ok) throw new Error("Exchange-rate service is unavailable.");

    const data = await response.json();
    const rate = data.rates && data.rates[to];

    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error("No valid exchange rate is available.");
    }

    result.textContent =
      `${money(amount, from)} = ${money(amount * rate, to)} | Rate: ${rate} ${to}/${from} | Rate date: ${data.date}. Indicative rate; provider fees may apply.`;
  } catch (error) {
    showError(result, error);
  }
});

// Transactions
$("newTransaction").addEventListener("click", () => {
  document.querySelector('[data-page="transactions"]').click();
  $("transactionDescription").focus();
});

$("transactionForm").addEventListener("submit", event => {
  event.preventDefault();

  try {
    const description = $("transactionDescription").value.trim();
    const type = $("transactionType").value;
    const amount = number("transactionAmount");
    const currency = $("transactionCurrency").value;
    const date = $("transactionDate").value;

    if (!description || description.length > 120) {
      throw new Error("Enter a description of up to 120 characters.");
    }

    if (!["income", "expense"].includes(type)) {
      throw new Error("Invalid transaction type.");
    }

    if (amount <= 0 || !date || Number.isNaN(Date.parse(date))) {
      throw new Error("Enter a valid positive amount and date.");
    }

    const transaction = {
      id: createId("txn"),
      description,
      type,
      amount,
      currency,
      date,
      createdAt: new Date().toISOString()
    };

    const next = [...transactions, transaction];

    if (!persist(STORAGE.transactions, next)) return;

    transactions = next;
    event.target.reset();
    $("transactionDate").value = new Date().toLocaleDateString("en-CA");

    renderTransactions();
    updateDashboard();

    alert("Transaction saved in this browser.");
  } catch (error) {
    alert(error.message || "Could not save transaction.");
  }
});

function renderTransactions() {
  const tbody = $("transactionRows");
  tbody.replaceChildren();

  [...transactions].reverse().forEach(txn => {
    const tr = document.createElement("tr");

    [
      txn.date,
      txn.description,
      txn.type,
      `${money(txn.amount, txn.currency)}`
    ].forEach(value => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });

    const actions = document.createElement("td");
    const receiptButton = document.createElement("button");
    receiptButton.className = "secondary-btn";
    receiptButton.textContent = "Receipt";
    receiptButton.addEventListener("click", () => {
      document.querySelector('[data-page="receipts"]').click();
      $("receiptTransaction").value = txn.id;
    });

    actions.appendChild(receiptButton);
    tr.appendChild(actions);
    tbody.appendChild(tr);
  });

  const select = $("receiptTransaction");
  const selected = select.value;
  select.replaceChildren();

  transactions.forEach(txn => {
    const option = document.createElement("option");
    option.value = txn.id;
    option.textContent = `${txn.date} — ${txn.description} — ${money(txn.amount, txn.currency)}`;
    select.appendChild(option);
  });

  if (transactions.some(txn => txn.id === selected)) {
    select.value = selected;
  }
}

// Dashboard: group currencies separately
function updateDashboard() {
  const totals = {};

  transactions.forEach(txn => {
    if (!totals[txn.currency]) {
      totals[txn.currency] = { income: 0, expense: 0 };
    }

    totals[txn.currency][txn.type] += txn.amount;
  });

  const inr = totals.INR || { income: 0, expense: 0 };

  $("incomeTotal").textContent = money(inr.income);
  $("expenseTotal").textContent = money(inr.expense);
  $("cashFlow").textContent = money(inr.income - inr.expense);
  $("calculationCount").textContent = calculations.length;

  const recent = $("recentTransactions");
  recent.replaceChildren();

  [...transactions].reverse().slice(0, 5).forEach(txn => {
    const tr = document.createElement("tr");

    [txn.date, txn.description, txn.type, money(txn.amount, txn.currency)]
      .forEach(value => {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      });

    recent.appendChild(tr);
  });

  if (typeof Chart === "undefined") return;

  const ctx = $("cashChart");

  if (cashChart) cashChart.destroy();

  cashChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Income (INR)", "Expenses (INR)"],
      datasets: [{
        label: "Recorded amounts",
        data: [inr.income, inr.expense],
        backgroundColor: ["#167453", "#e59c64"]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

// Stock holdings: manual entry only
$("stockForm").addEventListener("submit", event => {
  event.preventDefault();

  try {
    const symbol = $("stockSymbol").value.trim().toUpperCase();
    const quantity = number("stockQuantity");
    const price = number("stockPrice");
    const currency = $("stockCurrency").value;

    if (!/^[A-Z0-9.-]{1,20}$/.test(symbol) ||
        quantity <= 0 || price < 0) {
      throw new Error("Enter a valid symbol, positive quantity, and non-negative price.");
    }

    const next = [...stocks, {
      id: createId("stock"),
      symbol,
      quantity,
      price,
      currency,
      createdAt: new Date().toISOString()
    }];

    if (!persist(STORAGE.stocks, next)) return;

    stocks = next;
    renderStocks();
    event.target.reset();
  } catch (error) {
    alert(error.message);
  }
});

function renderStocks() {
  const tbody = $("stockRows");
  tbody.replaceChildren();

  stocks.forEach(stock => {
    const tr = document.createElement("tr");

    [
      stock.symbol,
      stock.quantity,
      money(stock.price, stock.currency),
      money(stock.quantity * stock.price, stock.currency)
    ].forEach(value => {
      const td = document.createElement("td");
      td.textContent = String(value);
      tr.appendChild(td);
    });

    const td = document.createElement("td");
    const remove = document.createElement("button");
    remove.className = "secondary-btn";
    remove.textContent = "Delete";
    remove.addEventListener("click", () => {
      if (!confirm("Delete this holding record?")) return;

      const next = stocks.filter(item => item.id !== stock.id);
      if (!persist(STORAGE.stocks, next)) return;

      stocks = next;
      renderStocks();
    });

    td.appendChild(remove);
    tr.appendChild(td);
    tbody.appendChild(tr);
  });
}

// Receipts: PDF generated from a saved transaction
$("generateReceipt").addEventListener("click", () => {
  try {
    const txn = transactions.find(
      item => item.id === $("receiptTransaction").value
    );

    if (!txn) throw new Error("Save a transaction before generating a receipt.");

    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error("PDF library is unavailable. Reload the page and try again.");
    }

    const receipt = {
      id: createId("receipt"),
      transactionId: txn.id,
      number: `FF-${Date.now()}`,
      issuedAt: new Date().toISOString(),
      snapshot: { ...txn }
    };

    const next = [...receipts, receipt];

    if (!persist(STORAGE.receipts, next)) return;

    receipts = next;

    const pdf = new window.jspdf.jsPDF();
    pdf.setFontSize(20);
    pdf.text("FINLOGY FINANCE", 20, 25);

    pdf.setFontSize(11);
    pdf.text("TRANSACTION RECEIPT - PERSONAL RECORD", 20, 35);
    pdf.text(`Receipt number: ${receipt.number}`, 20, 50);
    pdf.text(`Transaction ID: ${txn.id}`, 20, 60);
    pdf.text(`Issue date: ${receipt.issuedAt}`, 20, 70);
    pdf.text(`Description: ${txn.description}`, 20, 85);
    pdf.text(`Type: ${txn.type}`, 20, 95);
    pdf.text(`Transaction date: ${txn.date}`, 20, 105);
    pdf.text(`Amount: ${money(txn.amount, txn.currency)}`, 20, 115);

    pdf.setFontSize(9);
    pdf.text("This is a record generated by Finlogy Finance.", 20, 140);
    pdf.text("It is not a bank or payment-provider confirmation.", 20, 148);

    pdf.save(`${receipt.number}.pdf`);

    $("receiptResult").textContent =
      `Receipt ${receipt.number} created for saved transaction ${txn.id}.`;

    renderReceipts();
  } catch (error) {
    showError($("receiptResult"), error);
  }
});

function renderReceipts() {
  const container = $("receiptRows");
  container.replaceChildren();

  receipts.forEach(receipt => {
    const p = document.createElement("p");
    p.textContent =
      `${receipt.number} — Transaction ${receipt.transactionId} — ${new Date(receipt.issuedAt).toLocaleString()}`;
    container.appendChild(p);
  });
}

// Calculation history
function renderCalculations() {
  const container = $("calculationRows");
  container.replaceChildren();

  [...calculations].reverse().forEach(calc => {
    const p = document.createElement("p");
    p.textContent =
      `${calc.type} | Principal: ${money(calc.principal, calc.currency)} | Interest: ${money(calc.interest, calc.currency)} | Total: ${money(calc.amount, calc.currency)} | ${new Date(calc.createdAt).toLocaleString()}`;
    container.appendChild(p);
  });
}

// CSV export with basic spreadsheet-formula protection
$("exportCSV").addEventListener("click", () => {
  const escapeCSV = value => {
    let text = String(value ?? "");

    if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;

    return `"${text.replace(/"/g, '""')}"`;
  };

  const rows = [
    ["ID", "Date", "Description", "Type", "Amount", "Currency"],
    ...transactions.map(txn => [
      txn.id, txn.date, txn.description, txn.type, txn.amount, txn.currency
    ])
  ];

  const csv = rows.map(row => row.map(escapeCSV).join(",")).join("\r\n");
  downloadBlob(csv, "finlogy-transactions.csv", "text/csv;charset=utf-8;");
});

$("backupJSON").addEventListener("click", () => {
  const data = {
    exportedAt: new Date().toISOString(),
    transactions,
    calculations,
    stocks,
    receipts
  };

  downloadBlob(JSON.stringify(data, null, 2), "finlogy-backup.json", "application/json");
});

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Initial render
renderTransactions();
renderStocks();
renderCalculations();
renderReceipts();
updateDashboard();

