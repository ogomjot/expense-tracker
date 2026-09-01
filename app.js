function safeReadStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch (error) {
    console.warn(`Could not read localStorage key "${key}":`, error);
    return fallback;
  }
}

function safeReadJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    if (value === null) return fallback;
    return JSON.parse(value);
  } catch (error) {
    console.warn(`Could not parse localStorage key "${key}":`, error);
    return fallback;
  }
}

function safeWriteStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Could not save localStorage key "${key}":`, error);
    if (
      typeof window !== "undefined" &&
      window.app &&
      typeof window.app.toast === "function"
    ) {
      window.app.toast(
        "Couldn't save — your browser's storage may be full or disabled",
        "error",
      );
    }
  }
}

function safeWriteJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Could not save localStorage key "${key}":`, error);
    if (
      typeof window !== "undefined" &&
      window.app &&
      typeof window.app.toast === "function"
    ) {
      window.app.toast(
        "Couldn't save — your browser's storage may be full or disabled",
        "error",
      );
    }
  }
}

function capitalize(str) {
  if (typeof str !== "string") return "";
  if (str.length === 0) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getFilteredTransactions(transactions, filterState = {}) {
  const type = filterState.type || "";
  const category = filterState.category || "";
  const search = String(filterState.search || "")
    .trim()
    .toLowerCase();
  const dateFrom = filterState.dateFrom || "";
  const dateTo = filterState.dateTo || "";

  return (transactions || []).filter((transaction) => {
    const typeMatch = !type || transaction.type === type;
    const categoryMatch = !category || transaction.category === category;
    const searchMatch =
      !search ||
      String(transaction.description || "")
        .toLowerCase()
        .includes(search);
    const dateFromMatch = !dateFrom || transaction.date >= dateFrom;
    const dateToMatch = !dateTo || transaction.date <= dateTo;
    return (
      typeMatch && categoryMatch && searchMatch && dateFromMatch && dateToMatch
    );
  });
}

function calculateTotals(transactions, useFiltered = false, filterState = {}) {
  const source = useFiltered
    ? getFilteredTransactions(transactions, filterState)
    : transactions || [];
  let totalIncome = 0;
  let totalExpenses = 0;

  source.forEach((transaction) => {
    if (transaction.type === "income") totalIncome += transaction.amount;
    else if (transaction.type === "expense")
      totalExpenses += transaction.amount;
  });

  return {
    income: totalIncome,
    expenses: totalExpenses,
    balance: totalIncome - totalExpenses,
  };
}

function getCategoryTotals(transactions, type) {
  const categoryTotals = {};
  (transactions || []).forEach((transaction) => {
    if (transaction.type === type) {
      categoryTotals[transaction.category] =
        (categoryTotals[transaction.category] || 0) + transaction.amount;
    }
  });
  return categoryTotals;
}

function isoDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getBudgetPeriodRange(filterState = {}, now = new Date()) {
  const explicitFrom = String(filterState.dateFrom || "").trim();
  const explicitTo = String(filterState.dateTo || "").trim();

  if (explicitFrom || explicitTo) {
    return {
      dateFrom: explicitFrom,
      dateTo: explicitTo,
    };
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    dateFrom: isoDateString(start),
    dateTo: isoDateString(end),
  };
}

function getCategorySpendForPeriod(
  transactions,
  category,
  filterState = {},
  now = new Date(),
  amountResolver = null,
) {
  const period = getBudgetPeriodRange(filterState, now);
  const categoryName = String(category || "");

  return (transactions || []).reduce((sum, transaction) => {
    if (transaction.type !== "expense") return sum;
    if (transaction.category !== categoryName) return sum;
    if (!transaction.date) return sum;
    if (period.dateFrom && transaction.date < period.dateFrom) return sum;
    if (period.dateTo && transaction.date > period.dateTo) return sum;
    const amount = amountResolver
      ? amountResolver(transaction)
      : Number(transaction.amount || 0);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
}

function getBudgetProgressState(spent, budget) {
  const numericSpent = Number(spent) || 0;
  const numericBudget = Number(budget) || 0;

  if (!numericBudget || numericBudget <= 0) {
    return {
      percentage: 0,
      status: "safe",
      fillWidth: "0%",
      label: "0%",
      remaining: numericBudget,
      statusLabel: "No budget",
    };
  }

  const rawPercentage = (numericSpent / numericBudget) * 100;
  const percentage = Math.min(rawPercentage, 100);
  const remaining = numericBudget - numericSpent;
  let status = "safe";
  let statusLabel = "On track";

  if (numericSpent >= numericBudget) {
    status = "alert";
    statusLabel = "Over budget";
  } else if (numericSpent >= numericBudget * 0.8) {
    status = "warning";
    statusLabel = "Close to limit";
  }

  return {
    percentage,
    status,
    fillWidth: `${percentage}%`,
    label: `${Math.round(percentage)}%`,
    remaining,
    statusLabel,
  };
}

function convertAmount(amount, rate) {
  const numericAmount = Number(amount);
  const numericRate = Number(rate);
  return Number.isFinite(numericAmount) && Number.isFinite(numericRate)
    ? numericAmount * numericRate
    : numericAmount;
}

const CHART_COLOR_PALETTE = [
  "#e74c3c",
  "#27ae60",
  "#3498db",
  "#f39c12",
  "#8e44ad",
  "#16a085",
  "#d35400",
  "#1abc9c",
  "#e67e22",
  "#2ecc71",
  "#9b59b6",
  "#2980b9",
];

function getChartPalette(categories = []) {
  const names = Array.isArray(categories)
    ? categories.filter((category) => typeof category === "string")
    : [];

  return names.map(
    (_, index) => CHART_COLOR_PALETTE[index % CHART_COLOR_PALETTE.length],
  );
}

const DEFAULT_CURRENCY = "USD";
const EXCHANGE_RATE_CACHE_TTL = 60 * 60 * 1000;
const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const MAX_BACKUP_TRANSACTIONS = 5000;
const MAX_BACKUP_CATEGORIES = 100;
const MAX_BACKUP_CATEGORY_LENGTH = 40;
const SUPPORTED_CURRENCIES = new Set([
  "AUD",
  "BGN",
  "BRL",
  "CAD",
  "CHF",
  "CNY",
  "CZK",
  "DKK",
  "EUR",
  "GBP",
  "HKD",
  "HUF",
  "IDR",
  "ILS",
  "INR",
  "ISK",
  "JPY",
  "KRW",
  "MXN",
  "MYR",
  "NOK",
  "NZD",
  "PHP",
  "PLN",
  "RON",
  "SEK",
  "SGD",
  "THB",
  "TRY",
  "USD",
  "ZAR",
]);

function normalizeCurrencyCode(value, fallback = DEFAULT_CURRENCY) {
  const code = String(value || "")
    .trim()
    .toUpperCase();
  return SUPPORTED_CURRENCIES.has(code) ? code : fallback;
}

function shouldPromptForCurrency(savedCurrency = "", dismissed = false) {
  const candidate = String(savedCurrency ?? "").trim();
  return candidate === "" && !dismissed;
}

function getTransactionCurrency(transaction, fallback = DEFAULT_CURRENCY) {
  return normalizeCurrencyCode(transaction && transaction.currency, fallback);
}

function getDisplayAmount(amount, sourceCurrency, targetCurrency, rate) {
  const source = normalizeCurrencyCode(sourceCurrency);
  const target = normalizeCurrencyCode(targetCurrency);
  if (source === target)
    return { amount: Number(amount), currency: target, converted: true };
  if (
    rate === null ||
    rate === undefined ||
    !Number.isFinite(Number(rate)) ||
    Number(rate) <= 0
  ) {
    return { amount: Number(amount), currency: source, converted: false };
  }
  return {
    amount: convertAmount(amount, rate),
    currency: target,
    converted: true,
  };
}

function getDisplayTransactions(transactions, targetCurrency, rateResolver) {
  return (transactions || []).map((transaction) => {
    const sourceCurrency = getTransactionCurrency(transaction);
    const rate =
      sourceCurrency === normalizeCurrencyCode(targetCurrency)
        ? 1
        : rateResolver(sourceCurrency, targetCurrency);
    const display = getDisplayAmount(
      transaction.amount,
      sourceCurrency,
      targetCurrency,
      rate,
    );
    return {
      ...transaction,
      displayAmount: display.amount,
      displayCurrency: display.currency,
    };
  });
}

function evaluateBudgetAlerts(
  transactions,
  budgets,
  filterState = {},
  alertState = {},
  amountResolver = null,
) {
  const period = getBudgetPeriodRange(filterState);
  const triggered = [];

  Object.entries(budgets || {}).forEach(([category, budget]) => {
    const numericBudget = Number(budget);
    if (!category || !Number.isFinite(numericBudget) || numericBudget <= 0)
      return;

    const spend = getCategorySpendForPeriod(
      transactions,
      category,
      period,
      new Date(),
      amountResolver
        ? (transaction) => amountResolver(transaction, category)
        : undefined,
    );
    const categoryState = alertState[category] || {
      warning: false,
      alert: false,
    };
    const percent = (spend / numericBudget) * 100;

    if (spend >= numericBudget && !categoryState.alert) {
      categoryState.alert = true;
      categoryState.warning = true;
      triggered.push({
        category,
        level: "alert",
        message: `You've used ${Math.round(percent)}% of your ${capitalize(category)} budget`,
        spend,
        budget: numericBudget,
      });
    } else if (
      spend >= numericBudget * 0.8 &&
      spend < numericBudget &&
      !categoryState.warning
    ) {
      categoryState.warning = true;
      triggered.push({
        category,
        level: "warning",
        message: `You've used ${Math.round(percent)}% of your ${capitalize(category)} budget`,
        spend,
        budget: numericBudget,
      });
    }

    alertState[category] = categoryState;
  });

  return triggered;
}

function csvField(value) {
  let s = String(value);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

function parseCsv(text) {
  if (typeof expenseTrackerCsvParser !== "undefined") {
    return expenseTrackerCsvParser.parse(text);
  }
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < String(text).length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
  }
  if (quoted) throw new Error("The CSV contains an unfinished quoted field");
  if (rows.length === 0) throw new Error("The CSV is empty");

  const headers = rows[0].map((header) => header.trim().replace(/^\uFEFF/, ""));
  return {
    headers,
    rows: rows
      .slice(1)
      .map((values) =>
        headers.map((_, index) => String(values[index] || "").trim()),
      ),
  };
}

function normalizedHeader(header) {
  return String(header)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findColumn(headers, aliases) {
  const normalized = headers.map(normalizedHeader);
  return normalized.findIndex((header) =>
    aliases.some((alias) => header === alias || header.includes(alias)),
  );
}

function detectImportFormat(headers) {
  const date = findColumn(headers, [
    "date",
    "transactiondate",
    "valuedate",
    "txndate",
  ]);
  const description = findColumn(headers, [
    "description",
    "narration",
    "transactiondetails",
    "details",
    "remarks",
    "particulars",
    "merchant",
    "name",
  ]);
  const amount = findColumn(headers, [
    "amount",
    "transactionamount",
    "withdrawalamount",
    "depositamount",
  ]);
  const debit = findColumn(headers, [
    "debit",
    "debitamount",
    "withdrawal",
    "withdrawals",
  ]);
  const credit = findColumn(headers, [
    "credit",
    "creditamount",
    "deposit",
    "deposits",
  ]);
  const type = findColumn(headers, [
    "type",
    "transactiontype",
    "transactioncategory",
    "drcr",
  ]);
  const currency = findColumn(headers, ["currency", "currencycode", "ccy"]);

  if (date === -1 || description === -1) return null;
  if (debit !== -1 || credit !== -1) {
    return { source: "bank", date, description, debit, credit, currency };
  }
  if (amount !== -1 && type !== -1) {
    return { source: "upi", date, description, amount, type, currency };
  }
  if (amount !== -1)
    return { source: "upi", date, description, amount, type: -1, currency };
  return null;
}

function normalizeAmount(value) {
  let cleaned = String(value || "")
    .replace(/[₹$€£]/g, "")
    .replace(/\s/g, "");
  if (cleaned.includes(".") && /,\d{1,2}$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    cleaned = cleaned.replace(/,/g, "");
  }
  cleaned = cleaned.replace(/[^\d.\-]/g, "");
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? Math.abs(amount) : NaN;
}

function normalizeImportDate(value) {
  const input = String(value || "").trim();
  let match = input.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!match) match = input.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (!match) return "";

  let year;
  let month;
  let day;
  if (match[1].length === 4) {
    [, year, month, day] = match;
  } else {
    year = match[3];
    const first = Number(match[1]);
    const second = Number(match[2]);
    month = String(first > 12 ? second : first);
    day = String(first > 12 ? first : second);
  }
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  )
    return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isValidStoredDate(value) {
  const date = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return normalizeImportDate(date) === date;
}

function normalizeStoredTransactions(data, defaultCurrency = DEFAULT_CURRENCY) {
  if (!Array.isArray(data)) return [];

  return data
    .filter(
      (transaction) =>
        transaction &&
        (transaction.type === "income" || transaction.type === "expense") &&
        isValidStoredDate(transaction.date) &&
        Number.isFinite(Number(transaction.amount)) &&
        Number(transaction.amount) > 0,
    )
    .map((transaction) => ({
      ...transaction,
      amount: Number(transaction.amount),
      currency: normalizeCurrencyCode(transaction.currency, defaultCurrency),
    }));
}

function normalizeStoredBudgets(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};

  return Object.fromEntries(
    Object.entries(data)
      .filter(
        ([category, amount]) =>
          typeof category === "string" &&
          category.length <= MAX_BACKUP_CATEGORY_LENGTH &&
          Number.isFinite(Number(amount)) &&
          Number(amount) > 0,
      )
      .slice(0, MAX_BACKUP_CATEGORIES)
      .map(([category, amount]) => [category, Number(amount)]),
  );
}

function normalizeStoredCategories(data) {
  if (!Array.isArray(data)) return [];
  return data
    .filter((category) => typeof category === "string" && category.trim())
    .map((category) => category.trim().slice(0, MAX_BACKUP_CATEGORY_LENGTH))
    .filter((category, index, categories) => categories.indexOf(category) === index)
    .slice(0, MAX_BACKUP_CATEGORIES);
}

function safeImportedText(value) {
  const text = String(value || "").trim();
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function normalizeImportedRows(
  parsed,
  mapping,
  defaultCurrency = DEFAULT_CURRENCY,
) {
  return parsed.rows
    .map((row) => {
      const date = normalizeImportDate(row[mapping.date]);
      const description = safeImportedText(row[mapping.description]);
      let type =
        mapping.type === -1
          ? ""
          : String(row[mapping.type] || "").toLowerCase();
      let amount = normalizeAmount(row[mapping.amount]);
      const currencyIndex = Number.isInteger(mapping.currency)
        ? mapping.currency
        : -1;
      const currency =
        currencyIndex === -1
          ? normalizeCurrencyCode(defaultCurrency)
          : normalizeCurrencyCode(row[currencyIndex], defaultCurrency);

      if (mapping.debit !== -1 || mapping.credit !== -1) {
        const debit =
          mapping.debit === -1 ? NaN : normalizeAmount(row[mapping.debit]);
        const credit =
          mapping.credit === -1 ? NaN : normalizeAmount(row[mapping.credit]);
        if (Number.isFinite(debit) && debit > 0) {
          amount = debit;
          type = "expense";
        } else if (Number.isFinite(credit) && credit > 0) {
          amount = credit;
          type = "income";
        }
      } else {
        const rawAmount = String(row[mapping.amount] || "").trim();
        type =
          mapping.type === -1
            ? rawAmount.startsWith("-")
              ? "expense"
              : "income"
            : /debit|withdraw|expense|dr|payment|sent/.test(type)
              ? "expense"
              : "income";
      }

      return date && description && Number.isFinite(amount) && amount > 0
        ? {
            date,
            type,
            category: type === "income" ? "other" : "other",
            description,
            amount,
            currency,
          }
        : null;
    })
    .filter(Boolean);
}

function normalizeBackupData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Backup data must be an object");
  }

  const safeTransactions = Array.isArray(data.transactions)
    ? data.transactions
    : [];
  if (!Array.isArray(data.transactions)) {
    throw new Error("transactions must be an array");
  }
  if (safeTransactions.length > MAX_BACKUP_TRANSACTIONS) {
    throw new Error("Backup contains too many transactions");
  }

  const importedCats =
    data.customCategories && typeof data.customCategories === "object"
      ? data.customCategories
      : {};

  const normalized = {
    version: data.version ?? 1,
    exportedAt: data.exportedAt ?? new Date().toISOString(),
    transactions: safeTransactions
      .filter(
        (transaction) =>
          transaction &&
          (transaction.type === "income" || transaction.type === "expense") &&
          typeof transaction.date === "string" &&
          isValidStoredDate(transaction.date) &&
          Number.isFinite(Number(transaction.amount)) &&
          Number(transaction.amount) > 0,
      )
      .map((transaction) => ({
        ...transaction,
        amount: Number(transaction.amount),
      })),
    customCategories: {
      expense: normalizeStoredCategories(importedCats.expense),
      income: normalizeStoredCategories(importedCats.income),
    },
    budgets:
      normalizeStoredBudgets(data.budgets),
    currency: normalizeCurrencyCode(data.currency),
  };

  if (
    data.budgetCurrencies &&
    typeof data.budgetCurrencies === "object" &&
    !Array.isArray(data.budgetCurrencies)
  ) {
    normalized.budgetCurrencies = Object.fromEntries(
      Object.entries(data.budgetCurrencies)
        .filter(([category]) => Object.prototype.hasOwnProperty.call(normalized.budgets, category))
        .map(([category, currency]) => [category, normalizeCurrencyCode(currency)]),
    );
  }

  return normalized;
}

// Expense Tracker Application
class ExpenseTracker {
  constructor() {
    // Default categories
    this.defaultCategories = {
      expense: ["food", "transport", "utilities", "entertainment", "other"],
      income: ["salary", "other"],
    };

    this.currencyLocales = {
      AUD: "en-AU",
      BGN: "bg-BG",
      BRL: "pt-BR",
      CAD: "en-CA",
      CHF: "de-CH",
      CNY: "zh-CN",
      CZK: "cs-CZ",
      DKK: "da-DK",
      EUR: "de-DE",
      GBP: "en-GB",
      HKD: "zh-HK",
      HUF: "hu-HU",
      IDR: "id-ID",
      ILS: "he-IL",
      INR: "en-IN",
      ISK: "is-IS",
      JPY: "ja-JP",
      KRW: "ko-KR",
      MXN: "es-MX",
      MYR: "ms-MY",
      NOK: "nb-NO",
      NZD: "en-NZ",
      PHP: "en-PH",
      PLN: "pl-PL",
      RON: "ro-RO",
      SEK: "sv-SE",
      SGD: "en-SG",
      THB: "th-TH",
      TRY: "tr-TR",
      USD: "en-US",
      ZAR: "en-ZA",
    };

    this.transactions = this.loadTransactions();
    this.customCategories = this.loadCustomCategories();
    this.budgets = this.loadBudgets();
    this.currency = normalizeCurrencyCode(
      safeReadStorage("currency", ""),
      DEFAULT_CURRENCY,
    );
    const savedExchangeRates = safeReadJson("exchangeRates", {});
    this.exchangeRates =
      savedExchangeRates &&
      typeof savedExchangeRates === "object" &&
      !Array.isArray(savedExchangeRates)
        ? savedExchangeRates
        : {};
    const savedBudgetCurrencies = safeReadJson("budgetCurrencies", {});
    this.budgetCurrencies =
      savedBudgetCurrencies &&
      typeof savedBudgetCurrencies === "object" &&
      !Array.isArray(savedBudgetCurrencies)
        ? savedBudgetCurrencies
        : {};
    this.pendingExchangeRates = {};
    this.currencyFormatters = {};
    this.dateFormatter = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    this.searchRenderTimer = null;
    this.renderedTransactions = null;
    this.editingId = null;
    this.expenseChart = null;
    this.incomeChart = null;
    this.trendsChart = null;
    this.budgetAlertState = {};

    this.initializeEventListeners();
    this.setDefaultDate();
    this.updateCategoryDropdowns();
    this.populateBudgetCategories();
    this.renderCategoriesDisplay();
    this.initDarkMode();
    this.initCurrencySelector();
    this.initCurrencyPrompt();
    this.exchangeRateRefreshTimer = setInterval(
      () => this.refreshExchangeRates(),
      24 * 60 * 60 * 1000,
    );
    this.initSettingsMenu();
    this.initAdvancedToggle();
    this.initChartToggleButtons();
    this.render();
  }

  // ---------- Persistence ----------
  loadTransactions() {
    const data = safeReadJson("transactions", []);
    if (!Array.isArray(data)) {
      console.warn("Saved transactions were invalid; starting fresh.");
      this.toast(
        "Your saved data couldn't be loaded, so a fresh start has been created.",
        "info",
      );
      return [];
    }
    return normalizeStoredTransactions(data);
  }

  saveTransactions() {
    safeWriteJson("transactions", this.transactions);
  }

  loadCustomCategories() {
    const data = safeReadJson("customCategories", { expense: [], income: [] });
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      console.warn("Saved custom categories were invalid; starting fresh.");
      this.toast(
        "Your saved data couldn't be loaded, so a fresh start has been created.",
        "info",
      );
      return { expense: [], income: [] };
    }
    return {
      expense: Array.isArray(data.expense) ? data.expense : [],
      income: Array.isArray(data.income) ? data.income : [],
    };
  }

  saveCustomCategories() {
    safeWriteJson("customCategories", this.customCategories);
  }

  loadBudgets() {
    const data = safeReadJson("budgets", {});
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      console.warn("Saved budgets were invalid; starting fresh.");
      this.toast(
        "Your saved data couldn't be loaded, so a fresh start has been created.",
        "info",
      );
      return {};
    }
    return normalizeStoredBudgets(data);
  }

  saveBudgets() {
    safeWriteJson("budgets", this.budgets);
  }

  saveBudgetCurrencies() {
    safeWriteJson("budgetCurrencies", this.budgetCurrencies);
  }

  // ---------- Toasts (replaces alert()) ----------
  toast(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      document.body.appendChild(container);
    }
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add("toast-visible"));
    setTimeout(() => {
      el.classList.remove("toast-visible");
      setTimeout(() => el.remove(), 250);
    }, 3200);
  }

  getBudgetAlertKey(period = {}) {
    const effective =
      period && Object.keys(period).length > 0
        ? period
        : getBudgetPeriodRange(this.getFilterState());
    return `${effective.dateFrom || ""}|${effective.dateTo || ""}`;
  }

  checkBudgetAlertsForTransactions(
    transactions = this.transactions,
    budgets = this.budgets,
    period = getBudgetPeriodRange(this.getFilterState()),
  ) {
    const key = this.getBudgetAlertKey(period);
    const state = this.budgetAlertState[key] || {};
    const alerts = evaluateBudgetAlerts(
      transactions,
      budgets,
      period,
      state,
      (transaction, category) => {
        const budgetCurrency = normalizeCurrencyCode(
          this.budgetCurrencies[category],
        );
        const display = getDisplayAmount(
          transaction.amount,
          getTransactionCurrency(transaction),
          budgetCurrency,
          this.getRateForDisplay(
            getTransactionCurrency(transaction),
            budgetCurrency,
          ),
        );
        return display.converted ? display.amount : NaN;
      },
    );
    this.budgetAlertState[key] = state;
    alerts.forEach((alert) => {
      const toastType = alert.level === "alert" ? "alert" : "warning";
      this.toast(alert.message, toastType);
    });
    return alerts;
  }

  // ---------- Dark mode ----------
  initDarkMode() {
    const toggle = document.getElementById("dark-mode-toggle");
    const stored = safeReadStorage("theme", "light");
    if (stored === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    }
    if (toggle) {
      toggle.setAttribute(
        "aria-pressed",
        document.documentElement.classList.contains("dark") ? "true" : "false",
      );
      toggle.addEventListener("click", () => this.toggleDarkMode());
      this.updateDarkModeToggleLabel();
    }
  }

  updateDarkModeToggleLabel() {
    const toggle = document.getElementById("dark-mode-toggle");
    if (!toggle) return;

    const indicator = toggle.querySelector(".settings-mode-indicator");
    const isDark = document.documentElement.classList.contains("dark");
    toggle.setAttribute("aria-pressed", String(isDark));
    if (indicator) indicator.textContent = isDark ? "On" : "Off";
  }

  toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle("dark");
    document.documentElement.classList.toggle("light", !isDark);
    safeWriteStorage("theme", isDark ? "dark" : "light");
    this.updateDarkModeToggleLabel();
  }

  initSettingsMenu() {
    const button = document.getElementById("settings-button");
    const menu = document.getElementById("settings-menu");
    if (!button || !menu) return;

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const isHidden = menu.classList.toggle("hidden");
      button.setAttribute("aria-expanded", String(!isHidden));
    });

    document.addEventListener("click", (event) => {
      if (!menu.contains(event.target) && !button.contains(event.target)) {
        menu.classList.add("hidden");
        button.setAttribute("aria-expanded", "false");
      }
    });
  }

  // ---------- Currency ----------
  initCurrencySelector() {
    const select = document.getElementById("currency-select");
    if (!select) return;

    const savedCurrency = safeReadStorage("currency", "");
    const hasSavedCurrency =
      typeof savedCurrency === "string" &&
      savedCurrency.trim() !== "" &&
      SUPPORTED_CURRENCIES.has(savedCurrency.trim().toUpperCase());

    select.value = hasSavedCurrency ? savedCurrency.trim().toUpperCase() : "";
    select.addEventListener("change", async () => {
      await this.changeDisplayCurrency(select.value);
    });
  }

  initCurrencyPrompt() {
    const modal = document.getElementById("currency-modal");
    const select = document.getElementById("currency-modal-select");
    const confirmButton = document.getElementById("currency-modal-confirm");
    const dismissButton = document.getElementById("currency-modal-dismiss");

    if (!modal || !select || !confirmButton || !dismissButton) return;

    const promptDismissed = safeReadStorage("currencyPromptDismissed", "false") === "true";
    const savedCurrency = safeReadStorage("currency", "");

    if (!shouldPromptForCurrency(savedCurrency, promptDismissed)) {
      modal.hidden = true;
      return;
    }

    modal.hidden = false;
    document.body.classList.add("currency-modal-open");

    const close = () => {
      modal.hidden = true;
      document.body.classList.remove("currency-modal-open");
    };

    const onConfirm = () => {
      const nextCurrency = normalizeCurrencyCode(select.value, "");
      if (!SUPPORTED_CURRENCIES.has(nextCurrency)) {
        select.focus();
        return;
      }
      safeWriteStorage("currency", nextCurrency);
      safeWriteStorage("currencyPromptDismissed", "true");
      this.currency = nextCurrency;
      if (document.getElementById("currency-select")) {
        document.getElementById("currency-select").value = nextCurrency;
      }
      close();
      this.render();
    };

    confirmButton.onclick = onConfirm;
    dismissButton.onclick = () => {
      safeWriteStorage("currencyPromptDismissed", "true");
      close();
    };
    modal.onclick = (event) => {
      if (event.target && event.target.dataset.modalDismiss === "true") {
        safeWriteStorage("currencyPromptDismissed", "true");
        close();
      }
    };
  }

  showCurrencyPromptForPreview() {
    const modal = document.getElementById("currency-modal");
    const select = document.getElementById("currency-modal-select");
    if (!modal || !select) return false;

    safeWriteStorage("currencyPromptDismissed", "false");
    modal.hidden = false;
    document.body.classList.add("currency-modal-open");
    select.focus();
    return true;
  }

  async changeDisplayCurrency(nextCurrency) {
    if (!SUPPORTED_CURRENCIES.has(nextCurrency)) return false;
    this.currency = nextCurrency;
    safeWriteStorage("currency", this.currency);
    await this.refreshExchangeRates();
    this.render();
    return true;
  }

  async getExchangeRate(baseCurrency, targetCurrency) {
    if (baseCurrency === targetCurrency) return 1;

    const cacheKey = `${baseCurrency}_${targetCurrency}`;
    const cached = this.exchangeRates[cacheKey];
    const cacheAge = cached ? Date.now() - Number(cached.timestamp) : Infinity;
    if (
      cached &&
      cacheAge < EXCHANGE_RATE_CACHE_TTL &&
      Number.isFinite(Number(cached.rate)) &&
      Number(cached.rate) > 0
    ) {
      return Number(cached.rate);
    }

    const fetchRate = async (retryCount = 0) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(
          `https://api.frankfurter.app/latest?from=${encodeURIComponent(baseCurrency)}&to=${encodeURIComponent(targetCurrency)}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          if (
            cached &&
            Number.isFinite(Number(cached.rate)) &&
            Number(cached.rate) > 0
          ) {
            return Number(cached.rate);
          }
          if (retryCount === 0) return fetchRate(1);
          throw new Error(`Exchange rate request failed: ${response.status}`);
        }

        const data = await response.json();
        const rate = Number(data.rates && data.rates[targetCurrency]);
        if (!Number.isFinite(rate) || rate <= 0) {
          if (
            cached &&
            Number.isFinite(Number(cached.rate)) &&
            Number(cached.rate) > 0
          ) {
            return Number(cached.rate);
          }
          if (retryCount === 0) return fetchRate(1);
          throw new Error("Exchange rate was missing");
        }

        this.exchangeRates[cacheKey] = { rate, timestamp: Date.now() };
        safeWriteJson("exchangeRates", this.exchangeRates);
        return rate;
      } catch (error) {
        if (retryCount === 0 && !(error && error.name === "AbortError")) {
          return fetchRate(1);
        }
        if (
          cached &&
          Number.isFinite(Number(cached.rate)) &&
          Number(cached.rate) > 0
        ) {
          return Number(cached.rate);
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    return fetchRate();
  }

  getRateForDisplay(sourceCurrency, targetCurrency) {
    const source = normalizeCurrencyCode(sourceCurrency);
    const target = normalizeCurrencyCode(targetCurrency);
    if (source === target) return 1;

    const cacheKey = `${source}_${target}`;
    const cached = this.exchangeRates[cacheKey];
    const cachedRate =
      cached && Number.isFinite(Number(cached.rate)) && Number(cached.rate) > 0
        ? Number(cached.rate)
        : null;
    const cacheAge = cached ? Date.now() - Number(cached.timestamp) : Infinity;

    if (cachedRate !== null && cacheAge < EXCHANGE_RATE_CACHE_TTL)
      return cachedRate;
    if (!this.pendingExchangeRates[cacheKey]) {
      this.pendingExchangeRates[cacheKey] = this.getExchangeRate(source, target)
        .then(() => this.render())
        .catch((error) => {
          this.toast(
            "Live rates unavailable — showing original currency",
            "warning",
          );
          console.warn(
            `Could not refresh ${source}/${target} exchange rate:`,
            error,
          );
        })
        .finally(() => {
          delete this.pendingExchangeRates[cacheKey];
        });
    }
    return cachedRate;
  }

  getDisplayValue(amount, sourceCurrency = DEFAULT_CURRENCY) {
    const source = normalizeCurrencyCode(sourceCurrency);
    const rate = this.getRateForDisplay(source, this.currency);
    return getDisplayAmount(amount, source, this.currency, rate);
  }

  formatDisplayAmount(amount, sourceCurrency = DEFAULT_CURRENCY) {
    const display = this.getDisplayValue(amount, sourceCurrency);
    return this.formatCurrency(display.amount, display.currency);
  }

  async refreshExchangeRates() {
    const currenciesInUse = new Set([this.currency]);
    this.transactions.forEach((transaction) =>
      currenciesInUse.add(getTransactionCurrency(transaction)),
    );
    Object.keys(this.budgets).forEach((category) => {
      const budgetCurrency = this.budgetCurrencies[category];
      if (budgetCurrency) {
        currenciesInUse.add(normalizeCurrencyCode(budgetCurrency));
      }
    });

    await Promise.all(
      [...currenciesInUse]
        .filter((targetCurrency) => targetCurrency !== this.currency)
        .map(async (targetCurrency) => {
          try {
            await this.getExchangeRate(targetCurrency, this.currency);
          } catch (error) {
            console.warn(
              `Could not refresh ${this.currency}/${targetCurrency} exchange rate:`,
              error,
            );
          }
        }),
    );
  }

  formatCurrency(amount, currency = this.currency) {
    const displayCurrency = normalizeCurrencyCode(currency);
    if (!this.currencyFormatters[displayCurrency]) {
      const locale = this.currencyLocales[displayCurrency] || "en-US";
      this.currencyFormatters[displayCurrency] = new Intl.NumberFormat(locale, {
        style: "currency",
        currency: displayCurrency,
      });
    }
    return this.currencyFormatters[displayCurrency].format(amount);
  }

  formatDate(dateString) {
    const [year, month, day] = String(dateString).split("-").map(Number);
    const localDate =
      year && month && day
        ? new Date(year, month - 1, day)
        : new Date(dateString);
    return this.dateFormatter.format(localDate);
  }

  initAdvancedToggle() {
    const toggle = document.getElementById("advanced-toggle");
    const tools = document.getElementById("advanced-tools");
    if (!toggle || !tools) return;

    const shouldOpen =
      safeReadStorage("advanced-tools-open", "false") === "true";
    tools.classList.toggle("hidden", !shouldOpen);
    toggle.setAttribute("aria-expanded", String(shouldOpen));
    toggle.textContent = shouldOpen ? "Hide Advanced Tools" : "More Tools";

    toggle.addEventListener("click", () => {
      const isOpen = !tools.classList.contains("hidden");
      tools.classList.toggle("hidden", isOpen);
      const nextState = !isOpen;
      safeWriteStorage("advanced-tools-open", String(nextState));
      toggle.setAttribute("aria-expanded", String(nextState));
      toggle.textContent = nextState ? "Hide Advanced Tools" : "More Tools";
    });
  }

  initChartToggleButtons() {
    document.querySelectorAll(".chart-toggle-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.chart;
        const panels = document.querySelectorAll(".chart-panel");
        panels.forEach((panel) => {
          const shouldShow = panel.id === `${target}-chart-section`;
          panel.classList.toggle("is-hidden", !shouldShow);
          panel.classList.toggle("is-active", shouldShow);
        });

        document.querySelectorAll(".chart-toggle-btn").forEach((btn) => {
          const active = btn === button;
          btn.classList.toggle("is-active", active);
        });
      });
    });
  }

  updateEmptyStateHint() {
    const hint = document.getElementById("empty-state-hint");
    if (!hint) return;
    hint.classList.toggle("hidden", this.transactions.length > 0);
  }

  // ---------- Event wiring ----------
  initializeEventListeners() {
    const expenseForm = document.getElementById("expense-form");
    if (expenseForm) {
      expenseForm.addEventListener("submit", (e) => this.handleFormSubmit(e));
    }

    const manualEntryTab = document.getElementById("manual-entry-tab");
    const importEntryTab = document.getElementById("import-entry-tab");
    if (manualEntryTab && importEntryTab) {
      manualEntryTab.addEventListener("click", () =>
        this.setEntryMode("manual"),
      );
      importEntryTab.addEventListener("click", () =>
        this.setEntryMode("import"),
      );
    }

    const cancelEditBtn = document.getElementById("cancel-edit-btn");
    if (cancelEditBtn) {
      cancelEditBtn.addEventListener("click", () => this.cancelEdit());
    }

    const filterType = document.getElementById("filter-type");
    if (filterType) filterType.addEventListener("change", () => this.render());

    const filterCategory = document.getElementById("filter-category");
    if (filterCategory)
      filterCategory.addEventListener("change", () => this.render());

    const filterSearch = document.getElementById("filter-search");
    if (filterSearch)
      filterSearch.addEventListener("input", () => {
        clearTimeout(this.searchRenderTimer);
        this.searchRenderTimer = setTimeout(() => this.render(), 150);
      });

    const emptyStateReset = document.getElementById("empty-state-reset");
    if (emptyStateReset)
      emptyStateReset.addEventListener("click", () => this.resetFilters());

    const resetFilter = document.getElementById("reset-filter");
    if (resetFilter)
      resetFilter.addEventListener("click", () => this.resetFilters());

    document.querySelectorAll(".quick-filter-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        this.applyQuickFilter(btn.dataset.range),
      );
    });

    const addCategoryBtn = document.getElementById("add-category-btn");
    if (addCategoryBtn) {
      addCategoryBtn.addEventListener("click", () => this.addCustomCategory());
    }

    const newCategoryInput = document.getElementById("new-category-input");
    if (newCategoryInput) {
      newCategoryInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.addCustomCategory();
      });
    }

    const expenseType = document.getElementById("expense-type");
    if (expenseType) {
      expenseType.addEventListener("change", () =>
        this.updateCategoryDropdowns(),
      );
    }

    const setBudgetBtn = document.getElementById("set-budget-btn");
    if (setBudgetBtn)
      setBudgetBtn.addEventListener("click", () => this.setBudget());

    const filterDateFrom = document.getElementById("filter-date-from");
    const filterDateTo = document.getElementById("filter-date-to");
    if (filterDateFrom)
      filterDateFrom.addEventListener("change", () => this.render());
    if (filterDateTo)
      filterDateTo.addEventListener("change", () => this.render());

    const exportCsvBtn = document.getElementById("export-csv-btn");
    if (exportCsvBtn)
      exportCsvBtn.addEventListener("click", () => this.exportToCSV());

    const exportJsonBtn = document.getElementById("export-json-btn");
    if (exportJsonBtn)
      exportJsonBtn.addEventListener("click", () => this.exportBackup());

    const importJsonInput = document.getElementById("import-json-input");
    if (importJsonInput) {
      importJsonInput.addEventListener("change", (e) => this.importBackup(e));
    }

    const importCsvInput = document.getElementById("import-csv-input");
    const importCsvButton = document.getElementById("import-csv-btn");
    const importDropZone = document.getElementById("import-drop-zone");
    if (importCsvButton && importCsvInput) {
      importCsvButton.addEventListener("click", () => importCsvInput.click());
      importCsvInput.addEventListener("change", (event) =>
        this.importCsvFile(event.target.files[0]),
      );
    }
    if (importDropZone) {
      ["dragenter", "dragover"].forEach((eventName) =>
        importDropZone.addEventListener(eventName, (event) => {
          event.preventDefault();
          importDropZone.classList.add("is-dragging");
        }),
      );
      ["dragleave", "drop"].forEach((eventName) =>
        importDropZone.addEventListener(eventName, (event) => {
          event.preventDefault();
          importDropZone.classList.remove("is-dragging");
        }),
      );
      importDropZone.addEventListener("drop", (event) =>
        this.importCsvFile(event.dataTransfer.files[0]),
      );
    }

    // Event delegation for dynamically created elements
    document.addEventListener("click", (e) => {
      const removeButton = e.target.closest(".remove-btn");
      if (removeButton) {
        const category = removeButton.dataset.category;
        const type = removeButton.dataset.type;
        if (category && type) this.removeCustomCategory(category, type);
      }

      const budgetDeleteButton = e.target.closest(".budget-delete-btn");
      if (budgetDeleteButton) {
        this.handleConfirmableDelete(budgetDeleteButton, () =>
          this.removeBudget(budgetDeleteButton.dataset.category),
        );
      }

      const deleteButton = e.target.closest(".btn-delete");
      if (deleteButton) {
        const transactionItem = deleteButton.closest(".transaction-item");
        if (transactionItem) {
          this.handleConfirmableDelete(deleteButton, () => {
            const id = parseInt(transactionItem.dataset.id, 10);
            if (!isNaN(id)) this.deleteTransaction(id);
          });
        }
      }

      const editButton = e.target.closest(".btn-edit");
      if (editButton) {
        const transactionItem = editButton.closest(".transaction-item");
        if (transactionItem) {
          const id = parseInt(transactionItem.dataset.id, 10);
          if (!isNaN(id)) this.startEditTransaction(id);
        }
      }
    });

    document.addEventListener("click", (e) => {
      const collapseButton = e.target.closest(".collapse-btn");
      if (collapseButton) {
        this.toggleCollapse(collapseButton);
      }
    });
  }

  // Two-step confirm for destructive actions instead of native confirm()
  handleConfirmableDelete(button, onConfirm) {
    if (button.dataset.confirming === "true") {
      onConfirm();
      return;
    }
    const original = button.textContent;
    button.dataset.confirming = "true";
    button.textContent = "Confirm?";
    button.classList.add("confirm-pending");
    setTimeout(() => {
      if (button.dataset.confirming === "true") {
        button.dataset.confirming = "false";
        button.textContent = original;
        button.classList.remove("confirm-pending");
      }
    }, 3000);
  }

  setDefaultDate() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const expenseDateEl = document.getElementById("expense-date");
    if (expenseDateEl && !this.editingId) expenseDateEl.value = today;
  }

  getAllCategories(type) {
    const defaults = this.defaultCategories[type] || [];
    const custom = this.customCategories[type] || [];
    return [...defaults, ...custom];
  }

  addCustomCategory() {
    const input = document.getElementById("new-category-input");
    const typeSelect = document.getElementById("category-type-select");
    const categoryName = input.value.trim().toLowerCase();
    const type = typeSelect.value;

    if (!categoryName || !type) {
      this.toast("Please enter a category name and select a type", "error");
      return;
    }
    if (categoryName.length > 20) {
      this.toast("Category name must be 20 characters or less", "error");
      return;
    }
    const allCategories = this.getAllCategories(type);
    if (allCategories.includes(categoryName)) {
      this.toast("This category already exists", "error");
      return;
    }

    this.customCategories[type].push(categoryName);
    this.saveCustomCategories();
    input.value = "";
    typeSelect.value = "";
    this.updateCategoryDropdowns();
    this.populateBudgetCategories();
    this.renderCategoriesDisplay();
    this.toast("Category added", "success");
  }

  removeCustomCategory(categoryName, type) {
    this.customCategories[type] = this.customCategories[type].filter(
      (cat) => cat !== categoryName,
    );
    this.saveCustomCategories();

    if (type === "expense" && this.budgets[categoryName] !== undefined) {
      delete this.budgets[categoryName];
      delete this.budgetCurrencies[categoryName];
      this.saveBudgets();
      this.saveBudgetCurrencies();
    }

    this.updateCategoryDropdowns();
    this.populateBudgetCategories();
    this.renderCategoriesDisplay();
    this.renderBudgets();
  }

  updateCategoryDropdowns() {
    const typeSelect = document.getElementById("expense-type");
    const categorySelect = document.getElementById("expense-category");
    const filterCategory = document.getElementById("filter-category");

    if (filterCategory) {
      const selectedCategory = filterCategory.value;
      const categories = [
        ...new Set([
          ...this.getAllCategories("expense"),
          ...this.getAllCategories("income"),
        ]),
      ];
      filterCategory.innerHTML = '<option value="">All Categories</option>';
      categories.forEach((cat) => {
        const option = document.createElement("option");
        option.value = cat;
        option.textContent = this.capitalize(cat);
        filterCategory.appendChild(option);
      });
      filterCategory.value = selectedCategory;
    }

    if (!typeSelect || !categorySelect) return;

    const type = typeSelect.value;
    if (type) {
      const categories = this.getAllCategories(type);
      const currentValue = categorySelect.value;
      categorySelect.innerHTML = '<option value="">Choose Category</option>';
      categories.forEach((cat) => {
        const option = document.createElement("option");
        option.value = cat;
        option.textContent = this.capitalize(cat);
        categorySelect.appendChild(option);
      });
      categorySelect.value = currentValue;
    }
  }

  renderCategoriesDisplay() {
    const container = document.getElementById("categories-display");
    if (!container) return;

    if (
      this.customCategories.expense.length === 0 &&
      this.customCategories.income.length === 0
    ) {
      container.innerHTML =
        '<p style="color: #95a5a6;">No custom categories yet</p>';
      return;
    }

    container.innerHTML = "";

    const buildTag = (cat, type, extraClass) => {
      const tag = document.createElement("div");
      tag.className = `category-tag ${extraClass}`;

      const label = document.createElement("span");
      label.textContent = `${this.capitalize(cat)} (${this.capitalize(type)})`;

      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.type = "button";
      removeBtn.dataset.category = cat;
      removeBtn.dataset.type = type;
      removeBtn.setAttribute("aria-label", `Remove ${cat} category`);
      removeBtn.textContent = "×";

      tag.appendChild(label);
      tag.appendChild(removeBtn);
      return tag;
    };

    this.customCategories.expense.forEach((cat) => {
      container.appendChild(buildTag(cat, "expense", "expense-tag"));
    });
    this.customCategories.income.forEach((cat) => {
      container.appendChild(buildTag(cat, "income", "income-tag"));
    });
  }

  // ---------- Add / Edit transaction ----------
  setEntryMode(mode) {
    const isImport = mode === "import";
    const manualTab = document.getElementById("manual-entry-tab");
    const importTab = document.getElementById("import-entry-tab");
    const manualPanel = document.getElementById("manual-entry-panel");
    const importPanel = document.getElementById("import-entry-panel");
    if (!manualTab || !importTab || !manualPanel || !importPanel) return;

    manualTab.classList.toggle("is-active", !isImport);
    importTab.classList.toggle("is-active", isImport);
    manualTab.setAttribute("aria-selected", String(!isImport));
    importTab.setAttribute("aria-selected", String(isImport));
    manualPanel.classList.toggle("hidden", isImport);
    importPanel.classList.toggle("hidden", !isImport);
  }

  handleFormSubmit(e) {
    e.preventDefault();

    const type = document.getElementById("expense-type").value;
    const category = document.getElementById("expense-category").value;
    const description = document.getElementById("expense-name").value.trim();
    const amount = parseFloat(document.getElementById("expense-amount").value);
    const date = document.getElementById("expense-date").value;

    if (!type || !category || !description || !amount || amount <= 0 || !date) {
      this.toast("Please fill in every field with a valid amount", "error");
      return;
    }

    if (this.editingId) {
      const index = this.transactions.findIndex((t) => t.id === this.editingId);
      if (index !== -1) {
        this.transactions[index] = {
          ...this.transactions[index],
          type,
          category,
          description,
          amount,
          date,
          currency: getTransactionCurrency(
            this.transactions[index],
            this.currency,
          ),
        };
        this.saveTransactions();
        this.toast("Transaction updated", "success");
      }
      this.cancelEdit();
    } else {
      this.transactions.push({
        id: Date.now(),
        type,
        category,
        description,
        amount,
        date,
        currency: this.currency,
        timestamp: new Date().toISOString(),
      });
      this.saveTransactions();
      this.toast("Transaction added", "success");
      this.checkBudgetAlertsForTransactions();
      this.resetForm();
    }

    this.render();
  }

  startEditTransaction(id) {
    const transaction = this.transactions.find((t) => t.id === id);
    if (!transaction) return;

    this.editingId = id;

    document.getElementById("expense-type").value = transaction.type;
    this.updateCategoryDropdowns();
    document.getElementById("expense-category").value = transaction.category;
    document.getElementById("expense-name").value = transaction.description;
    document.getElementById("expense-amount").value = transaction.amount;
    document.getElementById("expense-date").value = transaction.date;

    const submitBtn = document.getElementById("expense-submit-btn");
    if (submitBtn) submitBtn.textContent = "Update Transaction";
    const cancelBtn = document.getElementById("cancel-edit-btn");
    if (cancelBtn) cancelBtn.classList.remove("hidden");

    this.setCardCollapsed("expense-form-section", false);
    document
      .getElementById("expense-form-section")
      .scrollIntoView({ behavior: "smooth", block: "center" });
  }

  cancelEdit() {
    this.editingId = null;
    this.resetForm();
    const submitBtn = document.getElementById("expense-submit-btn");
    if (submitBtn) submitBtn.textContent = "Add Transaction";
    const cancelBtn = document.getElementById("cancel-edit-btn");
    if (cancelBtn) cancelBtn.classList.add("hidden");
  }

  resetForm() {
    document.getElementById("expense-form").reset();
    this.setDefaultDate();
  }

  // ---------- Filters ----------
  resetFilters() {
    const filterType = document.getElementById("filter-type");
    const filterCategory = document.getElementById("filter-category");
    const filterSearch = document.getElementById("filter-search");
    const filterDateFrom = document.getElementById("filter-date-from");
    const filterDateTo = document.getElementById("filter-date-to");

    if (filterType) filterType.value = "";
    if (filterCategory) filterCategory.value = "";
    if (filterSearch) filterSearch.value = "";
    if (filterDateFrom) filterDateFrom.value = "";
    if (filterDateTo) filterDateTo.value = "";

    this.render();
  }

  applyQuickFilter(range) {
    const from = document.getElementById("filter-date-from");
    const to = document.getElementById("filter-date-to");
    if (!from || !to) return;

    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const iso = (d) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (range === "all") {
      from.value = "";
      to.value = "";
    } else if (range === "this-month") {
      from.value = iso(new Date(now.getFullYear(), now.getMonth(), 1));
      to.value = iso(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    } else if (range === "last-month") {
      from.value = iso(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      to.value = iso(new Date(now.getFullYear(), now.getMonth(), 0));
    } else if (range === "this-year") {
      from.value = iso(new Date(now.getFullYear(), 0, 1));
      to.value = iso(new Date(now.getFullYear(), 11, 31));
    }

    this.render();
  }

  getFilterState() {
    const filterType = document.getElementById("filter-type");
    const filterCategory = document.getElementById("filter-category");
    const filterSearch = document.getElementById("filter-search");
    const filterDateFrom = document.getElementById("filter-date-from");
    const filterDateTo = document.getElementById("filter-date-to");

    return {
      type: filterType ? filterType.value : "",
      category: filterCategory ? filterCategory.value : "",
      search: filterSearch ? filterSearch.value : "",
      dateFrom: filterDateFrom ? filterDateFrom.value : "",
      dateTo: filterDateTo ? filterDateTo.value : "",
    };
  }

  getFilteredTransactions() {
    if (this.renderedTransactions) return this.renderedTransactions;
    return getFilteredTransactions(this.transactions, this.getFilterState());
  }

  calculateTotals(useFiltered = false) {
    return calculateTotals(
      this.transactions,
      useFiltered,
      this.getFilterState(),
    );
  }

  calculateDisplayTotals(useFiltered = false) {
    const source = useFiltered
      ? this.getFilteredTransactions()
      : this.transactions;
    return source.reduce(
      (totals, transaction) => {
        const display = this.getDisplayValue(
          transaction.amount,
          getTransactionCurrency(transaction),
        );
        if (transaction.type === "income") totals.income += display.amount;
        else if (transaction.type === "expense")
          totals.expenses += display.amount;
        return { ...totals, balance: totals.income - totals.expenses };
      },
      { income: 0, expenses: 0, balance: 0 },
    );
  }

  deleteTransaction(id) {
    this.transactions = this.transactions.filter((t) => t.id !== id);
    this.saveTransactions();
    if (this.editingId === id) this.cancelEdit();
    this.checkBudgetAlertsForTransactions();
    this.toast("Transaction deleted", "info");
    this.render();
  }

  // ---------- Render ----------
  render() {
    this.renderedTransactions = getFilteredTransactions(
      this.transactions,
      this.getFilterState(),
    );
    this.updateEmptyStateHint();
    this.updateSummary();
    this.renderCharts();
    this.renderTrendsChart();
    this.renderBudgets();
    this.renderTransactions();
    this.updateAllChartIcons();
    this.renderedTransactions = null;
  }

  updateSummary() {
    const hasFilters = Object.values(this.getFilterState()).some(Boolean);
    const { income, expenses, balance } =
      this.calculateDisplayTotals(hasFilters);

    const totalIncomeEl = document.getElementById("total-income");
    const totalExpensesEl = document.getElementById("total-expenses");
    const balanceEl = document.getElementById("balance");

    if (totalIncomeEl) totalIncomeEl.textContent = this.formatCurrency(income);
    if (totalExpensesEl) totalExpensesEl.textContent = this.formatCurrency(expenses);
    if (balanceEl) {
      balanceEl.textContent = this.formatCurrency(balance);
      balanceEl.classList.remove("positive", "negative");
      if (balance < 0) balanceEl.classList.add("negative");
      else if (balance > 0) balanceEl.classList.add("positive");
    }
  }

  renderTransactions() {
    const container = document.getElementById("transactions-list");
    if (!container) return;
    const emptyState = document.getElementById("transactions-empty-state");

    const filteredTransactions = this.getFilteredTransactions();

    if (filteredTransactions.length === 0) {
      container.innerHTML = "";
      const hasNoTransactions = this.transactions.length === 0;
      emptyState?.classList.toggle("hidden", false);
      emptyState?.classList.toggle("no-data", hasNoTransactions);
      this.setCardCollapsed("transactions-section", false);
      return;
    }

    emptyState?.classList.add("hidden");
    emptyState?.classList.remove("no-data");
    this.setCardCollapsed("transactions-section", false);
    filteredTransactions.sort((a, b) =>
      String(b.date).localeCompare(String(a.date)),
    );

    container.innerHTML = "";
    const fragment = document.createDocumentFragment();

    filteredTransactions.forEach((transaction) => {
      const item = document.createElement("div");
      item.className = `transaction-item ${transaction.type}`;
      item.dataset.id = String(transaction.id);

      const info = document.createElement("div");
      info.className = "transaction-info";

      const desc = document.createElement("div");
      desc.className = "transaction-description";
      desc.textContent = transaction.description;

      const meta = document.createElement("div");
      meta.className = "transaction-meta";

      const catSpan = document.createElement("span");
      catSpan.className = "transaction-category";
      catSpan.textContent = this.capitalize(transaction.category);

      const dateSpan = document.createElement("span");
      dateSpan.textContent = this.formatDate(transaction.date);

      meta.appendChild(catSpan);
      meta.appendChild(dateSpan);
      info.appendChild(desc);
      info.appendChild(meta);

      const amount = document.createElement("div");
      amount.className = `transaction-amount ${transaction.type}`;
      amount.textContent = `${transaction.type === "income" ? "+" : "-"}${this.formatDisplayAmount(transaction.amount, getTransactionCurrency(transaction))}`;

      const editBtn = document.createElement("button");
      editBtn.className = "btn-edit";
      editBtn.type = "button";
      editBtn.textContent = "Edit";

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn-delete";
      deleteBtn.type = "button";
      deleteBtn.textContent = "Delete";

      item.appendChild(info);
      item.appendChild(amount);
      item.appendChild(editBtn);
      item.appendChild(deleteBtn);

      fragment.appendChild(item);
    });
    container.appendChild(fragment);
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  capitalize(str) {
    return capitalize(str);
  }

  getCategoryTotals(type) {
    return this.getFilteredTransactions().reduce((totals, transaction) => {
      if (transaction.type !== type) return totals;
      const display = this.getDisplayValue(
        transaction.amount,
        getTransactionCurrency(transaction),
      );
      if (!display.converted) return totals;
      totals[transaction.category] =
        (totals[transaction.category] || 0) + display.amount;
      return totals;
    }, {});
  }

  renderCharts() {
    this.renderExpenseChart();
    this.renderIncomeChart();
  }

  renderExpenseChart() {
    const categoryTotals = this.getCategoryTotals("expense");
    const ctx = document.getElementById("expenseChart");
    if (!ctx) return;

    if (typeof Chart === "undefined") {
      ctx.style.display = "none";
      this.setChartEmptyState("expenseChart", "expenseChartIcon", true);
      this.updateChartIconVisibility("expenseChart", "expenseChartIcon");
      return;
    }

    const labels = Object.keys(categoryTotals).map((cat) =>
      this.capitalize(cat),
    );
    const data = Object.values(categoryTotals);

    if (data.length === 0) {
      ctx.style.display = "none";
      const legendEl = document.getElementById("expense-chart-legend");
      if (legendEl) legendEl.innerHTML = "";
      this.setChartEmptyState("expenseChart", "expenseChartIcon", true);
      this.updateChartIconVisibility("expenseChart", "expenseChartIcon");
      return;
    }

    this.setChartEmptyState("expenseChart", "expenseChartIcon", false);
    this.setCardCollapsed("expense-chart-section", false);
    ctx.style.display = "block";

    const colors = getChartPalette(Object.keys(categoryTotals));
    if (this.expenseChart) {
      this.expenseChart.data.labels = labels;
      this.expenseChart.data.datasets[0].data = data;
      this.expenseChart.data.datasets[0].backgroundColor = colors;
      this.expenseChart.update("none");
    } else {
      this.expenseChart = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels,
          datasets: [
            {
              data,
              backgroundColor: colors,
              borderColor: "#fff",
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { display: false } },
        },
      });
    }

    this.renderLegend("expense-chart-legend", labels, data, colors);
    this.updateChartIconVisibility("expenseChart", "expenseChartIcon");
  }

  renderIncomeChart() {
    const categoryTotals = this.getCategoryTotals("income");
    const ctx = document.getElementById("incomeChart");
    if (!ctx) return;

    if (typeof Chart === "undefined") {
      ctx.style.display = "none";
      this.setChartEmptyState("incomeChart", "incomeChartIcon", true);
      this.updateChartIconVisibility("incomeChart", "incomeChartIcon");
      return;
    }

    const labels = Object.keys(categoryTotals).map((cat) =>
      this.capitalize(cat),
    );
    const data = Object.values(categoryTotals);

    if (data.length === 0) {
      ctx.style.display = "none";
      const legendEl = document.getElementById("income-chart-legend");
      if (legendEl) legendEl.innerHTML = "";
      this.setChartEmptyState("incomeChart", "incomeChartIcon", true);
      this.updateChartIconVisibility("incomeChart", "incomeChartIcon");
      return;
    }

    this.setChartEmptyState("incomeChart", "incomeChartIcon", false);
    this.setCardCollapsed("income-chart-section", false);
    ctx.style.display = "block";

    const colors = getChartPalette(Object.keys(categoryTotals));
    if (this.incomeChart) {
      this.incomeChart.data.labels = labels;
      this.incomeChart.data.datasets[0].data = data;
      this.incomeChart.data.datasets[0].backgroundColor = colors;
      this.incomeChart.update("none");
    } else {
      this.incomeChart = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels,
          datasets: [
            {
              data,
              backgroundColor: colors,
              borderColor: "#fff",
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { display: false } },
        },
      });
    }

    this.renderLegend("income-chart-legend", labels, data, colors);
    this.updateChartIconVisibility("incomeChart", "incomeChartIcon");
  }

  renderLegend(containerId, labels, data, colors) {
    const legendContainer = document.getElementById(containerId);
    if (!legendContainer) return;

    legendContainer.innerHTML = "";
    const total = data.reduce((a, b) => a + b, 0);

    labels.forEach((label, index) => {
      const percentage = ((data[index] / total) * 100).toFixed(1);

      const item = document.createElement("div");
      item.className = "legend-item";

      const swatch = document.createElement("div");
      swatch.className = "legend-color";
      swatch.style.backgroundColor = colors[index];

      const labelWrap = document.createElement("div");
      labelWrap.className = "legend-label";

      const nameSpan = document.createElement("span");
      nameSpan.textContent = label;

      const valueSpan = document.createElement("span");
      valueSpan.textContent = `${this.formatCurrency(data[index])} (${percentage}%)`;

      labelWrap.appendChild(nameSpan);
      labelWrap.appendChild(valueSpan);
      item.appendChild(swatch);
      item.appendChild(labelWrap);
      legendContainer.appendChild(item);
    });
  }

  populateBudgetCategories() {
    const budgetCategorySelect = document.getElementById("budget-category");
    if (!budgetCategorySelect) return;

    budgetCategorySelect.innerHTML =
      '<option value="">Select Category</option>';
    this.getAllCategories("expense").forEach((cat) => {
      const option = document.createElement("option");
      option.value = cat;
      option.textContent = this.capitalize(cat);
      budgetCategorySelect.appendChild(option);
    });
  }

  setBudget() {
    const categorySelect = document.getElementById("budget-category");
    const amountInput = document.getElementById("budget-amount");
    if (!categorySelect || !amountInput) return;

    const category = categorySelect.value;
    const amount = parseFloat(amountInput.value);

    if (!category || !amount || amount <= 0) {
      this.toast("Please select a category and enter a valid amount", "error");
      return;
    }

    this.budgets[category] = amount;
    this.budgetCurrencies[category] = this.currency;
    this.saveBudgets();
    this.saveBudgetCurrencies();
    categorySelect.value = "";
    amountInput.value = "";
    this.renderBudgets();
    this.toast("Budget set", "success");
  }

  removeBudget(category) {
    delete this.budgets[category];
    delete this.budgetCurrencies[category];
    this.saveBudgets();
    this.saveBudgetCurrencies();
    this.renderBudgets();
  }

  renderBudgets() {
    const container = document.getElementById("budgets-display");
    if (!container) return;

    if (Object.keys(this.budgets).length === 0) {
      container.innerHTML = "";
      this.setCardCollapsed("budget-section", true);
      return;
    }

    this.setCardCollapsed("budget-section", false);

    container.innerHTML = "";
    const period = getBudgetPeriodRange(this.getFilterState());
    const visibleTransactions = getFilteredTransactions(
      this.getFilteredTransactions(),
      period,
    );

    Object.entries(this.budgets).forEach(([category, budgetAmount]) => {
      const budgetCurrency = normalizeCurrencyCode(
        this.budgetCurrencies[category],
      );
      const spent = visibleTransactions.reduce((sum, transaction) => {
        if (transaction.type !== "expense" || transaction.category !== category)
          return sum;
        const display = getDisplayAmount(
          transaction.amount,
          getTransactionCurrency(transaction),
          budgetCurrency,
          this.getRateForDisplay(
            getTransactionCurrency(transaction),
            budgetCurrency,
          ),
        );
        return display.converted ? sum + display.amount : sum;
      }, 0);
      const displayBudget = getDisplayAmount(
        budgetAmount,
        budgetCurrency,
        this.currency,
        this.getRateForDisplay(budgetCurrency, this.currency),
      );
      const displaySpent = this.getDisplayValue(spent, budgetCurrency);
      const progressState = getBudgetProgressState(
        displaySpent.amount,
        displayBudget.amount,
      );
      const status =
        progressState.status === "alert" ? "exceeded" : progressState.status;

      const item = document.createElement("div");
      item.className = `budget-item ${status}`.trim();

      const info = document.createElement("div");
      info.className = "budget-info";

      const catDiv = document.createElement("div");
      catDiv.className = "budget-category";
      catDiv.textContent = this.capitalize(category);

      const progress = document.createElement("div");
      progress.className = "budget-progress";

      const bar = document.createElement("div");
      bar.className = "budget-progress-bar";
      const fill = document.createElement("div");
      fill.className = "budget-progress-fill";
      fill.style.width = progressState.fillWidth;
      bar.appendChild(fill);

      const amountSpan = document.createElement("span");
      amountSpan.className = "budget-amount";
      amountSpan.textContent = `${this.formatCurrency(displaySpent.amount, displaySpent.currency)} / ${this.formatCurrency(displayBudget.amount, displayBudget.currency)} (${progressState.label})`;

      progress.appendChild(bar);
      progress.appendChild(amountSpan);
      info.appendChild(catDiv);
      info.appendChild(progress);

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "budget-delete-btn";
      deleteBtn.type = "button";
      deleteBtn.dataset.category = category;
      deleteBtn.textContent = "Delete";

      item.appendChild(info);
      item.appendChild(deleteBtn);
      container.appendChild(item);
    });
  }

  renderTrendsChart() {
    const canvas = document.getElementById("trendsChart");
    if (!canvas) return;

    if (typeof Chart === "undefined") {
      canvas.style.display = "none";
      this.setChartEmptyState("trendsChart", "trendsChartIcon", true);
      this.updateChartIconVisibility("trendsChart", "trendsChartIcon");
      return;
    }

    const monthlyData = {};
    this.getFilteredTransactions().forEach((transaction) => {
      const month = transaction.date.substring(0, 7);
      if (!monthlyData[month]) monthlyData[month] = { income: 0, expense: 0 };
      const display = this.getDisplayValue(
        transaction.amount,
        getTransactionCurrency(transaction),
      );
      if (!display.converted) return;
      if (transaction.type === "income")
        monthlyData[month].income += display.amount;
      else monthlyData[month].expense += display.amount;
    });

    if (Object.keys(monthlyData).length === 0) {
      canvas.style.display = "none";
      this.setChartEmptyState("trendsChart", "trendsChartIcon", true);
      this.updateChartIconVisibility("trendsChart", "trendsChartIcon");
      return;
    }

    this.setChartEmptyState("trendsChart", "trendsChartIcon", false);
    this.setCardCollapsed("trends-section", false);
    canvas.style.display = "block";

    const sortedMonths = Object.keys(monthlyData).sort();
    const expenseData = sortedMonths.map((m) => monthlyData[m].expense);
    const incomeData = sortedMonths.map((m) => monthlyData[m].income);
    const labels = sortedMonths.map((month) => {
      const [year, monthNum] = month.split("-");
      return new Date(year, monthNum - 1).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
    });

    if (this.trendsChart) {
      this.trendsChart.data.labels = labels;
      this.trendsChart.data.datasets[0].data = expenseData;
      this.trendsChart.data.datasets[1].data = incomeData;
      this.trendsChart.update("none");
    } else {
      this.trendsChart = new Chart(canvas, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Expenses",
              data: expenseData,
              borderColor: "#e74c3c",
              backgroundColor: "rgba(231, 76, 60, 0.1)",
              tension: 0.3,
              fill: true,
            },
            {
              label: "Income",
              data: incomeData,
              borderColor: "#27ae60",
              backgroundColor: "rgba(39, 174, 96, 0.1)",
              tension: 0.3,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { display: true } },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: (value) => this.formatCurrency(value) },
            },
          },
        },
      });
    }
    this.updateChartIconVisibility("trendsChart", "trendsChartIcon");
  }

  // ---------- Export / Import ----------

  csvField(value) {
    return csvField(value);
  }

  exportToCSV() {
    const transactions = this.getFilteredTransactions();
    if (transactions.length === 0) {
      this.toast("No transactions to export", "error");
      return;
    }

    let csv = "Date,Type,Category,Description,Amount,Currency\n";
    transactions.forEach((transaction) => {
      const row = [
        this.csvField(transaction.date),
        this.csvField(transaction.type),
        this.csvField(transaction.category),
        this.csvField(transaction.description),
        transaction.amount,
        getTransactionCurrency(transaction),
      ];
      csv += row.join(",") + "\n";
    });

    this.downloadFile(
      csv,
      `expenses_${new Date().toISOString().split("T")[0]}.csv`,
      "text/csv",
    );
  }

  exportBackup() {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      transactions: this.transactions,
      customCategories: this.customCategories,
      budgets: this.budgets,
      budgetCurrencies: this.budgetCurrencies,
      currency: this.currency,
    };
    this.downloadFile(
      JSON.stringify(backup, null, 2),
      `expense-tracker-backup_${new Date().toISOString().split("T")[0]}.json`,
      "application/json",
    );
    this.toast("Backup downloaded", "success");
  }

  importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      this.toast("Backup files must be 5 MB or smaller", "error");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const normalized = normalizeBackupData(data);

        this.transactions = normalized.transactions;
        this.customCategories = normalized.customCategories;
        this.budgets = normalized.budgets;
        this.budgetCurrencies = normalized.budgetCurrencies || {};

        if (normalized.currency && this.currencyLocales[normalized.currency]) {
          this.currency = normalized.currency;
        }

        this.saveTransactions();
        this.saveCustomCategories();
        this.saveBudgets();
        this.saveBudgetCurrencies();
        safeWriteStorage("currency", this.currency);

        this.updateCategoryDropdowns();
        this.populateBudgetCategories();
        this.renderCategoriesDisplay();
        const currencySelect = document.getElementById("currency-select");
        if (currencySelect) currencySelect.value = this.currency;
        this.render();
        this.toast("Backup restored", "success");
      } catch (err) {
        this.toast("Could not read that backup file", "error");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  setImportError(message) {
    const error = document.getElementById("import-csv-error");
    if (!error) return;
    error.textContent = message || "";
    error.classList.toggle("hidden", !message);
  }

  importCsvFile(file) {
    this.setImportError("");
    if (!file) return;
    if (!String(file.name).toLowerCase().endsWith(".csv")) {
      this.setImportError("Please choose a CSV file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.setImportError("CSV files must be 5 MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        this.processCsvImport(String(event.target.result || ""));
      } catch (error) {
        this.setImportError(error.message || "Could not read that CSV file.");
      }
    };
    reader.onerror = () => this.setImportError("Could not read that CSV file.");
    reader.readAsText(file);
  }

  processCsvImport(text) {
    const parsed = parseCsv(text);
    if (parsed.rows.length > 5000) {
      throw new Error("CSV files may contain at most 5000 data rows.");
    }
    const detected = detectImportFormat(parsed.headers);
    if (!detected) {
      this.showImportMapping(parsed);
      return;
    }
    this.showImportPreview(
      normalizeImportedRows(parsed, detected, this.currency),
    );
  }

  commitImportedTransactions(transactions) {
    if (transactions.length === 0)
      throw new Error("No valid transactions were found in that CSV.");
    const imported = transactions.map((transaction, index) => ({
      ...transaction,
      id: Date.now() + index,
      timestamp: new Date().toISOString(),
    }));
    this.transactions.push(...imported);
    this.saveTransactions();
    this.checkBudgetAlertsForTransactions(
      this.transactions,
      this.budgets,
      getBudgetPeriodRange(this.getFilterState()),
    );
    this.render();
    this.toast(
      `${imported.length} transaction${imported.length === 1 ? "" : "s"} imported`,
      "success",
    );
  }

  showImportPreview(transactions) {
    const panel = document.getElementById("import-preview-panel");
    if (!panel) throw new Error("Import preview is unavailable.");
    this.pendingImportTransactions = transactions;
    panel.textContent = "";
    const heading = document.createElement("h3");
    heading.textContent = `Preview: ${transactions.length} transaction${transactions.length === 1 ? "" : "s"}`;
    panel.appendChild(heading);
    const table = document.createElement("table");
    const header = document.createElement("tr");
    ["Keep", "Date", "Description", "Type", "Amount", "Currency"].forEach(
      (text) => {
        const cell = document.createElement("th");
        cell.textContent = text;
        header.appendChild(cell);
      },
    );
    table.appendChild(header);
    transactions.slice(0, 10).forEach((transaction, index) => {
      const row = document.createElement("tr");
      const keepCell = document.createElement("td");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = true;
      checkbox.dataset.importIndex = String(index);
      keepCell.appendChild(checkbox);
      row.appendChild(keepCell);
      [
        transaction.date,
        transaction.description,
        capitalize(transaction.type),
        String(transaction.amount),
        transaction.currency,
      ].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });
      table.appendChild(row);
    });
    panel.appendChild(table);
    const note = document.createElement("p");
    note.textContent =
      transactions.length > 10
        ? "Showing the first 10 rows. Unchecked preview rows will be excluded."
        : "Uncheck rows you do not want to import.";
    panel.appendChild(note);
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.textContent = "Confirm import";
    confirm.addEventListener("click", () => {
      const excluded = new Set(
        Array.from(
          panel.querySelectorAll("input[data-import-index]:not(:checked)"),
        ).map((input) => Number(input.dataset.importIndex)),
      );
      this.commitImportedTransactions(
        transactions.filter((_, index) => !excluded.has(index)),
      );
      this.cancelImport();
    });
    panel.appendChild(confirm);
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => this.cancelImport());
    panel.appendChild(cancel);
    panel.classList.remove("hidden");
  }

  cancelImport() {
    this.pendingImportTransactions = null;
    ["import-preview-panel", "import-mapping-panel"].forEach((id) => {
      const panel = document.getElementById(id);
      if (panel) {
        panel.textContent = "";
        panel.classList.add("hidden");
      }
    });
    this.setImportError("");
  }

  showImportMapping(parsed) {
    const panel = document.getElementById("import-mapping-panel");
    if (!panel) throw new Error("Column mapping is unavailable.");
    panel.textContent = "";
    const heading = document.createElement("h3");
    heading.textContent = "Map CSV columns";
    panel.appendChild(heading);
    const fields = [
      ["date", "Date"],
      ["description", "Description"],
      ["amount", "Amount"],
      ["type", "Type (debit/credit)"],
      ["currency", "Currency (optional)"],
    ];
    const selects = {};
    fields.forEach(([key, labelText]) => {
      const label = document.createElement("label");
      label.textContent = labelText;
      const select = document.createElement("select");
      select.dataset.mapping = key;
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "Choose a column";
      select.appendChild(empty);
      parsed.headers.forEach((header, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = header;
        select.appendChild(option);
      });
      label.appendChild(select);
      panel.appendChild(label);
      selects[key] = select;
    });
    const typeHint = document.createElement("p");
    typeHint.textContent =
      "Type values should contain debit/expense or credit/income.";
    panel.appendChild(typeHint);
    const submit = document.createElement("button");
    submit.type = "button";
    submit.textContent = "Import mapped rows";
    submit.addEventListener("click", () => {
      const required = ["date", "description", "amount", "type"];
      if (required.some((key) => selects[key].value === "")) {
        this.setImportError("Choose a column for each required field.");
        return;
      }
      const mapping = Object.fromEntries([
        ...required.map((key) => [key, Number(selects[key].value)]),
        [
          "currency",
          selects.currency.value === "" ? -1 : Number(selects.currency.value),
        ],
      ]);
      try {
        this.showImportPreview(normalizeImportedRows(parsed, mapping));
        panel.classList.add("hidden");
      } catch (error) {
        this.setImportError(error.message);
      }
    });
    panel.appendChild(submit);
    panel.classList.remove("hidden");
  }

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  // ---------- Collapse / empty-state icons ----------
  setCardCollapsed(sectionId, isCollapsed) {
    const section = document.getElementById(sectionId);
    if (!section || !section.classList.contains("brick")) return;

    const button = section.querySelector(".collapse-btn");
    const content = section.querySelector(".brick-content");
    if (!button || !content) return;

    if (isCollapsed) {
      section.classList.add("collapsed");
      button.textContent = "+";
      button.setAttribute("aria-expanded", "false");
      content.style.display = "none";
    } else {
      section.classList.remove("collapsed");
      button.textContent = "−";
      button.setAttribute("aria-expanded", "true");
      content.style.display = "block";
    }

    this.updateAllChartIcons();
  }

  toggleCollapse(button) {
    const section = button.closest(".brick");
    if (!section) return;

    const content = section.querySelector(".brick-content");
    if (!content) return;

    const isCollapsed = section.classList.contains("collapsed");
    if (isCollapsed) {
      section.classList.remove("collapsed");
      button.textContent = "−";
      button.setAttribute("aria-expanded", "true");
      content.style.display = "block";
    } else {
      section.classList.add("collapsed");
      button.textContent = "+";
      button.setAttribute("aria-expanded", "false");
      content.style.display = "none";
    }

    this.updateAllChartIcons();
  }

  updateAllChartIcons() {
    this.updateChartIconVisibility("expenseChart", "expenseChartIcon");
    this.updateChartIconVisibility("incomeChart", "incomeChartIcon");
    this.updateChartIconVisibility("trendsChart", "trendsChartIcon");
  }

  setChartEmptyState(canvasId, iconId, isEmpty) {
    const canvas = document.getElementById(canvasId);
    const icon = document.getElementById(iconId);
    const wrapper = canvas?.closest(".chart-placeholder-wrapper");
    if (!canvas || !icon || !wrapper) return;

    wrapper.classList.toggle("is-empty", isEmpty);
    icon.classList.toggle("hidden", isEmpty);
  }

  updateChartIconVisibility(canvasId, iconId) {
    const canvas = document.getElementById(canvasId);
    const icon = document.getElementById(iconId);
    if (!canvas || !icon) return;

    const section = canvas.closest(".brick");
    const isCollapsed = section && section.classList.contains("collapsed");
    const hasData = canvas.style.display !== "none";

    if (isCollapsed || !hasData) icon.classList.add("hidden");
    else icon.classList.remove("hidden");
  }
}

// Initialize the app only on the actual main page
let app;
function initializeApp() {
  if (
    typeof document !== "undefined" &&
    document.getElementById("expense-form")
  ) {
    app = new ExpenseTracker();
    window.app = app;
    window.ExpenseTracker = ExpenseTracker;

    const target = window.location.hash;
    const allowedTargets = new Set([
      "#category-section",
      "#budget-section",
      "#filter-section",
      "#expense-chart-section",
      "#transactions-section",
    ]);
    if (target === "#import-entry-panel") app.setEntryMode("import");
    const advancedTarget = allowedTargets.has(target)
      ? document.getElementById(target.slice(1))
      : null;
    if (advancedTarget) {
      const tools = document.getElementById("advanced-tools");
      const toggle = document.getElementById("advanced-toggle");
      if (tools) tools.classList.remove("hidden");
      if (toggle) {
        toggle.setAttribute("aria-expanded", "true");
        toggle
          .querySelector("span")
          ?.replaceChildren(document.createTextNode("Hide Advanced Tools"));
      }
      advancedTarget.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeApp);
  } else {
    initializeApp();
  }
}

if (typeof window !== "undefined") {
  window.calculateTotals = calculateTotals;
  window.getFilteredTransactions = getFilteredTransactions;
  window.getCategoryTotals = getCategoryTotals;
  window.getBudgetPeriodRange = getBudgetPeriodRange;
  window.getCategorySpendForPeriod = getCategorySpendForPeriod;
  window.evaluateBudgetAlerts = evaluateBudgetAlerts;
  window.getBudgetProgressState = getBudgetProgressState;
  window.csvField = csvField;
  window.parseCsv = parseCsv;
  window.detectImportFormat = detectImportFormat;
  window.normalizeImportedRows = normalizeImportedRows;
  window.normalizeBackupData = normalizeBackupData;
  window.capitalize = capitalize;
  window.convertAmount = convertAmount;
  window.getDisplayAmount = getDisplayAmount;
  window.getDisplayTransactions = getDisplayTransactions;
  window.showCurrencyPrompt = () => {
    if (window.app && typeof window.app.showCurrencyPromptForPreview === "function") {
      return window.app.showCurrencyPromptForPreview();
    }
    const modal = document.getElementById("currency-modal");
    const select = document.getElementById("currency-modal-select");
    if (!modal || !select) return false;
    localStorage.setItem("currencyPromptDismissed", "false");
    modal.hidden = false;
    document.body.classList.add("currency-modal-open");
    select.focus();
    return true;
  };
}

if (typeof module !== "undefined") {
  module.exports = {
    ExpenseTracker,
    calculateTotals,
    getFilteredTransactions,
    getCategoryTotals,
    getBudgetPeriodRange,
    getCategorySpendForPeriod,
    evaluateBudgetAlerts,
    getBudgetProgressState,
    csvField,
    parseCsv,
    detectImportFormat,
    normalizeImportedRows,
    normalizeBackupData,
    capitalize,
    convertAmount,
    getDisplayAmount,
    getDisplayTransactions,
    getChartPalette,
    normalizeStoredTransactions,
    normalizeStoredBudgets,
    shouldPromptForCurrency,
  };
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  (function () {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    const spinTargets = [
      { el: document.querySelector(".brand-badge"), pxPerRotation: 1000 },
      { el: document.getElementById("bgCrystal"), pxPerRotation: 1400 },
    ].filter((t) => t.el);

    if (spinTargets.length === 0) return;

    let ticking = false;

    function applyRotation() {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      spinTargets.forEach(({ el, pxPerRotation }) => {
        const degrees = (scrollY / pxPerRotation) * 360;
        el.style.transform = `rotate(${degrees}deg)`;
      });
      ticking = false;
    }

    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          requestAnimationFrame(applyRotation);
          ticking = true;
        }
      },
      { passive: true },
    );

    applyRotation();
  })();
}
