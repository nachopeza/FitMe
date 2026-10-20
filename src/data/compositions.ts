import type { MealSlot } from '../domain/types';
import type { IconName } from '../ui/icons';

/**
 * Composiciones: los básicos de cada día que NO son un alimento suelto.
 *
 * Un café no es "café". Es un café solo, o con una nube de leche, o con leche
 * de soja en vaso grande. Registrarlo como "café" daba 2 kcal y era mentira, y
 * buscar cada pieza por separado es justo la fricción que hace que no se
 * registre nada.
 *
 * Un café con leche de soja son ~120 kcal. En un desayuno diario, errar eso son
 * 3.500 kcal al mes: exactamente lo que no se puede permitir quien ya come poco.
 *
 * Cada composición es una lista de huecos con opciones, y cada opción aporta
 * alimentos reales de la base. Los macros salen de ahí, no de una estimación.
 */

export interface CompositionOption {
  id: string;
  label: string;
  /** Alimentos y gramos que aporta esta opción. */
  parts: { foodId: string; grams: number }[];
  /** Apunte breve bajo la etiqueta. */
  note?: string;
}

export interface CompositionSlot {
  id: string;
  label: string;
  options: CompositionOption[];
  /** Opción marcada al abrir. Si falta, se marca la primera. */
  defaultOptionId?: string;
  /** Permite marcar varias (añadidos de un yogur, por ejemplo). */
  multi?: boolean;
  /** Se puede dejar sin marcar nada. */
  optional?: boolean;
  /** Se oculta cuando en otro hueco está elegida esta opción. */
  hiddenWhen?: { slot: string; option: string };
}

export interface Composition {
  id: string;
  name: string;
  icon: IconName;
  /** Frase corta que explica para qué sirve. */
  tagline: string;
  slots: CompositionSlot[];
  slotHint?: MealSlot;
  prepMinutes: number;
}

/** Atajo para declarar una opción de una sola pieza. */
const one = (id: string, label: string, foodId: string, grams: number, note?: string): CompositionOption => ({
  id, label, parts: [{ foodId, grams }], note,
});

const none = (id = 'nada', label = 'Nada'): CompositionOption => ({ id, label, parts: [] });

