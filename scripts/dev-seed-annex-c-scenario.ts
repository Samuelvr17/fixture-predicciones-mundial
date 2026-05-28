#!/usr/bin/env npx tsx
/**
 * scripts/dev-seed-annex-c-scenario.ts
 *
 * DEV-ONLY SCRIPT for testing Annex C visually without manually entering results.
 *
 * This script inserts fictional group stage match results to generate a known
 * combination of best third-place teams (EFGHIJKL) for testing the bracket resolution.
 *
 * WARNING: This script is for DEVELOPMENT ONLY.
 * - Uses service role client to bypass RLS
 * - Only inserts/updates match_results for group stage
 * - Does NOT touch user predictions
 * - Does NOT touch user groups
 * - Can clean/replace existing test results
 *
 * Usage:
 *   npm run dev:annex-c-scenario
 *
 * Requisites:
 * - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import WebSocket from "ws";
import { calculateGroupStandings } from "../src/lib/tournament/groupStandings";
import { calculateBestThirds } from "../src/lib/tournament/bestThirds";
import { assignThirdPlaceSlots, getAllSlotPatterns } from "../src/lib/tournament/thirdPlaceAssignment";
import { resolveBracket } from "../src/lib/tournament/bracket";

// Load environment variables
config({ path: ".env.local" });

// ============================================================================
// TYPES
// ============================================================================

interface DbMatch {
  id: string;
  match_number: number | null;
  round: string;
  group_code: string | null;
  team1_id: string | null;
  team2_id: string | null;
  team1_slot: string;
  team2_slot: string;
}

interface DbTeam {
  id: string;
  name: string;
  code: string;
  group_code: string;
}

interface DbMatchResult {
  id: string;
  match_id: string;
  team1_score: number;
  team2_score: number;
  winner_team_id: string | null;
  entered_by: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

// Target combination: EFGHIJKL (groups E, F, G, H, I, J, K, L qualify as thirds)
const TARGET_QUALIFIED_GROUPS = ["E", "F", "G", "H", "I", "J", "K", "L"];

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("⚠️  DEV-ONLY SCRIPT - Annex C Scenario Seeder");
  console.log("⚠️  This script is for development testing only!\n");

  // Validate environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("❌ Missing environment variables:");
    if (!supabaseUrl) console.error("   NEXT_PUBLIC_SUPABASE_URL");
    if (!serviceRoleKey) console.error("   SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  // Create service role client
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: WebSocket as any },
  });

  console.log("📊 Fetching data from database...");

  // Fetch all teams
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, code, group_code")
    .order("group_code");

  if (teamsError) {
    console.error("❌ Error fetching teams:", teamsError.message);
    process.exit(1);
  }

  console.log(`✅ Found ${teams.length} teams`);

  // Fetch all group stage matches
  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("id, match_number, round, group_code, team1_id, team2_id, team1_slot, team2_slot")
    .eq("round", "group")
    .order("group_code");

  if (matchesError) {
    console.error("❌ Error fetching matches:", matchesError.message);
    process.exit(1);
  }

  console.log(`✅ Found ${matches.length} group stage matches`);

  // Get a global admin to use as the actor for entering results
  console.log("\n🔐 Looking for global admin...");
  const { data: globalAdmin, error: adminError } = await supabase
    .from("global_admins")
    .select("user_id")
    .limit(1)
    .single();

  if (adminError || !globalAdmin) {
    console.error("❌ No global admin found in database.");
    console.error("   This script requires a global admin to enter test results.");
    console.error("   Please create a global admin first using: npm run create-global-admin");
    process.exit(1);
  }

  const enteredBy = globalAdmin.user_id;
  console.log(`✅ Using global admin (user_id: ${enteredBy})`);

  // Get group stage match IDs to delete their results
  const groupMatchIds = matches.map(m => m.id);

  // Clean existing group stage match results (ALL, not just from one user)
  console.log("\n⚠️  WARNING: This will DELETE ALL existing group stage match results!");
  console.log("⚠️  This is a DEV-ONLY operation and should not be run in production.");
  console.log("\n🧹 Deleting existing group stage match results...");
  
  const { error: deleteError } = await supabase
    .from("match_results")
    .delete()
    .in("match_id", groupMatchIds);

  if (deleteError) {
    console.error("❌ Error deleting results:", deleteError.message);
    process.exit(1);
  }

  console.log("✅ Deleted existing group stage match results");

  // Generate fictional results to create EFGHIJKL combination
  console.log("\n🎯 Generating results for EFGHIJKL combination...");
  const results = generateScenarioResults(teams as DbTeam[], matches as DbMatch[], TARGET_QUALIFIED_GROUPS, enteredBy);

  console.log(`✅ Generated ${results.length} match results`);

  // Insert results
  console.log("\n💾 Inserting results into database...");
  const { error: insertError } = await supabase
    .from("match_results")
    .insert(results);

  if (insertError) {
    console.error("❌ Error inserting results:", insertError.message);
    process.exit(1);
  }

  console.log(`✅ Results inserted successfully (${results.length} results)`);

  // Now calculate and print the results
  console.log("\n" + "=".repeat(60));
  console.log("📈 CALCULATING STANDINGS AND BRACKET");
  console.log("=".repeat(60) + "\n");

  // Fetch the inserted results
  const { data: insertedResults, error: fetchResultsError } = await supabase
    .from("match_results")
    .select("match_id, team1_score, team2_score");

  if (fetchResultsError) {
    console.error("❌ Error fetching inserted results:", fetchResultsError.message);
    process.exit(1);
  }

  // Convert to library format
  const libraryTeams = teams.map(t => ({
    id: t.id,
    name: t.name,
    code: t.code,
    group_code: t.group_code,
  }));

  const libraryMatches = matches.map(m => ({
    id: m.id,
    team1_id: m.team1_id!,
    team2_id: m.team2_id!,
    group_code: m.group_code!,
    round: "group" as const,
  }));

  const libraryResults = insertedResults.map(r => ({
    match_id: r.match_id,
    team1_score: r.team1_score,
    team2_score: r.team2_score,
  }));

  // Calculate group standings
  const standingsOutput = calculateGroupStandings(libraryTeams, libraryMatches, libraryResults);

  // Print standings by group
  console.log("📊 GROUP STANDINGS");
  console.log("-".repeat(60));
  for (const groupCode of ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]) {
    const group = standingsOutput.standings[groupCode];
    if (!group) continue;

    console.log(`\nGroup ${groupCode}:`);
    group.standings.forEach((team, idx) => {
      const position = idx + 1;
      const teamInfo = teams.find(t => t.id === team.team_id);
      console.log(
        `  ${position}. ${teamInfo?.name || team.team_id} - ` +
        `${team.points} pts, ${team.wins}-${team.draws}-${team.losses}, ` +
        `GD: ${team.goalDifference}, GF: ${team.goalsFor}`
      );
    });
  }

  // Calculate best thirds
  console.log("\n" + "-".repeat(60));
  console.log("🥉 BEST THIRD-PLACE TEAMS");
  console.log("-".repeat(60));

  const bestThirdsOutput = calculateBestThirds(standingsOutput.thirdPlaceTeams);

  console.log(`\nQualified (Top 8):`);
  bestThirdsOutput.qualifiedThirds.forEach((team, idx) => {
    const teamInfo = teams.find(t => t.id === team.team_id);
    const groupCode = Object.entries(standingsOutput.standings).find(
      ([_, g]) => g.standings[2]?.team_id === team.team_id
    )?.[0];
    console.log(
      `  ${idx + 1}. ${teamInfo?.name || team.team_id} (Group ${groupCode}) - ` +
      `${team.points} pts, GD: ${team.goalDifference}, GF: ${team.goalsFor}`
    );
  });

  console.log(`\nEliminated (Bottom 4):`);
  bestThirdsOutput.eliminatedThirds.forEach((team, idx) => {
    const teamInfo = teams.find(t => t.id === team.team_id);
    const groupCode = Object.entries(standingsOutput.standings).find(
      ([_, g]) => g.standings[2]?.team_id === team.team_id
    )?.[0];
    console.log(
      `  ${idx + 1}. ${teamInfo?.name || team.team_id} (Group ${groupCode}) - ` +
      `${team.points} pts, GD: ${team.goalDifference}, GF: ${team.goalsFor}`
    );
  });

  // Get combination key
  const qualifiedGroupCodes = bestThirdsOutput.qualifiedThirds.map(team => {
    const groupCode = Object.entries(standingsOutput.standings).find(
      ([_, g]) => g.standings[2]?.team_id === team.team_id
    )?.[0];
    return groupCode;
  }).filter(Boolean) as string[];

  const combinationKey = [...qualifiedGroupCodes].sort().join("");

  console.log("\n" + "-".repeat(60));
  console.log(`🔑 COMBINATION KEY: ${combinationKey}`);
  console.log("-".repeat(60));

  if (combinationKey === TARGET_QUALIFIED_GROUPS.join("")) {
    console.log("✅ Successfully generated target combination!");
  } else {
    console.log(`⚠️  Generated ${combinationKey}, expected ${TARGET_QUALIFIED_GROUPS.join("")}`);
  }

  // Get Annex C assignments
  console.log("\n" + "-".repeat(60));
  console.log("📋 ANNEX C ASSIGNMENTS");
  console.log("-".repeat(60));

  try {
    const assignments = assignThirdPlaceSlots(qualifiedGroupCodes);
    const slotPatterns = getAllSlotPatterns();

    for (const slotPattern of slotPatterns) {
      const assignedGroup = (assignments as any)[slotPattern];
      const teamInfo = standingsOutput.standings[assignedGroup]?.standings[2];
      const teamName = teams.find(t => t.id === teamInfo?.team_id)?.name || "Unknown";
      console.log(`  ${slotPattern} → Group ${assignedGroup} (${teamName})`);
    }
  } catch (error) {
    console.error("❌ Error getting Annex C assignments:", error);
  }

  // Fetch knockout matches for Round of 32
  console.log("\n" + "-".repeat(60));
  console.log("⚽ ROUND OF 32 MATCHES (with third-place teams resolved)");
  console.log("-".repeat(60));

  const { data: knockoutMatches, error: knockoutError } = await supabase
    .from("matches")
    .select("id, match_number, round, team1_id, team2_id, team1_slot, team2_slot, venue")
    .eq("round", "round_of_32")
    .order("match_number");

  if (knockoutError) {
    console.error("❌ Error fetching knockout matches:", knockoutError.message);
    process.exit(1);
  }

  const libraryKnockoutMatches = knockoutMatches.map(m => ({
    id: m.id,
    num: m.match_number ?? undefined,
    round: m.round as any,
    date: "",
    time: "",
    ground: m.venue,
    team1_id: m.team1_id ?? undefined,
    team2_id: m.team2_id ?? undefined,
    team1_slot: m.team1_slot as any,
    team2_slot: m.team2_slot as any,
  }));

  const bracketOutput = resolveBracket(
    libraryKnockoutMatches,
    [],
    standingsOutput,
    bestThirdsOutput
  );

  console.log("\n");
  for (const resolvedMatch of bracketOutput.matches) {
    const match = resolvedMatch.match;
    const team1Name = resolvedMatch.team1_id 
      ? teams.find(t => t.id === resolvedMatch.team1_id)?.name || resolvedMatch.team1_slot
      : resolvedMatch.team1_slot || "TBD";
    const team2Name = resolvedMatch.team2_id
      ? teams.find(t => t.id === resolvedMatch.team2_id)?.name || resolvedMatch.team2_slot
      : resolvedMatch.team2_slot || "TBD";

    console.log(
      `  Match ${match.num}: ${team1Name} vs ${team2Name} (${match.ground})`
    );

    if (resolvedMatch.pendingSlots.length > 0) {
      console.log(`    ⚠️  Pending slots: ${resolvedMatch.pendingSlots.map(s => s.slot).join(", ")}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ DEV SCENARIO SEEDING COMPLETE");
  console.log("=".repeat(60));
  console.log("\nYou can now visit /groups/[groupId]/bracket to see the bracket");
  console.log("with third-place teams resolved using Annex C.\n");
}

// ============================================================================
// SCENARIO GENERATION
// ============================================================================

/**
 * Generate fictional match results to produce the target combination.
 * 
 * Strategy:
 * - For groups in TARGET_QUALIFIED_GROUPS (E, F, G, H, I, J, K, L):
 *   - Make 3rd place team have 4 points, 0 GD, 2 GF
 * - For other groups (A, B, C, D):
 *   - Make 3rd place team have 1 point, -5 GD, 1 GF
 * - Ensure clear 1st and 2nd places in each group
 */
