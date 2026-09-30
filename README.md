# FitMe

Asistente nutricional personal para **ganancia muscular controlada**. No es un
contador de calorías genérico: está construido alrededor de un objetivo
concreto —ganar músculo progresivamente sin grasa innecesaria— y de una forma
concreta de comer.

Al abrirla responde, sin buscar en ningún menú: qué he comido, cuántas calorías
y macros llevo, qué me falta, qué debería comer ahora, si he comido suficiente
para haber entrenado y cómo estoy evolucionando.

---

## Principio rector

**DATOS → TENDENCIAS → AJUSTES.**

Todo el diseño sale de aquí, y se puede comprobar en el código:

| Decisión | Dónde está | Por qué |
|---|---|---|
| Los objetivos son **rangos**, no números | `TargetRange` en `domain/types.ts` | 128 g de proteína con objetivo 133 es «dentro del rango», no un fallo |
| El peso se lee por **media móvil de 7 días** | `readTrend()` en `domain/trends.ts` | Una subida de 0,8 kg en un día es agua, glucógeno y sodio |
| Los ajustes exigen **2 semanas, 8 días registrados y 6 pesadas** | `suggestAdjustment()` | Ajustar sobre ruido es peor que no ajustar |
| Los ajustes están **topados a ±150 kcal/día** | `MAX_STEP_KCAL` | Nunca cambios extremos |
| Las medias semanales dividen por **días registrados**, no por 7 | `weeklySummary()` | Un día sin registrar no es un día sin comer |
| Cada cantidad lleva su **confianza** (`exact` / `estimated` / `rough`) | `Confidence` | La app no finge precisión que no tiene |
| Las calorías del reloj **no se suman** al objetivo | `DayLog.deviceKcal` | Los dispositivos erran un 20-30%; son una señal, no una medición |
| La proteína **no baja** en día de descanso | `targetsForDay()` | Su función es estructural, no energética |

---

## Arquitectura

**React 18 + TypeScript + Vite, PWA instalable, todo en el dispositivo.**

```
src/
├── domain/              Lógica pura, sin React y sin IO. Es donde vive el criterio.
│   ├── types.ts         Modelo de dominio
│   ├── nutrition.ts     TDEE, objetivos con rangos, tipos de día, estados
│   ├── trends.ts        Medias móviles, resúmenes semanales, ajuste automático
│   ├── recommender.ts   «¿Qué como ahora?» y sustituciones
│   ├── parser.ts        Interpretación de español hablado → alimentos
│   └── dates.ts         Fechas locales (nunca UTC: el día del usuario es local)
├── data/
│   ├── foods.ts         116 alimentos con composición real
│   ├── blueprints.ts    27 plantillas de comida ajustables
│   └── db.ts            IndexedDB (Dexie): esquema, exportación, borrado
├── features/
│   ├── store.tsx        Estado global reactivo sobre IndexedDB
│   ├── logging.ts       Construcción y revisión de registros
│   ├── capture/         Voz, foto, código de barras, etiqueta, manual
│   ├── suggest/         Recomendaciones y modos (rápido, sin cocinar, despensa)
│   ├── recipes/         Recetas y comidas habituales
│   ├── tools/           Calculadora, comparador, lista de la compra
│   └── sheets/          Peso, entrenamiento, contexto del día, objetivos, privacidad
└── ui/                  Pantallas y sistema de diseño
```

### Por qué esta separación

`domain/` no importa nada de React, del navegador ni de la base de datos. Eso
permite **probar el criterio nutricional con tests rápidos y deterministas**
(103 tests, menos de un segundo) y cambiar la interfaz sin tocar la lógica. Los
tres bugs más graves que aparecieron durante el desarrollo —contar la actividad
dos veces, redondear por encima del tope de una plantilla, y clasificar «he
comido» como almuerzo— se detectaron y se fijaron ahí, con un test que impide
que vuelvan.

### Decisiones que no eran obvias

**1. Crudo y cocinado son alimentos distintos, con `id` distinto.**
100 g de arroz crudo son 355 kcal; cocinado, 130. Es la principal fuente de
error de los contadores de macros. `cookedYield` convierte entre estados con el
rendimiento real (80 g de arroz crudo → 200 g cocinado) y nunca 1:1.

