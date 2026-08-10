const BASE_URL = process.env.INVENTORY_BASE_URL || "http://localhost:3000";
const API_BASE_URL =
  process.env.INVENTORY_API_BASE_URL || `${BASE_URL.replace(/\/$/, "")}/api`;
const INVENTORY_PRODUCTS_PATH =
  process.env.INVENTORY_PRODUCTS_PATH || "/inventory/products";
const VALID_UNITS = new Set(["mililitros", "gramos", "unidades"]);
const UNIT_OVERRIDES = {
  // Completa las unidades para ingredientes nuevos (name -> unit).
};

const rawList = `
ACEITE FREIDORA	16,000	 $130,000
ACEITE GIRASOL	900	 $14,500
ACEITE OLIVA	750	 $45,000
ACHIRAS	120	 $7,250
AGUACATE 	1	 $4,000
AHUYAMA	500	 $1,500
AJO CABEZA 	200	 $6,000
ALMENDRA LAMINADA	500	 $14,000
ALMOHAJABANA	600	 $14,000
APIO RAMA 	500	 $2,000
ARANDANOS DESHIDRATADOS	125	 $5,200
ARRACACHA	500	 $3,000
ARROZ	500	 $2,300
ARVEJA MUTE	500	 $6,000
AZUCAR	500	 $1,900
CAFE	170	 $35,000
CAMARONES 	500	 $25,000
CARBON	500	 $15,000
CEBOLLA CABEZONA BLANCA 	500	 $3,200
CEBOLLA CABEZONA ROJA 	500	 $2,000
CEBOLLA LARGA	500	 $6,500
CHAMPIÑONES 	500	 $10,000
CHOCOLATE CORONA 	500	 $17,000
CHORIZO SANTAROSANO	16	 $30,000
CILANTRO	600	 $6,000
COGOLLO	250	 $7,000
CREMA DE LECHE 	1,000	 $18,000
CREMA LEÑA 	1,000	 $27,180
CROTONES 	750	 $25,900
CUAJADA	500	 $13,200
EMPANADAS 	20	 $26,416
FETUCCINI 	500	 $6,310
FRESA	500	 $2,500
FLORES COMESTIBLES 	60	 $7,000
FRIJOL MUTE	500	 $8,000
GALLETAS DUCALES 	1	 $5,000
GALLETAS SALTIN	1	 $2,500
GARBANZOS	500	 $6,000
GERMINADOS 	100	 $7,500
GUACAS	500	 $2,500
HARINA PAN 	1,000	 $3,500
HARINA TRIGO	500	 $1,700
HUEVOS	30	 $16,000
KIWI	500	 $1,600
LECHE LIQUIDA 	1,000	 $3,083
MAIZ DULCE 	1,000	 $10,000
MAIZ MUTE 	500	 $3,500
MANTEQUILLA	500	 $16,900
MAYONESA 	3,600	 $58,000
MAZORCA	1	 $1,700
MEJILLONES 	454	 $14,732
MIEL 	1,000	 $22,000
NACHOS	180	 $5,500
NUEZ MOSCADA 	10	 $2,777
PALMITOS 	454	 $6,319
PAN HAMBURGUESA	1	 $1,020
PAN PERRO 	1	 $980
PANELA 	16,000	 $60,000
PANKO	200	 $8,400
PAPA CRIOLLA 	500	 $2,500
PAPA FOSFORITO	200	 $5,000
PAPA FRANCESA 	2,500	 $84,000
PAPA NEGRA	500	 $1,500
PAPRIKA 	2,000	 $17,000
PASTA PENNE	1,000	 $11,880
PEPINO 	150	 $2,000
PEREJIL	500	 $5,000
PIMENTON 	500	 $3,000
PIMIENTA 	2,000	 $15,000
PIÑA 	300	 $3,200
PLATANITOS	1	 $16,000
PLATANO MADURO 	1	 $2,800
PLATANO VERDE 	1	 $2,000
PONQUE RAMO	1	 $6,880
QUESO AMARILLO 	2,500	 $88,300
QUESO BLOQUE 	2,500	 $51,000
QUESO COSTEÑO 	500	 $17,000
QUESO PARMESANO	100	 $12,400
QUESO PHILADELPHIA 	1,360	 $41,500
QUESO SUIZO 	140	 $8,300
QUESO TAJADO 	2,500	 $53,000
REPOLLO	1	 $5,000
SAL 	1,000	 $2,600
SAL DE AJO	4,000	 $18,000
SALCHICHA ALEMANA 	6	 $24,000
SALCHICHA AMERICANA 	18	 $45,900
SALSA BBQ 	4,555	 $59,000
SALSA GUACAMOLE	1,000	 $29,000
SALSA HUMO	3,000	 $32,000
SALSA MOZTASA 	4,100	 $32,000
SALSA SABOR LEÑA	500	 $13,000
SALSA SOYA	3,000	 $25,000
SALSA TOMATE 	4,280	 $82,000
SOUR CREAM 	400	 $12,000
TOCINETA 	1,000	 $19,600
TOMATE CHERRY	500	 $7,000
TOMATE MILANO	500	 $2,500
TORTILLAS BIMBO 	8	 $17,850
VINAGRE 	3,800	 $6,500
YUCA 	500	 $2,000
ZANAHORIA 	500	 $2,000
ALBAHACA	50	 $3,980
BONDIOLA 	500	 $11,000
CARNE MOLIDA	500	 $11,500
PUNTA 	500	 $18,000
CHATAS 	500	 $18,000
PECHUGA 	500	 $12,000
COSTILLA 	500	 $11,000
PANCETA 	500	 $11,000
CARNE DE SUDAR 	500	 $13,000
PICADILLO MUTE 	500	 $7,500
MOJARRA 	500	 $12,000
PATA 	500	 $4,000
LOMO FINO 	500	 $20,000
SALMON 	4	 $33,950
CARNE PARA ASAR 	500	 $16,000
BOCADILLO	480	 $3,500
chunchulla 	500	 $8,000
AREPA AMARILLA	5	 $5,500
AJI	250	 $3,847
MARACUYA	1,000	 $12,440
MANI	200	 $4,000
RELLENA	5	 $9,500
CEBOLLITAS OCAÑERAS 	150	 $8,100
AROS DE CEBOLLA	388	 $20,350
`;

