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
 */
function parseTime(timeStr: string): string {
    const match = timeStr.match(/^(\d{1,2}:\d{2})/);
    if (!match) return "00:00:00";
    const [h, m] = match[1].split(":");
    return `${h.padStart(2, "0")}:${m}:00`;
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

    // ── 3. Construir e insertar partidos ──────────────────────────────────────
    console.log("\n⚽ Procesando partidos...");

    const matchesPayload = data.matches.map((m, idx) => {
        const round = mapRound(m.round);
        const groupCode = parseGroupCode(m.group);

        const team1IsSlot = isSlot(m.team1);
        const team2IsSlot = isSlot(m.team2);

        return {
            match_number: m.num ?? null,
            round,
            group_code: groupCode,
            team1_id: team1IsSlot ? null : (teamIdByName.get(m.team1) ?? null),
            team2_id: team2IsSlot ? null : (teamIdByName.get(m.team2) ?? null),
            team1_slot: m.team1,  // siempre guardamos el slot original (sea nombre o referencia)
            team2_slot: m.team2,
            match_date: m.date,
            match_time: parseTime(m.time),
            venue: m.ground,
            sort_order: idx + 1,
        };
    });

    // Los partidos de grupos no tienen `num`, así que upsert por (match_date + team1_slot + team2_slot)
    // Los partidos de eliminatoria tienen `num` único, hacemos upsert por match_number.
    // Separamos en dos lotes:
    const knockoutMatches = matchesPayload.filter((m) => m.match_number !== null);
    const groupMatches = matchesPayload.filter((m) => m.match_number === null);

    // Upsert partidos de grupos por team1_slot + team2_slot + match_date
    if (groupMatches.length > 0) {
        const { error } = await supabase
            .from("matches")
            .upsert(groupMatches, {
                onConflict: "team1_slot,team2_slot,match_date",
                ignoreDuplicates: false,
            });
        if (error) {
            console.error("❌ Error insertando partidos de grupos:", error.message);
            console.error("   Detalle:", error.details);
            process.exit(1);
        }
        console.log(`✅ Partidos de grupos insertados/actualizados: ${groupMatches.length}`);
    }

    // Upsert partidos de eliminatoria por match_number
    if (knockoutMatches.length > 0) {
        const { error } = await supabase
            .from("matches")
            .upsert(knockoutMatches, {
                onConflict: "match_number",
                ignoreDuplicates: false,
            });
        if (error) {
            console.error("❌ Error insertando partidos eliminatorias:", error.message);
            console.error("   Detalle:", error.details);
            process.exit(1);
        }
        console.log(`✅ Partidos de eliminatoria insertados/actualizados: ${knockoutMatches.length}`);
    }

    console.log("\n🎉 Seed completado correctamente");
    console.log(`   Total partidos: ${matchesPayload.length}`);
    console.log(`     - Fase de grupos: ${groupMatches.length}`);
    console.log(`     - Eliminatorias:  ${knockoutMatches.length}`);
}

main().catch((err) => {
    console.error("❌ Error inesperado:", err);
    process.exit(1);
});
