# Plan · Clara · Hampshire DCEP (app de estudio)

> Estado: **PROPUESTA — pendiente de tu aprobación**. No se ha escrito código todavía.

## 1. Stack (me quedo con el que sugeriste)

| Pieza | Elección | Por qué |
|---|---|---|
| UI | React 18 + TypeScript + Vite | Rápido, tipado, build estático gratis en cualquier hosting |
| Estilos | Tailwind CSS (modo oscuro por clase) | Mobile-first y contraste controlado con tokens |
| Datos | IndexedDB con **Dexie** | Todo local, sin cuentas; soporta grabaciones de audio (Blob) |
| PWA | `vite-plugin-pwa` (Workbox) | Instalable y 100 % offline (el contenido va dentro del build) |
| Rutas | React Router con **HashRouter** | Funciona en GitHub Pages sin configurar redirecciones |
| Markdown | `react-markdown` + `remark-gfm` | Lecciones en `.md` editables |
| Gráficas | Recharts | Peso, evolución de tests, horas |
| Fechas | `date-fns` + `date-fns-tz` (Europe/London), formato dd/mm/aaaa | |
| Tests | Vitest | Repasos espaciados, SM-2 y planificador |
| Audio | `MediaRecorder` del navegador | Paso 9 "explicar en voz alta" |

Un solo cambio respecto a lo que pedías: **el contenido de `content/` se empaqueta al compilar** (con `import.meta.glob`). Editas un `.md`/`.json`, haces `npm run build` (o Netlify lo reconstruye solo al hacer push) y ya está. No hay que tocar código.

## 2. Estructura del proyecto

```
clara-dcep/
├─ content/                      ← TODO el contenido editable
│  ├─ structure.json             ← carpetas → asignaturas → lecciones (orden, fase, tamaño)
│  ├─ lessons/<carpeta>/<asignatura>/<NN-slug>.md   ← lección (frontmatter + cuerpo)
│  ├─ flashcards/<asignatura>.json
│  ├─ questions/<asignatura|capítulo>.json          ← mini-tests y banco NIE
│  ├─ glossary.json  · acronyms.json
│  └─ fitness/plan.json          ← plan semanal de entreno
├─ src/
│  ├─ lib/srs.ts                 ← repasos +1d/+3d/+7d/+1m/mensual
│  ├─ lib/sm2.ts                 ← flashcards (SM-2 simplificado, 3 botones)
│  ├─ lib/planner.ts             ← genera el calendario a partir de Ajustes
│  ├─ lib/today.ts               ← agrega las tareas de "Hoy" de todas las carpetas
│  ├─ db/ (Dexie: esquema + backup JSON)
│  ├─ screens/ Hoy · Semana · Carpetas · Progreso · Ajustes · (lección, flashcards, test, simulacro, NIE capítulo, diario, fitness)
│  └─ components/
└─ README.md (español)
```

### Formato de una lección (`.md`)

```md
---
id: nie-1-3
title: "1.3 Actus reus"
manualRef: "Blackstone's 2027 · cap. 1.3"
sources: ["legislation.gov.uk/...", "College of Policing APP ..."]
---
## Objectives
- ...
## Explanation
Plain-English text...
:::es
Traducción/explicación en español (oculta hasta pulsar "ver en español").
:::
## Police scenarios
## Common mistakes & exam traps
## Summary (5 lines)
## Sources
```
Flashcards y mini-test de la lección van en JSON aparte (vinculados por `lessonId`) para que se puedan usar también en el mazo global y en los simulacros.

## 3. Modelo de datos (IndexedDB)

Contenido estático (del build): `Folder`, `Subject`, `Lesson`, `Card`, `Question {id, subjectId, chapter?, scenario, options[4], correct, explanations[4], manualRef}`, `GlossaryTerm {en, plainEn, es, tags}`.

Estado del usuario (Dexie):

