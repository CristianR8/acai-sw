"use client";

import { type ReactNode, useMemo, useState } from "react";

export type GuidedOrder = {
  name: string;
  menuItemName: string;
  price: number;
  note: string;
};

type Option = {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  menuItemName: string;
};

type MenuItem = {
  name: string;
  price: string | number;
};

type Props = {
  onAddConfigured: (order: GuidedOrder) => void;
  editDraft?: GuidedOrder | null;
  menuItems: MenuItem[];
};

const money = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

const products: Option[] = [
  { id: "vaso", name: "Vaso", description: "Elige el tamaño que prefieras.", price: 0, image: "🥤", menuItemName: "Açaí personalizado" },
  { id: "bowl", name: "Bowl", description: "Una porción generosa.", price: 29900, image: "🍨", menuItemName: "Bowl personalizado" },
  { id: "cono", name: "Cono", description: "Crocante y práctico.", price: 9900, image: "🍦", menuItemName: "Cono personalizado" },
  { id: "cafe", name: "Café Americano", description: "Café listo para servir.", price: 5000, image: "☕", menuItemName: "Café Americano" },
  { id: "fresas", name: "Fresas", description: "Fresas listas para servir.", price: 17900, image: "🍓", menuItemName: "Fresas" },
  { id: "agua", name: "Botella de agua", description: "Agua lista para servir.", price: 5000, image: "🧴", menuItemName: "BOTELLA DE AGUA" },
  { id: "topping", name: "Topping", description: "Adicional listo para servir.", price: 2000, image: "🍓", menuItemName: "Topping" },
  { id: "salsa", name: "Salsa", description: "Adicional listo para servir.", price: 3000, image: "🍯", menuItemName: "Salsa" },
];

const cupSizes: Option[] = [
  { id: "8oz", name: "Vaso 8 oz", description: "Pequeño", price: 16000, image: "🥤", menuItemName: "Açaí personalizado" },
  { id: "12oz", name: "Vaso 12 oz", description: "Mediano", price: 21000, image: "🥤", menuItemName: "Açaí personalizado" },
  { id: "16oz", name: "Vaso 16 oz", description: "Grande", price: 26000, image: "🥤", menuItemName: "Açaí personalizado" },
];

const baseOptions = [
  { id: "yogurt", name: "Yogurt", emoji: "🥛" },
  { id: "acai", name: "Açaí", emoji: "🫐" },
  { id: "mix", name: "Mix", emoji: "🥛🫐" },
] as const;

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function withMenuPrice(option: Option, menuItems: MenuItem[]): Option {
  if (option.id === "topping" || option.id.endsWith("oz")) return option;

  const menuItem = menuItems.find(
    (item) =>
      normalizeName(item.name) === normalizeName(option.menuItemName) ||
      normalizeName(item.name) === normalizeName(option.name),
  );
  const menuPrice = Number(menuItem?.price);

  return Number.isFinite(menuPrice) ? { ...option, price: menuPrice } : option;
}

function Card({ item, onClick }: { item: Option; onClick: () => void }) {
  return <button data-guided-choice-card type="button" onClick={onClick} className="flex min-h-[150px] flex-col rounded-2xl border border-stroke bg-gray-1 p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md dark:border-dark-3 dark:bg-dark-2"><div className="flex h-20 items-center justify-center rounded-xl bg-gray-2 text-4xl dark:bg-dark-3">{item.image}</div><p className="mt-3 font-bold text-dark dark:text-white">{item.name}</p><p className="mt-1 text-xs text-body">{item.description}</p>{item.price > 0 && <p className="mt-2 text-sm font-black text-primary">{money(item.price)}</p>}</button>;
}

function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" onClick={onClose}><div className="w-full max-w-3xl rounded-2xl border border-stroke bg-white p-5 shadow-2xl dark:border-dark-3 dark:bg-gray-dark" onClick={(event) => event.stopPropagation()}>{children}</div></div>;
}

