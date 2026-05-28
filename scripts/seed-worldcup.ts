#!/usr/bin/env npx ts-node --esm
/**
 * scripts/seed-worldcup.ts
 *
 * Importa data/worldcup-2026.json a Supabase (tablas: teams, matches).
 * Idempotente: usa upsert en code/name para equipos y match_number para partidos.
 *
 * Uso:
 *   npm run seed:worldcup
 *
 * Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno.
 * El seed usa service_role para bypassear RLS.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import WebSocket from "ws";

// ─── Tipos del JSON ───────────────────────────────────────────────────────────

interface RawMatch {
    round: string;
    num?: number;
    date: string;
    time: string;
    team1: string;
    team2: string;
    group?: string; // "Group A", "Group B", ...
    ground: string;
}

interface WorldCupData {
    name: string;
    matches: RawMatch[];
}

// ─── Mapeos ───────────────────────────────────────────────────────────────────

/** Convierte el nombre de la ronda del JSON al ENUM match_round de la DB */
function mapRound(round: string): string {
    const r = round.toLowerCase();
    if (r.includes("matchday")) return "group";
    if (r.includes("round of 32")) return "round_of_32";
    if (r.includes("round of 16")) return "round_of_16";
    if (r.includes("quarter")) return "quarter_final";
    if (r.includes("semi")) return "semi_final";
    if (r.includes("third") || r.includes("third place")) return "third_place";
    if (r.includes("final")) return "final";
    throw new Error(`Ronda desconocida: "${round}"`);
}

/**
 * Extrae el código de grupo de "Group A" → "A"
 */
function parseGroupCode(group?: string): string | null {
    if (!group) return null;
    const match = group.match(/Group ([A-L])/i);
    return match ? match[1].toUpperCase() : null;
}

/**
 * Determina si un team string del JSON es un equipo real o un slot de bracket.
 * Slots: "1A", "2B", "W74", "L101", "3A/B/C/D/F", "3C/D/F/G/H", etc.
 */
function isSlot(team: string): boolean {
    // Slots comienzan con dígito, W, L, o son referencias a terceros
    return /^[1-9][A-L]$/.test(team) || // 1A, 2B, 3L
        /^[WL]\d+/.test(team) ||           // W74, L101
        /^\d[A-L](\/[A-L])+/.test(team);  // 3A/B/C/D/F
}

/**
 * Normaliza el tiempo. "13:00 UTC-6" → "13:00:00" (guardamos solo la hora local del venue)
 * @deprecated Usar parseMatchKickoffForColombia para conversión completa con timezone
 */
function parseTime(timeStr: string): string {
    const match = timeStr.match(/^(\d{1,2}:\d{2})/);
    if (!match) return "00:00:00";
    const [h, m] = match[1].split(":");
    return `${h.padStart(2, "0")}:${m}:00`;
}

/**
 * Parsea la fecha y hora de un partido y calcula los valores para Colombia (UTC-5).
 * 
 * @param date - Fecha en formato "YYYY-MM-DD"
 * @param time - Hora en formato "HH:MM UTC-X" (ej: "13:00 UTC-6")
 * @returns Objeto con kickoff_at_utc, match_date Colombia, match_time Colombia, venue_timezone, venue_local_time
 * 
 * @example
 * parseMatchKickoffForColombia("2026-06-11", "13:00 UTC-6")
 * // Returns:
 * // {
 * //   kickoff_at_utc: "2026-06-11T19:00:00.000Z",
 * //   match_date: "2026-06-11",
 * //   match_time: "14:00:00",
 * //   venue_timezone: "UTC-6",
 * //   venue_local_time: "13:00:00"
 * // }
 */