**2. Convenio europeo de etiquetado en toda la base de datos.**
Los hidratos de carbono **no** incluyen la fibra, y la fibra aporta ~2 kcal/g.
Es lo que dicen las etiquetas españolas y lo que devuelve Open Food Facts.
Un test verifica la coherencia energética de los 116 alimentos.

**3. Los factores de actividad no son los clásicos de Mifflin.**
Los multiplicadores habituales (1,2 / 1,375 / 1,55) ya incluyen el ejercicio.
Como aquí el entrenamiento y los pasos se suman aparte y de forma explícita,
usarlos contaría la actividad dos veces: para 66 kg son unas 400 kcal/día de
más, suficiente para convertir una ganancia controlada en ganancia de grasa.
Los factores de `BASE_FACTOR` cubren solo la vida cotidiana (NEAT).

**4. Las plantillas de comida no son recetas fijas.**
Cada rol (proteína, carbohidrato, grasa, verdura) lleva un rango de gramos, y el
recomendador estira o encoge la comida para encajarla en lo que falta. La misma
plantilla sirve para «te faltan 800 kcal» y para «te faltan 300 kcal».

**5. Si se descarta un ingrediente, el título se rehace.**
En modo «tengo esto en casa», anunciar «arroz con carne picada» una comida que
no lleva carne picada sería mentir. `titleFromItems()` reconstruye el nombre con
lo que la comida lleva de verdad.

---

## Servicios externos

Ninguna función básica depende de un servicio de pago. Esto es deliberado.

| Servicio | Para qué | Coste | Sin él |
|---|---|---|---|
| **Web Speech API** (navegador) | Dictado de voz → texto | Gratis, nativo | El mismo cuadro acepta texto escrito; el parser es el mismo |
| **BarcodeDetector API** (navegador) | Lectura de códigos de barras | Gratis, nativo | Respaldo automático con **ZXing** en JavaScript, que funciona en iOS |
| **Open Food Facts** | Datos de productos por código de barras | Gratis, sin clave, sin registro | Se crea el producto a mano una vez y queda guardado para siempre |
| **API de Claude** (opcional) | Reconocimiento de platos por foto y transcripción de etiquetas | De pago, clave del usuario | Todo lo demás funciona. La foto sigue sirviendo para apuntar mirándola, y el extractor de tablas nutricionales es local |

### Sobre el análisis con IA

Está **desactivado por defecto** y se activa en `Perfil → Análisis de fotos con
IA` pegando una clave propia.

- El módulo va en un **chunk aparte de carga diferida**: quien no lo active no
  descarga ni un byte de él.
- Las peticiones van del navegador **directamente** a la API, sin servidor
  intermedio. Nadie más ve las fotos.
- La contrapartida, que la app dice explícitamente en su pantalla de ajustes: una
  clave en el navegador es legible por cualquiera con acceso al dispositivo.
  Conviene usar una clave dedicada y con límite de gasto.
- Las fotos se reducen a 1024 px antes de enviarse.
- La IA **solo transcribe** la etiqueta a texto; interpretarla lo hace un parser
  local y determinista (`labelParser.ts`, 10 tests). Así hay tres caminos al
  mismo resultado —IA, copiar mirando la foto, o pegar el texto— y ninguno es
  obligatorio.

### Alternativas evaluadas y descartadas

- **Tesseract.js** para reconocimiento óptico local de etiquetas: son unos 15 MB
  de datos de idioma descargados de un CDN, y su salida necesita revisión
  humana igual. La ruta «foto en pantalla + copiar la tabla» resuelve el mismo
  problema sin ese peso. Si se quisiera añadir, el punto de entrada es
  `parseNutritionLabel(texto)`: son unas diez líneas de integración.
- **APIs de nutrición de pago** (Nutritionix, Edamam, FatSecret): meterían un
  coste recurrente en la función más básica de la app. La base local de 116
  alimentos cubre lo que el usuario come de verdad, y Open Food Facts cubre los
  envasados.

---

## Estado: qué funciona y qué falta

### Funciona, probado en navegador

