# Quiniela Mundial 2026

App web para crear grupos privados y predecir el Mundial de Fútbol 2026 completo: marcadores, clasificados, avances por ronda, campeón, tercer puesto y goleador.

## Stack Técnico

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Supabase (Auth, Postgres, Row Level Security)
- Vitest

## Funcionalidades

- **Autenticación**: Registro y login con Supabase Auth
- **Grupos privados**: Creación de quinielas con código de invitación
- **Invitaciones**: Código único para unirse a grupos
- **Predicciones**: Marcadores de todos los partidos, campeón, tercer puesto, goleador y avances por ronda
- **Calendario**: Vista de todos los partidos del Mundial 2026
- **Standings**: Tablas de posiciones de grupos con cálculo automático
- **Bracket**: Visualización dinámica del torneo eliminatorio
- **Leaderboard**: Ranking de puntajes por grupo con desglose por categoría
- **Scoring**: Sistema de puntos automático que compara predicciones contra resultados reales

## Variables de Entorno

Crear archivo `.env.local` con:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_supabase_service_role_key
```

`SUPABASE_SERVICE_ROLE_KEY` es necesario para ejecutar el seed de datos.

## Comandos

```bash
npm run dev          # Iniciar servidor de desarrollo
npm run build        # Build para producción
npm run test         # Ejecutar tests en modo watch
npm run test:run     # Ejecutar tests una vez
npm run seed:worldcup # Importar datos del Mundial desde data/worldcup-2026.json
npm run gen-types    # Generar tipos TypeScript desde Supabase
npm run create-global-admin # Crear usuario administrador global
npm run create-test-users   # Crear usuarios de prueba para testing
```

## Seed del Mundial

El script `npm run seed:worldcup` lee `data/worldcup-2026.json` e importa a la base de datos:

- Partidos con fases, fechas, horarios y sedes
- Equipos y grupos
- Estructura del bracket con slots dinámicos (1A, 2B, W74, L101, etc.)

Este script requiere `SUPABASE_SERVICE_ROLE_KEY` para tener permisos de escritura.

## Scripts de Administración

### Crear Administrador Global

```bash
npm run create-global-admin
```

Crea un usuario con rol `global_admin` que puede:
- Ingresar resultados reales de partidos
- Indicar ganadores en eliminatorias
- Resolver desempates manuales oficiales
- Confirmar campeón, tercer puesto y goleador oficial
- Ejecutar recálculos globales

Credenciales por defecto:
- Email: `admin@fixture-mundial.com`
- Password: `admin123`

**Importante**: Cambiar la contraseña después del primer login.

### Crear Usuarios de Prueba

```bash
npm run create-test-users
```

Crea 5 usuarios de prueba para testing:
- usuario1@test.com / password123
- usuario2@test.com / password123
- usuario3@test.com / password123
- usuario4@test.com / password123
- usuario5@test.com / password123

Ambos scripts requieren `SUPABASE_SERVICE_ROLE_KEY`.

## Roles

### member
Usuario regular de un grupo. Puede crear y editar sus propias predicciones antes del deadline, y ver predicciones de otros miembros del mismo grupo.

### leader
Creador del grupo. Puede cambiar configuración básica del grupo (nombre, fecha límite si no ha empezado el torneo), ver miembros y gestionar el código de invitación. No puede ingresar resultados reales ni resolver desempates oficiales.

### global_admin
Rol global definido en la tabla `global_admins`. Puede ingresar resultados reales de partidos, indicar ganadores en eliminatorias, resolver desempates manuales oficiales, confirmar campeón, tercer puesto y goleador oficial, y ejecutar recálculos globales.

## Reglas de Puntos

### Fase de Grupos
- **Marcador exacto**: 5 puntos
- **Ganador o empate correcto sin marcador exacto**: 2 puntos

### Fase Eliminatoria
- **Marcador exacto a 90 minutos**: 10 puntos

### Avances de Selecciones (acumulativos)
- Clasifica a dieciseisavos: 20 puntos
- Avanza a octavos: 35 puntos
- Avanza a cuartos: 55 puntos
- Avanza a semifinales: 80 puntos
- Llega a la final: 110 puntos
- Es campeón: 150 puntos

### Predicciones Especiales
- **Tercer puesto correcto**: 80 puntos
- **Campeón correcto**: 150 puntos
- **Goleador oficial correcto**: 60 puntos

## Documentación

Para más detalles técnicos y reglas del juego, consultar:

- `docs/APP_SPEC.md` - Especificación completa de la aplicación
- `docs/RULES.md` - Reglas detalladas del juego y sistema de puntajes
- `docs/TEST_PLAN.md` - Plan de pruebas

## Estado del Proyecto

✅ **Mapeo de mejores terceros**: Completado. El sistema ahora soporta la combinación oficial de FIFA para determinar qué terceros de cada grupo se enfrentan en dieciseisavos.

✅ **Source key para partidos**: Implementado. La columna `source_key` en la tabla `matches` proporciona un identificador estable para operaciones de upsert.