function generateScenarioResults(
  teams: DbTeam[],
  matches: DbMatch[],
  targetQualifiedGroups: string[],
  enteredBy: string
): Array<{ match_id: string; team1_score: number; team2_score: number; entered_by: string }> {
  const results: Array<{ match_id: string; team1_score: number; team2_score: number; entered_by: string }> = [];

  // Group matches by group
  const matchesByGroup = new Map<string, DbMatch[]>();
  for (const match of matches) {
    if (!match.group_code) continue;
    if (!matchesByGroup.has(match.group_code)) {
      matchesByGroup.set(match.group_code, []);
    }
    matchesByGroup.get(match.group_code)!.push(match);
  }

  // Generate results for each group
  for (const [groupCode, groupMatches] of matchesByGroup) {
    const isTargetGroup = targetQualifiedGroups.includes(groupCode);
    const groupTeams = teams.filter(t => t.group_code === groupCode);

    if (groupTeams.length !== 4 || groupMatches.length !== 6) {
      console.warn(`⚠️  Group ${groupCode} has unexpected structure: ${groupTeams.length} teams, ${groupMatches.length} matches`);
      continue;
    }

    // For target groups: 3rd place gets 4 points (1W, 1D, 1L)
    // For other groups: 3rd place gets 1 point (0W, 1D, 2L)
    const thirdPlacePoints = isTargetGroup ? 4 : 1;
    const thirdPlaceGD = isTargetGroup ? 0 : -5;
    const thirdPlaceGF = isTargetGroup ? 2 : 1;

    // Simple scenario: assign fixed results
    // Team order in groupTeams is arbitrary, so we'll use the match structure
    // to determine who plays whom and assign scores accordingly

    // Match 1: Team 1 vs Team 2
    // Match 2: Team 3 vs Team 4
    // Match 3: Team 1 vs Team 3
    // Match 4: Team 2 vs Team 4
    // Match 5: Team 1 vs Team 4
    // Match 6: Team 2 vs Team 3

    // We'll create a simple pattern:
    // - Team 1: 9 points (3 wins) - 1st place
    // - Team 2: 6 points (2 wins, 1 loss) - 2nd place
    // - Team 3: thirdPlacePoints - 3rd place
    // - Team 4: 0 points (3 losses) - 4th place

    const [m1, m2, m3, m4, m5, m6] = groupMatches;

    // Match 1: Team 1 beats Team 2 (2-0)
    results.push({ match_id: m1.id, team1_score: 2, team2_score: 0, entered_by: enteredBy });

    // Match 2: Team 3 beats Team 4 (2-0)
    results.push({ match_id: m2.id, team1_score: 2, team2_score: 0, entered_by: enteredBy });

    // Match 3: Team 1 beats Team 3 (2-0)
    results.push({ match_id: m3.id, team1_score: 2, team2_score: 0, entered_by: enteredBy });

    // Match 4: Team 2 beats Team 4 (2-0)
    results.push({ match_id: m4.id, team1_score: 2, team2_score: 0, entered_by: enteredBy });

    // Match 5: Team 1 beats Team 4 (2-0)
    results.push({ match_id: m5.id, team1_score: 2, team2_score: 0, entered_by: enteredBy });

    // Match 6: Team 2 vs Team 3 - determine based on target
    if (isTargetGroup) {
      // Team 3 needs to get points: draw (1-1)
      results.push({ match_id: m6.id, team1_score: 1, team2_score: 1, entered_by: enteredBy });
    } else {
      // Team 3 gets only 1 point: lose (0-2)
      results.push({ match_id: m6.id, team1_score: 2, team2_score: 0, entered_by: enteredBy });
    }
  }

  return results;
}

// ============================================================================
// ENTRY POINT
// ============================================================================

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