| Tabla | Campos clave |
|---|---|
| `settings` | fechas clave (todas editables), tema, idioma de apoyo, horas objetivo |
| `lessonProgress` | lessonId, status (pending/done), completedAt, plannedDate (override manual) |
| `reviews` | itemType (lesson/chapter/academyDay/topic), itemId, dueDate, step (1,3,7,30,mensual), doneAt |
| `cardState` | cardId, ease, interval, due, reps, lapses (incluye tarjetas creadas por ti) |
| `userCards` / `userQuestions` | tus flashcards y preguntas propias |
| `testAttempts` | tipo (mini/acumulado/simulacro), fecha, respuestas, % total y por parte, duración |
| `errors` | questionId, subject/capítulo, tipo de error (6 tipos), regla correcta escrita por ti, fecha |
| `nieChapter` | chapterId, steps[10] (hecho + fecha + minutos), status, reviewCount, confidence 1–5, summary (texto paso 10), recordings (Blob) |
| `academyDays` | fecha, módulo, apuntes, 5 ideas clave, dudas, cardIds |
| `academyModules` | nombre, orden (lista editable) |
| `assessments` | fecha, tipo, nota, qué mejorar |
| `studySessions` | fecha, minutos, carpeta/asignatura (horas reales vs objetivo) |
| `taskDone` | fecha + taskKey (marcar tareas de Hoy; base de la racha) |
| `workouts` | fecha, tipo (gym A/B/C, running, tenis, rodaje, descanso), hecho, notas |
| `weights` | fecha, kg |
| `bleepLevels` | fecha, nivel (p. ej. 5.4) |
| `habits` | fecha, comidas cumplidas (sí/parcial/no), agua, sueño (h) |

Backup: exporta/importa todas estas tablas en un `.json` (los audios en base64).

## 4. Lógica central

- **Repasos espaciados**: al marcar algo como terminado se crean repasos a +1d, +3d, +7d, +1 mes y luego cada mes, calculados desde la fecha **real** de finalización. Los no hechos aparecen como "Atrasados" (en rojo) en Hoy. Para capítulos NIE, los repasos paran el 17/05 y entra el repaso final por grupos (17–31 may).
- **Flashcards**: SM-2 simplificado. *Lo sé* → intervalo × facilidad; *Dudo* → intervalo × 1,2 y baja la facilidad; *No lo sé* → vuelve a mañana. Límite diario configurable (20 nuevas, 100 repasos).
- **Planificador** (función pura, con tests): a partir de las fechas de Ajustes genera el calendario. Si cambias una fecha (p. ej. el examen NIE), todo se recalcula. Si vas atrasada, lo no hecho se arrastra a "Hoy" como pendiente, sin borrar nada.
  - Pre-academia: L–V 2 lecciones, sábado 1 lección + mini-test semanal, domingo repaso semanal (1,5 h).
  - Navidad (24–28 dic): solo flashcards y repasos (ligero).
  - Academia: L–V diario de academia + 1 h 15 NIE + repasos; sábado 3,5 h (≈2 "unidades" NIE); domingo repasos + resumen semanal de la academia.
  - NIE: capítulos en TU orden de 12 grupos, repartidos por tamaño (peso estimado: 1.7 = 9, 1.8 = 7, 2.2/2.3/2.7 = 5…).
  - Hitos: tests acumulados 31/01, 28/02, 28/03, 25/04 (30 preguntas) y simulacros 80 preg./120 min los sábados 1, 8, 15, 22 y 29 de mayo; examen 01/06/2027 (estimado).
- **Racha**: un día cuenta si completas todas las tareas obligatorias de Hoy (o al menos el 80 %, configurable).

## 5. Pantallas

