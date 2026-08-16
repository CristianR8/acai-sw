"use client";

import { useEffect, useMemo, useState } from "react";

export type GuidedOrder = { name: string; menuItemName: string; price: number; note: string };
type Option = { id: string; name: string; description: string; price: number; image: string; needsBase?: boolean; toppings: number; sauces: number };

type Props = { onAddConfigured: (order: GuidedOrder) => void; editDraft?: GuidedOrder | null };

const money = (value: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
const EXTRA_PRICE = 3000;

const products: Option[] = [
  { id: "vaso", name: "Vaso", description: "Elige el tamaño que prefieras.", price: 0, image: "🥤", needsBase: true, toppings: 0, sauces: 0 },
  { id: "bowl", name: "Bowl", description: "Una porción generosa.", price: 29900, image: "🍨", needsBase: true, toppings: 5, sauces: 1 },
  { id: "cono", name: "Cono", description: "Crocante y práctico.", price: 9900, image: "🍦", needsBase: true, toppings: 0, sauces: 1 },
  { id: "cafe", name: "Café 7 oz", description: "Café listo para servir.", price: 0, image: "☕", toppings: 0, sauces: 0 },
  { id: "fresas", name: "Fresas vaso 12 oz", description: "Fresas con una combinación a elección.", price: 17900, image: "🍓", toppings: 1, sauces: 1 },
];

const cupSizes: Option[] = [
  { id: "8oz", name: "Vaso 8 oz", description: "Pequeño", price: 16900, image: "🥤", toppings: 2, sauces: 1 },
  { id: "12oz", name: "Vaso 12 oz", description: "Mediano", price: 21900, image: "🥤", toppings: 3, sauces: 1 },
  { id: "16oz", name: "Vaso 16 oz", description: "Grande", price: 26900, image: "🥤", toppings: Number.POSITIVE_INFINITY, sauces: Number.POSITIVE_INFINITY },
];

const bases = [
  { id: "acai", name: "Açaí", description: "Frutal, intenso y refrescante.", image: "🫐" },
  { id: "yogurt", name: "Yogurt griego", description: "Cremoso y suave.", image: "🥣" },
  { id: "cool-mix", name: "Cool mix", description: "Mitad açaí, mitad yogurt griego.", image: "🍇" },
];

const toppings = [
  ["Banano", "🍌"], ["Fresa", "🍓"], ["Mango", "🥭"], ["Leche en polvo", "🥛"],
  ["Granola", "🌾"], ["Avena", "🌿"], ["Almendras", "🌰"], ["Oreo", "🍪"],
  ["Maní", "🥜"], ["Arándanos", "🫐"], ["Kiwi", "🥝"], ["Cereza", "🍒"],
  ["Durazno", "🍑"], ["Coco deshidratado", "🥥"], ["Chía pudín", "🫘"], ["Granola chocolate", "🍫"],
].map(([name, image], index) => ({ id: `t${index}`, name, image }));
const sauces = [
  ["Chocolate", "🍫"], ["Leche condensada", "🥛"], ["Chocolate blanco", "🤍"],
  ["Mantequilla de maní", "🥜"], ["Arequipe sin azúcar", "🍮"], ["Pistacho", "💚"],
  ["Frutos rojos", "🍓"], ["Miel", "🍯"], ["Mantequilla de almendras", "🌰"],
].map(([name, image], index) => ({ id: `s${index}`, name, image }));

function Card({ name, description, image, selected, onClick }: { name: string; description: string; image: string; selected: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`relative flex min-h-[150px] flex-col rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md ${selected ? "border-primary bg-primary/10 ring-2 ring-primary/25" : "border-stroke bg-gray-1 dark:border-dark-3 dark:bg-dark-2"}`}><div className="flex h-20 items-center justify-center rounded-xl bg-gray-2 text-4xl dark:bg-dark-3">{image}</div><p className="mt-3 font-bold text-dark dark:text-white">{name}</p><p className="mt-1 text-xs text-body">{description}</p>{selected ? <span className="absolute right-3 top-3 rounded-full bg-primary px-2 py-1 text-xs text-white">✓</span> : null}</button>;
}

export default function GuidedOrderBuilder({ onAddConfigured, editDraft = null }: Props) {
  const [step, setStep] = useState(1);
  const [productId, setProductId] = useState<string | null>(null);
  const [cupSizeId, setCupSizeId] = useState<string | null>(null);
  const [baseId, setBaseId] = useState<string | null>(null);
  const [toppingIds, setToppingIds] = useState<string[]>([]);
  const [sauceIds, setSauceIds] = useState<string[]>([]);

  const product = products.find((item) => item.id === productId);
  const cupSize = cupSizes.find((item) => item.id === cupSizeId);
  const base = bases.find((item) => item.id === baseId);
  const needsBase = Boolean(product?.needsBase);
  const configuredProduct = productId === "vaso" ? cupSize : product;
  const allowedToppings = configuredProduct?.toppings ?? 0;
  const allowedSauces = configuredProduct?.sauces ?? 0;
  const selectedToppings = toppings.filter((item) => toppingIds.includes(item.id));
  const selectedSauces = sauces.filter((item) => sauceIds.includes(item.id));
  const total = useMemo(() => (configuredProduct?.price ?? 0) + Math.max(0, selectedToppings.length - allowedToppings) * EXTRA_PRICE + Math.max(0, selectedSauces.length - allowedSauces) * EXTRA_PRICE, [allowedSauces, allowedToppings, configuredProduct?.price, selectedSauces.length, selectedToppings.length]);
  const readyForProduct = Boolean(product && (product.id !== "vaso" || cupSize));

  useEffect(() => {
    if (!editDraft) return;
    const configuredName = editDraft.note.match(/Configurado:\s*([^|]+)/i)?.[1]?.trim() ?? editDraft.name;
    const normalized = configuredName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const nextProductId = normalized.includes("vaso") ? "vaso" : normalized.includes("bowl") ? "bowl" : normalized.includes("cono") ? "cono" : normalized.includes("cafe") ? "cafe" : "fresas";
    const baseName = editDraft.note.match(/Base:\s*([^|]+)/i)?.[1]?.trim();
    const toppingNames = editDraft.note.match(/Toppings:\s*([^|]+)/i)?.[1]?.split(",").map((name) => name.trim()) ?? [];
    const sauceNames = editDraft.note.match(/Salsas:\s*([^|]+)/i)?.[1]?.split(",").map((name) => name.trim()) ?? [];
    setProductId(nextProductId);
    setCupSizeId(nextProductId === "vaso" ? cupSizes.find((item) => item.name === configuredName)?.id ?? null : null);
    setBaseId(bases.find((item) => item.name === baseName)?.id ?? null);
    setToppingIds(toppings.filter((item) => toppingNames.includes(item.name)).map((item) => item.id));
    setSauceIds(sauces.filter((item) => sauceNames.includes(item.name)).map((item) => item.id));
    setStep(nextProductId === "cafe" ? 1 : nextProductId === "vaso" || nextProductId === "bowl" || nextProductId === "cono" ? 3 : 2);
  }, [editDraft]);

  function reset() { setStep(1); setProductId(null); setCupSizeId(null); setBaseId(null); setToppingIds([]); setSauceIds([]); }
  function toggle(id: string, selected: string[], setter: (value: string[]) => void) { setter(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]); }
  function menuItemName() { return productId === "vaso" ? "Açaí personalizado" : productId === "bowl" ? "Bowl personalizado" : productId === "cono" ? "Cono personalizado" : productId === "cafe" ? "Café 7 oz" : "Fresas vaso 12 oz"; }
  function submit() {
    if (!configuredProduct || (needsBase && !base)) return;
    onAddConfigured({ name: configuredProduct.name, menuItemName: menuItemName(), price: total, note: [`Configurado: ${configuredProduct.name}`, base ? `Base: ${base.name}` : "", selectedToppings.length ? `Toppings: ${selectedToppings.map((item) => item.name).join(", ")}` : "", selectedSauces.length ? `Salsas: ${selectedSauces.map((item) => item.name).join(", ")}` : ""].filter(Boolean).join(" | ") });
    reset();
  }
  function selectProduct(next: Option) { setProductId(next.id); setCupSizeId(null); setBaseId(null); setToppingIds([]); setSauceIds([]); }
  const stepLabels = needsBase ? ["Producto", "Base", "Toppings y salsas"] : ["Producto", "Toppings y salsas"];
  const currentIndex = needsBase ? step - 1 : step === 1 ? 0 : 1;

  return <div className="rounded-2xl border border-stroke bg-white p-4 shadow-sm dark:border-dark-3 dark:bg-gray-dark sm:p-6">
    <div className="mb-5 flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Tu creación</p><h4 className="mt-1 text-2xl font-black text-dark dark:text-white">Arma tu pedido</h4><p className="mt-1 text-sm text-body">Elige el producto y personalízalo.</p></div><div className="rounded-xl bg-secondary px-3 py-2 text-right text-white"><p className="text-[10px] uppercase text-white/70">Total estimado</p><p className="text-lg font-black">{money(total)}</p></div></div>
    <div className={`mb-6 grid gap-2 ${needsBase ? "grid-cols-3" : "grid-cols-2"}`}>{stepLabels.map((label, index) => <div key={label} className={`rounded-xl border px-3 py-2 text-sm font-bold ${currentIndex === index ? "border-primary bg-primary text-white" : "border-stroke text-body dark:border-dark-3"}`}>Paso {index + 1} · {label}</div>)}</div>
    {step === 1 ? <section><h5 className="mb-3 text-lg font-black text-dark dark:text-white">Paso 1 · Elige el producto</h5><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{products.map((item) => <Card key={item.id} {...item} selected={productId === item.id} onClick={() => selectProduct(item)} />)}</div>{productId === "vaso" ? <div className="mt-5"><h6 className="mb-3 font-black text-dark dark:text-white">Elige el tamaño del vaso</h6><div className="grid gap-3 md:grid-cols-3">{cupSizes.map((item) => <Card key={item.id} {...item} selected={cupSizeId === item.id} onClick={() => setCupSizeId(item.id)} />)}</div></div> : null}</section> : null}
    {step === 2 && needsBase ? <section><h5 className="mb-3 text-lg font-black text-dark dark:text-white">Paso 2 · Elige la base</h5><div className="grid gap-3 md:grid-cols-3">{bases.map((item) => <Card key={item.id} {...item} selected={baseId === item.id} onClick={() => setBaseId(item.id)} />)}</div></section> : null}
    {step === 3 || (!needsBase && step === 2) ? <section className="space-y-5"><div><h5 className="text-lg font-black text-dark dark:text-white">Toppings y salsas</h5><p className="text-xs text-body">Personaliza tu producto.</p></div><div><h6 className="mb-2 font-black text-dark dark:text-white">Toppings</h6><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{toppings.map((item) => <Card key={item.id} name={item.name} description="" image={item.image} selected={toppingIds.includes(item.id)} onClick={() => toggle(item.id, toppingIds, setToppingIds)} />)}</div></div><div><h6 className="mb-2 font-black text-dark dark:text-white">Salsas</h6><div className="grid grid-cols-2 gap-3 md:grid-cols-3">{sauces.map((item) => <Card key={item.id} name={item.name} description="" image={item.image} selected={sauceIds.includes(item.id)} onClick={() => toggle(item.id, sauceIds, setSauceIds)} />)}</div></div></section> : null}
    <div className="mt-6 flex justify-between border-t border-stroke pt-4 dark:border-dark-3"><button type="button" disabled={step === 1} onClick={() => setStep(needsBase && step === 3 ? 2 : 1)} className="rounded-xl border border-stroke px-4 py-2 text-sm font-bold disabled:opacity-40 dark:border-dark-3 dark:text-white">Atrás</button>{step === 1 && productId === "cafe" ? <button type="button" onClick={submit} className="rounded-xl bg-secondary px-5 py-2 text-sm font-bold text-white">Agregar al pedido</button> : step === 1 ? <button type="button" disabled={!readyForProduct} onClick={() => setStep(needsBase ? 2 : 2)} className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white disabled:opacity-40">Continuar</button> : step === 2 && needsBase ? <button type="button" disabled={!base} onClick={() => setStep(3)} className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white disabled:opacity-40">Continuar</button> : <button type="button" onClick={submit} className="rounded-xl bg-secondary px-5 py-2 text-sm font-bold text-white">Agregar al pedido</button>}</div>
  </div>;
}
