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
} from "./app.js";

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