export const COMPOSITIONS: Composition[] = [
  // ─────────────────────────────── Café ───────────────────────────────
  {
    id: 'cafe',
    name: 'Café',
    icon: 'coffee',
    tagline: 'Como lo tomas de verdad',
    slotHint: 'breakfast',
    prepMinutes: 2,
    slots: [
      {
        id: 'base',
        label: 'Café',
        defaultOptionId: 'solo',
        options: [
          one('solo', 'Solo', 'cafe', 60, 'Un espresso'),
          one('doble', 'Doble', 'cafe', 120),
          one('americano', 'Americano', 'cafe', 200, 'Largo, con agua'),
          one('descafeinado', 'Descafeinado', 'cafe', 60),
          none('sin-cafe', 'Sin café'),
        ],
      },
      {
        id: 'leche',
        label: 'Leche',
        defaultOptionId: 'sin-leche',
        options: [
          none('sin-leche', 'Sin leche'),
          { id: 'entera', label: 'Entera', parts: [] },
          { id: 'semi', label: 'Semi', parts: [] },
          { id: 'desnatada', label: 'Desnatada', parts: [] },
          { id: 'soja', label: 'De soja', parts: [] },
          { id: 'avena', label: 'De avena', parts: [] },
        ],
      },
      {
        id: 'cantidad',
        label: 'Cuánta leche',
        defaultOptionId: 'vaso',
        hiddenWhen: { slot: 'leche', option: 'sin-leche' },
        options: [
          { id: 'nube', label: 'Una nube', parts: [], note: '20 ml' },
          { id: 'cortado', label: 'Cortado', parts: [], note: '50 ml' },
          { id: 'vaso', label: 'Vaso', parts: [], note: '150 ml' },
          { id: 'grande', label: 'Taza grande', parts: [], note: '220 ml' },
        ],
      },
      {
        id: 'azucar',
        label: 'Endulzante',
        defaultOptionId: 'nada',
        options: [
          none(),
          one('azucar1', '1 de azúcar', 'azucar', 5),
          one('azucar2', '2 de azúcar', 'azucar', 10),
          one('miel', 'Miel', 'miel', 12),
          one('edulcorante', 'Edulcorante', 'edulcorante', 1),
        ],
      },
    ],
  },

  // ─────────────────────────────── Tostada ───────────────────────────────
  {
    id: 'tostada',
    name: 'Tostada',
    icon: 'bread',
    tagline: 'Pan y lo que le pongas',
    slotHint: 'breakfast',
    prepMinutes: 4,
    slots: [
      {
        id: 'pan',
        label: 'Pan',
        defaultOptionId: 'blanca-1',
        options: [
          one('blanca-1', '1 rebanada', 'pan-blanco', 30),
          one('blanca-2', '2 rebanadas', 'pan-blanco', 60),
          one('integral-1', '1 integral', 'pan-integral', 35),
          one('integral-2', '2 integrales', 'pan-integral', 70),
          one('molde-2', '2 de molde', 'pan-molde', 56),
        ],
      },
      {
        id: 'encima',
        label: 'Encima',
        multi: true,
        optional: true,
        options: [
          { id: 'tomate-aceite', label: 'Tomate y aceite', parts: [{ foodId: 'tomate', grams: 60 }, { foodId: 'aceite-oliva', grams: 7 }] },
          one('aceite', 'Solo aceite', 'aceite-oliva', 7),
          one('mantequilla', 'Mantequilla', 'mantequilla', 10),
          one('mermelada', 'Mermelada', 'mermelada', 20),
          one('aguacate', 'Aguacate', 'aguacate', 50),
          one('crema-cacahuete', 'Crema de cacahuete', 'crema-cacahuete', 18),
          one('jamon', 'Jamón serrano', 'jamon-serrano', 30),
          one('pavo', 'Pavo o jamón cocido', 'jamon-cocido', 50),
          one('queso', 'Queso en lonchas', 'queso-lonchas', 20),
          one('untable', 'Queso untable', 'queso-untable', 20),
          one('huevo', 'Huevo', 'huevo-cocido', 50),
        ],
      },
    ],
  },

  // ─────────────────────────────── Yogur ───────────────────────────────
  {
    id: 'yogur',
    name: 'Yogur',
    icon: 'bowl',
    tagline: 'Con lo que le eches',
    slotHint: 'snack',
    prepMinutes: 2,
    slots: [
      {
        id: 'base',
        label: 'Yogur',
        defaultOptionId: 'proteico',
        options: [
          one('proteico', 'Proteico', 'yogur-proteico', 150),
          one('proteico-2', 'Proteico, dos', 'yogur-proteico', 300),
          one('natural', 'Natural', 'yogur-natural', 125),
          one('griego', 'Griego', 'yogur-griego', 150),
          one('batido', 'Queso batido', 'queso-batido', 200),
          one('requeson', 'Requesón', 'requeson', 150),
        ],
      },
      {
        id: 'añadidos',
        label: 'Añadidos',
        multi: true,
        optional: true,
        options: [
          one('cereales', 'Cereales', 'cereales-maiz', 40),
          one('muesli', 'Muesli', 'muesli', 45),
          one('avena', 'Avena', 'avena', 40),
          one('platano', 'Plátano', 'platano', 120),
          one('fresas', 'Fresas', 'fresas', 100),
          one('arandanos', 'Arándanos', 'arandanos', 60),
          one('miel', 'Miel', 'miel', 15),
          one('nueces', 'Nueces', 'nueces', 25),
          one('almendras', 'Almendras', 'almendras', 25),
          one('crema-cacahuete', 'Crema de cacahuete', 'crema-cacahuete', 18),
          one('cacao', 'Cacao', 'cacao-desgrasado', 10),
        ],
      },
    ],
  },

  // ─────────────────────────────── Bocadillo ───────────────────────────────
  {
    id: 'bocadillo',
    name: 'Bocadillo',
    icon: 'sandwich',
    tagline: 'Rápido y denso',
    slotHint: 'snack',
    prepMinutes: 5,
    slots: [
      {
        id: 'pan',
        label: 'Pan',
        defaultOptionId: 'pequeno',
        options: [
          one('pequeno', 'Pequeño', 'pan-blanco', 80),
          one('mediano', 'Mediano', 'pan-blanco', 120),
          one('grande', 'Grande', 'pan-blanco', 180),
          one('integral', 'Integral', 'pan-integral', 100),
          one('molde', '2 de molde', 'pan-molde', 56),
        ],
      },
      {
        id: 'relleno',
        label: 'Relleno',
        multi: true,
        options: [
          one('jamon-serrano', 'Jamón serrano', 'jamon-serrano', 50),
          one('jamon-cocido', 'Jamón cocido o pavo', 'jamon-cocido', 60),
          one('atun', 'Atún', 'atun-natural', 70),
          one('pollo', 'Pollo', 'pollo-pechuga-cocinada', 100),
          one('tortilla', 'Tortilla de huevos', 'huevo', 110),
          one('lomo', 'Lomo', 'cerdo-lomo-cocinado', 100),
          one('queso', 'Queso', 'queso-lonchas', 40),
          one('mozzarella', 'Mozzarella', 'mozzarella', 60),
        ],
      },
      {
        id: 'extras',
        label: 'Extras',
        multi: true,
        optional: true,
        options: [
          one('tomate', 'Tomate', 'tomate', 60),
          one('aceite', 'Aceite', 'aceite-oliva', 7),
          one('lechuga', 'Lechuga', 'lechuga', 25),
          one('mayonesa', 'Mayonesa', 'mayonesa', 15),
          one('piquillo', 'Piquillos', 'piquillo', 50),
        ],
      },
    ],
  },

  // ─────────────────────────────── Batido ───────────────────────────────
  {
    id: 'batido',
    name: 'Batido',
    icon: 'shake',
    tagline: 'Calorías sin tener que masticar',
    slotHint: 'snack',
    prepMinutes: 3,
    slots: [
      {
        id: 'liquido',
        label: 'Con qué',
        defaultOptionId: 'soja',
        options: [
          one('soja', 'Bebida de soja', 'bebida-soja', 250),
          one('leche', 'Leche semi', 'leche-semi', 250),
          one('entera', 'Leche entera', 'leche-entera', 250),
          one('avena', 'Bebida de avena', 'bebida-avena', 250),
          none('agua', 'Agua'),
        ],
      },
      {
        id: 'proteina',
        label: 'Proteína',
        defaultOptionId: 'uno',
        options: [
          one('uno', '1 cacito', 'proteina-whey', 30),
          one('dos', '2 cacitos', 'proteina-whey', 60),
          one('caseina', 'Caseína', 'proteina-caseina', 30),
          none('sin', 'Sin proteína'),
        ],
      },
      {
        id: 'extras',
        label: 'Extras',
        multi: true,
        optional: true,
        options: [
          one('platano', 'Plátano', 'platano', 120),
          one('avena', 'Avena', 'avena', 50),
          one('crema-cacahuete', 'Crema de cacahuete', 'crema-cacahuete', 20),
          one('cacao', 'Cacao', 'cacao-desgrasado', 10),
          one('miel', 'Miel', 'miel', 15),
          one('datiles', 'Dátiles', 'datiles', 24),
          one('yogur', 'Yogur griego', 'yogur-griego', 150),
        ],
      },
    ],
  },
];

