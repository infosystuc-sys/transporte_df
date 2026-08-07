# Gestión de Fletes

Sistema de gestión para una empresa de transporte de cargas (fletes) de
Tucumán, Argentina. Reemplaza las planillas Excel actuales, controlando el
ciclo completo de cada viaje: carga, descarga, merma, tarifa, gastos, cobro
al cliente y liquidación al chofer.

Ver el spec de diseño completo en
[`docs/superpowers/specs/2026-08-06-sistema-gestion-fletes-design.md`](docs/superpowers/specs/2026-08-06-sistema-gestion-fletes-design.md).

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript estricto
- [Supabase](https://supabase.com) (Postgres, Auth, Storage)
- [Drizzle ORM](https://orm.drizzle.team) con migraciones versionadas
- [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- [TanStack Table](https://tanstack.com/table) para listados
- [react-hook-form](https://react-hook-form.com) + [Zod](https://zod.dev) para formularios

## Requisitos

- Node.js 22+
- pnpm 10+
- Un proyecto de Supabase ya creado

## Instalación

1. Instalar dependencias:

   ```bash
   pnpm install
   ```

2. Copiar `.env.example` a `.env.local` y completar las variables:

   ```bash
   cp .env.example .env.local
   ```

   - `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: en
     el dashboard de Supabase, **Project Settings → API**.
   - `SUPABASE_SERVICE_ROLE_KEY`: misma pantalla, sección de claves
     secretas. Nunca se expone al navegador.
   - `DATABASE_URL`: **Project Settings → Database → Connection string**
     (usar el modo "Transaction pooler" para desarrollo).
   - `ANTHROPIC_API_KEY`: opcional, solo habilita el fallback de lectura de
     CPE escaneadas por IA (Fase 10). Sin esta variable el sistema pide
     cargar esos casos a mano.

3. Crear al menos un usuario de login en Supabase Auth (dashboard →
   **Authentication → Users → Add user**), con email y contraseña. El
   sistema no tiene pantalla de alta de usuarios ni registro público.

4. Generar y aplicar las migraciones de base de datos:

   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

5. Cargar los datos de prueba (catálogos, viajes de ejemplo):

   ```bash
   pnpm seed
   ```

6. Levantar el servidor de desarrollo:

   ```bash
   pnpm dev
   ```

   Abrir [http://localhost:3000](http://localhost:3000).

## Scripts

| Script             | Descripción                                            |
| ------------------ | ------------------------------------------------------- |
| `pnpm dev`          | Servidor de desarrollo                                  |
| `pnpm build`        | Build de producción                                     |
| `pnpm lint`         | ESLint                                                   |
| `pnpm db:generate`  | Genera una migración de Drizzle a partir del esquema     |
| `pnpm db:migrate`   | Aplica las migraciones pendientes contra `DATABASE_URL`  |
| `pnpm db:studio`    | Abre Drizzle Studio para inspeccionar la base            |
| `pnpm seed`         | Carga catálogos y datos de prueba                        |

## Estructura

```
src/
  app/
    login/          # Ruta pública de login
    (app)/           # Rutas protegidas por el proxy (dashboard, viajes, etc.)
  components/
    ui/              # Componentes shadcn/ui
    layout/          # Sidebar, topbar, navegación
    auth/            # Formulario de login
  lib/
    supabase/        # Clientes de Supabase (browser, server, proxy)
    schemas/          # Schemas de Zod compartidos entre cliente y servidor
    auth/             # Server actions de autenticación
  db/
    schema/           # Esquema de Drizzle (tablas)
    index.ts          # Instancia de conexión a la base
  proxy.ts             # Protección de rutas y refresco de sesión (Next.js 16)
drizzle/                # Migraciones generadas (versionadas en git)
fixtures/               # Documentos reales de referencia (CPE, remitos, Excel histórico)
docs/superpowers/specs/  # Spec de diseño del proyecto
```

## Deploy

Pensado para Vercel + Supabase. Configurar las mismas variables de entorno
de `.env.example` en el proyecto de Vercel antes de deployar.
