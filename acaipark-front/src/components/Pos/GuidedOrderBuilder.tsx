"use client";

import { useMemo, useState } from "react";

type GuidedOrder = {
  name: string;
  price: number;
  note: string;
};

type Option = {
  id: string;
  name: string;
  description: string;
  price?: number;
  image: string;
};

type Props = {
  onAddConfigured: (order: GuidedOrder) => void;
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);

const sizes: Option[] = [
  {
    id: "vaso",
    name: "Vaso",
    description:
      "Pequeño, mediano o grande. Ideal para disfrutarlo a tu ritmo.",
    price: 16900,
    image: "🥤",
  },
  {
    id: "bowl",
    name: "Bowl",
    description: "Una porción generosa para combinar más toppings y compartir.",
    price: 29900,
    image: "🍨",
  },
  {
    id: "cono",
    name: "Cono",
    description: "Crocante, práctico y perfecto para un antojo rápido.",
    price: 9900,
    image: "🍦",
  },
];

const bases: Option[] = [
  {
    id: "acai",
    name: "Açaí",
    description: "Frutal, intenso y refrescante.",
    image: "🫐",
  },
  {
    id: "yogurt",
    name: "Yogurt griego",
    description: "Cremoso, suave y con un toque naturalmente ácido.",
    image: "🥣",
  },
  {
    id: "cool-mix",
    name: "Cool mix",
    description: "Mitad açaí, mitad yogurt griego.",
    image: "🍇",
  },
];

const toppings: Option[] = [
  {
    id: "banano",
    name: "Banano",
    description: "Dulce y cremoso.",
    image: "🍌",
  },
  {
    id: "fresa",
    name: "Fresa",
    description: "Fresca y ligeramente ácida.",
    image: "🍓",
  },
  {
    id: "mango",
    name: "Mango",
    description: "Tropical y jugoso.",
    image: "🥭",
  },
  {
    id: "leche",
    name: "Leche en polvo",
    description: "Cremosa y suave.",
    image: "🥛",
  },
  {
    id: "granola",
    name: "Granola",
    description: "Crocante y tostada.",
    image: "🌾",
  },
  {
    id: "avena",
    name: "Avena",
    description: "Textura y energía.",
    image: "🌿",
  },
  {
    id: "almendras",
    name: "Almendras",
    description: "Crocantes y delicadas.",
    image: "🌰",
  },
  {
    id: "oreo",
    name: "Oreo",
    description: "Un toque de chocolate.",
    image: "🍪",
  },
  {
    id: "mani",
    name: "Maní",
    description: "Tostado y lleno de sabor.",
    image: "🥜",
  },
  {
    id: "arandanos",
    name: "Arándanos",
    description: "Pequeños, dulces y frescos.",
    image: "🫐",
  },
  {
    id: "kiwi",
    name: "Kiwi",
    description: "Ácido y refrescante.",
    image: "🥝",
  },
  {
    id: "cereza",
    name: "Cereza",
    description: "Dulce y brillante.",
    image: "🍒",
  },
  {
    id: "durazno",
    name: "Durazno",
    description: "Suave y aromático.",
    image: "🍑",
  },
  {
    id: "coco",
    name: "Coco deshidratado",
    description: "Tropical y delicado.",
    image: "🥥",
  },
  {
    id: "chia",
    name: "Chía pudín",
    description: "Cremosa y nutritiva.",
    image: "🫘",
  },
  {
    id: "choco-granola",
    name: "Granola chocolate",
    description: "Crocante y chocolata.",
    image: "🍫",
  },
];

