# Plan de Prueba Completo - Quiniela Mundial 2026

## Configuración Inicial

### 1. Crear Admin Global
```bash
npm run create-global-admin
```
- **Email**: admin@fixture-mundial.com
- **Password**: admin123
- **Importante**: Cambiar contraseña después del primer login

### 2. Crear Usuarios de Prueba
Opción A: Registro manual desde la UI
- Ir a `/register`
- Crear usuarios con diferentes emails

Opción B: Script automatizado (recomendado)
```bash
npm run create-test-users
```
Esto creará 5 usuarios de prueba:
- usuario1@test.com / password123
- usuario2@test.com / password123
- usuario3@test.com / password123
- usuario4@test.com / password123
- usuario5@test.com / password123

### 3. Seed de Datos del Mundial
```bash
npm run seed:worldcup
```
Esto importa todos los partidos, equipos y estructura del bracket desde `data/worldcup-2026.json`

---

## Checklist de Prueba - Usuario No Autenticado

### Landing Page (/)
- [ ] Ver landing page con título "Quiniela Mundial 2026"
- [ ] Ver descripción de la app
- [ ] Ver botón "Registrarse"
- [ ] Ver botón "Iniciar Sesión"
- [ ] Clic en "Registrarse" redirige a `/register`
- [ ] Clic en "Iniciar Sesión" redirige a `/login`

### Registro (/register)
- [ ] Ver formulario de registro
- [ ] Campo "Nombre de usuario" visible
- [ ] Campo "Correo electrónico" visible
- [ ] Campo "Contraseña" visible
- [ ] Validación: nombre mínimo 2 caracteres
- [ ] Validación: nombre máximo 32 caracteres
- [ ] Validación: email formato válido
- [ ] Validación: contraseña mínimo 6 caracteres
- [ ] Registro exitoso redirige a `/dashboard`
- [ ] Error si email ya existe
- [ ] Link "Inicia sesión aquí" funciona

### Login (/login)
- [ ] Ver formulario de login
- [ ] Campo "Correo electrónico" visible
- [ ] Campo "Contraseña" visible
- [ ] Login con credenciales correctas funciona
- [ ] Error con credenciales incorrectas
- [ ] Error con email no registrado
- [ ] Link "Regístrate aquí" funciona

### Acceso Restringido
- [ ] Intentar acceder a `/dashboard` sin auth redirige a `/login`
- [ ] Intentar acceder a `/groups/[id]` sin auth redirige a `/login`
- [ ] Intentar acceder a `/global-admin/results` sin auth redirige a `/login`

---

## Checklist de Prueba - Usuario Autenticado (Member)

### Dashboard (/dashboard)
- [ ] Ver header con "Dashboard"
- [ ] Ver mensaje de bienvenida con username
- [ ] Ver botón "Cerrar sesión"
- [ ] Cerrar sesión funciona y redirige a landing
- [ ] Ver lista de grupos donde es miembro
- [ ] Ver tarjeta "Crear nuevo grupo"
- [ ] Ver tarjeta "Unirse a grupo con código"

### Crear Grupo
- [ ] Clic en "Crear nuevo grupo" muestra formulario
- [ ] Campo "Nombre del grupo" visible
- [ ] Campo "Fecha límite" visible
- [ ] Validación: nombre mínimo 2 caracteres
- [ ] Validación: nombre máximo 80 caracteres
- [ ] Validación: fecha límite requerida
- [ ] Validación: fecha límite debe ser futuro
- [ ] Validación: fecha límite antes del 11 junio 2026 2pm
- [ ] Crear grupo exitoso -- ✅ FIX APLICADO: Errores RLS corregidos con migraciones 20260525200000, 20260525210000, y 20260525220000 (reconstrucción completa de políticas RLS)
- [ ] Redirige a página del grupo creado
- [ ] Usuario es automáticamente leader del grupo
- [ ] Código de invitación generado (6 caracteres alfanuméricos) 

### Unirse a Grupo con Código
- [ ] Clic en "Unirse a grupo con código" muestra formulario 
- [ ] Campo "Código de invitación" visible
- [ ] Validación: código requerido
- [ ] Error con código inválido
- [ ] Unirse exitoso con código válido
- [ ] Redirige a página del grupo
- [ ] Usuario es member (no leader)
- [ ] Error si ya es miembro del grupo

