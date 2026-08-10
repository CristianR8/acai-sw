const BASE_URL = process.env.INVENTORY_BASE_URL || "http://localhost:3000";
const API_BASE_URL =
  process.env.INVENTORY_API_BASE_URL || `${BASE_URL.replace(/\/$/, "")}/api`;

const DEFAULT_UNIT_COST = 5000; // $5,000 COP por unidad

const items = [
  { name: "Vaso Budweiser", quantity: 17 },
  { name: "Copa de agua", quantity: 5 },
  { name: "Copa de vino", quantity: 6 },
  { name: "Copa Stella", quantity: 14 },
  { name: "Copa margarita", quantity: 1 },
  { name: "Copa club colombia", quantity: 25 },
  { name: "Vasos diferentes", quantity: 2 },
  { name: "Vasos mojito", quantity: 1 },
  { name: "Copa malteada", quantity: 14 },
  { name: "Copa tulipán", quantity: 8 },
  { name: "Copas balón sodas", quantity: 4 },
  { name: "Vasos roquero", quantity: 5 },
  { name: "Jarras", quantity: 12 },
  { name: "Jarras cuadrada", quantity: 1 },
  { name: "Copas cuadradas sodas", quantity: 10 },
];

async function createProduct(item) {
  const totalCost = item.quantity * DEFAULT_UNIT_COST;
  const url = `${API_BASE_URL}/inventory/products`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: item.name,
      unit: "unidades",
      kind: "material",
      initial_quantity: item.quantity,
      total_cost: totalCost,
      is_active: true,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      (typeof payload?.message === "string" && payload.message) ||
      (typeof payload?.detail === "string" && payload.detail) ||
      `Error ${response.status}`;
    return { success: false, name: item.name, error: message };
  }

  return { success: true, name: item.name, id: payload.id };
}

async function main() {
  console.log(`Agregando ${items.length} items de cristalería...`);
  console.log(`Precio por defecto: $${DEFAULT_UNIT_COST.toLocaleString()} COP/unidad\n`);

  let created = 0;
  let failed = 0;

  for (const item of items) {
    const result = await createProduct(item);
    if (result.success) {
      console.log(`✓ ${item.name} (${item.quantity} uds, $${(item.quantity * DEFAULT_UNIT_COST).toLocaleString()}) → id: ${result.id}`);
      created++;
    } else {
      console.log(`✗ ${item.name}: ${result.error}`);
      failed++;
    }
  }

  console.log(`\nResultado: ${created} creados, ${failed} fallidos`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