/**
 * La leche del café es un caso aparte: el TIPO sale de un hueco y la CANTIDAD de
 * otro. Es como se piensa un café («con leche de soja, en vaso»), pero no encaja
 * en el modelo de huecos independientes, así que se resuelve aquí.
 */
const MILK_FOOD: Record<string, string | null> = {
  'sin-leche': null,
  entera: 'leche-entera',
  semi: 'leche-semi',
  desnatada: 'leche-desnatada',
  soja: 'bebida-soja',
  avena: 'bebida-avena',
};

const MILK_ML: Record<string, number> = { nube: 20, cortado: 50, vaso: 150, grande: 220 };

/** Selección del usuario: por cada hueco, los identificadores marcados. */
export type CompositionChoice = Record<string, string[]>;

export function defaultChoice(comp: Composition): CompositionChoice {
  const out: CompositionChoice = {};
  for (const slot of comp.slots) {
    if (slot.multi || slot.optional) {
      out[slot.id] = slot.defaultOptionId ? [slot.defaultOptionId] : [];
    } else {
      out[slot.id] = [slot.defaultOptionId ?? slot.options[0].id];
    }
  }
  return out;
}

export function isSlotHidden(slot: CompositionSlot, choice: CompositionChoice): boolean {
  if (!slot.hiddenWhen) return false;
  return (choice[slot.hiddenWhen.slot] ?? []).includes(slot.hiddenWhen.option);
}

