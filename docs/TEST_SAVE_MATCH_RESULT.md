# Pruebas Manuales para saveMatchResult

## Escenarios de Prueba para Fase de Grupos

### 1. Partido de fase de grupos con empate
- **Entrada**: matchId (round='group'), team1Score=2, team2Score=2, winnerTeamId=null
- **Resultado esperado**: ✅ Éxito - winnerTeamId puede ser null en empate de fase de grupos

### 2. Partido de fase de grupos sin empate, sin winnerTeamId
- **Entrada**: matchId (round='group'), team1Score=3, team2Score=1, winnerTeamId=null
- **Resultado esperado**: ✅ Éxito - el sistema inferirá el ganador del marcador

### 3. Partido de fase de grupos con empate pero con winnerTeamId
- **Entrada**: matchId (round='group'), team1Score=2, team2Score=2, winnerTeamId=team1Id
- **Resultado esperado**: ❌ Error - "En fase de grupos con empate, no debe haber un equipo ganador"

### 4. Partido de fase de grupos con winnerTeamId incorrecto
- **Entrada**: matchId (round='group'), team1Score=3, team2Score=1, winnerTeamId=otroTeamId
- **Resultado esperado**: ❌ Error - "El equipo ganador debe ser uno de los dos equipos del partido"

## Escenarios de Prueba para Eliminatorias

### 5. Partido de eliminatoria con empate sin winnerTeamId
- **Entrada**: matchId (round='quarter_final'), team1Score=1, team2Score=1, winnerTeamId=null
- **Resultado esperado**: ❌ Error - "En eliminatorias con empate, debe seleccionar manualmente el equipo clasificado"

### 6. Partido de eliminatoria con empate con winnerTeamId válido
- **Entrada**: matchId (round='quarter_final'), team1Score=1, team2Score=1, winnerTeamId=team1Id
- **Resultado esperado**: ✅ Éxito - winnerTeamId es obligatorio en empate de eliminatoria

### 7. Partido de eliminatoria sin empate, winnerTeamId coincide con marcador
- **Entrada**: matchId (round='semi_final'), team1Score=2, team2Score=1, winnerTeamId=team1Id
- **Resultado esperado**: ✅ Éxito - winnerTeamId coincide con el equipo con más goles

### 8. Partido de eliminatoria sin empate, winnerTeamId no coincide con marcador
- **Entrada**: matchId (round='semi_final'), team1Score=2, team2Score=1, winnerTeamId=team2Id
- **Resultado esperado**: ❌ Error - "El equipo ganador no coincide con el marcador del partido"

### 9. Partido de eliminatoria sin empate, sin winnerTeamId
- **Entrada**: matchId (round='final'), team1Score=3, team2Score=0, winnerTeamId=null
- **Resultado esperado**: ✅ Éxito - el sistema puede inferir el ganador del marcador

### 10. Partido de eliminatoria con winnerTeamId incorrecto
- **Entrada**: matchId (round='round_of_16'), team1Score=2, team2Score=1, winnerTeamId=otroTeamId
- **Resultado esperado**: ❌ Error - "El equipo ganador debe ser uno de los dos equipos del partido"

## Validaciones Generales

### 11. Goles negativos
- **Entrada**: matchId, team1Score=-1, team2Score=2, winnerTeamId=null
- **Resultado esperado**: ❌ Error - "Los goles deben ser números enteros mayores o iguales a 0"

### 12. Goles no enteros
- **Entrada**: matchId, team1Score=2.5, team2Score=1, winnerTeamId=null
- **Resultado esperado**: ❌ Error - "Los goles deben ser números enteros"

### 13. Partido no encontrado
- **Entrada**: matchId (inexistente), team1Score=2, team2Score=1, winnerTeamId=null
- **Resultado esperado**: ❌ Error - "No se pudo encontrar el partido"

## Pruebas de Integración

### 14. Guardar resultado y recalcular puntajes
- **Acción**: Guardar resultado válido de fase de grupos
- **Verificación**: Los puntajes de todos los usuarios se recalculan correctamente
- **Verificación**: Las rutas /standings y /groups/[groupId]/leaderboard se revalidan

### 15. Actualizar resultado existente
- **Acción**: Guardar resultado para un partido que ya tiene resultado
- **Verificación**: El resultado se actualiza correctamente en lugar de crear uno nuevo

## Notas Importantes

- En eliminatorias, el marcador corresponde a los 90 minutos.
- Si el marcador queda empatado, winner_team_id define quién clasificó.
- No se guardan penales ni marcador de tiempo extra.
