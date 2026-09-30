/**
 * Plantillas de comida ("blueprints").
 *
 * No son recetas fijas: cada rol lleva un rango de gramos y el recomendador
 * ajusta las cantidades a los macros que falten. Así la misma plantilla sirve
 * para "te faltan 800 kcal" y para "te faltan 300 kcal" sin proponer absurdos.
 *
 * Están construidas con los alimentos que el usuario come de verdad.
 */

export type BlueprintTag =
  | 'quick' // 5-10 min
  | 'noCook' // sin cocinar
  | 'lowVolume' // poco volumen, útil con poco apetito
  | 'highProtein'
  | 'postWorkout'
  | 'breakfast'
  | 'lunch'
  | 'snack'
  | 'dinner'
  | 'lowFiber'; // fácil de digerir

export interface Slotted {
  foodId: string;
  min: number;
  max: number;
}

export interface Blueprint {
  id: string;
  title: string;
  prepMinutes: number;
  tags: BlueprintTag[];
  /** Fuente proteica principal: se ajusta a la proteína que falte. */
  protein?: Slotted;
  /** Fuente proteica secundaria, con cantidad fija. */
  protein2?: { foodId: string; grams: number };
  /** Fuente de carbohidrato: absorbe la energía restante. */
  carb?: Slotted;
  /** Grasa de ajuste fino. */
  fat?: Slotted;
  /** Verdura o fruta: volumen, fibra y micronutrientes. */
  veg?: { foodId: string; grams: number };
  /** Añadidos fijos (salsas, café, etc.). */
  extras?: { foodId: string; grams: number }[];
}

