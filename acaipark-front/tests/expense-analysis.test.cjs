const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const filename = path.resolve(__dirname, "../src/lib/expense-analysis.ts");
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } });
const analysis = new Module(filename, module);
analysis._compile(compiled.outputText, filename);
const { filterExpenses, groupExpenses, defaultExpenseFilters } = analysis.exports;
const payments = [
  { id: 1, name: "Nómina de cajero", category: "Nómina", concept: "Quincena", amount: "300000", payment_date: "2026-11-01", status: "manual", expense_type: "operacional_fijo" },
  { id: 2, name: "Personal de seguridad", category: "Nómina", concept: "Turno sábado", amount: "100000", payment_date: "2026-11-02", status: "manual", expense_type: "operacional_fijo" },
  { id: 3, name: "Arriendo", category: "Local", concept: "Noviembre", amount: "350000", payment_date: "2026-11-03", status: "manual", expense_type: null },
  { id: 4, name: "Nómina de cajero", category: "Nómina", concept: "Error anulado", amount: "999999", payment_date: "2026-11-04", status: "void", expense_type: null },
];

test("payroll category includes cashier and security with accent-insensitive search", () => {
  const result = filterExpenses(payments, { ...defaultExpenseFilters, search: "nomina", status: "manual" });
  assert.deepEqual(result.map((p) => p.id), [2, 1]);
});
test("largest expense category aggregates records and excludes annulments", () => {
  assert.deepEqual(groupExpenses(payments, "category"), [
    { name: "Nómina", amount: 400000, count: 2 }, { name: "Local", amount: 350000, count: 1 },
  ]);
});
test("combined filters, concept search and descending amount ordering", () => {
  const filters = { ...defaultExpenseFilters, category: "Nómina", classification: "operacional_fijo", status: "manual", sort: "amount_desc" };
  assert.deepEqual(filterExpenses(payments, filters).map((p) => p.id), [1, 2]);
  assert.deepEqual(filterExpenses(payments, { ...filters, search: "sabado" }).map((p) => p.id), [2]);
  assert.deepEqual(filterExpenses(payments, { ...filters, name: "Arriendo" }), []);
});
test("void and unclassified filters remain available without counting void money", () => {
  const result = filterExpenses(payments, { ...defaultExpenseFilters, status: "void", classification: "unclassified" });
  assert.equal(result.length, 1);
  assert.deepEqual(groupExpenses(result, "name"), []);
  assert.deepEqual(payments.map((p) => p.id), [1, 2, 3, 4]);
});
