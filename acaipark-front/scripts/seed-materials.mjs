const BASE_URL = process.env.INVENTORY_BASE_URL || "http://localhost:3000";
const DEFAULT_TOTAL_COST = 50000;

const rawList = `
Mesas plásticas x1
Mesa madera x4
Mesa madera por x6
Silla plástica x1
Bancos x1
Silla metálica x1
Servilleteros x1
Licuadoras x1
Bailarinas x1
Sartenes x1
Ollas x1
Cucharas x1
Cuchillos de mesa x1
Tenedor de mesa x1
Cuchillos de cocina x1
Pinzas de precisión x1
Picadoras x1
Escobas x1
Traperos x1
Computadores x1
Grapadoras x1
Marcadores x1
Rotuladores x1
Copa Balón x3
Copa de michelada x1
Vasos altos relieve x2
Bolsas de hielo x10
Caja de helado x1.5
Paquetes fichas de parques x5
Tenedores x15
Cuchillos x30
Cucharas x15
Domino x1
Paquete cartas UNO x1
Jarra de limonada x1
Copa margarita x1
Cuchillo pequeño blanco x5
Cuchillo blanco grande x2
Cuchillo amarillo x2
Cuchillo morado x1
Pinzas pequeñas x2
Pinza grande x1
Aplasta carne x2
Rayadores x2
Picador de verduras x1
Tablas para picar medianas x4
Platos viejos de hamburguesa x15
Platos verdes nuevos x5
Platos negros x16
Platos azules nuevos x10
Platos color crema nuevos x4
Platos viejos pequeños x6
Platos pequeños nuevos x3
Platos pequeños hondos x2
Plato hondo pequeño azul x1
Platos hondos x14
Platos hondos naranja x12
Platos hondos azules x8
Platos hondos grandes colores x7
Platos hondos blancos x3
Platos hondos fetuccini x3
Jarras de barro chocolate x3
Jarras metálicas pequeñas chocolate x6
Jarra metálica mediana chocolate x1
Jarra metálica grande chocolate x1
Jarra plástica x1
Tazas plásticas medianas x2
Tazas plásticas grandes x2
Copas de ceviche x8
Estufa 4 hornillas x1
Freidora industrial x1
Carrito con plancha y freidoras x1
Plancha industrial x1
Wafleras x2
Gramera x1
Microondas x1
Extractor x1
Congeladores horizontales x4
Congelador vertical x1
Nevera Budweiser x1
Nevera Coca-Cola x1
`;

function normalizeName(value) {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseList(list) {
  const entries = [];
  const seen = new Set();

  list
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const match = line.match(/^(.*)\s+x\s*([0-9]+(?:\.[0-9]+)?)$/i);
      if (!match) return;
      const namePart = match[1].trim();
      const quantityPart = match[2];
      if (!namePart) return;
      const normalized = normalizeName(namePart);
      if (seen.has(normalized)) return;
      seen.add(normalized);
      entries.push({
        name: namePart,
        quantity: quantityPart,
      });
    });

  return entries;
}

async function fetchExisting() {
  const url = `${BASE_URL}/api/inventory/products?kind=material`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`No se pudo cargar inventario (${response.status}).`);
  }
  const payload = await response.json().catch(() => []);
  return Array.isArray(payload) ? payload : [];
}

async function createProduct(item) {
  const response = await fetch(`${BASE_URL}/api/inventory/products`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: item.name,
      unit: null,
      kind: "material",
      initial_quantity: item.quantity,
      total_cost: DEFAULT_TOTAL_COST,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message =
      (typeof payload?.message === "string" && payload.message) ||
      `Error ${response.status}`;
    throw new Error(message);
  }
}

async function main() {
  const items = parseList(rawList);
  const existing = await fetchExisting();
  const existingNames = new Set(
    existing.map((item) => normalizeName(item?.name ?? "")),
  );

  const toCreate = items.filter((item) => !existingNames.has(normalizeName(item.name)));
  if (!toCreate.length) {
    console.log("No hay insumos nuevos para agregar.");
    return;
  }

  let created = 0;
  for (const item of toCreate) {
    await createProduct(item);
    created += 1;
  }

  console.log(`Insumos creados: ${created}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
