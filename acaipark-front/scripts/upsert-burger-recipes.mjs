const BASE_URL = process.env.INVENTORY_BASE_URL || "http://localhost:3000";
const API_BASE_URL =
  process.env.INVENTORY_API_BASE_URL || `${BASE_URL.replace(/\/$/, "")}/api`;

const burgerRecipes = [
  {
    menuName: "CLASICA BURGUER",
    ingredients: [
      { name: "PAN HAMBURGUESA", weight: 1, price: 1020.0 },
      { name: "CARNE BURGUER", weight: 1, price: 4288.0 },
      { name: "SAL", weight: 1, price: 5.0 },
      { name: "TOMATE", weight: 5, price: 5.0 },
      { name: "PEPINILLO", weight: 10, price: 5.0 },
      { name: "PAPA FRANCESA", weight: 120, price: 8.0 },
      { name: "PAPRIKA", weight: 1, price: 9.0 },
      { name: "QUESO TAJADO", weight: 3, price: 21.0 },
      { name: "SALSA TARTARA", weight: 5, price: 12.5 },
      { name: "TOCINETA", weight: 5, price: 20.0 },
      { name: "COGOLLO", weight: 3, price: 28.0 },
    ],
  },
  {
    menuName: "GIRONA BURGUER",
    ingredients: [
      { name: "PAN HAMBURGUESA", weight: 1, price: 0 },
      { name: "CARNE BURGUER", weight: 1, price: 0 },
      { name: "SAL", weight: 1, price: 0 },
      { name: "TOMATE", weight: 5, price: 0 },
      { name: "POLLO DESMECHADO", weight: 60, price: 0 },
      { name: "PAPA FRANCESA", weight: 120, price: 0 },
      { name: "PAPRIKA", weight: 1, price: 0 },
      { name: "QUESO TAJADO", weight: 3, price: 0 },
      { name: "SALSA TARTARA", weight: 5, price: 0 },
      { name: "COGOLLO", weight: 3, price: 0 },
      { name: "TOCINETA", weight: 5, price: 0 },
    ],
  },
  {
    menuName: "CRSIPY BURGUER",
    ingredients: [
      { name: "PAN HAMBURGUESA", weight: 1, price: 0 },
      { name: "PECHUGA DE POLLO", weight: 150, price: 0 },
      { name: "HUEVO", weight: 1, price: 0 },
      { name: "SAL", weight: 1, price: 0 },
      { name: "TOMATE", weight: 5, price: 0 },
      { name: "PANKO", weight: 30, price: 0 },
      { name: "PAPA FRANCESA", weight: 120, price: 0 },
      { name: "PAPRIKA", weight: 1, price: 0 },
      { name: "QUESO TAJADO", weight: 3, price: 0 },
      { name: "SALSA TARTARA", weight: 5, price: 0 },
      { name: "TOCINETA", weight: 5, price: 0 },
      { name: "COGOLLO", weight: 3, price: 0 },
    ],
  },
  {
    menuName: "CAFFETO BURGUER",
    ingredients: [
      { name: "PAN HAMBURGUESA", weight: 1, price: 0 },
      { name: "CARNE BURGUER", weight: 1, price: 0 },
      { name: "PULLED PORK", weight: 60, price: 0 },
      { name: "SAL", weight: 1, price: 0 },
      { name: "SALSA CHILAQUI", weight: 5, price: 0 },
      { name: "TOMATE", weight: 5, price: 0 },
      { name: "TOCINETA", weight: 5, price: 0 },
      { name: "PAPA FRANCESA", weight: 120, price: 0 },
      { name: "PAPRIKA", weight: 1, price: 0 },
      { name: "QUESO TAJADO", weight: 3, price: 0 },
      { name: "SALSA TARTARA", weight: 5, price: 0 },
      { name: "COGOLLO", weight: 3, price: 0 },
    ],
  },
  {
    menuName: "KETO BURGUER",
    ingredients: [
      { name: "CARNE BURGUER", weight: 2, price: 0 },
      { name: "SAL", weight: 1, price: 0 },
      { name: "TOMATE", weight: 5, price: 0 },
      { name: "TOCINETA", weight: 5, price: 0 },
      { name: "PAPA FRANCESA", weight: 1, price: 0 },
      { name: "PAPRIKA", weight: 8, price: 0 },
      { name: "QUESO TAJADO", weight: 0, price: 0 },
      { name: "SALSA TARTARA", weight: 0, price: 0 },
      { name: "COGOLLO", weight: 0, price: 0 },
    ],
  },
  {
    menuName: "PHILLY POWER BURGER",
    ingredients: [
      { name: "PAN HAMBURGUESA", weight: 1, price: 0 },
      { name: "CARNE BURGUER", weight: 1, price: 0 },
      { name: "CEBOLLA CARAMELIZADA", weight: 10, price: 0 },
      { name: "QUESO FILADELFIA", weight: 50, price: 0 },
      { name: "HUEVO", weight: 1, price: 0 },
      { name: "SAL", weight: 1, price: 0 },
      { name: "TOMATE", weight: 5, price: 0 },
      { name: "TOCINETA", weight: 5, price: 0 },
      { name: "PAPA FRANCESA", weight: 120, price: 0 },
      { name: "PAPRIKA", weight: 1, price: 0 },
      { name: "QUESO AMARILLO", weight: 5, price: 0 },
      { name: "SALSA TARTARA", weight: 5, price: 0 },
      { name: "COGOLLO", weight: 3, price: 0 },
    ],
  },
  {
    menuName: "LA MÚNICH",
    ingredients: [
      { name: "PAN HAMBURGUESA", weight: 1, price: 0 },
      { name: "CARNE BURGUER", weight: 1, price: 0 },
      { name: "CEBOLLA CARAMELIZADA", weight: 10, price: 0 },
      { name: "CHUTNEY DE TOMATE Y TOCINETA", weight: 10, price: 0 },
      { name: "SALCHICHA ALEMANA", weight: 30, price: 0 },
      { name: "SAL", weight: 1, price: 0 },
      { name: "TOMATE", weight: 5, price: 0 },
      { name: "CHUCRUT DE REPOLLO", weight: 5, price: 0 },
      { name: "ALIOLI TRUFADO", weight: 5, price: 0 },
      { name: "QUESO AMARILLO", weight: 5, price: 0 },
      { name: "QUESO SUIZO", weight: 4, price: 0 },
      { name: "REDUCCION DE CERVEZA", weight: 5, price: 0 },
      { name: "SALSA EMMI", weight: 5, price: 0 },
      { name: "PAPA FRANCESA", weight: 120, price: 0 },
      { name: "PAPRIKA", weight: 1, price: 0 },
      { name: "COGOLLO", weight: 3, price: 0 },
    ],
  },
  {
    menuName: "LA MEDALLO",
    ingredients: [
      { name: "PAN HAMBURGUESA", weight: 1, price: 0 },
      { name: "CARNE BURGUER", weight: 1, price: 0 },
      { name: "CEBOLLA CARAMELIZADA", weight: 10, price: 0 },
      { name: "PANCETA", weight: 30, price: 0 },
      { name: "CHORIZO SANTA ROSANO", weight: 1, price: 0 },
      { name: "SALSA CHILAQUI", weight: 10, price: 0 },
      { name: "SAL", weight: 1, price: 0 },
      { name: "TOMATE", weight: 5, price: 0 },
      { name: "QUESO TAJADO", weight: 5, price: 0 },
      { name: "PAPA FRANCESA", weight: 120, price: 0 },
      { name: "TOCINETA", weight: 5, price: 0 },
      { name: "PAPRIKA", weight: 1, price: 0 },
      { name: "TARTARA", weight: 5, price: 0 },
      { name: "COGOLLO", weight: 3, price: 0 },
    ],
  },
  {
    menuName: "LA CHULA",
    ingredients: [
      { name: "PAN HAMBURGUESA", weight: 1, price: 0 },
      { name: "CARNE BURGUER", weight: 1, price: 0 },
      { name: "CEBOLLA CARAMELIZADA", weight: 10, price: 0 },
      { name: "PANCETA", weight: 30, price: 0 },
      { name: "CARNE DESMECHADA", weight: 60, price: 0 },
      { name: "SALSA CHILAQUI", weight: 10, price: 0 },
      { name: "SAL", weight: 1, price: 0 },
      { name: "TOMATE", weight: 5, price: 0 },
      { name: "QUESO TAJADO", weight: 5, price: 0 },
      { name: "PAPA FRANCESA", weight: 120, price: 0 },
      { name: "TOCINETA", weight: 5, price: 0 },
      { name: "NACHOS", weight: 3, price: 0 },
      { name: "TARTARA", weight: 5, price: 0 },
      { name: "GUACAMOLE", weight: 10, price: 0 },
      { name: "PAPRIKA", weight: 1, price: 0 },
      { name: "COGOLLO", weight: 3, price: 0 },
    ],
  },
  {
    menuName: "LA QUESUDA BURGUER",
    ingredients: [
      { name: "PAN HAMBURGUESA", weight: 1, price: 0 },
      { name: "CARNE BURGUER", weight: 1, price: 0 },
      { name: "CEBOLLA CARAMELIZADA", weight: 10, price: 0 },
      { name: "SALCHICHA", weight: 0.5, price: 0 },
      { name: "CARNE DESMECHADA", weight: 60, price: 0 },
      { name: "SAL", weight: 1, price: 0 },
      { name: "TOMATE", weight: 5, price: 0 },
      { name: "QUESO AMARILLO", weight: 5, price: 0 },
      { name: "PAPA FRANCESA", weight: 120, price: 0 },
      { name: "MERMELADA DE TOCINETA", weight: 15, price: 0 },
      { name: "MADURO", weight: 10, price: 0 },
      { name: "QUESO BLOQUE", weight: 90, price: 0 },
      { name: "TARTARA", weight: 5, price: 0 },
      { name: "SALSA CHILAQUI", weight: 10, price: 0 },
      { name: "PAPRIKA", weight: 1, price: 0 },
      { name: "COGOLLO", weight: 3, price: 0 },
    ],
  },
];

