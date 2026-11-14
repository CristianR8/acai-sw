// Run against a local preview; every API is mocked, so no business data is changed.
const { chromium } = require("playwright-core");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "America/Bogota" });
  await context.addInitScript(() => {
    localStorage.setItem("acai_access_token", "test-only-mocked-token");
    localStorage.setItem("acaipark_user_role", "administrator");
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(120000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const fixturePayments = [
    { id: 1, fixed_expense_id: 1, name: "Nómina de cajero", category: "Nómina", concept: "Quincena", amount: "300000", payment_date: today, status: "manual", expense_type: "operacional_fijo" },
    { id: 2, fixed_expense_id: 2, name: "Personal de seguridad", category: "Nómina", concept: "Sábado", amount: "100000", payment_date: today, status: "manual", expense_type: "operacional_fijo" },
    { id: 3, fixed_expense_id: 3, name: "Arriendo", category: "Local", concept: "Noviembre", amount: "350000", payment_date: today, status: "manual" },
    { id: 4, fixed_expense_id: 1, name: "Nómina de cajero", category: "Nómina", concept: "Anulado", amount: "999999", payment_date: today, status: "void" },
  ];
  let purchases = [{ id: 1, invoice_id: "F-1", supplier_name: "Frutas", purchased_at: `${today}T12:00:00-05:00`, created_at: `${today}T12:00:00-05:00`, total_cost: 10000, payment_method: "credit", payment_status: "credit", paid_amount: 0, balance: 10000, payments: [], items: [{ id: 1, product_id: 1, product_name: "Fresas", quantity: 3000, unit_cost: 3.3333, line_total: 10000 }] }];
  let lastPurchase = null, lastAbono = null, lastCorrection = null, lastCounts = null;
  let method = "cash";
  const sale = () => ({ id: 1, order_id: 1, status: "active", payment_method: method, created_at: `${today}T12:00:00-05:00`, total: 50000, subtotal: 50000, tax_total: 0, service_total: 0, discount_total: 0, courtesy_count: 0, discount_count: 0, items: [{ id: 1, name: "Cono", quantity: 5, line_total: 50000 }] });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    let body = [];
    if (url.pathname === "/api/auth/me") body = { name: "Admin prueba", email: "admin@example.test", role: "administrator" };
    else if (url.pathname === "/api/expenses/payments") body = fixturePayments;
    else if (url.pathname === "/api/inventory/products") body = [{ id: 1, name: "Fresas", kind: "ingredient", unit: "gramos" }];
    else if (url.pathname === "/api/inventory/purchases") {
      if (request.method() === "POST") lastPurchase = request.postDataJSON();
      body = request.method() === "POST" ? purchases[0] : purchases;
    } else if (url.pathname === "/api/inventory/purchases/1/payments") {
      lastAbono = request.postDataJSON();
      purchases = [{ ...purchases[0], payment_status: "partial", paid_amount: 3000, balance: 7000, payments: [{ id: 1, is_initial: false, ...lastAbono }] }];
      body = purchases[0];
    } else if (url.pathname === "/api/sales/1/payment-method") {
      lastCorrection = { ...request.postDataJSON(), authorization: request.headers().authorization };
      method = lastCorrection.payment_method;
      body = sale();
    } else if (url.pathname === "/api/sales") body = [sale(), { ...sale(), id: 2, status: "void" }];
    else if (url.pathname === "/api/sales/summary/daily-payment-methods") body = { date: today, cash_total: method === "cash" ? 50000 : 0, dataphone_total: 0, transfer_total: method === "transfer" ? 50000 : 0, total: 50000 };
    else if (url.pathname === "/api/sales/summary/products") body = [{ menu_item_id: null, name: "Cono", quantity: 5, total: 50000 }];
    else if (url.pathname === "/api/sales/cash-closing") {
      if (request.method() === "PUT") lastCounts = request.postDataJSON();
      body = { cash_total: 50000, transfer_total: 0, dataphone_total: 0, total: 50000, opening_total: 20000, expenses_total: 1000, purchases_total: 10000, expected_cash: 59000, denomination_counts: lastCounts?.denomination_counts ?? {}, physical_cash: 0, difference: -59000, outflows: [{ reference: "Gasto #1", name: "Transporte", concept: "Taxi", amount: 1000 }, { reference: "Compra #1 / Pago #1", name: "Frutas", concept: "Fresas", amount: 10000 }], sales_count: 1, products: [{ name: "Cono", quantity: 5, total: 50000 }] };
    }
    await route.fulfill({ status: 200, json: body });
  });
  const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3101";
  const artifacts = path.resolve(__dirname, "../../tmp/november-browser");
  fs.mkdirSync(artifacts, { recursive: true });
  try {
    console.log("Browser connected; opening expense screen");
    await page.goto(`${base}/expenses`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Historial de gastos" }).waitFor();
    await page.getByLabel(/^Categoría/).selectOption("Nómina");
    await page.getByLabel(/^Estado/).selectOption("manual");
    await page.getByLabel(/^Ordenar por/).selectOption("amount_desc");
    assert.equal(await page.locator("tbody tr").count(), 2);
    assert.match(await page.locator("tbody tr").first().innerText(), /Nómina de cajero/);
    assert.match(await page.getByText(/Total filtrado:/).innerText(), /400\.000/);
    await page.getByLabel("Buscar por nombre, categoría o concepto").fill("sabado");
    assert.equal(await page.locator("tbody tr").count(), 1);
    await page.getByRole("button", { name: "Limpiar filtros de análisis" }).click();
    await page.screenshot({ path: path.join(artifacts, "expenses.png"), fullPage: true });
    console.log("PASS expense filters, payroll category, totals and ordering");

    await page.goto(`${base}/inventory/purchases`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Registrar compra", exact: true }).click();
    await page.getByLabel("Naturaleza de la compra").selectOption("cash_drawer");
    await page.getByLabel("Pago inicial / abono").fill("3000");
    await page.getByLabel(/^Nombre/).selectOption("1");
    await page.getByLabel("Cantidad", { exact: true }).fill("3000");
    await page.getByLabel("Costo total", { exact: true }).fill("10000");
    const purchaseReload = page.waitForResponse((response) => response.url().includes("/api/inventory/purchases?") && response.request().method() === "GET");
    await page.getByRole("button", { name: "Registrar compra", exact: true }).last().click();
    await purchaseReload;
    await page.getByText("Cargando compras...").waitFor({ state: "hidden" });
    await page.waitForFunction(() => !document.querySelector('input[placeholder="Vacío = total pendiente"]'));
    assert.equal(lastPurchase.payment_method, "cash_drawer");
    assert.equal(lastPurchase.initial_payment_amount, 3000);
    assert.equal(lastPurchase.items[0].line_total, 10000);
    assert.equal(lastPurchase.items[0].unit_cost, 3.3333);
    await page.locator("summary").filter({ hasText: "Crédito" }).click();
    await page.getByLabel("Monto del abono").fill("3000");
    await page.getByRole("button", { name: "Guardar abono" }).click();
    await page.locator("summary").filter({ hasText: "Abono" }).waitFor();
    assert.equal(lastAbono.payment_method, "cash_drawer");
    assert.equal(lastAbono.amount, 3000);
    await page.screenshot({ path: path.join(artifacts, "purchases.png"), fullPage: true });
    console.log("PASS purchase payment form, exact cost and dated installment");

    await page.goto(`${base}/sales`, { waitUntil: "domcontentloaded" });
    await page.getByLabel("Medio de pago de venta #1").selectOption("transfer");
    await page.getByRole("button", { name: "Guardar cambio" }).click();
    await page.getByRole("status").filter({ hasText: "venta #1 actualizado" }).waitFor();
    assert.deepEqual(lastCorrection, { payment_method: "transfer", previous_payment_method: "cash", authorization: "Bearer test-only-mocked-token" });
    assert.equal(await page.getByLabel("Medio de pago de venta #2").count(), 0);
    await page.getByRole("button", { name: "Ver ventas de este día" }).click();
    await page.getByLabel("Medio de pago de venta #1").waitFor();
    await page.screenshot({ path: path.join(artifacts, "sales.png"), fullPage: true });
    console.log("PASS sale correction, void protection and daily sales selection");

    await page.goto(`${base}/cash-closing`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Resumen de ventas del día" }).waitFor();
    assert.equal(await page.getByText("Datáfono", { exact: true }).count(), 0);
    assert.equal(await page.getByText("Compra #1 / Pago #1", { exact: true }).count(), 1);
    await page.getByLabel(/Billete de.*50\.000/).fill("1");
    assert.equal(await page.getByRole("link", { name: "Descargar Excel" }).count(), 0);
    await page.getByRole("button", { name: "Guardar conteo" }).click();
    await page.getByRole("link", { name: "Descargar Excel" }).waitFor();
    assert.equal(lastCounts.denomination_counts["50000"], 1);
    await page.screenshot({ path: path.join(artifacts, "closing.png"), fullPage: true });
    console.log("PASS itemized closing, saved count, export links and product summary");
    assert.deepEqual(errors, []);
    console.log("PASS no browser runtime errors");
  } catch (error) {
    await page.screenshot({ path: path.join(artifacts, "failure.png"), fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