function normalizeName(value) {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNumberString(value) {
  let raw = String(value ?? "").trim();
  if (!raw) return "0";

  raw = raw.replace(/\s+/g, "");

  function looksLikeThousandsSep(input, sep) {
    const parts = input.split(sep);
    if (parts.length <= 1) return false;
    if (!parts.every((part) => /^[0-9]+$/.test(part))) return false;
    return [1, 2, 3].includes(parts[0].length) && parts.slice(1).every((part) => part.length === 3);
  }

  if (raw.includes(".") && raw.includes(",")) {
    if (raw.lastIndexOf(",") > raw.lastIndexOf(".")) {
      raw = raw.replace(/\./g, "").replace(",", ".");
    } else {
      raw = raw.replace(/,/g, "");
    }
  } else if (raw.includes(".")) {
    if (looksLikeThousandsSep(raw, ".")) {
      raw = raw.replace(/\./g, "");
    }
  } else if (raw.includes(",")) {
    if (looksLikeThousandsSep(raw, ",")) {
      raw = raw.replace(/,/g, "");
    } else {
      raw = raw.replace(",", ".");
    }
  }

  return raw;
}

function parseList(list) {
  const entries = [];
  const errors = [];

  list
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const match = line.match(/^(.*?)(\d[\d,\.]*)\s+\$?\s*([\d,\.]+)\s*$/);
      if (!match) {
        errors.push(line);
        return;
      }
      const namePart = match[1].trim();
      if (!namePart) {
        errors.push(line);
        return;
      }

      entries.push({
        name: namePart,
        quantity: normalizeNumberString(match[2]),
        total_cost: normalizeNumberString(match[3]),
      });
    });

  return { entries, errors };
}

function inventoryProductsUrl(pathSuffix = "") {
  const base = API_BASE_URL.replace(/\/$/, "");
  const path = INVENTORY_PRODUCTS_PATH.startsWith("/")
    ? INVENTORY_PRODUCTS_PATH
    : `/${INVENTORY_PRODUCTS_PATH}`;
  return `${base}${path}${pathSuffix}`;
}

async function fetchExisting() {
  const url = `${inventoryProductsUrl()}?kind=ingredient`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`No se pudo cargar inventario (${response.status}).`);
  }
  const payload = await response.json().catch(() => []);
  return Array.isArray(payload) ? payload : [];
}

async function createProduct(item, unit) {
  const response = await fetch(inventoryProductsUrl(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: item.name,
      unit,
      kind: "ingredient",
      initial_quantity: item.quantity,
      total_cost: item.total_cost,
      is_active: true,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message =
      (typeof payload?.message === "string" && payload.message) ||
      (typeof payload?.detail === "string" && payload.detail) ||
      `Error ${response.status}`;
    throw new Error(message);
  }
}

async function updateProduct(id, item) {
  const response = await fetch(inventoryProductsUrl(`/${id}`), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      on_hand: item.quantity,
      total_cost: item.total_cost,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message =
      (typeof payload?.message === "string" && payload.message) ||
      (typeof payload?.detail === "string" && payload.detail) ||
      `Error ${response.status}`;
    throw new Error(message);
  }
}

async function main() {
  const listOnly = process.argv.includes("--list-new");
  const { entries, errors } = parseList(rawList);
  if (errors.length) {
    throw new Error(`Lineas invalidas: ${errors.join(" | ")}`);
  }

  const existing = await fetchExisting();
  const existingMap = new Map(
    existing.map((item) => [normalizeName(item?.name ?? ""), item]),
  );

  const missingUnits = [];
  let created = 0;
  let updated = 0;

  for (const item of entries) {
    const normalized = normalizeName(item.name);
    const existingItem = existingMap.get(normalized);
    if (existingItem) {
      if (!listOnly) {
        await updateProduct(existingItem.id, item);
      }
      updated += 1;
      continue;
    }

    const unit = UNIT_OVERRIDES[normalized];
    if (!unit || !VALID_UNITS.has(unit)) {
      missingUnits.push(item.name);
      continue;
    }

    if (!listOnly) {
      await createProduct(item, unit);
    }
    created += 1;
  }

  if (missingUnits.length) {
    console.log("Faltan unidades para ingredientes nuevos:");
    missingUnits.forEach((name) => console.log(`- ${name}`));
    if (listOnly) return;
    process.exitCode = 1;
    return;
  }

  console.log(`Actualizados: ${updated}`);
  console.log(`Creados: ${created}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
