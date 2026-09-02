"use client";

import { type ReactNode, useState } from "react";

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

type Props = {
  onAddConfigured: (order: GuidedOrder) => void;
  editDraft?: GuidedOrder | null;
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
  { id: "cafe", name: "Café", description: "Café listo para servir.", price: 0, image: "☕", menuItemName: "Café" },
  { id: "fresas", name: "Fresas", description: "Fresas listas para servir.", price: 17900, image: "🍓", menuItemName: "Fresas" },
  { id: "agua", name: "Botella de agua", description: "Agua lista para servir.", price: 5000, image: "🧴", menuItemName: "BOTELLA DE AGUA" },
  { id: "topping", name: "Topping", description: "Adicional listo para servir.", price: 3000, image: "🍓", menuItemName: "Topping" },
  { id: "salsa", name: "Salsa", description: "Adicional listo para servir.", price: 3000, image: "🍯", menuItemName: "Salsa" },
];

const cupSizes: Option[] = [
  { id: "8oz", name: "Vaso 8 oz", description: "Pequeño", price: 16900, image: "🥤", menuItemName: "Açaí personalizado" },
  { id: "12oz", name: "Vaso 12 oz", description: "Mediano", price: 21900, image: "🥤", menuItemName: "Açaí personalizado" },
  { id: "16oz", name: "Vaso 16 oz", description: "Grande", price: 26900, image: "🥤", menuItemName: "Açaí personalizado" },
];

function Card({ item, onClick }: { item: Option; onClick: () => void }) {
  return <button data-guided-choice-card type="button" onClick={onClick} className="flex min-h-[150px] flex-col rounded-2xl border border-stroke bg-gray-1 p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md dark:border-dark-3 dark:bg-dark-2"><div className="flex h-20 items-center justify-center rounded-xl bg-gray-2 text-4xl dark:bg-dark-3">{item.image}</div><p className="mt-3 font-bold text-dark dark:text-white">{item.name}</p><p className="mt-1 text-xs text-body">{item.description}</p>{item.price > 0 && <p className="mt-2 text-sm font-black text-primary">{money(item.price)}</p>}</button>;
}

function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" onClick={onClose}><div className="w-full max-w-3xl rounded-2xl border border-stroke bg-white p-5 shadow-2xl dark:border-dark-3 dark:bg-gray-dark" onClick={(event) => event.stopPropagation()}>{children}</div></div>;
}

export default function GuidedOrderBuilder({ onAddConfigured }: Props) {
  const [showSizePicker, setShowSizePicker] = useState(false);

  function addToOrder(item: Option) {
    onAddConfigured({ name: item.name, menuItemName: item.menuItemName, price: item.price, note: `Configurado: ${item.name}` });
  }

  function selectProduct(item: Option) {
    if (item.id === "vaso") {
      setShowSizePicker(true);
      return;
    }
    addToOrder(item);
  }

  return <div className="rounded-2xl border border-stroke bg-white p-4 shadow-sm dark:border-dark-3 dark:bg-gray-dark sm:p-6"><div className="mb-5"><p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Toma de pedidos</p><h4 className="mt-1 text-2xl font-black text-dark dark:text-white">Elige el producto</h4><p className="mt-1 text-sm text-body">Selecciona un producto para agregarlo directamente al pedido.</p></div><section><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{products.map((item) => <Card key={item.id} item={item} onClick={() => selectProduct(item)} />)}</div></section>{showSizePicker && <Modal onClose={() => setShowSizePicker(false)}><div className="mb-4 flex items-start justify-between gap-3"><div><h5 className="text-xl font-black text-dark dark:text-white">Elige el tamaño del vaso</h5><p className="mt-1 text-sm text-body">El tamaño se agregará directamente al pedido.</p></div><button type="button" onClick={() => setShowSizePicker(false)} className="rounded-lg border border-stroke px-3 py-1.5 text-sm font-semibold text-dark dark:border-dark-3 dark:text-white">Cerrar</button></div><div className="grid gap-3 md:grid-cols-3">{cupSizes.map((item) => <Card key={item.id} item={item} onClick={() => { addToOrder(item); setShowSizePicker(false); }} />)}</div></Modal>}</div>;
}