### Página del Grupo (/groups/[id])
- [ ] Ver nombre del grupo
- [ ] Ver código de invitación
- [ ] Ver cantidad de miembros
- [ ] Ver rol del usuario (Líder/Miembro)
- [ ] Ver banner de deadline (abierto/cerrado)
- [ ] Ver fecha límite formateada
- [ ] Ver tarjeta "Mis Predicciones"
- [ ] Ver tarjeta "Miembros"
- [ ] Ver tarjeta "Calendario"
- [ ] Ver tarjeta "Bracket"
- [ ] Ver tarjeta "Leaderboard"
- [ ] Ver tarjeta "Standings Globales"
- [ ] Si es leader: ver sección "Opciones de Líder"
- [ ] Si es leader: ver botón "Configuración del Grupo"

### Mis Predicciones (/groups/[id]/my-predictions)
- [ ] Ver lista de todos los partidos
- [ ] Ver equipos con banderas
- [ ] Ver fecha y hora del partido
- [ ] Ver sede del partido
- [ ] Ver inputs para marcador (team1, team2)
- [ ] Poder editar marcadores antes del deadline
- [ ] Ver sección "Predicciones Especiales"
- [ ] Ver selector de Campeón
- [ ] Ver selector de Tercer Puesto
- [ ] Ver selector de Goleador
- [ ] Ver sección "Avances de Selecciones"
- [ ] Ver selector de avance máximo por equipo
- [ ] Guardar predicciones funciona
- [ ] Predicciones persisten al recargar
- [ ] Después del deadline: banner amarillo de advertencia
- [ ] Después del deadline: inputs deshabilitados
- [ ] Después del deadline: no se pueden editar

### Ver Predicciones de Otros (/groups/[id]/members/[userId]/predictions)
- [ ] Ver lista de miembros del grupo
- [ ] Clic en miembro muestra sus predicciones
- [ ] Ver predicciones en modo solo lectura
- [ ] No poder editar predicciones ajenas
- [ ] Ver marcadores predichos
- [ ] Ver campeón predicho
- [ ] Ver tercer puesto predicho
- [ ] Ver goleador predicho
- [ ] Ver avances predichos

### Calendario de Partidos (/groups/[id]/matches)
- [ ] Ver todos los partidos del torneo
- [ ] Ver partidos agrupados por fase/fecha
- [ ] Ver información de cada partido
- [ ] Ver resultados reales si existen (ingresados por admin)
- [ ] Ver marcador a 90 minutos
- [ ] En eliminatorias: ver equipo que avanza

### Bracket (/groups/[id]/bracket)
- [ ] Ver bracket visual de eliminatorias
- [ ] Ver dieciseisavos
- [ ] Ver octavos
- [ ] Ver cuartos
- [ ] Ver semifinales
- [ ] Ver tercer puesto
- [ ] Ver final
- [ ] Ver campeón si está definido
- [ ] Ver slots pendientes (1A, 2B, W74, etc.) cuando falten datos
- [ ] Bracket se actualiza cuando admin ingresa resultados

### Leaderboard (/groups/[id]/leaderboard)
- [ ] Ver tabla de posiciones del grupo
- [ ] Ver ranking de usuarios
- [ ] Ver nombre de usuario
- [ ] Ver puntos totales
- [ ] Ver desglose por categoría:
  - [ ] Marcadores exactos fase grupos
  - [ ] Ganador/empate correcto fase grupos
  - [ ] Marcadores exactos eliminatorias
  - [ ] Avances de ronda
  - [ ] Tercer puesto
  - [ ] Campeón
  - [ ] Goleador
- [ ] Ordenado por puntos totales descendente
- [ ] Resaltar usuario actual
- [ ] Leaderboard se actualiza cuando admin ingresa resultados

### Standings Globales (/standings)
- [ ] Ver tabla de posiciones oficial del torneo
- [ ] Ver todos los grupos (A, B, C, etc.)
- [ ] Ver tabla de cada grupo con:
  - [ ] Posición
  - [ ] Equipo
  - [ ] PJ (partidos jugados)
  - [ ] G (ganados)
  - [ ] E (empatados)
  - [ ] P (perdidos)
  - [ ] GF (goles a favor)
  - [ ] GC (goles en contra)
  - [ ] DG (diferencia de gol)
  - [ ] PTS (puntos)
- [ ] Tablas se calculan automáticamente con resultados reales
- [ ] Ver mejores terceros si aplica

