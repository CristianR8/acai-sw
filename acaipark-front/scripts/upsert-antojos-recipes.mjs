const BASE_URL = process.env.INVENTORY_BASE_URL || "http://localhost:3000";
const API_BASE_URL =
  process.env.INVENTORY_API_BASE_URL || `${BASE_URL.replace(/\/$/, "")}/api`;

const antojosRecipes = [
  {
    menuName: "DESGRANADO GIRONA",
    ingredients: [
      { name: "PAPAS FRANCESA", weight: 150, price: 0 },
      { name: "MAIZ", weight: 100, price: 0 },
      { name: "POLLO DESMECHADO", weight: 60, price: 0 },
      { name: "TOCINETA", weight: 5, price: 0 },
      { name: "PAPRIKA", weight: 1, price: 0 },
      { name: "QUESO TAJADO", weight: 5, price: 0 },
      { name: "SALSA TARTARA", weight: 15, price: 0 },
      { name: "GUACAMOLE", weight: 5, price: 0 },
    ],
  },
  {
    menuName: "PAPAS GIRONA",
    ingredients: [
      { name: "PAPA CRIOLLA", weight: 150, price: 0 },
      { name: "CARNE DESMECADA", weight: 60, price: 0 },
      { name: "POLLO DESMECHADO", weight: 60, price: 0 },
      { name: "SALSA CHILACHÍN", weight: 15, price: 0 },
      { name: "TOCINETA", weight: 5, price: 0 },
      { name: "QUESO TAJADO", weight: 5, price: 0 },
      { name: "SALSA TARTARA", weight: 10, price: 0 },
      { name: "GUACAMOLE", weight: 5, price: 0 },
    ],
  },
  {
    menuName: "QUESADILLA DE CARNE",
    ingredients: [
      { name: "TORTILLA", weight: 1, price: 0 },
      { name: "TOMATE", weight: 5, price: 0 },
      { name: "POLLO DESMECHADO", weight: 60, price: 0 },
      { name: "COGOLLO", weight: 3, price: 0 },
      { name: "QUESO TAJADO", weight: 5, price: 0 },
      { name: "SALSA TARTARA", weight: 10, price: 0 },
      { name: "GUACAMOLE", weight: 5, price: 0 },
    ],
  },
  {
    menuName: "QUESADILLA DE POLLO",
    ingredients: [
      { name: "TORTILLA", weight: 1, price: 0 },
      { name: "TOMATE", weight: 5, price: 0 },
      { name: "CARNE DESMECHADA", weight: 60, price: 0 },
      { name: "COGOLLO", weight: 3, price: 0 },
      { name: "QUESO TAJADO", weight: 5, price: 0 },
      { name: "SALSA CHILQUI", weight: 10, price: 0 },
      { name: "GUACAMOLE", weight: 5, price: 0 },
    ],
  },
  {
    menuName: "QUESADILLA MIXTA",
    ingredients: [
      { name: "TORTILLA", weight: 1, price: 0 },
      { name: "TOMATE", weight: 5, price: 0 },
      { name: "POLLO DESMECHADO", weight: 60, price: 0 },
      { name: "CARNE DESMECHADA", weight: 60, price: 0 },
      { name: "COGOLLO", weight: 3, price: 0 },
      { name: "QUESO TAJADO", weight: 5, price: 0 },
      { name: "SALSA TARTARA", weight: 10, price: 0 },
      { name: "SALSA CHILQUI", weight: 10, price: 0 },
      { name: "GUACAMOLE", weight: 5, price: 0 },
    ],
  },
  {
    menuName: "SALCHIPAPA JR",
    ingredients: [
      { name: "PAPA FRANCESA", weight: 150, price: 0 },
      { name: "SALCHICHA", weight: 1.5, price: 0 },
      { name: "SALSA TARTARA", weight: 5, price: 0 },
      { name: "QUESO COSTEÑO", weight: 30, price: 0 },
    ],
  },
];

const INGREDIENT_ALIASES = {
  "papas francesa": ["papa francesa"],
  maiz: ["maiz dulce"],
  "carne desmecada": ["carne desmechada", "carne de sudar", "carne molida"],
  "carne desmechada": ["carne de sudar", "carne molida"],
  "salsa chilachin": ["salsa chilaqui", "salsa bbq", "salsa humo"],
  "salsa chilqui": ["salsa chilaqui", "salsa bbq", "salsa humo"],
  tortilla: ["tortillas bimbo"],
  tomate: ["tomate milano", "tomate cherry"],
  salchicha: ["salchicha americana", "salchicha alemana"],
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

  for (const recipe of antojosRecipes) {
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