1. **Hoy** — cabecera con racha y cuenta atrás (academia / NIE). Bloques: *Atrasado* · *Lección/tarea planificada* · *Repasos* · *Flashcards (n)* · *Entreno/tenis* · *Diario de academia* (si toca) · *Hábitos*. Cada tarea con checkbox y acceso directo.
2. **Semana** — 7 días con lo planificado, horas objetivo vs reales (barras) y entrenos hechos/planificados.
3. **Carpetas** — 5 carpetas con % → asignaturas con % → lecciones (estado y fecha). Dentro de cada asignatura: Lecciones · Flashcards · Tests · Progreso.
4. **Progreso** — global y por carpeta, horas, capítulos NIE por estado (Pendiente / En curso x/10 / Estudiado / En repaso n / Final ✓ y confianza), gráfica de tests vs línea 55,7 %, errores por tipo, peso.
5. **Ajustes** — fechas, backup JSON, claro/oscuro, idioma de apoyo ("ver en español" siempre visible o pulsando).
- Transversales: **Buscador global** (lecciones + glosario EN → plain EN → ES) en la barra superior, **Registro de errores**, **Glosario/Acrónimos** con modo flashcard y test.
- **NIE · capítulo**: checklist de 10 pasos con tiempo sugerido, grabadora (paso 9), editor del resumen (paso 10), confianza 1–5, preguntas del banco.
- **Simulacro**: modo examen a pantalla completa, temporizador 120 min, marcar para revisar, resultado por parte vs 55,7 %, enviar fallos al registro de errores.
- **Fitness**: plan semanal (L gym A · M intervalos + tenis · X gym B · J tenis · V gym C + trote · S rodaje + tenis · D descanso activo), peso semanal con tendencia, bleep, hábitos. Aviso fijo de consultar al GP; sin contador de calorías; objetivo de pérdida moderado (el NHS habla de ~0,5–1 kg/semana ⚠ VERIFICAR en la lección).

Navegación móvil: barra inferior **Hoy · Semana · Carpetas · Progreso · Más** (Ajustes, errores, glosario, fitness).

## 6. Decisiones que he tomado (dime si quieres cambiar alguna)

1. **NIE: asignaturas = las 4 Partes oficiales** + una asignatura "Examen NIE: info y estrategia". Las lecciones son los 43 capítulos; tu orden de 12 grupos manda en el calendario y en la numeración (Lección 1 = 1.3, Lección 2 = 1.2).
2. **Carpeta Academia**: además del diario, módulos, assessments y resumen semanal, añado una asignatura corta "Método de academia" con 2 lecciones (apuntes y assessments) para cumplir "lecciones 1 y 2 de cada asignatura".
3. **Fitness**: 2 asignaturas — *Nutrición y hábitos* y *Entrenamiento (bleep, fuerza, running + tenis, lesiones)*. Las 8 lecciones van en pre-academia.
4. **Conducción 2.14**: la asignatura NIE 2.14 enlaza a las lecciones DR8, DR9 y DR11 y viceversa.
5. **Glosario y acrónimos**: 150+ términos y 80+ acrónimos en JSON; las "lecciones" son bloques de estudio con test.
6. **Preguntas NIE originales**: en Fase 3 escribo 10 por capítulo para 1.3 y 1.2; en Fase 4, 10–15 por capítulo. Con referencia "§" aproximada y aviso "comprueba con tu edición 2027" (no tengo el manual 2027, así que las referencias de apartado irán marcadas ⚠ VERIFICAR).
7. **Repaso "+1 mes"** = mismo día del mes siguiente (no 30 días).
8. **Idioma**: interfaz en español; lecciones en inglés claro con bloques "ver en español".
9. **Despliegue recomendado**: Netlify o GitHub Pages (explicaré ambos en el README).

## 7. Fases de trabajo

| Fase | Contenido | Entrega |
|---|---|---|
| 1 | Esqueleto, PWA, Dexie, Hoy/Semana, Carpetas, Progreso, repasos, planificador, Ajustes, backup | build + tests verdes, commit |
| 2 | Flashcards SM-2, mini-tests, registro de errores, simulacros con temporizador, NIE capítulo (10 pasos + grabadora + editor), diario de academia | build + tests |
| 3 | `structure.json` completo con el índice, Lecciones 1 y 2 de cada asignatura (≈34 lecciones), glosario/acrónimos, Fitness (registros + gráficas) | build + tests |
| 4 | Resto de lecciones por tandas (pre-academia primero, por fecha; luego NIE en tu orden) | por tanda |