### Configuración del Grupo (Solo Leader) (/groups/[id]/settings)
- [ ] Ver página de configuración
- [ ] Poder cambiar nombre del grupo
- [ ] Poder cambiar fecha límite (si torneo no empezó)
- [ ] Ver código de invitación actual
- [ ] Poder regenerar código de invitación
- [ ] Ver lista de miembros
- [ ] Ver rol de cada miembro
- [ ] No poder cambiar rol a otros (solo leader es creador)

### Logout
- [ ] Clic en "Cerrar sesión" funciona
- [ ] Redirige a landing page
- [ ] No poder acceder a páginas protegidas sin login

---

## Checklist de Prueba - Group Leader

### Configuración del Grupo
- [ ] Acceder a `/groups/[id]/settings` como leader
- [ ] Cambiar nombre del grupo funciona
- [ ] Cambiar fecha límite funciona (si antes del mundial)
- [ ] Regenerar código de invitación funciona
- [ ] Ver lista de miembros con sus roles
- [ ] Ver fecha de creación del grupo

### Gestión de Invitaciones
- [ ] Compartir código de invitación con otros
- [ ] Otros usuarios pueden unirse con el código
- [ ] Ver nuevos miembros en la lista

### Permisos
- [ ] No puede ingresar resultados reales
- [ ] No puede resolver desempates oficiales
- [ ] No puede confirmar campeón/tercer puesto/goleador
- [ ] Sí puede hacer sus propias predicciones
- [ ] Sí puede ver predicciones de otros

---

## Checklist de Prueba - Global Admin

### Acceso a Panel Admin
- [ ] Login como admin@fixture-mundial.com
- [ ] Acceder a `/global-admin/results`
- [ ] Ver panel de admin global
- [ ] Ver lista de todos los partidos
- [ ] Acceder a `/global-admin/tiebreaks`

### Ingresar Resultados - Fase de Grupos
- [ ] Seleccionar partido de fase de grupos
- [ ] Ingresar goles team1 (90 minutos)
- [ ] Ingresar goles team2 (90 minutos)
- [ ] Guardar resultado funciona
- [ ] Resultado persiste
- [ ] Tabla de grupo se recalcula automáticamente
- [ ] Leaderboard se recalcula automáticamente
- [ ] Bracket no afectado (fase de grupos)

### Ingresar Resultados - Eliminatorias
- [ ] Seleccionar partido de eliminatorias
- [ ] Ingresar goles team1 (90 minutos)
- [ ] Ingresar goles team2 (90 minutos)
- [ ] Seleccionar equipo que avanza
- [ ] Guardar resultado funciona
- [ ] Resultado persiste
- [ ] Bracket se actualiza automáticamente
- [ ] Leaderboard se recalcula automáticamente
- [ ] Slots del bracket se resuelven (W74, L101, etc.)

### Editar Resultados
- [ ] Editar resultado existente funciona
- [ ] Recálculo automático al editar
- [ ] Bracket se actualiza correctamente

### Resolver Desempates (/global-admin/tiebreaks)
- [ ] Ver grupos con empate
- [ ] Ver partidos de mejores terceros con empate
- [ ] Poder seleccionar orden manual de equipos empatados
- [ ] Guardar resolución de desempate
- [ ] Bracket se actualiza con resolución manual
- [ ] Tabla de grupo se actualiza

### Confirmar Campeón
- [ ] Ver sección de campeón
- [ ] Seleccionar campeón oficial
- [ ] Guardar campeón
- [ ] Leaderboard actualiza puntos de campeón
- [ ] Bracket muestra campeón

### Confirmar Tercer Puesto
- [ ] Ver sección de tercer puesto
- [ ] Seleccionar ganador del partido por tercer puesto
- [ ] Guardar tercer puesto
- [ ] Leaderboard actualiza puntos de tercer puesto

### Confirmar Goleador Oficial
- [ ] Ver sección de goleador
- [ ] Seleccionar jugador goleador oficial
- [ ] Guardar goleador
- [ ] Leaderboard actualiza puntos de goleador

### Recálculo Global
- [ ] Ver botón/ejecutar recálculo global
- [ ] Recalcular todos los puntajes desde cero
- [ ] Verificar que puntajes son correctos
- [ ] Verificar que leaderboard es consistente

### Permisos
- [ ] Solo admin puede acceder a `/global-admin/*`
- [ ] Usuarios normales redirigidos al intentar acceder
- [ ] Leaders redirigidos al intentar acceder

---

## Checklist de Prueba - Sistema de Puntajes

