const BASE_URL = process.env.INVENTORY_BASE_URL || "http://localhost:3000";
const API_BASE_URL =
  process.env.INVENTORY_API_BASE_URL || `${BASE_URL.replace(/\/$/, "")}/api`;

const extraRecipes = [
  {
    menuName: "SALMÓN EN REDUCCIÓN DE FRUTOS ROJOS",
    ingredients: [
      { name: "SALMON", weight: 300, price: 68.0 },
      { name: "PURE DE PAPA", weight: 80, price: 0 },
      { name: "SAL", weight: 3, price: 5.0 },
      { name: "ENSALADA", weight: 50, price: 20.0 },
      { name: "SALSA PESTO", weight: 12, price: 42.6 },
    ],
  },
  {
    menuName: "PULPITO DE SALCHICHA",
    ingredients: [
      { name: "PAPA FRANCESA", weight: 120, price: 0 },
      { name: "SALCHICHA", weight: 2, price: 0 },
      { name: "SALSA TARTARA", weight: 20, price: 0 },
      { name: "QUESO COSTEÑO", weight: 15, price: 0 },
      { name: "MECHAS LOCAS", weight: 1, price: 0 },
    ],
  },
  {
    menuName: "NUGGETS DE POLLO",
    ingredients: [
      { name: "PAPA FRANCESA", weight: 120, price: 0 },
      { name: "NUGGETS", weight: 5, price: 0 },
      { name: "SALSA TARTARA", weight: 10, price: 0 },
      { name: "QUESO COSTEÑO", weight: 15, price: 0 },
      { name: "MECHAS LOCAS", weight: 1, price: 0 },
    ],
  },
  {
    menuName: "MIGAO GIRONA",
    ingredients: [
      { name: "QUESO BLOQUE", weight: 60, price: 0 },
      { name: "ACHIRAS", weight: 8, price: 0 },
      { name: "PONQUE RAMO", weight: 1, price: 0 },
      { name: "GALLETAS DUCALES", weight: 20, price: 0 },
      { name: "ALMOJABANA", weight: 1, price: 0 },
      { name: "CHOCOLATE CORONA", weight: 90, price: 0 },
    ],
  },
  {
    menuName: "CUAJADA CON REDUCCIÓN EN PANELA",
    ingredients: [
      { name: "CUAJADA", weight: 60, price: 0 },
      { name: "PANELA", weight: 5, price: 0 },
      { name: "CERVEZA", weight: 1, price: 0 },
    ],
  },
  {
    menuName: "CREPES DULCE TENTACIÓN",
    ingredients: [
      { name: "MASA CREPE", weight: 30, price: 0 },
      { name: "FRESA", weight: 20, price: 0 },
      { name: "KIWI", weight: 15, price: 0 },
      { name: "CHANTILLI", weight: 30, price: 0 },
      { name: "OREO", weight: 1, price: 0 },
    ],
  },
  {
    menuName: "WAFFLES",
    ingredients: [{ name: "MASA WAFLE", weight: 1, price: 0 }],
  },
];

const INGREDIENT_ALIASES = {
  salmon: ["salmon"],
  "pure de papa": ["papa criolla", "papa negra"],
  ensalada: ["cogollo"],
  "salsa tartara": ["sour cream", "mayonesa"],
  salchicha: ["salchicha americana", "salchicha alemana"],
  "mechas locas": ["papa fosforo"],
  nuggets: ["nuggets de pollo"],
  cuajada: ["queso cuajada"],
  cerveza: ["cerveza poker", "poker"],
  "chantilli": ["chantilly"],
  "masa wafle": ["masa waffle"],
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

  for (const recipe of extraRecipes) {
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
