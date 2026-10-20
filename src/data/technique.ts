/**
 * Cómo se hace cada ejercicio, en tres claves.
 *
 * Las fotos vienen de free-exercise-db (dominio público) y enseñan la posición
 * de inicio y la de final. El texto está escrito aquí y no traducido del
 * dataset a propósito: a media serie nadie lee cinco párrafos, así que cada
 * ejercicio se resume en lo que de verdad cambia el resultado y en el fallo que
 * más se repite.
 */

export interface Technique {
  /** Dos o tres claves de ejecución. */
  cues: string[];
  /** El error que más se comete. */
  error?: string;
}

/** Ejercicios con foto en `public/ex/<id>-0.webp` y `-1.webp`. */
export const WITH_PHOTOS = new Set([
  'abductores', 'aductores', 'aperturas-mancuerna', 'aperturas-polea', 'bici-estatica', 'cinta',
  'comba', 'crunch', 'crunch-polea', 'curl-alterno', 'curl-barra', 'curl-barra-z', 'curl-concentrado',
  'curl-femoral', 'curl-femoral-sentado', 'curl-inclinado', 'curl-mancuernas', 'curl-martillo',
  'curl-muneca', 'curl-polea', 'curl-predicador', 'dead-hang', 'dominadas', 'dominadas-supinas',
  'elevacion-piernas', 'elevaciones-frontales', 'elevaciones-laterales', 'elevaciones-laterales-polea',
  'eliptica', 'encogimientos', 'escaleras', 'extension-cuadriceps', 'extension-polea',
  'extension-polea-cuerda', 'extension-sobre-cabeza', 'face-pull', 'farmer-walk', 'flexiones',
  'flexiones-lastradas', 'fondos-banco', 'fondos-pecho', 'gemelos-pie', 'gemelos-sentado', 'hack',
  'hip-thrust', 'hiperextensiones', 'jalon-agarre-estrecho', 'jalon-pecho', 'mountain-climbers',
  'pajaro', 'pajaro-maquina', 'patada-gluteo-polea', 'patada-triceps', 'peck-deck', 'peso-muerto',
  'peso-muerto-piernas-rigidas', 'peso-muerto-rumano', 'plancha', 'plancha-lateral', 'prensa',
  'press-arnold', 'press-banca', 'press-banca-mancuernas', 'press-cerrado', 'press-declinado',
  'press-frances', 'press-hombro-mancuernas', 'press-hombro-maquina', 'press-inclinado',
  'press-inclinado-mancuernas', 'press-maquina-pecho', 'press-militar', 'puente-gluteo',
  'pull-over-polea', 'pullover', 'push-press', 'remo-barra', 'remo-ergometro', 'remo-mancuerna',
  'remo-maquina', 'remo-menton', 'remo-polea-baja', 'remo-t', 'rueda-abdominal', 'russian-twist',
  'sentadilla', 'sentadilla-frontal', 'sentadilla-goblet', 'swing-kettlebell', 'zancadas',
  'clean', 'thruster',
]);