Perfil y onboarding (16 datos) · objetivos calculados con rangos y editables a
mano · contador de macros con fibra · registro manual, **por voz** y por
plantilla · pantalla de confirmación con confianza por alimento y opción «no sé»
· conversión crudo/cocinado · recetas con macros por ración · comidas habituales
con recuento de uso · sustituciones · peso con media móvil y tendencia ·
entrenamiento con ejercicios · pasos, hambre y digestión · macros dinámicos por
tipo de día · «¿Qué como ahora?», cena rápida, no quiero cocinar, tengo esto en
casa · reparto de proteína del día · resumen semanal y consistencia · ajuste
automático gradual · gráficas de peso, macros y peso-frente-a-ingesta ·
historial · calculadora · comparador · lista de la compra · exportar, importar y
borrar datos · PWA instalable y funcional sin conexión.

### Implementado pero no verificable en este entorno

Requieren un dispositivo real con permisos; el código está escrito y con
degradación explícita si el navegador no lo soporta:

- **Dictado por voz**: probado el parser y la interfaz; el reconocimiento del
  navegador necesita micrófono. Chrome y Safari lo soportan; Firefox no, y ahí
  la app pasa sola a texto escrito.
- **Escáner de códigos de barras**: necesita cámara. Hay entrada manual del
  código como alternativa siempre visible.
- **Análisis de foto con IA**: necesita una clave de API.

### No implementado

- **Sincronización de pasos automática** con Google Fit / Apple Salud. No hay API
  web para ello; haría falta envoltorio nativo (Capacitor). Los pasos se
  introducen a mano, y el hueco está previsto en `DayLog.steps`.
- **Copia de seguridad en la nube.** Por diseño: no hay servidor. La exportación
  a JSON cubre el caso.
- **Seguimiento de composición corporal más allá de peso, grasa estimada y
  cintura.** Los campos existen en `WeightEntry`; falta la interfaz de gráficas.

---

## Hoja de ruta

Lo entregado cubre el **MVP completo y la mayor parte de V2**:

- **MVP** — perfil, objetivos, contador de macros, registro manual, alimentos,
  recetas, comidas guardadas, peso, panel de hoy, resumen diario y semanal,
  recomendaciones. ✅
- **V2** — voz ✅, cámara ✅, código de barras ✅, escáner de etiquetas ✅.
- **V3** — reconocimiento avanzado de platos ✅ (con IA opcional), aprendizaje
  personalizado ✅ (recuento de uso de recetas y comidas, alimentos habituales,
  tolerancia digestiva), ajustes automáticos ✅, análisis de tendencias ✅.
  Pendiente: modelos de estimación de raciones entrenados con las correcciones
  del propio usuario.

---

## Verlo en el móvil

La app se publica en **GitHub Pages** en cada empujón a `master`, mediante
`.github/workflows/deploy.yml`. Los tests y la comprobación de tipos bloquean el
despliegue: si el dominio se rompe, no se publica.

El propio flujo de trabajo activa Pages (`configure-pages` con
`enablement: true`), así que no hay que tocar los ajustes del repositorio.

Queda en **https://nachopeza.github.io/FitMe/**, y desde el
navegador del móvil se instala como aplicación: *Compartir → Añadir a pantalla de
inicio* en iOS, o *Instalar aplicación* en Chrome. Instalada funciona sin
conexión, a pantalla completa y con su propio icono.

Servida así tiene origen propio (`https://`), que es lo que necesitan el
micrófono, la cámara y el service worker para funcionar de verdad.

## Desarrollo

```bash
npm install
npm run dev          # servidor de desarrollo
npm test             # 103 tests del dominio
npm run build        # producción (PWA)
npm run preview      # servir el build
```

El paquete inicial son **~128 KB comprimidos**. Las gráficas, la cámara, las
herramientas y el módulo de IA se descargan solo cuando se usan.

---

## Privacidad

Todo se guarda en IndexedDB, en el dispositivo. No hay cuenta, no hay servidor y
no hay analítica. Las únicas conexiones salientes posibles son la consulta de un
código de barras a Open Food Facts (se envía el número, nunca la imagen) y, si el
usuario la activa, el análisis de fotos con IA. La clave de la API **nunca** se
incluye en las exportaciones. El borrado desde `Perfil → Borrar todos mis datos`
es completo e irreversible.

---

## Aviso

FitMe estima; no mide. Una foto de un plato no permite conocer los gramos
exactos, y las calorías de un reloj son una aproximación. La app no diagnostica
nada. Ante molestias digestivas persistentes o cualquier síntoma preocupante, lo
que corresponde es consultar con un profesional sanitario.