Lecciones 1 y 2 que se escriben en Fase 3: VO1–2, GR1–2, ET1–2, DE1–2, SE1–2, SJ1–2, CO1–2, AC1 + GL1, DR1–2, AM1–2, FT1 + FT3 (Nutrición y hábitos: FT1, FT3, FT6, FT8), FT2 + FT4 (Entrenamiento: FT2, FT4, FT5, FT7), NIE info 1–2, NIE 1.3 y 1.2.

## 8. Índice completo de lecciones con fechas

Las fechas las recalcula el planificador si cambias Ajustes. Códigos: SE España vs UK · FT Fitness · VO Vocabulario · GR Gramática · SJ Sistema policial/judicial · CO Comunicación · ET Ética e igualdad · DR Conducir · DE Describir · AC Acrónimos · GL Glosario · AM Método de academia.

### Pre-academia (lecciones planificadas; 18–23 dic = repaso general y test de la carpeta)

| Fecha | Código | Lección |
|---|---|---|
| sáb 31/10 | SE1 | Policing by consent y principios de Peel |
| lun 02/11 | FT1 | Pérdida de peso saludable (NHS) y tu punto de partida |
| lun 02/11 | VO1 | Arrest & detention |
| mar 03/11 | GR1 | In / on / at: tiempo |
| mar 03/11 | SJ1 | Mapa policial: 43 forces, Home Office, PCC, College of Policing, IOPC, HMICFRS |
| mié 04/11 | CO1 | Alfabeto fonético y reloj 24 h |
| mié 04/11 | VO2 | Custody |
| jue 05/11 | GR2 | In / on / at: lugar y horas en informes |
| jue 05/11 | ET1 | Lenguaje inclusivo: pronombres, they/them, Mx, preguntar con respeto |
| vie 06/11 | DR1 | Tu carné español en Gran Bretaña (gov.uk) |
| vie 06/11 | DE1 | Describir personas de la cabeza a los pies |
| sáb 07/11 | SE2 | Policía sin armas de fuego y sin DNI obligatorio |
| lun 09/11 | AC1 | Acrónimos I (40 esenciales) |
| lun 09/11 | FT2 | Entrenar el bleep test (15 m MSFT, nivel 5.4) |
| mar 10/11 | SJ2 | Rangos y CID vs uniformados |
| mar 10/11 | GR3 | Past simple vs past continuous en declaraciones |
| mié 11/11 | DR2 | Conducir por la izquierda y rotondas |
| mié 11/11 | VO3 | Evidence & investigation |
| jue 12/11 | ET2 | Code of Ethics (College of Policing) |
| jue 12/11 | CO2 | Mensajes de radio |
| vie 13/11 | DE2 | Ropa y rasgos distintivos |
| vie 13/11 | GL1 | Glosario I (50 términos) |
| sáb 14/11 | GR4 | Past perfect y secuencia de hechos |
| lun 16/11 | SE3 | Common law vs derecho continental y jurados |
| lun 16/11 | SJ3 | CPS y la decisión de acusar |
| mar 17/11 | FT3 | Nutrición: el plato equilibrado (Eatwell Guide) |
| mar 17/11 | DR3 | Carriles, adelantamientos y prioridades |
| mié 18/11 | VO4 | Court & justice |
| mié 18/11 | ET3 | Standards of Professional Behaviour |
| jue 19/11 | DE3 | Etnia autodefinida (SDE) vs IC codes |
| jue 19/11 | GR5 | Modals: may / must / shall / should |
| vie 20/11 | CO3 | Pocket notebook y ELBOWS |
| vie 20/11 | SJ4 | Tribunales: magistrates', Crown Court y apelaciones |
| sáb 21/11 | AC2 | Acrónimos II (40 más) |
| lun 23/11 | SE4 | La caution vs la lectura de derechos en España |
| lun 23/11 | FT4 | Entrenamiento de fuerza A/B/C |
| mar 24/11 | DR4 | Highway Code I: jerarquía de usuarios y normas básicas |
| mar 24/11 | VO5 | Offences & offenders |
| mié 25/11 | GR6 | La voz pasiva |
| mié 25/11 | ET4 | Equality Act 2010: características protegidas y PSED |
| jue 26/11 | DE4 | Vehículos y matrículas UK |
| jue 26/11 | SJ5 | Tipos de delito y burden/standard of proof |
| vie 27/11 | CO4 | Witness statement (MG11) |
| vie 27/11 | GL2 | Glosario II (50 términos) |
| sáb 28/11 | SE5 | 999/101, unidades, fechas y 24 h |
| lun 30/11 | DR5 | Highway Code II: peatones, ciclistas, autopistas |
| lun 30/11 | VO6 | Thresholds: suspect, believe, reasonable grounds |
| mar 01/12 | GR7 | Reported speech |
| mar 01/12 | FT5 | Combinar running y tenis |
| mié 02/12 | ET5 | Discapacidad y salud mental: lenguaje respetuoso |
| mié 02/12 | DE5 | Lugares, direcciones UK y postcodes |
| jue 03/12 | SJ6 | PACE y los Codes A–H |
| jue 03/12 | DR6 | Señales distintas de España |
| vie 04/12 | GR8 | Phrasal verbs policiales I |
| vie 04/12 | SE6 | Registro cultural: cortesía, indirectas y "sorry" |
| sáb 05/12 | VO7 | Victims, witnesses & safeguarding |
| lun 07/12 | CO5 | Redacción de informes (práctica) |
| lun 07/12 | FT6 | Comidas en días de academia |
| mar 08/12 | DR7 | Marcas viales |
| mar 08/12 | ET6 | Lenguaje respetuoso: raza, religión, orientación, edad |
| mié 09/12 | SJ7 | PIP y el NIE |
| mié 09/12 | GR9 | Phrasal verbs policiales II |
| jue 10/12 | GL3 | Glosario III (50+ términos) |
| jue 10/12 | DR8 | Límites de velocidad (mph) |
| vie 11/12 | VO8 | Verbos y colocaciones del día a día policial |
| vie 11/12 | AM1 | Cómo tomar apuntes en la academia |
| sáb 12/12 | FT7 | Prevención de lesiones |
| lun 14/12 | GR10 | False friends para hispanohablantes |
| lun 14/12 | DR9 | Alcohol, drogas y móvil al volante |
| mar 15/12 | AC3 | Test final de acrónimos y glosario |
| mar 15/12 | AM2 | Cómo preparar los assessments |
| mié 16/12 | DR10 | El coche: seguro, MOT, VED y V5C |
| mié 16/12 | FT8 | Hábitos: agua, sueño y constancia |
| jue 17/12 | DR11 | Accidentes: qué hacer |
| jue 17/12 | DR12 | Aparcamiento y multas |