const INGREDIENT_ALIASES = {
  tomate: ["tomate milano", "tomate cherry"],
  pepinillo: ["pepino"],
  "carne burguer": ["carne molida", "carne para asar"],
  "salsa tartara": ["sour cream", "mayonesa"],
  "pollo desmechado": ["pechuga", "pechuga de pollo"],
  "pulled pork": ["panceta", "bondiola"],
  "salsa chilaqui": ["salsa bbq", "salsa humo"],
  "cebolla caramelizada": ["cebolla cabezona blanca", "cebolla cabezona roja"],
  "queso filadelfia": ["queso philadelphia"],
  "chutney de tomate y tocineta": ["tomate milano", "tocineta"],
  "salchicha alemana": ["salchicha alemana"],
  "chucrut de repollo": ["repollo"],
  "alioli trufado": ["mayonesa", "ajo cabeza"],
  "reduccion de cerveza": ["cerveza poker", "poker"],
  "salsa emmi": ["salsa bbq", "salsa sabor leña"],
  "chorizo santa rosano": ["chorizo santarosano"],
  tartara: ["sour cream", "mayonesa"],
  "carne desmechada": ["carne de sudar", "carne molida"],
  guacamole: ["salsa guacamole", "aguacate"],
  salchicha: ["salchicha americana", "salchicha alemana"],
  "mermelada de tocineta": ["tocineta", "azucar"],
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

  for (const recipe of burgerRecipes) {
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
