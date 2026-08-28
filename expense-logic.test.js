import { describe, it, expect } from "vitest";
import {
  calculateTotals,
  getFilteredTransactions,
  csvField,
  parseCsv,
  detectImportFormat,
  normalizeImportedRows,
  normalizeBackupData,
  capitalize,
  getCategoryTotals,
  getBudgetPeriodRange,
  getCategorySpendForPeriod,
  evaluateBudgetAlerts,
  getBudgetProgressState,
  convertAmount,
  getDisplayAmount,
  getDisplayTransactions,
  ExpenseTracker,
} from "./app.js";

describe("convertAmount", () => {
  it("converts an amount using the supplied exchange rate", () => {
    expect(convertAmount(100, 0.92)).toBeCloseTo(92);
  });

  it("leaves invalid values unchanged", () => {
    expect(convertAmount(100, NaN)).toBe(100);
  });
});

describe("display-only currency conversion", () => {
  it("converts for display without modifying stored transactions or budgets", () => {
    const transactions = [{ type: "expense", amount: 100, currency: "USD" }];
    const budgets = { food: 200 };
    const beforeTransactions = JSON.stringify(transactions);
    const beforeBudgets = JSON.stringify(budgets);

    const displayed = getDisplayTransactions(transactions, "EUR", () => 0.92);

    expect(displayed[0].displayAmount).toBeCloseTo(92);
    expect(displayed[0].displayCurrency).toBe("EUR");
    expect(JSON.stringify(transactions)).toBe(beforeTransactions);
    expect(JSON.stringify(budgets)).toBe(beforeBudgets);
  });

  it("falls back to the original amount and currency when no rate exists", () => {
    expect(getDisplayAmount(100, "USD", "EUR", null)).toEqual({
      amount: 100,
      currency: "USD",
      converted: false,
    });
  });

  it("preserves stored data through repeated A to B to A display changes", () => {
    const transactions = [{ id: 1, amount: 100, currency: "USD" }];
    const budgets = { food: 200 };
    const before = JSON.stringify({ transactions, budgets });
    const resolver = (source, target) => source === "USD" && target === "EUR" ? 0.92 : 1.087;

    getDisplayTransactions(transactions, "EUR", resolver);
    getDisplayTransactions(transactions, "USD", resolver);

    expect(JSON.stringify({ transactions, budgets })).toBe(before);
  });

  it("does not mutate stored data when the display currency changes", () => {
    const tracker = Object.create(ExpenseTracker.prototype);
    tracker.currency = "USD";
    tracker.render = () => {};
    const transactions = [{ id: 1, amount: 100, currency: "USD" }];
    const budgets = { food: 200 };
    tracker.transactions = transactions;
    tracker.budgets = budgets;
    const before = JSON.stringify({ transactions, budgets });

    const previousStorage = globalThis.localStorage;
    globalThis.localStorage = { setItem: () => {} };
    try {
      tracker.changeDisplayCurrency("EUR");
      tracker.changeDisplayCurrency("USD");
    } finally {
      if (previousStorage === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = previousStorage;
    }

    expect(JSON.stringify({ transactions, budgets })).toBe(before);
  });
});

describe("calculateTotals", () => {
  it("sums income, expenses, and balance correctly", () => {
    const transactions = [
      { type: "income", amount: 100 },
      { type: "income", amount: 50 },
      { type: "expense", amount: 40 },
      { type: "expense", amount: 15 },
    ];

    expect(calculateTotals(transactions)).toEqual({
      income: 150,
      expenses: 55,
      balance: 95,
    });
  });

  it("returns zero totals for empty arrays", () => {
    expect(calculateTotals([])).toEqual({
      income: 0,
      expenses: 0,
      balance: 0,
    });
  });

  it("handles mixed transaction types correctly", () => {
    const transactions = [
      { type: "income", amount: 10 },
      { type: "expense", amount: 3 },
      { type: "expense", amount: 7 },
      { type: "income", amount: 2 },
    ];

    expect(calculateTotals(transactions)).toEqual({
      income: 12,
      expenses: 10,
      balance: 2,
    });
  });

  it("supports filtered and unfiltered totals", () => {
    const transactions = [
      { type: "income", amount: 100, date: "2024-01-01" },
      { type: "expense", amount: 30, date: "2024-02-01" },
      { type: "expense", amount: 40, date: "2024-03-01" },
    ];

    expect(calculateTotals(transactions, false)).toEqual({ income: 100, expenses: 70, balance: 30 });
    expect(
      calculateTotals(transactions, true, { type: "expense", dateFrom: "2024-02-01", dateTo: "2024-03-31" }),
    ).toEqual({ income: 0, expenses: 70, balance: -70 });
  });
});

describe("getFilteredTransactions", () => {
  it("filters by type", () => {
    const transactions = [
      { type: "income", date: "2024-01-05" },
      { type: "expense", date: "2024-01-07" },
    ];

    expect(getFilteredTransactions(transactions, { type: "expense" })).toEqual([
      { type: "expense", date: "2024-01-07" },
    ]);
  });

  it("filters by date from", () => {
    const transactions = [
      { type: "income", date: "2024-01-05" },
      { type: "expense", date: "2024-01-20" },
    ];

    expect(getFilteredTransactions(transactions, { dateFrom: "2024-01-10" })).toEqual([
      { type: "expense", date: "2024-01-20" },
    ]);
  });

  it("filters by date to", () => {
    const transactions = [
      { type: "income", date: "2024-01-05" },
      { type: "expense", date: "2024-01-20" },
    ];

    expect(getFilteredTransactions(transactions, { dateTo: "2024-01-10" })).toEqual([
      { type: "income", date: "2024-01-05" },
    ]);
  });

  it("combines type and date filters", () => {
    const transactions = [
      { type: "income", date: "2024-01-05" },
      { type: "expense", date: "2024-01-07" },
      { type: "expense", date: "2024-01-20" },
    ];

    expect(
      getFilteredTransactions(transactions, {
        type: "expense",
        dateFrom: "2024-01-10",
        dateTo: "2024-01-31",
      }),
    ).toEqual([{ type: "expense", date: "2024-01-20" }]);
  });

  it("returns everything when no filters are provided", () => {
    const transactions = [
      { type: "income", date: "2024-01-05" },
      { type: "expense", date: "2024-01-20" },
    ];

    expect(getFilteredTransactions(transactions)).toEqual(transactions);
  });

  it("filters by category and description search", () => {
    const transactions = [
      { type: "expense", category: "food", description: "Weekly groceries", date: "2024-01-05" },
      { type: "expense", category: "transport", description: "Train ticket", date: "2024-01-06" },
      { type: "income", category: "salary", description: "Monthly salary", date: "2024-01-07" },
    ];

    expect(getFilteredTransactions(transactions, { category: "food", search: "GROCER" })).toEqual([
      transactions[0],
    ]);
  });
});

describe("csvField", () => {
  it("quotes normal strings correctly", () => {
    expect(csvField("hello")).toBe('"hello"');
  });

  it("escapes embedded double quotes", () => {
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
  });

  it("prepends apostrophe to formula-like values", () => {
    expect(csvField("=cmd")).toBe('"\'=cmd"');
    expect(csvField("+1")).toBe('"\'+1"');
    expect(csvField("-1")).toBe('"\'-1"');
    expect(csvField("@evil")).toBe('"\'@evil"');
  });
});

describe("CSV statement import", () => {
  it("parses quoted commas and CRLF rows", () => {
    expect(parseCsv('Date,Description,Amount,Type\r\n01/02/2024,"Cafe, lunch","₹1,200.50",Debit\r\n')).toEqual({
      headers: ["Date", "Description", "Amount", "Type"],
      rows: [["01/02/2024", "Cafe, lunch", "₹1,200.50", "Debit"]],
    });
  });

  it("detects bank columns and normalizes debit rows", () => {
    const parsed = parseCsv("Date,Narration,Debit,Credit,Balance\n31/12/2024,Groceries,2, ,100\n");
    const mapping = detectImportFormat(parsed.headers);
    expect(mapping.source).toBe("bank");
    expect(normalizeImportedRows(parsed, mapping)).toEqual([{
      date: "2024-12-31",
      type: "expense",
      category: "other",
      description: "Groceries",
      amount: 2,
      currency: "USD",
    }]);
  });
});

describe("normalizeBackupData", () => {
  it("accepts a valid backup unchanged", () => {
    const backup = {
      version: 1,
      exportedAt: "2024-01-01T00:00:00.000Z",
      transactions: [{ type: "income", amount: 10, date: "2024-01-01" }],
      customCategories: { expense: ["food"], income: ["salary"] },
      budgets: { food: 200 },
      currency: "USD",
    };

    expect(normalizeBackupData(backup)).toEqual(backup);
  });

  it("fills missing customCategories.income with an empty array", () => {
    const backup = {
      transactions: [],
      customCategories: { expense: ["food"] },
      budgets: {},
      currency: "USD",
    };

    expect(normalizeBackupData(backup).customCategories.income).toEqual([]);
  });

  it("defaults invalid budget structures to an empty object", () => {
    const backup = {
      transactions: [],
      customCategories: { expense: [], income: [] },
      budgets: [],
      currency: "USD",
    };

    expect(normalizeBackupData(backup).budgets).toEqual({});
  });

  it("throws for malformed backup payloads", () => {
    expect(() => normalizeBackupData({ transactions: "nope" })).toThrow();
    expect(() => normalizeBackupData(null)).toThrow();
    expect(() => normalizeBackupData([])).toThrow();
  });

  it("drops invalid transaction records while keeping valid records", () => {
    const normalized = normalizeBackupData({
      transactions: [
        { type: "expense", amount: 20, date: "2024-01-01" },
        { type: "expense", amount: -5, date: "2024-01-01" },
        { type: "unknown", amount: 10, date: "2024-01-01" },
      ],
    });

    expect(normalized.transactions).toEqual([
      { type: "expense", amount: 20, date: "2024-01-01" },
    ]);
  });
});

describe("capitalize", () => {
  it("handles empty strings", () => {
    expect(capitalize("")).toBe("");
  });

  it("handles single characters", () => {
    expect(capitalize("a")).toBe("A");
  });

  it("keeps already-capitalized strings intact", () => {
    expect(capitalize("Food")).toBe("Food");
  });
});

describe("getCategoryTotals", () => {
  it("groups transaction amounts by category", () => {
    const transactions = [
      { type: "expense", category: "food", amount: 10 },
      { type: "expense", category: "food", amount: 15 },
      { type: "income", category: "salary", amount: 100 },
      { type: "expense", category: "transport", amount: 20 },
    ];

    expect(getCategoryTotals(transactions, "expense")).toEqual({
      food: 25,
      transport: 20,
    });
  });
});

describe("budget alerts", () => {
  it("fires an 80% warning once for a category in the current period", () => {
    const transactions = [
      { id: 1, type: "expense", category: "food", amount: 80, date: "2024-08-05" },
    ];
    const budgets = { food: 100 };
    const period = { dateFrom: "2024-08-01", dateTo: "2024-08-31" };

    const alerts = evaluateBudgetAlerts(transactions, budgets, period, {});

    expect(alerts).toEqual([
      { category: "food", level: "warning", message: "You've used 80% of your Food budget", spend: 80, budget: 100 },
    ]);

    const repeats = evaluateBudgetAlerts([
      ...transactions,
      { id: 2, type: "expense", category: "food", amount: 10, date: "2024-08-06" },
    ], budgets, period, { food: { warning: true, alert: false } });

    expect(repeats).toEqual([]);
  });

  it("fires the 100% alert once and does not double-fire on later transactions", () => {
    const period = { dateFrom: "2024-08-01", dateTo: "2024-08-31" };
    const budgets = { food: 100 };
    const initial = evaluateBudgetAlerts([
      { id: 1, type: "expense", category: "food", amount: 100, date: "2024-08-10" },
    ], budgets, period, {});

    expect(initial).toEqual([
      { category: "food", level: "alert", message: "You've used 100% of your Food budget", spend: 100, budget: 100 },
    ]);

    const repeat = evaluateBudgetAlerts([
      { id: 1, type: "expense", category: "food", amount: 100, date: "2024-08-10" },
      { id: 2, type: "expense", category: "food", amount: 10, date: "2024-08-12" },
    ], budgets, period, { food: { warning: true, alert: true } });

    expect(repeat).toEqual([]);
  });

  it("batches CSV import alerts into one toast per category", () => {
    const period = { dateFrom: "2024-08-01", dateTo: "2024-08-31" };
    const budgets = { food: 100, transport: 50 };
    const importTransactions = [
      { id: 1, type: "expense", category: "food", amount: 50, date: "2024-08-03" },
      { id: 2, type: "expense", category: "food", amount: 60, date: "2024-08-15" },
      { id: 3, type: "expense", category: "transport", amount: 60, date: "2024-08-20" },
    ];

    const alerts = evaluateBudgetAlerts(importTransactions, budgets, period, {});

    expect(alerts).toEqual([
      { category: "food", level: "alert", message: "You've used 110% of your Food budget", spend: 110, budget: 100 },
      { category: "transport", level: "alert", message: "You've used 120% of your Transport budget", spend: 60, budget: 50 },
    ]);
  });

  it("calculates the budget progress indicator state for the current period", () => {
    const spend = getCategorySpendForPeriod([
      { type: "expense", category: "food", amount: 80, date: "2024-08-05" },
      { type: "expense", category: "food", amount: 10, date: "2024-08-12" },
    ], "food", { dateFrom: "2024-08-01", dateTo: "2024-08-31" });

    expect(spend).toBe(90);
    expect(getBudgetProgressState(90, 100)).toEqual({
      percentage: 90,
      status: "warning",
      fillWidth: "90%",
      label: "90%",
      remaining: 10,
      statusLabel: "Close to limit",
    });

    expect(getBudgetProgressState(40, 100)).toEqual({
      percentage: 40,
      status: "safe",
      fillWidth: "40%",
      label: "40%",
      remaining: 60,
      statusLabel: "On track",
    });

    expect(getBudgetProgressState(120, 100)).toEqual({
      percentage: 100,
      status: "alert",
      fillWidth: "100%",
      label: "100%",
      remaining: -20,
      statusLabel: "Over budget",
    });
  });

  it("uses the current month period when no explicit budget dates are supplied", () => {
    const now = new Date("2024-08-15T12:00:00Z");
    const range = getBudgetPeriodRange({}, now);

    expect(range).toEqual({
      dateFrom: "2024-08-01",
      dateTo: "2024-08-31",
    });
  });

  it("recalculates the indicator after removing a transaction from the period", () => {
    const period = { dateFrom: "2024-08-01", dateTo: "2024-08-31" };
    const transactions = [
      { type: "expense", category: "food", amount: 90, date: "2024-08-05" },
      { type: "expense", category: "food", amount: 20, date: "2024-08-10" },
    ];

    const spendAfterDelete = getCategorySpendForPeriod(
      transactions.filter((transaction) => transaction.amount !== 20),
      "food",
      period,
    );

    expect(spendAfterDelete).toBe(90);
    expect(getBudgetProgressState(spendAfterDelete, 100)).toEqual({
      percentage: 90,
      status: "warning",
      fillWidth: "90%",
      label: "90%",
      remaining: 10,
      statusLabel: "Close to limit",
    });

    const spendBackUnderThreshold = getCategorySpendForPeriod(
      transactions.filter((transaction) => transaction.amount !== 90),
      "food",
      period,
    );

    expect(spendBackUnderThreshold).toBe(20);
    expect(getBudgetProgressState(spendBackUnderThreshold, 100)).toEqual({
      percentage: 20,
      status: "safe",
      fillWidth: "20%",
      label: "20%",
      remaining: 80,
      statusLabel: "On track",
    });
  });
});
