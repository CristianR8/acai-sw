const BASE_URL = process.env.INVENTORY_BASE_URL || "http://localhost:3000";
const API_BASE_URL =
  process.env.INVENTORY_API_BASE_URL || `${BASE_URL.replace(/\/$/, "")}/api`;

const especialesRecipes = [
  {
    menuName: "TORRE GIRONA",
    ingredients: [
      { name: "PURE DE PAPA", weight: 300, price: 0 },
      { name: "POLLO DESMECHADO", weight: 60, price: 0 },
      { name: "PIÑA CARAMELIZADA", weight: 40, price: 0 },
      { name: "CHICHARRON", weight: 60, price: 0 },
      { name: "AGUACATE", weight: 30, price: 0 },
      { name: "PLATANITOS", weight: 10, price: 0 },
      { name: "SOUR CREAM", weight: 5, price: 0 },
    ],
  },
  {
    menuName: "FETUCCINI CARBONARA",
    ingredients: [
      { name: "FETTUCCINE", weight: 180, price: 0 },
      { name: "PECHUGA DE POLLO", weight: 70, price: 0 },
      { name: "CEBOLLA", weight: 10, price: 0 },
      { name: "TOCINETA", weight: 10, price: 0 },
      { name: "CREMA DE LECHE", weight: 10, price: 0 },
      { name: "SAL", weight: 1, price: 0 },
      { name: "PAN PERRO", weight: 5, price: 0 },
      { name: "AJO", weight: 2, price: 0 },
      { name: "HUEVO", weight: 1, price: 0 },
    ],
  },
  {
    menuName: "GREGORIANA MAR Y TIERRA",
    ingredients: [
      { name: "PASTA PENNE", weight: 180, price: 0 },
      { name: "CAMARONES", weight: 150, price: 0 },
      { name: "PALMITOS", weight: 2, price: 0 },
      { name: "MEJILLONES", weight: 50, price: 0 },
      { name: "CREMA DE LECHE", weight: 10, price: 0 },
      { name: "SAL", weight: 5, price: 0 },
      { name: "PAN PERRO", weight: 5, price: 0 },
      { name: "AJO", weight: 3, price: 0 },
      { name: "PEREJIL", weight: 10, price: 0 },
      { name: "ACEITE DE OLIVA", weight: 10, price: 0 },
    ],
  },
  {
    menuName: "ENSALADA GIRONA",
    ingredients: [
      { name: "COGOLLO", weight: 50, price: 0 },
      { name: "ARANDANOS DESHIDRATADOS", weight: 30, price: 0 },
      { name: "ALMENDRA LAMINADA", weight: 30, price: 0 },
      { name: "TOMATE CHERRY", weight: 30, price: 0 },
      { name: "CROUTONES", weight: 20, price: 0 },
      { name: "SOUR CREAM", weight: 20, price: 0 },
      { name: "PARMESANO", weight: 10, price: 0 },
      { name: "PECHUGA DE POLLO", weight: 70, price: 0 },
    ],
  },
  {
    menuName: "CEVICHE DE CHICHARRÓN",
    ingredients: [
      { name: "CAMARON", weight: 150, price: 0 },
      { name: "GALLETA SALTIN", weight: 10, price: 0 },
      { name: "SALSA CEVICHE", weight: 60, price: 0 },
      { name: "AGUACATE", weight: 15, price: 0 },
      { name: "PLATANITOS", weight: 10, price: 0 },
    ],
  },
];

const INGREDIENT_ALIASES = {
  "pure de papa": ["papa criolla", "papa negra"],
  "piña caramelizada": ["piña"],
  chicharron: ["panceta"],
  fettuccine: ["fetuccini"],
  cebolla: ["cebolla cabezona blanca", "cebolla cabezona roja"],
  ajo: ["ajo cabeza"],
  camaron: ["camarones"],
  parmesano: ["queso parmesano"],
  croutones: ["crotones"],
  "salsa ceviche": ["salsa ceviche"],
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

  for (const recipe of especialesRecipes) {
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