### Fase de Grupos - Marcador Exacto
- [ ] Predecir marcador exacto: 5 puntos
- [ ] Ejemplo: Predicción 2-1, Real 2-1 = 5 puntos
- [ ] Verificar en leaderboard desglose

### Fase de Grupos - Resultado Correcto
- [ ] Predecir ganador/empate sin exacto: 2 puntos
- [ ] Ejemplo: Predicción 1-0, Real 2-1 = 2 puntos
- [ ] Ejemplo empate: Predicción 0-0, Real 1-1 = 2 puntos
- [ ] Verificar en leaderboard desglose

### Fase de Grupos - Sin Acierto
- [ ] Predecir incorrectly: 0 puntos
- [ ] Ejemplo: Predicción 2-1, Real 0-2 = 0 puntos

### Eliminatorias - Marcador Exacto
- [ ] Predecir marcador exacto 90 min: 10 puntos
- [ ] Ejemplo: Predicción 1-1, Real 1-1 = 10 puntos
- [ ] No afectado por quien avanza después

### Avances de Selecciones (Acumulativos)
- [ ] Clasifica a dieciseisavos: +20 puntos
- [ ] Avanza a octavos: +35 puntos
- [ ] Avanza a cuartos: +55 puntos
- [ ] Avanza a semifinales: +80 puntos
- [ ] Llega a final: +110 puntos
- [ ] Es campeón: +150 puntos
- [ ] Puntos acumulativos si se alcanzan múltiples hitos
- [ ] Verificar en leaderboard desglose

### Tercer Puesto
- [ ] Acierta tercer puesto: +80 puntos
- [ ] No acierta: 0 puntos
- [ ] Verificar en leaderboard desglose

### Campeón
- [ ] Acierta campeón: +150 puntos
- [ ] No acierta: 0 puntos
- [ ] Verificar en leaderboard desglose

### Goleador Oficial
- [ ] Acierta goleador: +60 puntos
- [ ] No acierta: 0 puntos
- [ ] Verificar en leaderboard desglose

### Recálculo Automático
- [ ] Puntos se recalculan al ingresar resultado
- [ ] Puntos se recalculan al editar resultado
- [ ] Puntos se recalculan al resolver desempate
- [ ] Leaderboard se actualiza en tiempo real

---

## Checklist de Prueba - Deadline

### Antes del Deadline
- [ ] Usuarios pueden crear predicciones
- [ ] Usuarios pueden editar predicciones
- [ ] Leader puede cambiar fecha límite
- [ ] Leader puede cambiar nombre de grupo
- [ ] Usuarios pueden unirse a grupos

### Después del Deadline
- [ ] Usuarios NO pueden crear predicciones nuevas
- [ ] Usuarios NO pueden editar predicciones existentes
- [ ] Leader NO puede cambiar fecha límite
- [ ] Leader NO puede cambiar nombre de grupo
- [ ] Usuarios SÍ pueden unirse a grupos
- [ ] Predicciones quedan congeladas
- [ ] Predicciones siguen visibles para miembros
- [ ] Banner amarillo de advertencia visible

---

## Checklist de Prueba - Seguridad y Permisos

### Row Level Security (RLS)
- [ ] Usuario solo ve grupos donde es miembro
- [ ] Usuario no puede ver grupos de otros
- [ ] Usuario solo edita sus propias predicciones
- [ ] Usuario no puede editar predicciones ajenas
- [ ] Leader no puede editar predicciones de miembros
- [ ] Solo Global Admin puede ingresar resultados
- [ ] Solo Global Admin puede resolver desempates
- [ ] Solo Global Admin puede confirmar campeón
- [ ] Solo Global Admin puede confirmar tercer puesto
- [ ] Solo Global Admin puede confirmar goleador

### Acceso por URL
- [ ] No acceder a grupos sin ser miembro
- [ ] No acceder a predicciones ajenas sin ser miembro del grupo
- [ ] No acceder a panel admin sin ser global admin
- [ ] Redirección correcta en cada caso

---

## Escenarios de Prueba Integrados

### Escenario 1: Flujo Completo de Usuario
1. [ ] Registrar nuevo usuario
2. [ ] Login
3. [ ] Crear grupo
4. [ ] Copiar código de invitación
5. [ ] Logout
6. [ ] Login como otro usuario
7. [ ] Unirse al grupo con código
8. [ ] Hacer predicciones completas
9. [ ] Ver predicciones del otro usuario
10. [ ] Ver leaderboard (vacío inicialmente)
11. [ ] Logout

