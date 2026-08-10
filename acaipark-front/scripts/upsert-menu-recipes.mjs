const BASE_URL = process.env.INVENTORY_BASE_URL || "http://localhost:3000";
const API_BASE_URL =
  process.env.INVENTORY_API_BASE_URL || `${BASE_URL.replace(/\/$/, "")}/api`;

const recipes = [
  {
    menuName: "PECHUGA EN SALSA DE MARACUYA",
    ingredients: [
      { name: "PECHUGA DE POLLO", unit: "GR", weight: 250, price: 24.0 },
      { name: "QUESO", unit: "GR", weight: 3, price: 21.0 },
      { name: "SALSA DE MARACUYA", unit: "GR", weight: 12, price: 10.8 },
      { name: "PAPA CRIOLLA", unit: "GR", weight: 120, price: 5.0 },
      { name: "SAL", unit: "GR", weight: 5, price: 3.0 },
      { name: "PAPRIKA", unit: "GR", weight: 2, price: 9.0 },
      { name: "ENSALADA", unit: "GR", weight: 5, price: 20.0 },
    ],
  },
  {
    menuName: "MOJARRA",
    ingredients: [
      { name: "MOJARRA", unit: "GR", weight: 500, price: 24.0 },
      { name: "PATACONES", unit: "UND", weight: 0.5, price: 2000.0 },
      { name: "ENSALADA", unit: "GR", weight: 50, price: 20.0 },
      { name: "SAL", unit: "GR", weight: 5, price: 5.0 },
      { name: "LIMON", unit: "GR", weight: 20, price: 4.0 },
    ],
  },
  {
    menuName: "CHICHARRON AL BARRIL",
    ingredients: [
      { name: "PANCETA", unit: "GR", weight: 350, price: 22.0 },
      { name: "PAPA CRIOLLA", unit: "GR", weight: 120, price: 5.0 },
      { name: "ENSALADA", unit: "GR", weight: 50, price: 20.0 },
      { name: "CHIMICHURRI", unit: "GR", weight: 8, price: 28.0 },
      { name: "SAL", unit: "GR", weight: 2, price: 1.0 },
      { name: "PAPRIKA", unit: "GR", weight: 1, price: 9.0 },
    ],
  },
  {
    menuName: "CHICHARRON EN REDUCCION DE PANELA",
    ingredients: [
      { name: "PANCETA", unit: "GR", weight: 250, price: 22.0 },
      { name: "ENSALADA", unit: "GR", weight: 50, price: 20.0 },
      { name: "PAPA CRIOLLA", unit: "GR", weight: 120, price: 5.0 },
      { name: "PAPRIKA", unit: "GR", weight: 1, price: 9.0 },
      { name: "POKER", unit: "GR", weight: 0.5, price: 7900.0 },
    ],
  },
  {
    menuName: "SALMON AL PESTO",
    ingredients: [
      { name: "SALMON", unit: "GR", weight: 300, price: 68.0 },
      { name: "PURE DE PAPA", unit: "GR", weight: 80, price: 5.0 },
      { name: "SAL", unit: "GR", weight: 3, price: 5.0 },
      { name: "ENSALADA", unit: "GR", weight: 50, price: 20.0 },
      { name: "SALSA PESTO", unit: "GR", weight: 12, price: 42.6 },
    ],
  },
  {
    menuName: "PICADA PARA CUATRO",
    ingredients: [
      { name: "PIÑA ASADA", unit: "GR", weight: 80, price: 11.0 },
      { name: "BONDIOLA", unit: "GR", weight: 120, price: 22.0 },
      { name: "PECHUGA", unit: "GR", weight: 120, price: 24.0 },
      { name: "CARNE ASADA", unit: "GR", weight: 120, price: 32.0 },
      { name: "CEBOLLA OCAÑERA", unit: "GR", weight: 30, price: 54.0 },
      { name: "CEBOLLA", unit: "GR", weight: 15, price: 4.0 },
      { name: "PIMENTON", unit: "GR", weight: 15, price: 6.0 },
      { name: "RELLENA", unit: "UND", weight: 2, price: 1900.0 },
      { name: "PAPA CRIOLLA", unit: "GR", weight: 250, price: 5.0 },
      { name: "AROS DE CEBOLLA", unit: "GR", weight: 20, price: 52.0 },
      { name: "CHORIZO SANTA ROSANO", unit: "UND", weight: 2, price: 1875.0 },
    ],
  },
  {
    menuName: "CLASICA BURGUER",
    ingredients: [
      { name: "PAN HAMBURGUESA", unit: "UND", weight: 1, price: 1020.0 },
      { name: "CARNE BURGUER", unit: "UND", weight: 1, price: 4288.0 },
      { name: "SAL", unit: "GR", weight: 1, price: 5.0 },
      { name: "TOMATE", unit: "GR", weight: 5, price: 5.0 },
      { name: "PEPINILLO", unit: "GR", weight: 10, price: 5.0 },
      { name: "PAPA FRANCESA", unit: "GR", weight: 120, price: 8.0 },
      { name: "PAPRIKA", unit: "GR", weight: 1, price: 9.0 },
      { name: "QUESO TAJADO", unit: "GR", weight: 3, price: 21.0 },
      { name: "SALSA TARTARA", unit: "GR", weight: 5, price: 12.5 },
      { name: "TOCINETA", unit: "GR", weight: 5, price: 20.0 },
      { name: "COGOLLO", unit: "GR", weight: 3, price: 28.0 },
    ],
  },
];

