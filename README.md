# Clara · Hampshire DCEP — app de estudio

App web (PWA, mobile-first) para organizar y estudiar la preparación para la academia, conducir en UK, la academia, el **NIE** y el plan de fitness. Funciona sin conexión y guarda todo en el navegador; no hay cuentas ni servidor.

> El plan completo (arquitectura, modelo de datos, pantallas e índice de lecciones con fechas) está en [`docs/PLAN.md`](docs/PLAN.md).

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Esqueleto, Hoy, Semana, Carpetas, Progreso, repasos espaciados, planificador, Ajustes, copia de seguridad | ✅ |
| 2 | Flashcards, mini-tests, registro de errores, simulacros, capítulo NIE (10 pasos), diario de academia | ✅ |
| 3 | Índice + lecciones 1 y 2 de cada asignatura, glosario, Fitness | ✅ |
| 4 | Resto de lecciones por tandas | ⏳ |

## Ejecutarla en tu ordenador

Necesitas [Node.js](https://nodejs.org) 20 o superior.

```bash
npm install        # solo la primera vez
npm run dev        # abre http://localhost:5173
npm test           # tests de repasos, planificador, racha y copia de seguridad
npm run build      # versión final en dist/
npm run preview    # prueba la versión final en http://localhost:4173
```

## Publicarla gratis para usarla en el móvil

**Opción A — Netlify (recomendada; vale con repo privado)**
1. Entra en [netlify.com](https://www.netlify.com) con tu cuenta de GitHub.
2. *Add new site → Import an existing project →* elige este repositorio.
3. Netlify lee `netlify.toml` (build `npm run build`, carpeta `dist`). Pulsa *Deploy*.
4. Cada vez que se suban cambios a GitHub, la web se actualiza sola.

**Opción B — GitHub Pages (repo público)**
1. En el repo: *Settings → Pages → Source: GitHub Actions*.
2. El workflow `.github/workflows/pages.yml` pasa los tests, compila y publica en cada push a `main`.
3. La dirección será `https://<usuario>.github.io/clara-dcep/`.

**Opción C — Vercel**: *Import project* → framework *Vite* → listo.

**Instalarla en el móvil**: abre la dirección en Safari (iPhone: *Compartir → Añadir a pantalla de inicio*) o Chrome (Android: *menú → Instalar aplicación*). Después funciona sin conexión.

## ⚠ Tus datos

Todo se guarda **solo en el navegador del dispositivo** (IndexedDB). No se sincroniza entre móvil y ordenador. Usa **Ajustes → Exportar JSON** cada semana y guarda el archivo (Drive, correo). Para pasar los datos a otro dispositivo: *Exportar* en uno e *Importar* en el otro.

## Editar el contenido (sin tocar código)

Todo está en `content/`:

| Archivo | Qué es |
|---|---|
| `content/structure.json` | Carpetas → asignaturas → lecciones (códigos y títulos) |
| `content/plan/pre-academy.json` | Orden de las lecciones de pre-academia (el planificador las reparte: L–V 2, sábado 1) |
| `content/plan/nie-temario.json` | Tu temario NIE: 43 capítulos en tu orden de 12 grupos, minutos por paso, repasos, repaso final, fechas clave, capacidad por día y simulacros |
| `content/fitness/plan.json` | Plan semanal de entreno |
| `content/lessons/<carpeta>/<asignatura>/<id>.md` | El texto de cada lección (Fase 3) |
| `content/flashcards/<asignatura>.json` | Flashcards: `{ "cards": [{ "id", "lessonId", "front", "back", "es" }] }` |
| `content/questions/<asignatura>.json` | Preguntas tipo test: `{ "questions": [{ "id", "lessonId", "chapter", "scenario", "options": [4], "correct": 0–3, "explanations": [4], "manualRef" }] }` |

En las lecciones, los bloques en español se escriben así y aparecen con el botón «Ver en español»:

```md
:::es
Explicación en español.
:::
```

Después de editar, `npm run build` (o sube el cambio a GitHub y Netlify/Pages lo publica).

## Cómo funciona

- **Fechas**: formato dd/mm/aaaa, zona horaria Europe/London. Todas las fechas clave se cambian en *Ajustes* y el calendario se recalcula.
- **Repasos espaciados**: al terminar algo → +1 día, +3 días, +7 días, +1 mes y después cada mes, contados desde la fecha **real** en que lo terminaste. Si haces un repaso tarde, los siguientes se desplazan esos días. Los capítulos NIE usan **+1, +3, +7, +30, +60, +90 y +120 días** desde la fecha real del paso ⑩ y no tienen repasos en o después del inicio del repaso final (17 may). En *Hoy* salen como mucho **3 repasos atrasados** (los más antiguos); el resto está en *NIE → Repasos* (Atrasados · Hoy · Próximos 7 días).
- **Flashcards**: SM-2 simplificado con 3 botones. *Lo sé* → 1 día, 4 días y luego × facilidad; *Dudo* → crece poco; *No lo sé* → mañana y otra vez al final de la sesión. Límite de 20 nuevas y 100 repasos al día.
- **Temario NIE**: los 43 capítulos en tus 12 grupos con los botones ①–⑩ (se guarda la fecha de cada paso). Al marcar el paso ⑩ el capítulo pasa a *Estudiado* (fecha editable) y empiezan sus repasos. Estados: Pendiente → En curso (x/10) → Estudiado → En repaso (n) → Final ✓.
- **Plan NIE que se reprograma solo** (`src/lib/scheduler.ts`): no son fechas fijas, es una **cola** con los pasos que te faltan, en tu orden, repartida desde hoy según los minutos de cada día (por defecto L–V 75′, sábado 180′, domingo 120′; festivos 0; editables en Ajustes). Lo que no marcas pasa al siguiente hueco, un paso puede partirse entre dos días y nunca se pone más de lo que cabe. Si haces solo una **parte** de un paso, la marcas y al día siguiente sale solo lo que falta (en el Temario el paso se ve en ámbar). Botón **"Hoy no puedo"** (deshacible) y aviso de **margen** hasta el fin de la academia. Los días pasados se ven tal como estaban planificados.
- **Progreso del temario**: tarjeta con % de estudio, capítulos, pasos, repasos, partes 1–4 y margen (en Progreso, en el Temario y en Hoy durante la academia).
- **Simulacros**: tabla con tus 9 tests del temario (tipo, material, objetivo); apuntas los aciertos y la app calcula el % y lo compara con tu objetivo y con el 55,7 %, con gráfica de evolución.
- **Diario de academia**: al guardar un día se programan repasos a +1 día y +7 días.
- **Simulacros como el NIE real**: 80 preguntas en 120 min repartidas por partes según su nº de capítulos (22/26/17/15); 10 preguntas al azar son "de prueba" y no puntúan (no sabes cuáles); se corrige sobre 70 y apruebas con 39 (55,7 %). Indicador de ritmo (90 s por pregunta). Acumulados: 30 preguntas en 45 min.
- **Tests por capítulo**: las preguntas de cada capítulo se agrupan en tests fijos de 10 (Test 1, 2, 3…), más uno al azar y uno cronometrado.
- **Preguntas**: todas son **originales** y de estilo NIE; no son preguntas reales del examen ni copiadas de libros.
- **Racha**: cuenta los días seguidos en que completas al menos el 80 % de las tareas de Hoy (ajustable). Lo atrasado no cuenta para la racha.
- **Planificador** (`src/lib/planner.ts`): reparte las lecciones de pre-academia, los 43 capítulos NIE (con la cola de `scheduler.ts`), los tests acumulados, los simulacros y el repaso final por grupos en las fechas fijas del temario (se desplazan si cambias el inicio del repaso final).

## Stack

React + TypeScript + Vite · Tailwind CSS · Dexie (IndexedDB) · vite-plugin-pwa · Recharts · Vitest.