export function parseMatchKickoffForColombia(date: string, time: string): {
    kickoff_at_utc: string;
    match_date: string;
    match_time: string;
    venue_timezone: string;
    venue_local_time: string;
} {
    // Parsear hora y offset
    const timeMatch = time.match(/^(\d{1,2}):(\d{2})\s+(UTC([+-]\d+))?/);
    if (!timeMatch) {
        // Fallback si no tiene formato esperado
        return {
            kickoff_at_utc: `${date}T00:00:00.000Z`,
            match_date: date,
            match_time: "00:00:00",
            venue_timezone: "UTC",
            venue_local_time: "00:00:00"
        };
    }

    const [, hours, minutes, , offsetStr] = timeMatch;
    const venueHour = parseInt(hours, 10);
    const venueMinute = parseInt(minutes, 10);
    
    // Parsear offset UTC (ej: "-6", "+5", "-4")
    const venueOffset = offsetStr ? parseInt(offsetStr, 10) : 0;
    const venueTimezone = offsetStr ? `UTC${offsetStr}` : "UTC";
    
    // Calcular hora UTC del venue
    // Si venue es UTC-6 y hora es 13:00, entonces UTC es 19:00
    // Si venue es UTC-7 y hora es 18:00, entonces UTC es 01:00 del día siguiente
    const utcHour = venueHour - venueOffset;
    const utcMinute = venueMinute;
    
    // Crear fecha UTC manejando cruce de día
    const baseDate = new Date(`${date}T00:00:00Z`);
    const utcDate = new Date(baseDate.getTime());
    utcDate.setUTCHours(utcHour, utcMinute, 0, 0);
    
    // Convertir a Colombia (UTC-5)
    // UTC-5 significa que Colombia está 5 horas atrás de UTC
    // Para convertir de UTC a Colombia, restamos 5 horas
    const colombiaOffsetHours = -5;
    const colombiaDate = new Date(utcDate.getTime() + (colombiaOffsetHours * 60 * 60 * 1000));
    
    // Formatear kickoff_at_utc (ISO string)
    const kickoff_at_utc = utcDate.toISOString();
    
    // Formatear match_date Colombia (YYYY-MM-DD)
    const match_date = colombiaDate.toISOString().split('T')[0];
    
    // Formatear match_time Colombia (HH:MM:SS)
    const match_time = `${String(colombiaDate.getUTCHours()).padStart(2, '0')}:${String(colombiaDate.getUTCMinutes()).padStart(2, '0')}:00`;
    
    // Formatear venue_local_time (HH:MM:00)
    const venue_local_time = `${String(venueHour).padStart(2, '0')}:${String(venueMinute).padStart(2, '0')}:00`;
    
    return {
        kickoff_at_utc,
        match_date,
        match_time,
        venue_timezone: venueTimezone,
        venue_local_time
    };
}

/**
 * Genera un código FIFA de 3 letras para un equipo a partir de su nombre.
 * No pretende ser perfecto — es solo para el seed inicial; se puede ajustar.
 */
