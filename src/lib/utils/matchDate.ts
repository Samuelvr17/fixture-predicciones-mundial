/**
 * src/lib/utils/matchDate.ts
 *
 * Utilidades para formatear y comparar fechas de partidos.
 * 
 * IMPORTANTE: Las fechas de partidos vienen como "YYYY-MM-DD" desde la columna match_date.
 * NO usar new Date("YYYY-MM-DD") porque se interpreta como UTC midnight y causa desfase
 * por timezone cuando se muestra con toLocaleDateString().
 * 
 * En su lugar, parseamos manualmente el string "YYYY-MM-DD" para evitar problemas de timezone.
 */

const MONTH_NAMES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

const DAY_NAMES_ES = [
  'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'
];

/**
 * Formatea fecha de partido en formato corto: "11/06"
 * @param dateStr - Fecha en formato "YYYY-MM-DD"
 * @returns Fecha formateada como "DD/MM"
 */
export function formatMatchDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}`;
}

/**
 * Formatea fecha de partido en formato largo español: "jueves, 11 de junio de 2026"
 * @param dateStr - Fecha en formato "YYYY-MM-DD"
 * @returns Fecha formateada en español largo
 */
export function formatMatchDateLong(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  const monthNum = parseInt(month, 10);
  const dayNum = parseInt(day, 10);
  const yearNum = parseInt(year, 10);

  const monthName = MONTH_NAMES_ES[monthNum - 1];
  const dayName = DAY_NAMES_ES[new Date(yearNum, monthNum - 1, dayNum).getDay()];

  return `${dayName}, ${dayNum} de ${monthName} de ${yearNum}`;
}

/**
 * Compara fechas y horas de partidos sin usar new Date("YYYY-MM-DD").
 * Compara strings lexicográficamente para fechas (YYYY-MM-DD se ordena correctamente)
 * y luego compara horas.
 * 
 * @param aDate - Fecha del partido A en formato "YYYY-MM-DD"
 * @param aTime - Hora del partido A en formato "HH:MM:SS"
 * @param bDate - Fecha del partido B en formato "YYYY-MM-DD"
 * @param bTime - Hora del partido B en formato "HH:MM:SS"
 * @returns Negativo si A < B, 0 si igual, positivo si A > B
 */
export function compareMatchDateTime(
  aDate: string,
  aTime: string,
  bDate: string,
  bTime: string
): number {
  // Comparar fechas lexicográficamente (YYYY-MM-DD se ordena correctamente)
  if (aDate !== bDate) {
    return aDate.localeCompare(bDate);
  }
  
  // Si misma fecha, comparar horas
  return aTime.localeCompare(bTime);
}

/**
 * Versión simplificada para usar en sort() de arrays
 * @param a - Partido con match_date y match_time
 * @param b - Partido con match_date y match_time
 * @returns Negativo si A < B, 0 si igual, positivo si A > B
 */
export function compareMatchesByDateTime(
  a: { match_date: string; match_time: string },
  b: { match_date: string; match_time: string }
): number {
  return compareMatchDateTime(a.match_date, a.match_time, b.match_date, b.match_time);
}
