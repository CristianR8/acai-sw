const BASE_URL = process.env.INVENTORY_BASE_URL || "http://localhost:3000";
const DEFAULT_QUANTITY = 100;
const DEFAULT_TOTAL_COST = 20000;
const VALID_UNITS = new Set(["mililitros", "gramos", "unidades"]);

const rawList = `
Aceite freidora -- mililitros
Aceite girasol -- mililitros
Aceite oliva -- mililitros
Mantequilla -- gramos
Champiñones -- gramos
Sal -- gramos
Pimienta -- gramos
Paprika -- gramos
Pimienta -- gramos
Nuez moscada -- gramos
Sal marina -- gramos
Azúcar -- gramos
Harina de trigo -- gramos
Huevos -- unidades
Esencia de vainilla -- mililitros
Mazorcas -- unidades
Chorizos -- unidades
Salchicha tipo americana -- unidades
Papa ripio -- gramos
Salchicha alemana -- unidades
Panela -- gramos
Cerveza -- mililitros
Nachos -- gramos
Sour cream -- mililitros
Guacamole -- mililitros
Crema de leña -- mililitros
Salsa ahumadora de leña -- mililitros
Salsa soya -- mililitros
Salsa Humo -- mililitros
Salsa tomate -- mililitros
Salsa bbq -- mililitros
Salsa moztasa -- mililitros
Salsa mayonesa -- mililitros
Chunchulla -- gramos
Chicharrones -- gramos
Punta de anca -- gramos
Chatas -- gramos
Mojarra -- unidades
Carne desmechada -- gramos
Pollo desmechado -- gramos
Lomo fino -- gramos
Bondiola cerdo -- gramos
Costillas -- gramos
Carne molida -- gramos
Pechuga de pollo -- gramos
Tocineta -- unidades
Camarones -- gramos
Salmon -- gramos
Nuguets -- gramos
Cebolla cabezona roja -- gramos
Cebolla cabezona blanca -- gramos
Cebolla larga -- gramos
Pimentón -- gramos
Zanahoria -- gramos
Papa amarilla -- gramos
Papa negra -- gramos
Arracacha -- gramos
Perejil -- gramos
Cilantro -- gramos
Cogollo -- gramos
Apio en rama -- gramos
Queso parmesano -- gramos
Tomate cherry -- gramos
Tomate milano -- gramos
Tomate chonto -- gramos
Pepino -- gramos
Piña -- gramos
Panko -- gramos
Limón -- gramos
Papa francesa -- gramos
Repollo -- gramos
Aceite trufa -- mililitros
Tortillas bimbo -- unidades
Galletas Ducales -- unidades
Galletas saltin -- unidades
Ponque ramo -- unidades
Achiras -- gramos
Fresa -- gramos
Mango -- gramos
Kiwi -- gramos
Naranja -- gramos
Limón -- gramos
Yerbabuena -- gramos
Romero -- gramos
Manzana -- gramos
Uva Isabella -- gramos
Mora -- gramos
Coco deshidratado -- gramos
Arándano -- gramos
Chantilly -- gramos
Limón deshidratado -- gramos
Granadina -- mililitros
Blue curacao -- mililitros
Ginebra -- mililitros
Ginebra rose -- mililitros
Tequila -- mililitros
Ron blanco -- mililitros
Vino segu ole tinto -- mililitros
Soda -- mililitros
Triplesec -- mililitros
Aguardiente -- mililitros
Agua tónica -- mililitros
Coca-Cola -- mililitros
Cuatro -- mililitros
Ginet -- mililitros
Manzana postobon -- mililitros
Cola hipinto -- mililitros
Uva postobon -- mililitros
Uchuva -- gramos
Cola y Pola -- mililitros
Andina refajo -- mililitros
Club colombia -- mililitros
Coronita -- mililitros
Aguila ligth -- mililitros
Aguila original -- mililitros
Poker -- mililitros
3 cordilleras -- mililitros
Heineken -- mililitros
Stella -- mililitros
Vino botella -- unidades
Champagnat jp botella -- unidades
Gomitas -- unidades
Banderitas gomas -- unidades
Helado vainilla -- mililitros
Helado fresa -- mililitros
Helado maracuyá -- mililitros
Leche condensada -- mililitros
Chispitas de chocolate -- gramos
Tajín -- gramos
Sal de colores -- gramos
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
      const [namePart, unitPart] = line.split("--").map((part) => part.trim());
      if (!namePart || !unitPart) return;
      const normalized = normalizeName(namePart);
      if (seen.has(normalized)) return;
      seen.add(normalized);
      entries.push({ name: namePart, unit: unitPart.toLowerCase() });
    });

  return entries;
}

async function fetchExisting() {
  const url = `${BASE_URL}/api/inventory/products?kind=ingredient`;
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
      unit: item.unit,
      kind: "ingredient",
      initial_quantity: DEFAULT_QUANTITY,
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
  const invalidUnits = items.filter((item) => !VALID_UNITS.has(item.unit));
  if (invalidUnits.length) {
    throw new Error(
      `Unidades inválidas: ${invalidUnits.map((item) => item.name).join(", ")}`,
    );
  }

  const existing = await fetchExisting();
  const existingNames = new Set(
    existing.map((item) => normalizeName(item?.name ?? "")),
  );

  const toCreate = items.filter((item) => !existingNames.has(normalizeName(item.name)));
  if (!toCreate.length) {
    console.log("No hay ingredientes nuevos para agregar.");
    return;
  }

  let created = 0;
  for (const item of toCreate) {
    await createProduct(item);
    created += 1;
  }

  console.log(`Ingredientes creados: ${created}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