function generateCode(name: string): string {
    const overrides: Record<string, string> = {
        "Mexico": "MEX",
        "South Africa": "RSA",
        "South Korea": "KOR",
        "Czech Republic": "CZE",
        "Canada": "CAN",
        "Bosnia & Herzegovina": "BIH",
        "Qatar": "QAT",
        "Switzerland": "SUI",
        "Brazil": "BRA",
        "Morocco": "MAR",
        "Haiti": "HAI",
        "Scotland": "SCO",
        "USA": "USA",
        "Paraguay": "PAR",
        "Australia": "AUS",
        "Turkey": "TUR",
        "Germany": "GER",
        "Curaçao": "CUW",
        "Ivory Coast": "CIV",
        "Ecuador": "ECU",
        "Netherlands": "NED",
        "Japan": "JPN",
        "Sweden": "SWE",
        "Tunisia": "TUN",
        "Belgium": "BEL",
        "Egypt": "EGY",
        "Iran": "IRN",
        "New Zealand": "NZL",
        "Spain": "ESP",
        "Cape Verde": "CPV",
        "Saudi Arabia": "KSA",
        "Uruguay": "URU",
        "France": "FRA",
        "Senegal": "SEN",
        "Iraq": "IRQ",
        "Norway": "NOR",
        "Argentina": "ARG",
        "Algeria": "ALG",
        "Austria": "AUT",
        "Jordan": "JOR",
        "Portugal": "POR",
        "DR Congo": "COD",
        "Uzbekistan": "UZB",
        "Colombia": "COL",
        "England": "ENG",
        "Croatia": "CRO",
        "Ghana": "GHA",
        "Panama": "PAN",
    };
    if (overrides[name]) return overrides[name];
    // Fallback: primeras 3 letras en mayúscula
    return name.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    // Validar variables de entorno
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        console.error("❌ Faltan variables de entorno:");
        if (!supabaseUrl) console.error("   NEXT_PUBLIC_SUPABASE_URL");
        if (!serviceRoleKey) console.error("   SUPABASE_SERVICE_ROLE_KEY");
        process.exit(1);
    }

    // Cliente con service_role para bypassear RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        realtime: {
            transport: WebSocket as any, // Polyfill de WebSocket para Node < 22
        },
    });

    // Leer JSON
    const jsonPath = resolve(process.cwd(), "data/worldcup-2026.json");
    const data: WorldCupData = JSON.parse(readFileSync(jsonPath, "utf-8"));
    console.log(`📂 Leído: ${data.name} — ${data.matches.length} partidos`);

    // ── 1. Extraer equipos únicos (solo nombres reales, no slots) ─────────────
    const teamNames = new Set<string>();
    const teamGroupMap = new Map<string, string>(); // name → groupCode

    for (const m of data.matches) {
        const groupCode = parseGroupCode(m.group);
        for (const teamName of [m.team1, m.team2]) {
            if (!isSlot(teamName)) {
                teamNames.add(teamName);
                if (groupCode && !teamGroupMap.has(teamName)) {
                    teamGroupMap.set(teamName, groupCode);
                }
            }
        }
    }

    console.log(`\n👥 Equipos únicos encontrados: ${teamNames.size}`);

    // ── 2. Upsert de equipos ──────────────────────────────────────────────────
    const teamsToInsert = [...teamNames].map((name) => ({
        name,
        code: generateCode(name),
        group_code: teamGroupMap.get(name) ?? null,
    }));

    const { error: teamsError, data: insertedTeams } = await supabase
        .from("teams")
        .upsert(teamsToInsert, { onConflict: "name", ignoreDuplicates: false })
        .select("id, name, code");

    if (teamsError) {
        console.error("❌ Error insertando equipos:", teamsError.message);
        process.exit(1);
    }

    console.log(`✅ Equipos insertados/actualizados: ${insertedTeams?.length ?? 0}`);

    // Construir lookup name → id para los partidos
    const teamIdByName = new Map<string, string>();
    for (const t of insertedTeams ?? []) {
        teamIdByName.set(t.name, t.id);
    }

    /**
 * Genera source_key único para un partido.
 * 
 * Reglas:
 * 1. Si match_number existe: 'match-{match_number}'
 * 2. Si round === 'group': 'group-{group_code}-{slug(team1_slot)}-{slug(team2_slot)}'
 * 3. Si round !== 'group' y match_number no existe: 'knockout-{round}-{slug(team1_slot)}-{slug(team2_slot)}'
 */
function generateSourceKey(match: {
    match_number: number | null;
    round: string;
    group_code: string | null;
    team1_slot: string;
    team2_slot: string;
}): string {
    if (match.match_number !== null) {
        return `match-${match.match_number}`;
    }
    
    // Sanitizar slots reemplazando caracteres no alfanuméricos con guiones
    const sanitizeSlot = (slot: string) => {
        return slot.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    };
    
    if (match.round === 'group') {
        return `group-${match.group_code}-${sanitizeSlot(match.team1_slot)}-${sanitizeSlot(match.team2_slot)}`;
    }
    
    // Para partidos de knockout sin match_number
    return `knockout-${match.round}-${sanitizeSlot(match.team1_slot)}-${sanitizeSlot(match.team2_slot)}`;
}