// Alias para mapear a ingredientes existentes del inventario.
const INGREDIENT_ALIASES = {
  "pechuga de pollo": ["pechuga"],
  queso: ["queso bloque", "queso costeño"],
  "salsa de maracuya": ["maracuya"],
  ensalada: ["cogollo"],
  patacones: ["platano verde", "platano maduro"],
  limon: ["limón", "limoñ"],
  chimichurri: ["aji", "perejil"],
  poker: ["poker", "cerveza poker"],
  "pure de papa": ["papa criolla", "papa negra"],
  "salsa pesto": ["albahaca"],
  "piña asada": ["piña"],
  "carne asada": ["carne para asar"],
  "cebolla ocañera": ["cebollitas ocañeras"],
  cebolla: ["cebolla cabezona blanca", "cebolla cabezona roja"],
  "chorizo santa rosano": ["chorizo santarosano", "chorizo santarosano"],
  tomate: ["tomate milano", "tomate cherry"],
  pepinillo: ["pepino"],
  "carne burguer": ["carne molida", "carne para asar"],
  "salsa tartara": ["sour cream", "mayonesa"],
};

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function getJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message =
      (typeof payload?.message === "string" && payload.message) ||
      (typeof payload?.detail === "string" && payload.detail) ||
      `Error ${response.status}`;
    throw new Error(`${url}: ${message}`);
  }
  const payload = await response.json().catch(() => []);
  return Array.isArray(payload) ? payload : [];
}

function findMenuItem(menuItems, targetName) {
  const normalizedTarget = normalize(targetName);
  let hit = menuItems.find((item) => normalize(item?.name) === normalizedTarget);
  if (hit) return hit;
  hit = menuItems.find((item) => normalize(item?.name).includes(normalizedTarget));
  if (hit) return hit;
  hit = menuItems.find((item) => normalizedTarget.includes(normalize(item?.name)));
  return hit ?? null;
}

function findIngredientName(inventoryNames, rawName) {
  const normalizedRaw = normalize(rawName);
  const byExact = inventoryNames.find((name) => normalize(name) === normalizedRaw);
  if (byExact) return byExact;

  const aliases = INGREDIENT_ALIASES[normalizedRaw] || [];
  for (const alias of aliases) {
    const normalizedAlias = normalize(alias);
    const aliasExact = inventoryNames.find((name) => normalize(name) === normalizedAlias);
    if (aliasExact) return aliasExact;
    const aliasContains = inventoryNames.find((name) =>
      normalize(name).includes(normalizedAlias),
    );
    if (aliasContains) return aliasContains;
  }

  const contains = inventoryNames.find(
    (name) =>
      normalize(name).includes(normalizedRaw) || normalizedRaw.includes(normalize(name)),
  );
  if (contains) return contains;

  return rawName;
}

async function updateMenuItem(itemId, payload) {
  const response = await fetch(`${API_BASE_URL}/menu/items/${itemId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (typeof body?.message === "string" && body.message) ||
      (typeof body?.detail === "string" && body.detail) ||
      `Error ${response.status}`;
    throw new Error(message);
  }
  return body;
}

async function main() {
  const menuItems = await getJson(`${API_BASE_URL}/menu/items`);
  const inventory = await getJson(`${API_BASE_URL}/inventory/products?kind=ingredient`);
  const inventoryNames = inventory.map((item) => item?.name).filter(Boolean);

  let updated = 0;
  let missingMenu = 0;

  for (const recipe of recipes) {
    const menuItem = findMenuItem(menuItems, recipe.menuName);
    if (!menuItem) {
      console.log(`⚠️  No se encontro menu item: ${recipe.menuName}`);
      missingMenu += 1;
      continue;
    }

    const ingredients = recipe.ingredients.map((ingredient) => {
      const mappedName = findIngredientName(inventoryNames, ingredient.name);
      return {
        name: mappedName,
        weight: ingredient.weight,
        price: ingredient.price,
        total: Number((ingredient.weight * ingredient.price).toFixed(2)),
      };
    });

    await updateMenuItem(menuItem.id, {
      name: menuItem.name,
      category: menuItem.category,
      price: menuItem.price,
      description: menuItem.description ?? null,
      ingredients,
    });

    console.log(`✓ Receta actualizada en "${menuItem.name}" (${ingredients.length} ingredientes)`);
    updated += 1;
  }

  console.log(`\nResultado: ${updated} menu items actualizados, ${missingMenu} no encontrados.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
