const BASE_URL = process.env.INVENTORY_BASE_URL || "http://localhost:3000";
const API_BASE_URL =
  process.env.INVENTORY_API_BASE_URL || `${BASE_URL.replace(/\/$/, "")}/api`;

const dogRecipes = [
  {
    menuName: "PERRO GIRONÉS",
    ingredients: [
      { name: "PAN PERRO", weight: 1, price: 0 },
      { name: "SALCHICHA AMERICANA", weight: 1, price: 0 },
      { name: "PAPA FOSFORO", weight: 10, price: 0 },
      { name: "SOUR CREAM", weight: 5, price: 0 },
      { name: "GUACAMOLE", weight: 5, price: 0 },
      { name: "PAPA FRANCESA", weight: 120, price: 0 },
      { name: "PAPRIKA", weight: 1, price: 0 },
      { name: "QUESO TAJADO", weight: 10, price: 0 },
      { name: "SALSA TARTARA", weight: 5, price: 0 },
      { name: "TOCINETA", weight: 5, price: 0 },
    ],
  },
  {
    menuName: "PERRO BÁRBARO",
    ingredients: [
      { name: "PAN PERRO", weight: 1, price: 0 },
      { name: "SALCHICHA", weight: 1, price: 0 },
      { name: "PAPA FOSFORO", weight: 10, price: 0 },
      { name: "SOUR CREAM", weight: 5, price: 0 },
      { name: "GUACAMOLE", weight: 5, price: 0 },
      { name: "PAPA FRANCESA", weight: 120, price: 0 },
      { name: "PAPRIKA", weight: 1, price: 0 },
      { name: "QUESO TAJADO", weight: 10, price: 0 },
      { name: "SALSA TARTARA", weight: 5, price: 0 },
      { name: "TOCINETA", weight: 5, price: 0 },
      { name: "POLLO DESMECHADO", weight: 60, price: 0 },
    ],
  },
  {
    menuName: "PERRO CHILI-DOG",
    ingredients: [
      { name: "PAN PERRO", weight: 1, price: 0 },
      { name: "CHORIZO SANTAROSANO", weight: 1, price: 0 },
      { name: "CARNE DE BURGUER", weight: 1, price: 0 },
      { name: "SALSA CHILAQUI", weight: 10, price: 0 },
      { name: "PICO DE GALLO", weight: 10, price: 0 },
      { name: "FRIJOL", weight: 15, price: 0 },
      { name: "PAPRIKA", weight: 10, price: 0 },
      { name: "QUESO TAJADO", weight: 5, price: 0 },
      { name: "SALSA TARTARA", weight: 5, price: 0 },
      { name: "MERMELADA DE TOCINETA", weight: 15, price: 0 },
      { name: "NACHOS", weight: 5, price: 0 },
      { name: "GUACAMOLE", weight: 5, price: 0 },
      { name: "SOUR CREAM", weight: 5, price: 0 },
      { name: "PAPA FRANCESA", weight: 120, price: 0 },
    ],
  },
  {
    menuName: "PERRO FORASTERO",
    ingredients: [
      { name: "PAN PERRO", weight: 1, price: 0 },
      { name: "SALCHICHA", weight: 1, price: 0 },
      { name: "CARNE DESMECHADA", weight: 60, price: 0 },
      { name: "SALSA CHILAQUI", weight: 10, price: 0 },
      { name: "PAPRIKA", weight: 1, price: 0 },
      { name: "QUESO TAJADO", weight: 10, price: 0 },
      { name: "SALSA TARTARA", weight: 5, price: 0 },
      { name: "PAPA FOSFORO", weight: 10, price: 0 },
      { name: "GUACAMOLE", weight: 5, price: 0 },
      { name: "SOUR CREAM", weight: 5, price: 0 },
      { name: "PAPA FRANCESA", weight: 120, price: 0 },
    ],
  },
];

const INGREDIENT_ALIASES = {
  "pan perro": ["pan perro"],
  salchicha: ["salchicha americana", "salchicha alemana"],
  "salchicha americana": ["salchicha americana"],
  "papa fosforo": ["papa fosforito"],
  "salsa tartara": ["sour cream", "mayonesa"],
  "chorizo santarosano": ["chorizo santarosano"],
  "carne de burguer": ["carne molida", "carne para asar"],
  "salsa chilaqui": ["salsa bbq", "salsa humo"],
  "pico de gallo": ["tomate milano", "cebolla cabezona blanca"],
  frijol: ["frijol mute"],
  "mermelada de tocineta": ["tocineta", "azucar"],
  "carne desmechada": ["carne de sudar", "carne molida"],
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
  return (
    menuItems.find((item) => normalize(item?.name) === normalizedTarget) ??
    menuItems.find((item) => normalize(item?.name).includes(normalizedTarget)) ??
    menuItems.find((item) => normalizedTarget.includes(normalize(item?.name))) ??
    null
  );
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
  return contains || rawName;
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

  for (const recipe of dogRecipes) {
    const menuItem = findMenuItem(menuItems, recipe.menuName);
    if (!menuItem) {
      console.log(`No se encontro menu item: ${recipe.menuName}`);
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

    console.log(`Receta actualizada: ${menuItem.name}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
