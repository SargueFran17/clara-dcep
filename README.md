# Clara · Hampshire DCEP — app de estudio

App web (PWA, mobile-first) para organizar y estudiar la preparación para la academia, conducir en UK, la academia, el **NIE** y el plan de fitness. Funciona sin conexión y guarda todo en el navegador; no hay cuentas ni servidor.

> El plan completo (arquitectura, modelo de datos, pantallas e índice de lecciones con fechas) está en [`docs/PLAN.md`](docs/PLAN.md).

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Esqueleto, Hoy, Semana, Carpetas, Progreso, repasos espaciados, planificador, Ajustes, copia de seguridad | ✅ |
| 2 | Flashcards, mini-tests, registro de errores, simulacros, capítulo NIE (10 pasos), diario de academia | ⏳ |
| 3 | Índice + lecciones 1 y 2 de cada asignatura, glosario, Fitness | ⏳ |
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
| `content/plan/nie-order.json` | Tu orden NIE en 12 grupos y el "peso" (tamaño) de cada capítulo |
| `content/fitness/plan.json` | Plan semanal de entreno |
| `content/lessons/<carpeta>/<asignatura>/<id>.md` | El texto de cada lección (Fase 3) |

En las lecciones, los bloques en español se escriben así y aparecen con el botón «Ver en español»:

```md
:::es
Explicación en español.
:::
```

Después de editar, `npm run build` (o sube el cambio a GitHub y Netlify/Pages lo publica).

## Cómo funciona

- **Fechas**: formato dd/mm/aaaa, zona horaria Europe/London. Todas las fechas clave se cambian en *Ajustes* y el calendario se recalcula.
- **Repasos espaciados**: al terminar algo → +1 día, +3 días, +7 días, +1 mes y después cada mes, contados desde la fecha **real** en que lo terminaste. Si haces un repaso tarde, los siguientes se desplazan esos días. Los capítulos NIE dejan de tener repasos al empezar el repaso final (17 may).
- **Racha**: cuenta los días seguidos en que completas al menos el 80 % de las tareas de Hoy (ajustable). Lo atrasado no cuenta para la racha.
- **Planificador** (`src/lib/planner.ts`): reparte las lecciones de pre-academia, los 43 capítulos NIE (ponderados por tamaño, en tu orden), los tests acumulados, los simulacros y el repaso final por grupos.

## Stack

React + TypeScript + Vite · Tailwind CSS · Dexie (IndexedDB) · vite-plugin-pwa · Recharts · Vitest.