export const BLUEPRINTS: Blueprint[] = [
  // ─────────── Comidas principales ───────────
  {
    id: 'bp-arroz-siempre',
    title: 'Arroz con carne picada, huevos y tomate',
    prepMinutes: 20,
    tags: ['lunch', 'dinner', 'highProtein', 'postWorkout'],
    protein: { foodId: 'carne-picada-pollo-cocinada', min: 80, max: 180 },
    protein2: { foodId: 'huevo', grams: 110 },
    carb: { foodId: 'arroz-cocido', min: 120, max: 320 },
    veg: { foodId: 'tomate', grams: 150 },
    extras: [{ foodId: 'aceite-oliva', grams: 8 }],
  },
  {
    id: 'bp-arroz-pollo',
    title: 'Arroz con pollo a la plancha',
    prepMinutes: 18,
    tags: ['lunch', 'dinner', 'highProtein', 'postWorkout', 'lowFiber'],
    protein: { foodId: 'pollo-pechuga-cocinada', min: 100, max: 220 },
    carb: { foodId: 'arroz-cocido', min: 120, max: 320 },
    veg: { foodId: 'pimiento-verde', grams: 80 },
    extras: [{ foodId: 'aceite-oliva', grams: 8 }],
  },
  {
    id: 'bp-pasta-carne',
    title: 'Pasta con carne picada y tomate',
    prepMinutes: 20,
    tags: ['lunch', 'dinner', 'postWorkout'],
    protein: { foodId: 'carne-picada-mixta-cocinada', min: 80, max: 170 },
    carb: { foodId: 'pasta-cocida', min: 120, max: 300 },
    extras: [
      { foodId: 'tomate-frito', grams: 60 },
      { foodId: 'queso-rallado', grams: 15 },
    ],
  },
  {
    id: 'bp-entrecot-patata',
    title: 'Entrecot con patata y ensalada',
    prepMinutes: 25,
    tags: ['lunch', 'dinner', 'highProtein'],
    protein: { foodId: 'entrecot-cocinado', min: 120, max: 220 },
    carb: { foodId: 'patata-cocida', min: 150, max: 350 },
    veg: { foodId: 'lechuga', grams: 80 },
    extras: [{ foodId: 'aceite-oliva', grams: 10 }],
  },
  {
    id: 'bp-salmon-arroz',
    title: 'Salmón con arroz',
    prepMinutes: 20,
    tags: ['lunch', 'dinner', 'lowFiber'],
    protein: { foodId: 'salmon-cocinado', min: 110, max: 190 },
    carb: { foodId: 'arroz-cocido', min: 120, max: 300 },
    veg: { foodId: 'calabacin', grams: 120 },
  },
  {
    id: 'bp-merluza-patata',
    title: 'Merluza al horno con patata',
    prepMinutes: 25,
    tags: ['dinner', 'lowFiber'],
    protein: { foodId: 'merluza-cocinada', min: 130, max: 230 },
    carb: { foodId: 'patata-cocida', min: 150, max: 320 },
    extras: [{ foodId: 'aceite-oliva', grams: 10 }],
  },
  {
    id: 'bp-lentejas',
    title: 'Lentejas con arroz y huevo',
    prepMinutes: 15,
    tags: ['lunch'],
    protein: { foodId: 'lentejas-cocidas', min: 180, max: 320 },
    protein2: { foodId: 'huevo-cocido', grams: 50 },
    carb: { foodId: 'arroz-cocido', min: 80, max: 180 },
    extras: [{ foodId: 'aceite-oliva', grams: 8 }],
  },

  // ─────────── Fajitas y bocadillos ───────────
  {
    id: 'bp-fajita-pollo',
    title: 'Fajitas de pollo con queso',
    prepMinutes: 12,
    tags: ['quick', 'lunch', 'dinner', 'lowVolume', 'highProtein'],
    protein: { foodId: 'pollo-pechuga-cocinada', min: 90, max: 180 },
    protein2: { foodId: 'queso-lonchas', grams: 20 },
    carb: { foodId: 'tortilla-trigo', min: 45, max: 135 },
    veg: { foodId: 'pimiento-rojo', grams: 60 },
  },
  {
    id: 'bp-fajita-carne',
    title: 'Fajitas de carne picada con queso',
    prepMinutes: 14,
    tags: ['quick', 'dinner', 'lowVolume'],
    protein: { foodId: 'carne-picada-pollo-cocinada', min: 90, max: 170 },
    protein2: { foodId: 'queso-rallado', grams: 20 },
    carb: { foodId: 'tortilla-trigo', min: 45, max: 124 },
    veg: { foodId: 'tomate', grams: 80 },
  },
  {
    id: 'bp-bocata-jamon-queso',
    title: 'Bocadillo de jamón serrano con queso',
    prepMinutes: 5,
    tags: ['quick', 'noCook', 'lowVolume', 'snack', 'dinner'],
    protein: { foodId: 'jamon-serrano', min: 40, max: 80 },
    protein2: { foodId: 'queso-curado', grams: 25 },
    carb: { foodId: 'pan-blanco', min: 50, max: 130 },
    extras: [{ foodId: 'aceite-oliva', grams: 6 }],
  },
  {
    id: 'bp-bocata-atun',
    title: 'Bocadillo de atún con tomate',
    prepMinutes: 5,
    tags: ['quick', 'noCook', 'dinner', 'snack', 'highProtein'],
    protein: { foodId: 'atun-natural', min: 60, max: 130 },
    carb: { foodId: 'pan-blanco', min: 50, max: 120 },
    veg: { foodId: 'tomate', grams: 100 },
    extras: [{ foodId: 'aceite-oliva', grams: 6 }],
  },

  // ─────────── Huevos ───────────
  {
    id: 'bp-tortilla-pan',
    title: 'Tortilla de huevos con pan y atún',
    prepMinutes: 10,
    tags: ['quick', 'dinner', 'highProtein', 'lowVolume'],
    protein: { foodId: 'huevo', min: 110, max: 220 },
    protein2: { foodId: 'atun-natural', grams: 52 },
    carb: { foodId: 'pan-blanco', min: 30, max: 100 },
    extras: [{ foodId: 'aceite-oliva', grams: 6 }],
  },
  {
    id: 'bp-huevos-tomate-pan',
    title: 'Huevos con tomate y pan',
    prepMinutes: 10,
    tags: ['quick', 'dinner', 'breakfast'],
    protein: { foodId: 'huevo', min: 110, max: 200 },
    carb: { foodId: 'pan-blanco', min: 30, max: 90 },
    veg: { foodId: 'tomate', grams: 120 },
    extras: [{ foodId: 'aceite-oliva', grams: 7 }],
  },
  {
    id: 'bp-revuelto-champis',
    title: 'Revuelto de huevos con champiñones y queso',
    prepMinutes: 12,
    tags: ['quick', 'dinner'],
    protein: { foodId: 'huevo', min: 110, max: 220 },
    protein2: { foodId: 'queso-rallado', grams: 20 },
    veg: { foodId: 'champinones', grams: 120 },
    carb: { foodId: 'pan-blanco', min: 0, max: 80 },
  },

  // ─────────── Sin cocinar ───────────
  {
    id: 'bp-yogur-cereales-fruta',
    title: 'Yogur con cereales, plátano y bebida de soja',
    prepMinutes: 3,
    tags: ['noCook', 'quick', 'breakfast', 'snack', 'lowVolume'],
    protein: { foodId: 'yogur-proteico', min: 150, max: 300 },
    carb: { foodId: 'cereales-maiz', min: 30, max: 90 },
    veg: { foodId: 'platano', grams: 120 },
    extras: [{ foodId: 'bebida-soja', grams: 100 }],
  },
  {
    id: 'bp-yogur-griego-miel-nueces',
    title: 'Yogur griego con miel y nueces',
    prepMinutes: 2,
    tags: ['noCook', 'quick', 'snack', 'lowVolume'],
    protein: { foodId: 'yogur-griego', min: 150, max: 300 },
    fat: { foodId: 'nueces', min: 15, max: 40 },
    extras: [{ foodId: 'miel', grams: 15 }],
  },
  {
    id: 'bp-ensalada-atun',
    title: 'Ensalada de atún con tomate y queso',
    prepMinutes: 6,
    tags: ['noCook', 'quick', 'dinner', 'highProtein'],
    protein: { foodId: 'atun-natural', min: 60, max: 140 },
    protein2: { foodId: 'queso-feta', grams: 40 },
    veg: { foodId: 'tomate', grams: 150 },
    carb: { foodId: 'pan-blanco', min: 0, max: 90 },
    extras: [
      { foodId: 'aceite-oliva', grams: 8 },
      { foodId: 'aceitunas', grams: 20 },
    ],
  },
  {
    id: 'bp-tomate-queso-atun',
    title: 'Tomate con queso y atún',
    prepMinutes: 4,
    tags: ['noCook', 'quick', 'dinner', 'snack', 'highProtein'],
    protein: { foodId: 'atun-natural', min: 52, max: 130 },
    protein2: { foodId: 'mozzarella', grams: 60 },
    veg: { foodId: 'tomate', grams: 150 },
    extras: [{ foodId: 'aceite-oliva', grams: 8 }],
  },
  {
    id: 'bp-batido-denso',
    title: 'Batido de proteína con avena, plátano y crema de cacahuete',
    prepMinutes: 3,
    tags: ['noCook', 'quick', 'lowVolume', 'postWorkout', 'highProtein', 'lowFiber'],
    protein: { foodId: 'proteina-whey', min: 25, max: 60 },
    carb: { foodId: 'avena', min: 30, max: 80 },
    fat: { foodId: 'crema-cacahuete', min: 10, max: 35 },
    veg: { foodId: 'platano', grams: 120 },
    extras: [{ foodId: 'bebida-soja', grams: 250 }],
  },
  {
    id: 'bp-queso-batido-fruta',
    title: 'Queso batido con fruta y almendras',
    prepMinutes: 3,
    tags: ['noCook', 'quick', 'snack', 'highProtein'],
    protein: { foodId: 'queso-batido', min: 200, max: 400 },
    fat: { foodId: 'almendras', min: 15, max: 40 },
    veg: { foodId: 'arandanos', grams: 60 },
    extras: [{ foodId: 'miel', grams: 12 }],
  },
  {
    id: 'bp-langostinos-pan',
    title: 'Langostinos con pan y piquillos',
    prepMinutes: 6,
    tags: ['noCook', 'quick', 'dinner', 'highProtein', 'lowFiber'],
    protein: { foodId: 'langostinos-cocidos', min: 100, max: 200 },
    carb: { foodId: 'pan-blanco', min: 40, max: 110 },
    veg: { foodId: 'piquillo', grams: 75 },
    extras: [{ foodId: 'aceite-oliva', grams: 8 }],
  },

  // ─────────── Desayunos ───────────
  {
    id: 'bp-tostadas-huevo',
    title: 'Tostadas con huevo y café con bebida de soja',
    prepMinutes: 8,
    tags: ['breakfast', 'quick'],
    protein: { foodId: 'huevo', min: 55, max: 165 },
    carb: { foodId: 'pan-integral', min: 35, max: 105 },
    extras: [
      { foodId: 'cafe', grams: 60 },
      { foodId: 'bebida-soja', grams: 80 },
      { foodId: 'aceite-oliva', grams: 5 },
    ],
  },
  {
    id: 'bp-avena-cacao',
    title: 'Avena con cacao, bebida de soja y fruta',
    prepMinutes: 5,
    tags: ['breakfast', 'quick', 'noCook'],
    carb: { foodId: 'avena', min: 40, max: 100 },
    protein: { foodId: 'proteina-whey', min: 0, max: 40 },
    veg: { foodId: 'platano', grams: 120 },
    extras: [
      { foodId: 'bebida-soja', grams: 250 },
      { foodId: 'cacao-desgrasado', grams: 10 },
    ],
  },
  {
    id: 'bp-desayuno-ligero',
    title: 'Café con bebida de soja, tostada y fruta',
    prepMinutes: 4,
    tags: ['breakfast', 'quick', 'noCook', 'lowVolume'],
    carb: { foodId: 'pan-integral', min: 35, max: 90 },
    fat: { foodId: 'crema-cacahuete', min: 10, max: 25 },
    veg: { foodId: 'mandarina', grams: 90 },
    extras: [
      { foodId: 'cafe', grams: 60 },
      { foodId: 'bebida-soja', grams: 80 },
    ],
  },

  // ─────────── Meriendas ───────────
  {
    id: 'bp-merienda-jamon',
    title: 'Pan con jamón serrano y tomate',
    prepMinutes: 4,
    tags: ['snack', 'quick', 'noCook', 'lowVolume'],
    protein: { foodId: 'jamon-serrano', min: 30, max: 70 },
    carb: { foodId: 'pan-blanco', min: 40, max: 100 },
    veg: { foodId: 'tomate', grams: 80 },
  },
  {
    id: 'bp-merienda-datiles',
    title: 'Dátiles con crema de cacahuete y bebida de soja',
    prepMinutes: 2,
    tags: ['snack', 'noCook', 'quick', 'lowVolume', 'lowFiber'],
    carb: { foodId: 'datiles', min: 24, max: 60 },
    fat: { foodId: 'crema-cacahuete', min: 15, max: 35 },
    protein: { foodId: 'proteina-whey', min: 0, max: 30 },
    extras: [{ foodId: 'bebida-soja', grams: 250 }],
  },
  {
    id: 'bp-requeson-pan',
    title: 'Requesón con pan y miel',
    prepMinutes: 3,
    tags: ['snack', 'noCook', 'quick'],
    protein: { foodId: 'requeson', min: 100, max: 250 },
    carb: { foodId: 'pan-integral', min: 35, max: 90 },
    extras: [{ foodId: 'miel', grams: 15 }],
  },
];
