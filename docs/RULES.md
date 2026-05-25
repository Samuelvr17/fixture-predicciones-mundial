# Rules - Quiniela Mundial 2026

## Concepto

Esta app es un juego de predicciones por puntos sobre el Mundial 2026.

No maneja dinero real.
No maneja apuestas pagadas.
No maneja cuotas.
No maneja pagos.
No maneja retiros.
No maneja probabilidades de casas de apuestas.

Solo compara predicciones contra resultados reales y asigna puntos.

---

## Fecha límite de predicciones

Cada grupo tiene una fecha límite global.

La fecha límite debe ser antes del primer partido del Mundial 2026.

Antes del deadline:

- Cada usuario puede crear sus predicciones.
- Cada usuario puede editar sus predicciones.
- Los demás miembros pueden ver las predicciones, pero no editarlas.

Después del deadline:

- Nadie puede crear predicciones.
- Nadie puede editar predicciones.
- Las predicciones quedan congeladas.
- Las predicciones siguen visibles para miembros del grupo.

---

## Visibilidad

Las predicciones son visibles para todos los miembros del mismo grupo en todo momento.

Permisos:

- Usuario dueño: puede editar sus predicciones antes del deadline.
- Usuario dueño: no puede editar después del deadline.
- Otros miembros: solo lectura siempre.
- Group Leader: no puede editar predicciones de otros usuarios.
- Global App Admin: ingresa resultados reales, resuelve desempates reales, confirma ganadores y goleador.

---

## Resultado de partidos

### Fase de grupos

El resultado real se guarda como marcador de 90 minutos.

Ejemplo:

México 2-1 Sudáfrica.

### Eliminatorias

El resultado real debe guardar:

- Goles equipo 1 a los 90 minutos.
- Goles equipo 2 a los 90 minutos.
- Equipo que avanza.

Ejemplo:

Colombia 1-1 Uruguay a los 90 minutos.
Clasifica Colombia.

El marcador exacto se evalúa con el resultado a los 90 minutos.

El avance de ronda se evalúa con el equipo que clasifica.

---

## Puntos por marcador en fase de grupos

### Marcador exacto

Si el usuario acierta exactamente los goles de ambos equipos:

Puntos: 5

Ejemplo:

Predicción: Colombia 2-1 Japón.
Resultado real: Colombia 2-1 Japón.
Puntos: 5.

### Ganador o empate correcto sin marcador exacto

Si el usuario no acierta el marcador exacto, pero acierta el resultado general:

- Victoria equipo 1.
- Victoria equipo 2.
- Empate.

Puntos: 2

Ejemplo:

Predicción: Colombia 1-0 Japón.
Resultado real: Colombia 2-1 Japón.
Puntos: 2.

Ejemplo empate:

Predicción: Colombia 0-0 Japón.
Resultado real: Colombia 1-1 Japón.
Puntos: 2.

### Sin acierto

Si el usuario no acierta marcador exacto ni resultado general:

Puntos: 0.

---

## Puntos por marcador en fase eliminatoria

### Marcador exacto a 90 minutos

Si el usuario acierta exactamente los goles de ambos equipos a los 90 minutos:

Puntos: 10

Ejemplo:

Predicción: Colombia 1-1 Uruguay.
Resultado 90 minutos: Colombia 1-1 Uruguay.
Puntos: 10.

El hecho de que Colombia o Uruguay avance después no cambia el punto de marcador exacto.

---

## Puntos por avance de selecciones

El usuario puede predecir hasta qué ronda llega cada selección.

La app otorga puntos si la selección alcanza una ronda determinada.

Los puntos son acumulables por hito alcanzado.

Tabla:

- Clasifica a dieciseisavos: 20 puntos.
- Avanza a octavos: 35 puntos.
- Avanza a cuartos: 55 puntos.
- Avanza a semifinales: 80 puntos.
- Llega a la final: 110 puntos.
- Es campeón: 150 puntos.

Ejemplo:

El usuario predice que Colombia llega a cuartos.

Si Colombia clasifica a dieciseisavos:
+20.

Si Colombia gana dieciseisavos y llega a octavos:
+35.

