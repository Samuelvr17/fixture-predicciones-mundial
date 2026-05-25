# App Spec - Quiniela Mundial 2026

## Descripción general

Esta aplicación es una app web de predicciones del Mundial de Fútbol 2026 para jugar entre varias personas dentro de grupos privados.

No es una app de apuestas con dinero. Es un juego de predicciones por puntos.

Cada usuario puede pertenecer a uno o varios grupos. Dentro de cada grupo, cada usuario llena sus predicciones del torneo antes de una fecha límite global. Después de esa fecha límite, nadie puede editar sus predicciones.

Los demás miembros del grupo pueden ver las predicciones de cualquier participante en todo momento, pero nunca pueden editar predicciones ajenas.

Un administrador del grupo ingresa los resultados reales de los partidos a medida que terminan. La app debe recalcular automáticamente tablas, clasificados, bracket y puntajes.

---

## Stack esperado

La app será una web app creada con:

- Next.js
- TypeScript
- App Router
- Tailwind CSS
- Supabase
- Supabase Auth
- Supabase Postgres
- Supabase Row Level Security
- React Flow o una solución similar para visualizar el bracket dinámico

---

## Roles

### Usuario no autenticado

Puede:

- Ver landing/login.
- Registrarse.
- Iniciar sesión.

No puede:

- Ver grupos.
- Ver predicciones.
- Crear predicciones.
- Ingresar resultados.

### Usuario autenticado

Puede:

- Ver su dashboard.
- Crear un grupo.
- Entrar a un grupo mediante código o invitación.
- Ver grupos donde es miembro.
- Crear y editar sus propias predicciones antes del deadline.
- Ver predicciones de otros miembros del mismo grupo.
- Ver tabla de posiciones del juego.
- Ver bracket.
- Ver resultados reales.

No puede:

- Editar predicciones ajenas.
- Editar sus predicciones después del deadline.
- Ingresar resultados reales si no es admin.
- Resolver desempates si no es admin.

### Group Leader

Es un miembro con rol `leader`. Cada grupo tiene un líder (usualmente el creador).

Puede:

- Cambiar configuración básica del grupo (nombre, fecha límite si no ha empezado el torneo).
- Ver miembros.
- Gestionar código de invitación.

No puede:

- Ingresar resultados reales.
- Resolver desempates reales (que afecten el bracket oficial).
- Confirmar campeón, tercer puesto o goleador oficial.

### Global App Admin

Es un rol global definido en la tabla `global_admins`.

Puede:

- Ingresar resultados reales de partidos (visibles para toda la app).
- Indicar ganador/clasificado en partidos de eliminación directa.
- Resolver desempates manuales reales (cuando el sistema no pueda decidir para el bracket oficial).
- Confirmar campeón, tercer puesto y goleador oficial del torneo.
- Ejecutar recálculos globales.

---

## Grupos

Cada grupo representa una quiniela privada.

Un grupo debe tener:

- Nombre.
- Código de invitación único.
- Usuario creador.
- Fecha límite global de predicciones.
- Lista de miembros.
- Roles por miembro: `leader` o `member`.
- Estado activo.

Regla clave:

La fecha límite es única para todo el torneo. Debe ser antes del primer partido del Mundial 2026.

Después del deadline:

- Nadie puede crear predicciones nuevas.
- Nadie puede editar predicciones existentes.
- Nadie puede cambiar campeón.
- Nadie puede cambiar tercer puesto.
- Nadie puede cambiar goleador.
- Nadie puede cambiar avances de equipos.

---

## Datos base del Mundial

La app usa un archivo local:

`data/worldcup-2026.json`

Ese archivo contiene:

- Nombre del torneo.
- Lista de partidos.
- Fase de grupos.
- Eliminatorias.
- Fechas.
- Horarios.
- Sedes.
- Equipos.
- Grupos.
- Códigos de bracket como 1A, 2B, W74, L101, etc.

La app debe importar este JSON a la base de datos mediante un script seed.

---

## Partidos

Cada partido debe tener:

- ID interno.
- Número oficial si existe.
- Ronda.
- Fecha.
- Hora.
- Sede.
- Grupo, si aplica.
- Equipo 1, si ya está definido.
- Equipo 2, si ya está definido.
- Slot original del equipo 1.
- Slot original del equipo 2.
- Tipo de fase:
  - group
  - round_of_32
  - round_of_16
  - quarter_final
  - semi_final
  - third_place
  - final
- Orden visual para calendario y bracket.

En fase de grupos los equipos están definidos desde el inicio.

En eliminatorias algunos equipos pueden ser referencias:

- 1A
- 2B
- 3A/B/C/D/F
- W74
- L101

La app debe resolver esos slots dinámicamente cuando tenga datos suficientes.

---

## Predicciones del usuario

Cada usuario debe llenar predicciones dentro de cada grupo.

Debe poder predecir:

1. Marcador de 90 minutos para todos los partidos disponibles.
2. Equipo campeón.
3. Equipo tercer puesto.
4. Goleador oficial del torneo.
5. Avance máximo de cada selección o selecciones que llegan a cada ronda.

Las predicciones pertenecen a:

- Un grupo.
- Un usuario.
- Un partido, cuando aplique.
- Una selección, cuando aplique.

Reglas:

- Cada usuario solo edita sus propias predicciones.
- Las predicciones de otros usuarios son solo lectura.
- Las predicciones son visibles para todos los miembros del grupo.
- Después del deadline, todo queda bloqueado.

---

## Resultados reales

El admin debe poder ingresar resultados reales.