### NIE — primera vuelta (29 dic – 24 abr; reparto ponderado por tamaño)

| Nº | Grupo | Capítulo | Inicio | Fin aprox. |
|---|---|---|---|---|
| 1 | 1 | 1.3 Actus reus | 29/12 | 31/12 |
| 2 | 1 | 1.2 Mens rea | 31/12 | 02/01 |
| 3 | 1 | 2.7 Non-fatal offences against the person | 02/01 | 07/01 |
| 4 | 2 | 1.8 Identification (Code D) | 07/01 | 14/01 |
| 5 | 3 | 1.4 Instituting criminal proceedings | 14/01 | 16/01 |
| 6 | 4 | 1.5 Court procedure and witnesses | 16/01 | 19/01 |
| 7 | 4 | 1.12 RIPA 2000 | 19/01 | 22/01 |
| 8 | 4 | 2.2 Misuse of drugs | 22/01 | 26/01 |
| 9 | 5 | 1.7 Detention and treatment of persons (Code C) | 26/01 | 03/02 |
| 10 | 6 | 3.1 Theft | 03/02 | 06/02 |
| 11 | 6 | 3.4 Burglary | 06/02 | 10/02 |
| 12 | 6 | 3.2 Robbery | 10/02 | 12/02 |
| 13 | 6 | 3.6 Handling stolen goods | 12/02 | 13/02 |
| 14 | 6 | 3.3 Blackmail | 13/02 | 13/02 |
| 15 | 6 | 3.5 Aggravated burglary | 13/02 | 16/02 |
| 16 | 6 | 3.8 Proceeds of crime | 16/02 | 18/02 |
| 17 | 7 | 1.11 Disclosure of evidence | 18/02 | 20/02 |
| 18 | 7 | 1.10 Release of person arrested | 20/02 | 24/02 |
| 19 | 7 | 2.9 Domestic violence and abuse | 24/02 | 27/02 |
| 20 | 8 | 4.2 Rape | 27/02 | 01/03 |
| 21 | 8 | 4.3 Sexual assault | 01/03 | 02/03 |
| 22 | 8 | 4.1 Sexual offences / anonymity | 02/03 | 04/03 |
| 23 | 8 | 4.4 Offences against children | 04/03 | 06/03 |
| 24 | 8 | 4.5 Offences against people with a mental disorder | 06/03 | 08/03 |
| 25 | 8 | 4.6 Preparatory offences | 08/03 | 09/03 |
| 26 | 8 | 4.7 Prostitution | 09/03 | 10/03 |
| 27 | 8 | 4.8 Other sexual offences | 10/03 | 11/03 |
| 28 | 9 | 1.9 Interviews | 11/03 | 13/03 |
| 29 | 9 | 3.9 Criminal damage | 13/03 | 17/03 |
| 30 | 9 | 3.7 Fraud | 17/03 | 20/03 |
| 31 | 10 | 2.1 Homicide | 20/03 | 22/03 |
| 32 | 10 | 2.3 Firearms and gun crime | 22/03 | 27/03 |
| 33 | 10 | 2.8 Hatred and harassment | 27/03 | 29/03 |
| 34 | 10 | 1.6 Entry, search and seizure (Code B) | 29/03 | 02/04 |
| 35 | 10 | 2.10 Child protection | 02/04 | 05/04 |
| 36 | 11 | 2.5 Cybercrime | 05/04 | 07/04 |
| 37 | 11 | 2.13 Public order offences | 07/04 | 10/04 |
| 38 | 11 | 2.12 Injunctions, orders and police powers | 10/04 | 14/04 |
| 39 | 11 | 2.11 Deprivation of liberty | 14/04 | 16/04 |
| 40 | 12 | 2.4 Terrorism | 16/04 | 19/04 |
| 41 | 12 | 1.1 Diversity, equality and inclusion | 19/04 | 21/04 |
| 42 | 12 | 2.6 Racially and religiously aggravated offences | 21/04 | 23/04 |
| 43 | 12 | 2.14 Standards of driving | 23/04 | 24/04 |

**NIE (asignatura "Examen NIE: info y estrategia")**: NI1 Formato, puntuación y reglas (80/70, 55,7 %, sin IA) · NI2 Cómo usar el método de 10 pasos y leer el Blackstone's — ambas antes del 29/12.

**Después de la primera vuelta**: 26/04–16/05 repasos espaciados + preguntas; 17–31/05 repaso final por grupos (1→12, ≈1 grupo/día con repaso doble de 1.7 y 1.8); simulacros sábados 1, 8, 15, 22, 29/05; examen 01/06/2027 (estimado).