/** Resuelve la selección a alimentos y gramos concretos. */
export function resolveComposition(
  comp: Composition,
  choice: CompositionChoice,
): { foodId: string; grams: number }[] {
  const parts: { foodId: string; grams: number }[] = [];

  for (const slot of comp.slots) {
    if (isSlotHidden(slot, choice)) continue;
    for (const optionId of choice[slot.id] ?? []) {
      const option = slot.options.find((o) => o.id === optionId);
      if (!option) continue;
      parts.push(...option.parts);
    }
  }

  // La leche del café, con su tipo y su cantidad cruzados.
  if (comp.id === 'cafe') {
    const milkKind = (choice.leche ?? [])[0] ?? 'sin-leche';
    const foodId = MILK_FOOD[milkKind];
    const ml = MILK_ML[(choice.cantidad ?? [])[0] ?? 'vaso'] ?? 150;
    if (foodId) parts.push({ foodId, grams: ml });
  }

  // Si el mismo alimento entra por dos sitios, se suman los gramos.
  const merged = new Map<string, number>();
  for (const part of parts) {
    merged.set(part.foodId, (merged.get(part.foodId) ?? 0) + part.grams);
  }
  return [...merged.entries()].map(([foodId, grams]) => ({ foodId, grams }));
}

/** Nombre legible de lo elegido: "Café con leche de soja, vaso". */
export function describeChoice(comp: Composition, choice: CompositionChoice): string {
  if (comp.id === 'cafe') {
    const base = comp.slots[0].options.find((o) => o.id === (choice.base ?? [])[0]);
    const milk = (choice.leche ?? [])[0] ?? 'sin-leche';
    const size = (choice.cantidad ?? [])[0] ?? 'vaso';
    if (milk === 'sin-leche') return `Café ${(base?.label ?? 'solo').toLowerCase()}`;
    const milkLabel = comp.slots[1].options.find((o) => o.id === milk)?.label.toLowerCase() ?? '';
    const sizeLabel = comp.slots[2].options.find((o) => o.id === size)?.label.toLowerCase() ?? '';
    return `Café con leche ${milkLabel}, ${sizeLabel}`;
  }

  const bits: string[] = [];
  for (const slot of comp.slots) {
    if (isSlotHidden(slot, choice)) continue;
    const labels = (choice[slot.id] ?? [])
      .map((id) => slot.options.find((o) => o.id === id)?.label)
      .filter((x): x is string => !!x && x !== 'Nada');
    if (labels.length) bits.push(labels.join(' y ').toLowerCase());
  }
  if (!bits.length) return comp.name;
  return `${comp.name} con ${bits.slice(1).join(', ') || bits[0]}`.replace(/ con $/, '');
}

export function getComposition(id: string): Composition | undefined {
  return COMPOSITIONS.find((c) => c.id === id);
}