### Escenario 2: Flujo de Admin con Resultados
1. [ ] Login como admin global
2. [ ] Ingresar resultado de partido fase grupos
3. [ ] Verificar tabla de grupo actualizada
4. [ ] Ingresar resultado de eliminatoria
5. [ ] Verificar bracket actualizado
6. [ ] Resolver desempate si aplica
7. [ ] Confirmar campeón
8. [ ] Verificar leaderboard con puntos
9. [ ] Ejecutar recálculo global
10. [ ] Verificar consistencia

### Escenario 3: Múltiples Usuarios Competitivos
1. [ ] Crear 5 usuarios de prueba
2. [ ] Crear grupo como usuario1
3. [ ] Unir usuarios 2-5 al grupo
4. [ ] Cada usuario hace predicciones diferentes
5. [ ] Login como admin
6. [ ] Ingresar varios resultados
7. [ ] Ver leaderboard con ranking
8. [ ] Verificar desglose de puntos
9. [ ] Verificar que puntajes son correctos

### Escenario 4: Deadline y Bloqueo
1. [ ] Crear grupo con deadline cercano
2. [ ] Hacer predicciones antes del deadline
3. [ ] Esperar a que pase el deadline
4. [ ] Intentar editar predicciones (debe fallar)
5. [ ] Verificar que predicciones están congeladas
6. [ ] Verificar banner de advertencia

---

## Cómo Probar con Múltiples Usuarios en Localhost

### Opción 1: Múltiples Navegadores/Incógnito
1. Abrir Chrome normal → Login como usuario1
2. Abrir Chrome incógnito → Login como usuario2
3. Abrir Firefox → Login como admin
4. Alternar entre ventanas para simular interacciones

### Opción 2: Diferentes Perfiles de Navegador
1. Crear perfil "Usuario1" en Chrome
2. Crear perfil "Usuario2" en Chrome
3. Crear perfil "Admin" en Chrome
4. Login con cada usuario en su perfil
5. Abrir todos los perfiles simultáneamente

### Opción 3: Navegadores Diferentes
1. Chrome → Login como usuario1
2. Firefox → Login como usuario2
3. Edge → Login como admin
4. Safari → Login como usuario3

### Opción 4: Cookies por Dominio (Avanzado)
Usar extensiones que permiten gestionar múltiples sesiones:
- "Multi-Account Containers" (Firefox)
- "SessionBox" (Chrome)
- "Cookie Editor"

---

## Script para Crear Usuarios de Prueba

Crear archivo `scripts/create-test-users.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import ws from 'ws'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  realtime: {
    transport: ws as any
  }
})

const testUsers = [
  { email: 'usuario1@test.com', password: 'password123', username: 'usuario1' },
  { email: 'usuario2@test.com', password: 'password123', username: 'usuario2' },
  { email: 'usuario3@test.com', password: 'password123', username: 'usuario3' },
  { email: 'usuario4@test.com', password: 'password123', username: 'usuario4' },
  { email: 'usuario5@test.com', password: 'password123', username: 'usuario5' },
]

async function createTestUsers() {
  console.log('Creating test users...\n')

  for (const user of testUsers) {
    try {
      const { data: userData, error: userError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          username: user.username
        }
      })

      if (userError) {
        console.error(`Error creating ${user.email}:`, userError.message)
        continue
      }

      console.log(`✓ Created: ${user.email} / ${user.password}`)
      console.log(`  User ID: ${userData.user.id}`)
      console.log(`  Username: ${user.username}\n`)

      // Wait for trigger
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (error) {
      console.error(`Unexpected error for ${user.email}:`, error)
    }
  }

  console.log('\nTest users created successfully!')
  console.log('You can now login with these credentials.')
}

createTestUsers()
```

Agregar a `package.json`:
```json
{
  "scripts": {
    "create-test-users": "tsx scripts/create-test-users.ts"
  }
}
```

---

## Plantilla para Reporte de Pruebas

### Información General
- **Fecha**: [DD/MM/YYYY]
- **Tester**: [Nombre]
- **Versión**: [Versión de la app]
- **Environment**: Localhost / Producción

### Resumen Ejecutivo
- **Total de pruebas**: [X]
- **Pasadas**: [X]
- **Fallidas**: [X]
- **Bloqueadas**: [X]

### Issues Críticos Encontrados