export const TECHNIQUE: Record<string, Technique> = {
  // ── Pecho ──
  'press-banca': { cues: ['Omóplatos juntos y hundidos contra el banco, pecho alto.', 'La barra baja a la línea del pezón, no al cuello.', 'Pies clavados en el suelo: empujas también con ellos.'], error: 'Despegar los hombros del banco al empujar.' },
  'press-inclinado': { cues: ['Banco entre 30 y 45°: más alto es press de hombro.', 'La barra baja a la clavícula alta.', 'Mismo apoyo escapular que en banca plana.'], error: 'Inclinar demasiado y pasarlo todo al deltoides.' },
  'press-declinado': { cues: ['Asegura las piernas antes de descolgar la barra.', 'La barra baja a la parte baja del pecho.', 'Recorrido corto: no fuerces el bloqueo.'] },
  'press-banca-mancuernas': { cues: ['Las mancuernas bajan hasta sentir estiramiento, no más.', 'Muñecas firmes, nudillos al techo.', 'Arriba no las choques: pierdes la tensión.'], error: 'Bajar tanto que el hombro rote hacia delante.' },
  'press-inclinado-mancuernas': { cues: ['Súbelas con las rodillas hasta la posición de inicio.', 'Codos a unos 45° del torso.', 'Aprieta arriba sin bloquear del todo.'] },
  'aperturas-mancuerna': { cues: ['Codos semiflexionados y fijos todo el recorrido.', 'Abre en arco, no en línea recta.', 'Peso moderado: esto es estiramiento, no fuerza.'], error: 'Convertirlo en un press doblando los codos.' },
  'aperturas-polea': { cues: ['Un pie adelante y torso ligeramente inclinado.', 'Cruza las manos un poco al final.', 'Vuelve despacio controlando la apertura.'] },
  'press-maquina-pecho': { cues: ['Ajusta el asiento: las asas a la altura del pecho.', 'Espalda pegada al respaldo.', 'Controla la vuelta, no dejes que el peso tire.'] },
  'peck-deck': { cues: ['Hombros abajo, nunca encogidos.', 'Junta y aguanta un segundo.', 'Abre despacio hasta notar el pecho estirado.'] },
  flexiones: { cues: ['Cuerpo en línea: glúteo apretado, costillas cerradas.', 'Manos algo más anchas que los hombros.', 'Pecho al suelo, codos a 45°.'], error: 'La cadera cae y la espalda se arquea.' },
  'flexiones-lastradas': { cues: ['Coloca el disco o la mochila entre los omóplatos.', 'Igual que la flexión: línea recta de cabeza a talón.', 'Si pierdes el rango, quita peso.'] },
  'fondos-pecho': { cues: ['Inclina el torso adelante para llevarlo al pecho.', 'Baja hasta que el hombro quede a la altura del codo.', 'No encojas los hombros en la parte baja.'], error: 'Bajar más de la cuenta y cargar el hombro.' },
  pullover: { cues: ['Tumbado a lo largo del banco, caderas algo bajas.', 'Brazos casi rectos, el arco sale del hombro.', 'Costillas cerradas: no arquees la zona lumbar.'] },

  // ── Espalda ──
  dominadas: { cues: ['Agarre algo más ancho que los hombros.', 'Empieza colgado del todo y tira con los codos al suelo.', 'Pecho a la barra, sin balanceo.'], error: 'Medias repeticiones por no bajar del todo.' },
  'dominadas-supinas': { cues: ['Palmas hacia ti, manos al ancho de los hombros.', 'Codos pegados al cuerpo.', 'Aquí el bíceps entra de verdad: aprovecha el rango.'] },
  'jalon-pecho': { cues: ['Fija los muslos bajo el rodillo antes de empezar.', 'Tira a la clavícula, no detrás de la nuca.', 'Pecho arriba y ligera inclinación atrás.'], error: 'Tirar con los brazos y dejar la espalda fuera.' },
  'jalon-agarre-estrecho': { cues: ['Agarre neutro o estrecho, manos juntas.', 'Codos pegados al torso.', 'Aguanta un instante abajo.'] },
  'remo-barra': { cues: ['Cadera atrás, torso a unos 45°, espalda neutra.', 'La barra sube al ombligo.', 'Aprieta los omóplatos antes de soltar.'], error: 'Subir el torso en cada repetición para ayudarte.' },
  'remo-pendlay': { cues: ['Torso paralelo al suelo y la barra para en cada repetición.', 'Cada repetición arranca del suelo, sin rebote.', 'Explosivo al subir, controlado al bajar.'], error: 'Perder el torso paralelo según pesa la serie.' },
  'remo-mancuerna': { cues: ['Apoya rodilla y mano del mismo lado en el banco.', 'La mancuerna sube hacia la cadera, no al hombro.', 'No gires el torso para ganar rango.'] },
  'remo-polea-baja': { cues: ['Rodillas algo flexionadas, espalda neutra.', 'Tira al abdomen y abre el pecho.', 'Estira del todo al volver, sin encorvarte.'] },
  'remo-maquina': { cues: ['Pecho apoyado: así no hay trampa con la cadera.', 'Codos cerca del cuerpo.', 'Aprieta un segundo al final.'] },
  'remo-t': { cues: ['Pies firmes a los lados de la barra.', 'Espalda neutra y cadera atrás.', 'Sube hasta tocar el pecho si el recorrido lo permite.'] },
  'peso-muerto': { cues: ['Barra pegada a la espinilla, caderas altas pero no de más.', 'Espalda neutra: pecho arriba, dorsal apretado.', 'Empuja el suelo y lleva la cadera adelante.'], error: 'Redondear la lumbar al despegar del suelo.' },
  'peso-muerto-rumano': { cues: ['Arranca de pie y baja llevando la cadera atrás.', 'Rodillas casi fijas, la barra roza el muslo.', 'Para cuando el isquio no da más, no cuando el suelo.'], error: 'Doblar las rodillas y convertirlo en peso muerto.' },
  'pull-over-polea': { cues: ['Brazos casi rectos todo el recorrido.', 'Lleva la barra a los muslos con el dorsal.', 'Torso algo inclinado y quieto.'] },
  'face-pull': { cues: ['Polea a la altura de la cara.', 'Tira a la frente separando las manos.', 'Termina con los codos altos y detrás de los hombros.'] },
  encogimientos: { cues: ['Sube los hombros hacia las orejas, recto.', 'No rotes: el trapecio sube y baja.', 'Aguanta arriba un segundo.'] },
  hiperextensiones: { cues: ['Cadera justo por encima del apoyo.', 'Sube hasta la línea del cuerpo, no más.', 'Glúteo apretado al final.'], error: 'Hiperextender la lumbar en la parte alta.' },

  // ── Hombro ──
  'press-militar': { cues: ['Barra en la clavícula, codos algo adelantados.', 'Aprieta glúteo y abdomen: el torso no se arquea.', 'Mete la cabeza bajo la barra al bloquear.'], error: 'Arquear la lumbar para compensar el peso.' },
  'press-hombro-mancuernas': { cues: ['Codos ligeramente adelante, no en cruz.', 'Baja hasta la oreja.', 'Arriba no las choques.'] },
  'press-arnold': { cues: ['Empiezas con las palmas hacia ti.', 'Gira al subir hasta acabar con palmas al frente.', 'Peso moderado: el giro ya es la dificultad.'] },
  'press-hombro-maquina': { cues: ['Asiento a la altura: asas a la altura del hombro.', 'Espalda apoyada.', 'Controla la bajada.'] },
  'elevaciones-laterales': { cues: ['Sube hasta la línea del hombro, no más.', 'Codo algo flexionado y por delante de la muñeca.', 'Peso ligero: esto no es un ejercicio de fuerza.'], error: 'Impulsar con la cadera y subir por encima del hombro.' },
  'elevaciones-laterales-polea': { cues: ['Polea abajo, cruzando por delante del cuerpo.', 'Tensión constante: esa es la ventaja frente a la mancuerna.', 'Sube a la altura del hombro.'] },
  'elevaciones-frontales': { cues: ['Sube a la altura de los ojos.', 'Sin balanceo: si lo necesitas, baja el peso.', 'Alterna o a dos manos, da igual.'] },
  pajaro: { cues: ['Torso casi paralelo al suelo.', 'Abre con los codos, no con las manos.', 'Hombros abajo todo el recorrido.'], error: 'Encoger los hombros y trabajar trapecio.' },
  'pajaro-maquina': { cues: ['Pecho apoyado, asas a la altura del hombro.', 'Abre hasta la línea del cuerpo.', 'Vuelve despacio.'] },
  'remo-menton': { cues: ['Agarre al ancho de los hombros, no más estrecho.', 'Sube hasta el pecho, con los codos por encima.', 'Si molesta el hombro, cambia a face pull.'], error: 'Agarre muy cerrado: pinza el hombro.' },

  // ── Bíceps ──
  'curl-barra': { cues: ['Codos pegados al costado y quietos.', 'Sube sin mover el torso.', 'Baja controlando: ahí está la mitad del trabajo.'], error: 'Balancear la espalda para subir el peso.' },
  'curl-barra-z': { cues: ['La barra Z es más amable con la muñeca.', 'Codos fijos al costado.', 'Rango completo: estira abajo.'] },
  'curl-mancuernas': { cues: ['Gira la muñeca al subir (supina).', 'Codos quietos.', 'Aprieta arriba un segundo.'] },
  'curl-alterno': { cues: ['Un brazo cada vez, el otro descansa estirado.', 'No uses el impulso del cuerpo al alternar.', 'Mismo ritmo en los dos lados.'] },
  'curl-martillo': { cues: ['Palmas enfrentadas todo el recorrido.', 'Trabaja braquial: el brazo se ve más grueso de perfil.', 'Codos pegados.'] },
  'curl-inclinado': { cues: ['Banco a 45–60°, brazos colgando detrás del cuerpo.', 'Ese estiramiento inicial es el motivo del ejercicio.', 'Sube sin adelantar el codo.'] },
  'curl-concentrado': { cues: ['Codo apoyado en la cara interna del muslo.', 'Sube despacio y aprieta arriba.', 'Un brazo cada vez, sin prisa.'] },
  'curl-predicador': { cues: ['Axilas pegadas al soporte.', 'No estires del todo de golpe: el codo sufre.', 'Sube hasta donde haya tensión, no hasta tocar.'] },
  'curl-polea': { cues: ['Tensión constante de principio a fin.', 'Codos al costado.', 'Un paso atrás de la polea para que no toque el suelo.'] },

  // ── Tríceps ──
  'press-frances': { cues: ['Codos apuntando al techo y quietos.', 'La barra baja a la frente o algo por detrás.', 'Barra Z si molesta el codo.'], error: 'Abrir los codos y convertirlo en press cerrado.' },
  'extension-polea': { cues: ['Codos pegados al costado.', 'Estira del todo abajo y aprieta.', 'Torso quieto: no empujes con el peso del cuerpo.'] },
  'extension-polea-cuerda': { cues: ['Separa las manos al final del recorrido.', 'Codos fijos al costado.', 'Mejor rango que con barra.'] },
  'extension-sobre-cabeza': { cues: ['Codos junto a la cabeza, apuntando arriba.', 'Baja hasta notar el tríceps estirado.', 'Costillas cerradas: no arquees la espalda.'] },
  'patada-triceps': { cues: ['Brazo pegado al costado y paralelo al suelo.', 'Solo se mueve el antebrazo.', 'Peso ligero y aprieta al final.'] },
  'fondos-banco': { cues: ['Manos al borde del banco, codos atrás.', 'Baja hasta 90° en el codo, no más.', 'Hombros abajo, no encogidos.'], error: 'Bajar demasiado y cargar la cápsula del hombro.' },
  'press-cerrado': { cues: ['Manos al ancho de los hombros, no más juntas.', 'Codos pegados al torso al bajar.', 'La barra baja a la parte baja del pecho.'] },

  // ── Pierna ──
  sentadilla: { cues: ['Barra sobre el trapecio, no sobre el cuello.', 'Rodillas en la dirección de los pies, cadera atrás y abajo.', 'Baja al menos hasta que el muslo quede paralelo.'], error: 'Levantar la cadera antes que el pecho al subir.' },
  'sentadilla-frontal': { cues: ['Codos altos todo el recorrido: si caen, la barra cae.', 'Torso más vertical que en la trasera.', 'Baja controlando, sube sin inclinar el pecho.'] },
  'sentadilla-goblet': { cues: ['Mancuerna o kettlebell pegada al pecho.', 'Baja entre las rodillas con el torso vertical.', 'Ideal para aprender la profundidad.'] },
  prensa: { cues: ['Pies a la anchura de la cadera, en medio de la plataforma.', 'Baja hasta 90° sin que la lumbar se despegue.', 'No bloquees las rodillas de golpe arriba.'], error: 'Bajar tanto que la pelvis se despega del asiento.' },
  hack: { cues: ['Espalda pegada al respaldo.', 'Pies algo adelantados si quieres más cuádriceps.', 'Controla la bajada.'] },
  'extension-cuadriceps': { cues: ['Ajusta el eje a la altura de la rodilla.', 'Sube y aprieta arriba un segundo.', 'Baja despacio, sin soltar el peso.'] },
  'curl-femoral': { cues: ['Cadera pegada al banco.', 'Sube llevando el talón al glúteo.', 'No despegues la pelvis para ayudarte.'] },
  'curl-femoral-sentado': { cues: ['Fija bien el muslo bajo el rodillo.', 'Rango completo y vuelta controlada.', 'Punta del pie hacia ti.'] },
  zancadas: { cues: ['Paso largo: rodilla de atrás casi al suelo.', 'Torso vertical.', 'Empuja con el talón de la pierna de delante.'] },
  bulgara: { cues: ['Pie de atrás sobre el banco, no muy lejos.', 'Torso ligeramente adelante para cargar el glúteo.', 'Rodilla de delante en la dirección del pie.'], error: 'Colocarse tan lejos del banco que tira de la ingle.' },
  'hip-thrust': { cues: ['Omóplatos en el borde del banco, barbilla metida.', 'Sube hasta que el torso quede paralelo al suelo.', 'Aprieta el glúteo arriba, sin arquear la lumbar.'], error: 'Terminar el movimiento con la espalda en vez del glúteo.' },
  'puente-gluteo': { cues: ['Talones cerca del glúteo.', 'Sube apretando el glúteo, no la lumbar.', 'Aguanta dos segundos arriba.'] },
  'patada-gluteo-polea': { cues: ['Tobillera en el pie, torso firme.', 'Lleva la pierna atrás sin arquear la espalda.', 'Aprieta al final del recorrido.'] },
  abductores: { cues: ['Espalda apoyada.', 'Abre despacio y vuelve controlando.', 'Rango completo, peso moderado.'] },
  aductores: { cues: ['Ajusta la apertura inicial a lo que toleras.', 'Cierra apretando, vuelve despacio.', 'Nada de rebotes en la apertura.'] },
  'gemelos-pie': { cues: ['Talón por debajo del escalón: estira abajo.', 'Sube del todo sobre la punta.', 'Pausa arriba y abajo.'], error: 'Rebotar y usar el tendón en vez del músculo.' },
  'gemelos-sentado': { cues: ['Rodilla a 90°: aquí entra el sóleo.', 'Rango completo y pausa arriba.', 'Lento, sin rebote.'] },
  'peso-muerto-piernas-rigidas': { cues: ['Rodillas casi rectas pero no bloqueadas.', 'Baja llevando la cadera atrás, espalda neutra.', 'Para cuando el isquio no dé más.'], error: 'Redondear la espalda buscando llegar al suelo.' },

  // ── Core ──
  plancha: { cues: ['Codos bajo los hombros.', 'Glúteo apretado y costillas cerradas.', 'Mejor 30 segundos bien que dos minutos con la cadera caída.'], error: 'Dejar caer la cadera o subirla en pico.' },
  'plancha-lateral': { cues: ['Codo bajo el hombro, cuerpo en línea.', 'Cadera alta: no la dejes caer.', 'Mira al frente.'] },
  crunch: { cues: ['Despega solo los omóplatos.', 'Sin tirar del cuello con las manos.', 'Exhala al subir.'], error: 'Tirar de la nuca con las manos.' },
  'crunch-polea': { cues: ['De rodillas, cuerda junto a la cabeza.', 'Flexiona la columna llevando los codos a los muslos.', 'La cadera no se mueve.'] },
  'elevacion-piernas': { cues: ['Colgado, sin balanceo.', 'Sube llevando la pelvis hacia las costillas, no solo las piernas.', 'Baja controlando.'], error: 'Columpiarse y subir solo por impulso.' },
  'rueda-abdominal': { cues: ['Empieza de rodillas y poco recorrido.', 'Glúteo apretado: la lumbar no se arquea.', 'Alarga el recorrido solo cuando lo controles.'], error: 'Llegar lejos a costa de arquear la espalda.' },
  'russian-twist': { cues: ['Torso atrás a unos 45°.', 'Gira desde el tronco, no solo con los brazos.', 'Pies en el suelo si pierdes la postura.'] },
  hollow: { cues: ['Lumbar pegada al suelo, sin hueco.', 'Baja brazos y piernas solo hasta donde mantengas ese apoyo.', 'Respira: no lo hagas en apnea.'], error: 'Despegar la lumbar y cargar la espalda.' },
  'mountain-climbers': { cues: ['Manos bajo los hombros, cuerpo en línea.', 'Rodilla al pecho sin subir la cadera.', 'Ritmo sostenido.'] },

  // ── Potencia y cuerpo completo ──
  'push-press': { cues: ['Flexión corta de piernas y extiende con fuerza.', 'La barra sube en línea recta sobre la cabeza.', 'Mete la cabeza al bloquear.'] },
  'swing-kettlebell': { cues: ['Es bisagra de cadera, no sentadilla.', 'La pesa va por dentro de los muslos.', 'El impulso lo da la cadera, no los brazos.'], error: 'Levantar la pesa con los hombros.' },
  'farmer-walk': { cues: ['Hombros atrás y abajo, pecho alto.', 'Pasos cortos y firmes.', 'Agarre fuerte: ese es el punto del ejercicio.'] },
  'curl-muneca': { cues: ['Antebrazos apoyados, muñecas fuera del banco.', 'Rango completo, poco peso.', 'Lento en los dos sentidos.'] },
  'dead-hang': { cues: ['Colgado con los hombros activos, no muertos.', 'Agarre firme, respiración tranquila.', 'Buen accesorio para dominadas.'] },
  burpees: { cues: ['Pecho al suelo abajo, extensión completa de cadera arriba.', 'Cae sobre la planta del pie, no sobre el talón.', 'Ritmo sostenible: es acondicionamiento, no una carrera.'], error: 'Dejar la cadera caída en la flexión por ir rápido.' },
  clean: { cues: ['Despega como un peso muerto: la barra pegada al cuerpo.', 'Extiende cadera y rodillas de golpe y métete debajo.', 'Recíbela en los deltoides con los codos altos.'], error: 'Tirar con los brazos en vez de extender la cadera.' },
  thruster: { cues: ['Sentadilla completa y, sin pausa, press sobre la cabeza.', 'El impulso de las piernas arranca el press.', 'Abdomen apretado: el torso no se arquea arriba.'], error: 'Separar la sentadilla del press y perder el impulso.' },

  // ── Cardio ──
  cinta: { cues: ['No te agarres al frontal: falsea el esfuerzo.', 'Ritmo que te deje hablar en frases cortas.', 'Después de pesas, suave: no te comas la recuperación.'] },
  'bici-estatica': { cues: ['Sillín a la altura de la cadera.', 'Rodilla ligeramente flexionada abajo.', 'Cadencia cómoda antes que resistencia alta.'] },
  eliptica: { cues: ['Postura erguida, sin colgarte de las asas.', 'Empuja también con las piernas, no solo con los brazos.', 'Resistencia suficiente para no ir dando tumbos.'] },
  'remo-ergometro': { cues: ['El orden es piernas, cadera, brazos. Y al revés al volver.', 'Espalda neutra, nada de tirones.', 'Los watios salen de las piernas.'], error: 'Tirar primero con los brazos.' },
  comba: { cues: ['Saltos bajos: solo lo justo para pasar la cuerda.', 'El giro sale de las muñecas.', 'Cae sobre la planta, no sobre el talón.'] },
  escaleras: { cues: ['Erguido, sin apoyarte en las asas.', 'Pisa el escalón completo.', 'Ritmo sostenido mejor que a ráfagas.'] },
};