const sauces: Option[] = [
  {
    id: "chocolate",
    name: "Chocolate",
    description: "Intenso y sedoso.",
    price: 3000,
    image: "🍫",
  },
  {
    id: "condensada",
    name: "Leche condensada",
    description: "Dulce y cremosa.",
    price: 3000,
    image: "🥛",
  },
  {
    id: "blanco",
    name: "Chocolate blanco",
    description: "Suave y dulce.",
    price: 3000,
    image: "🤍",
  },
  {
    id: "mani-salsa",
    name: "Mantequilla de maní",
    description: "Tostada y cremosa.",
    price: 3000,
    image: "🥜",
  },
  {
    id: "arequipe",
    name: "Arequipe sin azúcar",
    description: "Dulce y ligero.",
    price: 3000,
    image: "🍯",
  },
  {
    id: "pistacho",
    name: "Pistacho",
    description: "Aromático y delicado.",
    price: 3000,
    image: "💚",
  },
  {
    id: "frutos-rojos",
    name: "Frutos rojos",
    description: "Ácidos y frescos.",
    price: 3000,
    image: "🍓",
  },
  {
    id: "miel",
    name: "Miel",
    description: "Dulzor natural.",
    price: 3000,
    image: "🍯",
  },
  {
    id: "almendras-salsa",
    name: "Mantequilla de almendras",
    description: "Suave y tostada.",
    price: 3000,
    image: "🌰",
  },
];

const seasonal: Option[] = [
  {
    id: "proteina",
    name: "Proteína limpia",
    description: "20 g para complementar tu bowl.",
    price: 5000,
    image: "💪",
  },
];