En fase de grupos debe ingresar:

- Goles equipo 1 a los 90 minutos.
- Goles equipo 2 a los 90 minutos.

En eliminatorias debe ingresar:

- Goles equipo 1 a los 90 minutos.
- Goles equipo 2 a los 90 minutos.
- Equipo que avanza.

Importante:

El marcador exacto para puntaje siempre cuenta a los 90 minutos.

El equipo que avanza puede ser distinto al ganador de los 90 minutos si hubo empate, tiempo extra o penales.

Ejemplo:

Colombia 1-1 Uruguay a los 90 minutos.
Clasifica Colombia.

Para puntaje de marcador exacto cuenta 1-1.
Para bracket avanza Colombia.

---

## Motor de fase de grupos

La app debe calcular automáticamente la tabla de cada grupo usando los resultados reales ingresados.

Por cada equipo calcular:

- Partidos jugados.
- Ganados.
- Empatados.
- Perdidos.
- Goles a favor.
- Goles en contra.
- Diferencia de gol.
- Puntos.
- Posición.

Puntos por partido:

- Victoria: 3 puntos.
- Empate: 1 punto.
- Derrota: 0 puntos.

Los primeros 2 equipos de cada grupo clasifican directo a dieciseisavos.

El tercer equipo de cada grupo entra a la tabla de mejores terceros.

---

## Desempates de grupo

Cuando dos o más equipos empatan en puntos dentro del grupo, aplicar:

1. Puntos en partidos entre los equipos empatados.
2. Diferencia de gol en partidos entre los equipos empatados.
3. Goles marcados en partidos entre los equipos empatados.
4. Diferencia de gol total en el grupo.
5. Goles marcados totales en el grupo.

Si después de esos criterios sigue el empate, la app no debe resolver automáticamente.

Debe marcar el grupo o posiciones afectadas como:

`requiresManualTiebreak = true`

El admin podrá elegir manualmente el orden final de esos equipos.

---

## Mejores terceros

Cuando todos los grupos estén definidos, la app debe tomar los 12 terceros.

Debe elegir los mejores 8 usando:

1. Más puntos.
2. Mejor diferencia de gol.
3. Más goles marcados.

Si después de esos criterios sigue el empate, la app debe marcar:

`requiresManualTiebreak = true`

El admin podrá resolver manualmente qué terceros clasifican y/o su orden.

---

## Bracket dinámico

La app debe construir el bracket dinámicamente.

Debe soportar slots como:

- 1A
- 2A
- 1B
- 2B
- 3A/B/C/D/F
- W74
- L74
- W101
- L102

Significado:

- 1A = primero del grupo A.
- 2A = segundo del grupo A.
- 3A/B/C/D/F = uno de los mejores terceros, según tabla oficial de asignación.
- W74 = ganador del partido 74.
- L101 = perdedor del partido 101.

La app debe:

1. Calcular posiciones de grupos.
2. Calcular mejores terceros.
3. Resolver participantes de dieciseisavos.
4. Resolver ganadores de cada partido eliminatorio.
5. Llenar octavos, cuartos, semifinales, tercer puesto y final.
6. Mostrar slots pendientes cuando falten datos.

---

## Visualización del bracket

El bracket debe ser visual, claro y dinámico.

Debe mostrar:

- Dieciseisavos.
- Octavos.
- Cuartos.
- Semifinales.
- Partido por tercer puesto.
- Final.
- Campeón.

Cada nodo de partido debe mostrar:

- Ronda.
- Fecha.
- Sede.
- Equipo 1.
- Equipo 2.
- Marcador, si existe.
- Ganador/clasificado, si existe.
- Estado pendiente si aún no se puede resolver.

---

## Sistema de puntajes

La app debe calcular puntos automáticamente comparando predicciones del usuario contra resultados reales.

Debe guardar desglose por categoría y total.

Categorías:

- Marcadores.
- Resultado correcto sin marcador exacto.
- Avances de ronda.
- Tercer puesto.
- Campeón.
- Goleador.

El leaderboard debe mostrar:

- Ranking.
- Nombre del usuario.
- Puntos totales.
- Desglose por categoría.

---

## Recalculo automático

Cuando el admin ingrese o edite un resultado real:

1. Guardar resultado.
2. Recalcular tabla de grupo si es fase de grupos.
3. Recalcular mejores terceros si aplica.
4. Recalcular bracket si aplica.
5. Recalcular puntos afectados.
6. Actualizar leaderboard.

La app debe evitar cálculos duplicados incorrectos.

Los puntajes deben poder recalcularse desde cero si hace falta.

---

## Seguridad

Usar Supabase Row Level Security.

Reglas generales:

- Un usuario solo ve grupos donde es miembro.
- Un usuario solo edita sus propias predicciones.
- Nadie edita predicciones después del deadline.
- Los miembros pueden ver predicciones de otros miembros del mismo grupo.
- Solo Global App Admin puede ingresar resultados.
- Solo Global App Admin puede resolver desempates reales.
- Solo Global App Admin puede confirmar goleador oficial.
- Nadie debe poder modificar puntajes manualmente desde cliente.

---

## Requisitos de calidad

El código debe ser modular.

Separar:

- UI.
- Acceso a datos.
- Tipos.
- Motor de torneo.
- Motor de puntuación.
- Componentes visuales.

Los motores principales deben ser funciones puras TypeScript cuando sea posible:

- groupStandings
- bestThirds
- bracketResolver
- scoringEngine

Deben tener tests para lógica importante.

No mezclar lógica pesada dentro de componentes React.