// ── 3. Construir e insertar partidos ──────────────────────────────────────
    console.log("\n⚽ Procesando partidos...");

    const matchesPayload = data.matches.map((m, idx) => {
        const round = mapRound(m.round);
        const groupCode = parseGroupCode(m.group);

        const team1IsSlot = isSlot(m.team1);
        const team2IsSlot = isSlot(m.team2);

        // Convertir hora del venue a Colombia UTC-5
        const timeInfo = parseMatchKickoffForColombia(m.date, m.time);

        const match_number = m.num ?? null;
        const team1_slot = m.team1;
        const team2_slot = m.team2;

        // Generar source_key único
        const source_key = generateSourceKey({
            match_number,
            round,
            group_code: groupCode,
            team1_slot,
            team2_slot,
        });

        return {
            source_key,
            match_number,
            round,
            group_code: groupCode,
            team1_id: team1IsSlot ? null : (teamIdByName.get(m.team1) ?? null),
            team2_id: team2IsSlot ? null : (teamIdByName.get(m.team2) ?? null),
            team1_slot,  // siempre guardamos el slot original (sea nombre o referencia)
            team2_slot,
            match_date: timeInfo.match_date,  // Fecha en Colombia
            match_time: timeInfo.match_time,  // Hora en Colombia
            kickoff_at_utc: timeInfo.kickoff_at_utc,  // UTC timestamp
            venue_timezone: timeInfo.venue_timezone,  // Timezone original del venue
            venue_local_time: timeInfo.venue_local_time,  // Hora local del venue
            venue: m.ground,
            sort_order: idx + 1,
        };
    });

    // Upsert todos los partidos usando source_key
    if (matchesPayload.length > 0) {
        const { error } = await supabase
            .from("matches")
            .upsert(matchesPayload, {
                onConflict: "source_key",
                ignoreDuplicates: false,
            });
        if (error) {
            console.error("❌ Error insertando partidos:", error.message);
            console.error("   Detalle:", error.details);
            process.exit(1);
        }
        console.log(`✅ Partidos insertados/actualizados: ${matchesPayload.length}`);
    }

    const groupMatches = matchesPayload.filter((m) => m.match_number === null);
    const knockoutMatches = matchesPayload.filter((m) => m.match_number !== null);

    // ── 4. Validaciones post-seed ────────────────────────────────────────────────
    console.log("\n🔍 Ejecutando validaciones post-seed...");

    // Validar total de partidos
    const { count: totalMatches, error: countError } = await supabase
        .from("matches")
        .select("*", { count: "exact", head: true });
    
    if (countError) {
        console.error("❌ Error contando partidos:", countError.message);
        process.exit(1);
    }

    if (totalMatches !== 104) {
        console.error(`❌ Validación fallida: Total de partidos debe ser 104, pero es ${totalMatches}`);
        process.exit(1);
    }
    console.log(`✅ Total de partidos: ${totalMatches}`);

    // Validar source_key null
    const { count: nullSourceKeys, error: nullSourceKeysError } = await supabase
        .from("matches")
        .select("*", { count: "exact", head: true })
        .is("source_key", null);
    
    if (nullSourceKeysError) {
        console.error("❌ Error contando source_key null:", nullSourceKeysError.message);
        process.exit(1);
    }

    if (nullSourceKeys !== 0) {
        console.error(`❌ Validación fallida: Hay ${nullSourceKeys} partidos con source_key null`);
        const { data: nullSourceKeyRows } = await supabase
            .from("matches")
            .select("id, source_key, match_number, round, team1_slot, team2_slot")
            .is("source_key", null);
        console.error("   Filas problemáticas:", nullSourceKeyRows);
        process.exit(1);
    }
    console.log(`✅ source_key null: ${nullSourceKeys}`);

    // Validar kickoff_at_utc null
    const { count: nullKickoff, error: nullKickoffError } = await supabase
        .from("matches")
        .select("*", { count: "exact", head: true })
        .is("kickoff_at_utc", null);
    
    if (nullKickoffError) {
        console.error("❌ Error contando kickoff_at_utc null:", nullKickoffError.message);
        process.exit(1);
    }

    if (nullKickoff !== 0) {
        console.error(`❌ Validación fallida: Hay ${nullKickoff} partidos con kickoff_at_utc null`);
        const { data: nullKickoffRows } = await supabase
            .from("matches")
            .select("id, source_key, match_number, round, kickoff_at_utc")
            .is("kickoff_at_utc", null);
        console.error("   Filas problemáticas:", nullKickoffRows);
        process.exit(1);
    }
    console.log(`✅ kickoff_at_utc null: ${nullKickoff}`);

    // Validar venue_timezone null
    const { count: nullTimezone, error: nullTimezoneError } = await supabase
        .from("matches")
        .select("*", { count: "exact", head: true })
        .is("venue_timezone", null);
    
    if (nullTimezoneError) {
        console.error("❌ Error contando venue_timezone null:", nullTimezoneError.message);
        process.exit(1);
    }

    if (nullTimezone !== 0) {
        console.error(`❌ Validación fallida: Hay ${nullTimezone} partidos con venue_timezone null`);
        const { data: nullTimezoneRows } = await supabase
            .from("matches")
            .select("id, source_key, match_number, round, venue_timezone")
            .is("venue_timezone", null);
        console.error("   Filas problemáticas:", nullTimezoneRows);
        process.exit(1);
    }
    console.log(`✅ venue_timezone null: ${nullTimezone}`);

    // Validar venue_local_time null
    const { count: nullLocalTime, error: nullLocalTimeError } = await supabase
        .from("matches")
        .select("*", { count: "exact", head: true })
        .is("venue_local_time", null);
    
    if (nullLocalTimeError) {
        console.error("❌ Error contando venue_local_time null:", nullLocalTimeError.message);
        process.exit(1);
    }

    if (nullLocalTime !== 0) {
        console.error(`❌ Validación fallida: Hay ${nullLocalTime} partidos con venue_local_time null`);
        const { data: nullLocalTimeRows } = await supabase
            .from("matches")
            .select("id, source_key, match_number, round, venue_local_time")
            .is("venue_local_time", null);
        console.error("   Filas problemáticas:", nullLocalTimeRows);
        process.exit(1);
    }
    console.log(`✅ venue_local_time null: ${nullLocalTime}`);

    // Validar no source_key like 'group--%'
    const { data: invalidGroupKeys, error: invalidGroupKeysError } = await supabase
        .from("matches")
        .select("id, source_key, match_number, round, team1_slot, team2_slot")
        .like("source_key", "group--%");
    
    if (invalidGroupKeysError) {
        console.error("❌ Error buscando source_key inválidos:", invalidGroupKeysError.message);
        process.exit(1);
    }

    if (invalidGroupKeys && invalidGroupKeys.length > 0) {
        console.error(`❌ Validación fallida: Hay ${invalidGroupKeys.length} partidos con source_key inválido (group--%)`);
        console.error("   Filas problemáticas:", invalidGroupKeys);
        process.exit(1);
    }
    console.log(`✅ Sin source_key inválidos (group--%)`);

    // Validar duplicados por source_key
    const { data: duplicateSourceKeys, error: duplicateError } = await supabase
        .from("matches")
        .select("source_key")
        .not("source_key", "is", null);
    
    if (duplicateError) {
        console.error("❌ Error buscando duplicados:", duplicateError.message);
        process.exit(1);
    }

    const sourceKeyCounts = new Map<string, number>();
    for (const row of duplicateSourceKeys ?? []) {
        sourceKeyCounts.set(row.source_key, (sourceKeyCounts.get(row.source_key) ?? 0) + 1);
    }

    const duplicates = [...sourceKeyCounts.entries()].filter(([_, count]) => count > 1);
    if (duplicates.length > 0) {
        console.error(`❌ Validación fallida: Hay ${duplicates.length} source_key duplicados`);
        console.error("   Duplicados:", duplicates);
        process.exit(1);
    }
    console.log(`✅ Sin duplicados por source_key`);

    console.log("\n🎉 Seed completado correctamente");
    console.log(`   Total partidos: ${matchesPayload.length}`);
    console.log(`     - Fase de grupos: ${groupMatches.length}`);
    console.log(`     - Eliminatorias:  ${knockoutMatches.length}`);
}

// Solo ejecutar main() si este archivo se ejecuta directamente (no cuando se importa)
if (require.main === module || import.meta.url === `file://${process.argv[1]}`) {
    main().catch((err) => {
        console.error("❌ Error inesperado:", err);
        process.exit(1);
    });
}
