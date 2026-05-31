export type TeamDisplayLike = { name: string; display_name_es?: string | null };

export function getTeamDisplayName(team?: TeamDisplayLike | null): string {
  return team?.display_name_es || team?.name || 'TBD';
}