Si Colombia gana octavos y llega a cuartos:
+55.

Si Colombia no pasa de cuartos, no suma semis, final ni campeón.

---

## Tercer puesto

Si el usuario acierta correctamente la selección que termina en tercer lugar oficial:

Puntos: 80

El Global App Admin debe ingresar o confirmar el ganador del partido por tercer puesto.

---

## Campeón

Si el usuario acierta correctamente la selección campeona:

Puntos: 150

El campeón también puede contar dentro del sistema de avances acumulables si la predicción del usuario incluía esa selección llegando a esas rondas.

---

## Goleador oficial

Si el usuario acierta el jugador que recibe oficialmente el premio de goleador del torneo:

Puntos: 60

No se calculan goles, asistencias ni minutos dentro de la app.

El Global App Admin selecciona el ganador oficial del premio al final del torneo.

---

## Tabla de grupos

Cada grupo tiene 4 equipos.

Cada equipo juega 3 partidos.

Puntuación de tabla:

- Victoria: 3 puntos.
- Empate: 1 punto.
- Derrota: 0 puntos.

Para cada equipo calcular:

- PJ: partidos jugados.
- G: ganados.
- E: empatados.
- P: perdidos.
- GF: goles a favor.
- GC: goles en contra.
- DG: diferencia de gol.
- PTS: puntos.

Clasifican automáticamente:

- Primero de cada grupo.
- Segundo de cada grupo.

El tercero de cada grupo entra a la tabla de mejores terceros.

---

## Desempates dentro de grupo

Si dos o más equipos empatan en puntos, aplicar en orden:

1. Puntos obtenidos en partidos entre los equipos empatados.
2. Diferencia de gol en partidos entre los equipos empatados.
3. Goles marcados en partidos entre los equipos empatados.
4. Diferencia de gol total en todos los partidos del grupo.
5. Goles marcados totales en todos los partidos del grupo.

Si después de estos criterios sigue el empate, el sistema no debe decidir automáticamente.

Debe marcar:

`requiresManualTiebreak = true`

El Global App Admin debe elegir manualmente el orden final de los equipos empatados.

---

## Mejores terceros

Después de ordenar los 12 grupos, se toman los terceros de cada grupo.

Clasifican los mejores 8 terceros.

Criterios:

1. Más puntos.
2. Mejor diferencia de gol.
3. Más goles marcados.

Si después de estos criterios sigue el empate, el sistema debe marcar:

`requiresManualTiebreak = true`

El Global App Admin debe resolver manualmente qué terceros clasifican y/o el orden final.

---

## Bracket

La app debe resolver dinámicamente el bracket.

Slots posibles:

- 1A: primero del Grupo A.
- 2A: segundo del Grupo A.
- 3A/B/C/D/F: tercer clasificado asignado según combinación oficial.
- W74: ganador del partido 74.
- L101: perdedor del partido 101.

Reglas:

- No llenar un partido si faltan datos previos.
- Mostrar equipos pendientes cuando no se puedan resolver.
- Actualizar bracket cuando el Global App Admin ingrese resultados.
- Actualizar bracket cuando el Global App Admin resuelva un desempate.

---

## Recalculo de puntos

Los puntos deben calcularse automáticamente.

El sistema debe poder recalcular desde cero para evitar errores.

Recalcular cuando:

- Se guarda un resultado real.
- Se edita un resultado real.
- Se resuelve un desempate.
- Se define un clasificado.
- Se define tercer puesto.
- Se define campeón.
- Se define goleador oficial.

---

## Desglose de puntaje

Cada usuario debe tener desglose por:

- Marcadores exactos fase de grupos.
- Ganador/empate correcto fase de grupos.
- Marcadores exactos eliminatorias.
- Avances de ronda.
- Tercer puesto.
- Campeón.
- Goleador.
- Total.

El leaderboard debe ordenar por total descendente.

---

## Regla de integridad

El cliente nunca debe ser la fuente final de puntos.

El cliente puede mostrar datos, pero la lógica importante debe estar validada del lado servidor o mediante funciones controladas.

Ningún usuario debe poder editar manualmente su puntaje.