### Issue #1: Error al Crear Grupo (BLOQUEANTE) - ✅ RESUELTO
- **Severidad**: CRÍTICA
- **Estado**: RESUELTO
- **Descripción**: No es posible crear grupos. Al intentar crear un grupo, aparece el error "Error al crear grupo. Intenta nuevamente" y el formulario se queda en blanco. Esto bloquea completamente la prueba de cualquier otra funcionalidad.
- **Causa raíz**: La política RLS `group_members_insert_self` solo permitía insertar con `role = 'member'`, pero el código intentaba insertar al creador como `role = 'leader'`.
- **Solución**: Creada migración `20260525200000_fix_leader_insert_policy.sql` que permite al creador insertarse como 'leader' cuando es el creador del grupo.
- **Pasos para reproducir**:
  1. Login como usuario autenticado
  2. Ir al dashboard
  3. Clic en "Crear nuevo grupo"
  4. Llenar formulario con nombre válido y fecha límite válida
  5. Submit formulario
  6. Error aparece y formulario se queda en blanco
- **Expected behavior**: Grupo debería crearse exitosamente y redirigir a la página del grupo
- **Actual behavior**: Error genérico y formulario se queda en blanco
- **Impacto**: Bloquea todas las pruebas relacionadas con grupos, predicciones, leaderboard, etc.
- **Fix aplicado**: Migración aplicada exitosamente con `npx supabase db push`

---

## Detalle de Fallas
| ID | Prueba | Severidad | Descripción | Pasos para Reproducir |
|----|--------|-----------|-------------|----------------------|
| 1 | [Nombre] | Alta/Baja/Media | [Descripción] | [Pasos] |

### Issues Encontrados
1. **[Título del issue]**
   - Severidad: Alta/Media/Baja
   - Descripción: [Detalles]
   - Pasos para reproducir: [Pasos]
   - Expected behavior: [Lo esperado]
   - Actual behavior: [Lo actual]

### Sugerencias de Mejora
1. **[Sugerencia 1]**
2. **[Sugerencia 2]**

### Conclusión
[Comentarios generales sobre el estado de la app]

---

## Pasos para Ejecutar las Pruebas

1. **Preparación del Ambiente**
   ```bash
   # Instalar dependencias
   npm install
   
   # Configurar variables de entorno
   cp .env.example .env.local
   # Editar .env.local con tus credenciales de Supabase
   
   # Ejecutar migraciones
   npx supabase db push
   
   # Seed de datos del mundial
   npm run seed:worldcup
   
   # Crear admin global
   npm run create-global-admin
   
   # Crear usuarios de prueba
   npm run create-test-users
   ```

2. **Iniciar la App**
   ```bash
   npm run dev
   ```
   App disponible en `http://localhost:3000`

3. **Ejecutar Checklist**
   - Usar este documento como guía
   - Marcar cada item completado
   - Documentar issues encontrados
   - Tomar screenshots de errores

4. **Reportar Resultados**
   - Completar plantilla de reporte
   - Incluir screenshots
   - Enviar reporte al equipo

---

## Notas Importantes

- **Deadline**: El deadline de predicciones debe ser antes del 11 de junio de 2026, 2:00 PM hora Colombia
- **Service Role Key**: Necesaria para scripts de seed y creación de usuarios
- **RLS**: Verificar que las reglas de Row Level Security están activas en Supabase
- **Recálculo**: Si hay inconsistencias en puntajes, ejecutar recálculo global
- **Slots del Bracket**: Los slots como 1A, 2B, W74, L101 se resuelven dinámicamente
- **Mejores Terceros**: El mapeo oficial de mejores terceros del Mundial 2026 está pendiente

---

## Checklist Final de Pre-Lanzamiento

- [ ] Todos los tests de usuario no autenticado pasan
- [ ] Todos los tests de usuario autenticado pasan
- [ ] Todos los tests de group leader pasan
- [ ] Todos los tests de global admin pasan
- [ ] Todos los tests de sistema de puntajes pasan
- [ ] Todos los tests de deadline pasan
- [ ] Todos los tests de seguridad y permisos pasan
- [ ] Todos los escenarios integrados pasan
- [ ] Seed de datos del mundial ejecutado sin errores
- [ ] Admin global creado y funcional
- [ ] Usuarios de prueba creados y funcionales
- [ ] RLS activo y funcionando en Supabase
- [ ] No hay errores en consola del navegador
- [ ] No hay errores en consola del servidor
- [ ] La app es responsive en móvil
- [ ] La app funciona en diferentes navegadores
- [ ] El performance es aceptable