function OptionCard({
  option,
  selected,
  onClick,
  multi = false,
}: {
  option: Option;
  selected: boolean;
  onClick: () => void;
  multi?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex min-h-[178px] flex-col overflow-hidden rounded-2xl border p-3 text-left transition duration-200 hover:-translate-y-1 hover:shadow-lg ${
        selected
          ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/30"
          : "border-stroke bg-gray-1 hover:border-primary/50 dark:border-dark-3 dark:bg-dark-2"
      }`}
      aria-pressed={selected}
    >
      <div className="relative flex h-24 items-center justify-center overflow-hidden rounded-xl bg-gray-2 text-5xl dark:bg-dark-3">
        {option.image.startsWith("/") ? (
          <img
            src={option.image}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          option.image
        )}
        {selected ? (
          <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-sm text-white">
            ✓
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-start justify-between gap-2">
        <span className="font-bold text-dark dark:text-white">
          {option.name}
        </span>
        {multi ? (
          <span className="text-xs font-semibold text-primary">
            {selected ? "Añadido" : "Elegir"}
          </span>
        ) : null}
      </div>
      <span className="text-body-color mt-1 text-xs leading-5 dark:text-dark-6">
        {option.description}
      </span>
      {option.price ? (
        <span className="mt-auto pt-2 text-xs font-bold text-secondary">
          + {formatMoney(option.price)}
        </span>
      ) : null}
    </button>
  );
}

export default function GuidedOrderBuilder({ onAddConfigured }: Props) {
  const [step, setStep] = useState(1);
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [baseId, setBaseId] = useState<string | null>(null);
  const [toppingIds, setToppingIds] = useState<string[]>([]);
  const [sauceIds, setSauceIds] = useState<string[]>([]);
  const [seasonalIds, setSeasonalIds] = useState<string[]>([]);
  const [parfait, setParfait] = useState<string | null>(null);

  const selectedSize = sizes.find((option) => option.id === sizeId);
  const selectedBase = bases.find((option) => option.id === baseId);
  const selectedToppings = toppings.filter((option) =>
    toppingIds.includes(option.id),
  );
  const selectedSauces = sauces.filter((option) =>
    sauceIds.includes(option.id),
  );
  const selectedSeasonal = seasonal.filter((option) =>
    seasonalIds.includes(option.id),
  );
  const hasStepThreeSelection = Boolean(
    toppingIds.length || sauceIds.length || seasonalIds.length || parfait,
  );
  const canAdvance =
    step === 1
      ? Boolean(sizeId)
      : step === 2
        ? Boolean(baseId)
        : hasStepThreeSelection;

  const total = useMemo(() => {
    return (
      (selectedSize?.price ?? 0) +
      selectedToppings.length * 3000 +
      selectedSauces.reduce((sum, option) => sum + (option.price ?? 0), 0) +
      selectedSeasonal.reduce((sum, option) => sum + (option.price ?? 0), 0) +
      (parfait === "mediano" ? 21900 : parfait === "grande" ? 26900 : 0)
    );
  }, [
    parfait,
    selectedSeasonal,
    selectedSauces,
    selectedSize,
    selectedToppings.length,
  ]);

  function toggleId(
    ids: string[],
    id: string,
    setter: (value: string[]) => void,
  ) {
    setter(
      ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id],
    );
  }

  function submitConfiguration() {
    if (!selectedSize || !selectedBase || !canAdvance) return;
    const chosenToppings = selectedToppings
      .map((option) => option.name)
      .join(", ");
    const chosenSauces = selectedSauces.map((option) => option.name).join(", ");
    const chosenSeasonal = selectedSeasonal
      .map((option) => option.name)
      .join(", ");
    const parfaitLabel =
      parfait === "mediano"
        ? "Parfait mediano"
        : parfait === "grande"
          ? "Parfait grande"
          : "";
    onAddConfigured({
      name: `${selectedSize.name} ${selectedBase.name}`,
      price: total,
      note: [
        `Configurado: ${selectedSize.name} · Base: ${selectedBase.name}`,
        chosenToppings ? `Toppings: ${chosenToppings}` : "",
        chosenSauces ? `Salsas: ${chosenSauces}` : "",
        chosenSeasonal ? `Temporada: ${chosenSeasonal}` : "",
        parfaitLabel,
      ]
        .filter(Boolean)
        .join(" | "),
    });
    setStep(1);
    setSizeId(null);
    setBaseId(null);
    setToppingIds([]);
    setSauceIds([]);
    setSeasonalIds([]);
    setParfait(null);
  }

  const steps = [
    { id: 1, label: "Elige el tamaño", done: Boolean(sizeId) },
    { id: 2, label: "Elige la base", done: Boolean(baseId) },
    { id: 3, label: "Toppings y salsas", done: hasStepThreeSelection },
  ];

  return (
    <div className="rounded-2xl border border-stroke bg-white p-4 shadow-sm dark:border-dark-3 dark:bg-gray-dark sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
            Tu creación
          </p>
          <h4 className="mt-1 text-2xl font-black text-dark dark:text-white">
            Arma tu bowl
          </h4>
          <p className="text-body-color mt-1 text-sm dark:text-dark-6">
            Completa cada paso para crear una combinación única.
          </p>
        </div>
        <div className="rounded-xl bg-secondary px-3 py-2 text-right text-white">
          <div className="text-[10px] uppercase tracking-wider text-white/70">
            Total estimado
          </div>
          <div className="text-lg font-black">{formatMoney(total)}</div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-2">
        {steps.map((item) => {
          const unlocked = item.id === 1 || steps[item.id - 2].done;
          return (
            <button
              key={item.id}
              type="button"
              disabled={!unlocked}
              onClick={() => setStep(item.id)}
              className={`relative rounded-xl border px-2 py-3 text-left transition ${
                step === item.id
                  ? "border-primary bg-primary text-white shadow-md"
                  : item.done
                    ? "border-secondary/30 bg-secondary/10 text-secondary"
                    : "text-body-color border-stroke bg-gray-1 dark:border-dark-3 dark:bg-dark-2 dark:text-dark-6"
              } ${!unlocked ? "cursor-not-allowed opacity-50" : "hover:-translate-y-0.5"}`}
            >
              <span className="block text-[10px] font-black uppercase tracking-wider">
                Paso {item.id}
              </span>
              <span className="mt-1 block text-xs font-bold sm:text-sm">
                {item.label}
              </span>
              {item.done ? (
                <span className="absolute right-2 top-2 text-xs">✓</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {step === 1 ? (
        <section>
          <div className="mb-3 flex items-end justify-between gap-2">
            <div>
              <h5 className="text-lg font-black text-dark dark:text-white">
                Paso 1 · Elige el tamaño
              </h5>
              <p className="text-body-color text-xs dark:text-dark-6">
                Vaso, bowl o cono.
              </p>
            </div>
            <span className="text-xs font-bold text-primary">
              Selecciona una opción
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {sizes.map((option) => (
              <OptionCard
                key={option.id}
                option={option}
                selected={sizeId === option.id}
                onClick={() => setSizeId(option.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section>
          <div className="mb-3">
            <h5 className="text-lg font-black text-dark dark:text-white">
              Paso 2 · Elige la base
            </h5>
            <p className="text-body-color text-xs dark:text-dark-6">
              Elige el sabor que será el corazón de tu pedido.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {bases.map((option) => (
              <OptionCard
                key={option.id}
                option={option}
                selected={baseId === option.id}
                onClick={() => setBaseId(option.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-5">
          <div>
            <h5 className="text-lg font-black text-dark dark:text-white">
              Paso 3 · Elige toppings y salsas
            </h5>
            <p className="text-body-color text-xs dark:text-dark-6">
              Puedes elegir varios. Selecciona al menos uno para continuar.
            </p>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h6 className="font-black text-dark dark:text-white">Toppings</h6>
              <span className="text-xs font-bold text-secondary">
                3.000 c/u
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {toppings.map((option) => (
                <OptionCard
                  key={option.id}
                  option={option}
                  multi
                  selected={toppingIds.includes(option.id)}
                  onClick={() => toggleId(toppingIds, option.id, setToppingIds)}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h6 className="font-black text-dark dark:text-white">Salsas</h6>
              <span className="text-xs font-bold text-secondary">
                3.000 c/u
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {sauces.map((option) => (
                <OptionCard
                  key={option.id}
                  option={option}
                  multi
                  selected={sauceIds.includes(option.id)}
                  onClick={() => toggleId(sauceIds, option.id, setSauceIds)}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h6 className="font-black text-dark dark:text-white">
                Temporada y parfaits
              </h6>
              <span className="text-xs font-bold text-secondary">Opcional</span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {seasonal.map((option) => (
                <OptionCard
                  key={option.id}
                  option={option}
                  multi
                  selected={seasonalIds.includes(option.id)}
                  onClick={() =>
                    toggleId(seasonalIds, option.id, setSeasonalIds)
                  }
                />
              ))}
              <OptionCard
                option={{
                  id: "parfait-mediano",
                  name: "Parfait mediano",
                  description: "2 toppings y 1 salsa.",
                  price: 21900,
                  image: "🍧",
                }}
                selected={parfait === "mediano"}
                onClick={() =>
                  setParfait(parfait === "mediano" ? null : "mediano")
                }
              />
              <OptionCard
                option={{
                  id: "parfait-grande",
                  name: "Parfait grande",
                  description: "3 toppings y 1 salsa.",
                  price: 26900,
                  image: "🍨",
                }}
                selected={parfait === "grande"}
                onClick={() =>
                  setParfait(parfait === "grande" ? null : "grande")
                }
              />
            </div>
          </div>
        </section>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-stroke pt-4 dark:border-dark-3">
        <button
          type="button"
          disabled={step === 1}
          onClick={() => setStep((current) => Math.max(1, current - 1))}
          className="rounded-xl border border-stroke bg-white px-4 py-2 text-sm font-bold text-dark transition hover:bg-gray-2 disabled:cursor-not-allowed disabled:opacity-40 dark:border-dark-3 dark:bg-dark-2 dark:text-white"
        >
          Atrás
        </button>
        {step < 3 ? (
          <button
            type="button"
            disabled={!canAdvance}
            onClick={() => setStep((current) => current + 1)}
            className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continuar al paso {step + 1}
          </button>
        ) : (
          <button
            type="button"
            disabled={!canAdvance}
            onClick={submitConfiguration}
            className="rounded-xl bg-secondary px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Agregar configuración al pedido
          </button>
        )}
      </div>
    </div>
  );
}