export default function GuidedOrderBuilder({ onAddConfigured, menuItems }: Props) {
  const [showSizePicker, setShowSizePicker] = useState(false);
  const [baseItem, setBaseItem] = useState<Option | null>(null);
  const [selectedBase, setSelectedBase] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Option | null>(null);
  const pricedProducts = useMemo(
    () => products.map((item) => withMenuPrice(item, menuItems)),
    [menuItems],
  );
  const pricedCupSizes = useMemo(
    () => cupSizes.map((item) => withMenuPrice(item, menuItems)),
    [menuItems],
  );

  function addSelectedItem() {
    if (!selectedItem) return;
    const item = selectedItem;
    const baseNote = selectedBase ? `; Base: ${selectedBase}` : "";
    onAddConfigured({ name: item.name, menuItemName: item.menuItemName, price: item.price, note: `Configurado: ${item.name}${baseNote}` });
    setSelectedItem(null);
    setSelectedBase(null);
  }

  function requestBase(item: Option) {
    setBaseItem(item);
    setSelectedItem(null);
    setSelectedBase(null);
  }

  function selectProduct(item: Option) {
    if (item.id === "vaso") {
      setShowSizePicker(true);
      return;
    }
    if (item.id === "cono" || item.id === "bowl") {
      requestBase(item);
      return;
    }
    setSelectedItem(item);
  }

  return <div className="rounded-2xl border border-stroke bg-white p-4 shadow-sm dark:border-dark-3 dark:bg-gray-dark sm:p-6"><div className="mb-5"><p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Toma de pedidos</p><h4 className="mt-1 text-2xl font-black text-dark dark:text-white">Elige el producto</h4><p className="mt-1 text-sm text-body">Selecciona un producto y confírmalo para agregarlo a la comanda.</p></div><section><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{pricedProducts.map((item) => <Card key={item.id} item={item} onClick={() => selectProduct(item)} />)}</div></section>{selectedItem && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3"><div><p className="font-semibold text-dark dark:text-white">Seleccionado: {selectedItem.name}{selectedBase ? ` · Base ${selectedBase}` : ""}</p><p className="text-sm text-body">{money(selectedItem.price)}</p></div><button type="button" onClick={addSelectedItem} className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white hover:bg-primary/90">Agregar pedido a la comanda</button></div>}{showSizePicker && <Modal onClose={() => setShowSizePicker(false)}><div className="mb-4 flex items-start justify-between gap-3"><div><h5 className="text-xl font-black text-dark dark:text-white">Elige el tamaño del vaso</h5><p className="mt-1 text-sm text-body">Después selecciona la base.</p></div><button type="button" onClick={() => setShowSizePicker(false)} className="rounded-lg border border-stroke px-3 py-1.5 text-sm font-semibold text-dark dark:border-dark-3 dark:text-white">Cerrar</button></div><div className="grid gap-3 md:grid-cols-3">{pricedCupSizes.map((item) => <Card key={item.id} item={item} onClick={() => { setShowSizePicker(false); requestBase(item); }} />)}</div></Modal>}{baseItem && <Modal onClose={() => setBaseItem(null)}><div className="mb-4 flex items-start justify-between gap-3"><div><h5 className="text-xl font-black text-dark dark:text-white">Selecciona la base</h5><p className="mt-1 text-sm text-body">{baseItem.name}</p></div><button type="button" onClick={() => setBaseItem(null)} className="rounded-lg border border-stroke px-3 py-1.5 text-sm font-semibold text-dark dark:border-dark-3 dark:text-white">Cerrar</button></div><div className="grid gap-3 md:grid-cols-3">{baseOptions.map((base) => <button key={base.id} type="button" onClick={() => { setSelectedItem(baseItem); setSelectedBase(base.name); setBaseItem(null); }} className="rounded-2xl border border-stroke bg-gray-1 p-5 text-center transition hover:border-primary hover:bg-primary/5 dark:border-dark-3 dark:bg-dark-2"><span className="block text-5xl">{base.emoji}</span><span className="mt-3 block text-lg font-bold text-dark dark:text-white">{base.name}</span></button>)}</div></Modal>}</div>;
}
