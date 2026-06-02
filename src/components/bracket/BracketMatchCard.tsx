import { ResolvedMatch } from '@/lib/tournament/bracket';
import { formatMatchDateShort } from '@/lib/utils/matchDate';
import { formatSlotLabel as formatTournamentSlotLabel } from '@/lib/tournament/slotLabels';

interface BracketMatchCardProps {
  match: ResolvedMatch;
  team1Name?: string;
  team2Name?: string;
  team1Code?: string;
  team2Code?: string;
  team1SourceLabel?: string;
  team2SourceLabel?: string;
}

const PENDING_REASON_LABELS: Record<string, string> = {
  missing_standings: 'Faltan grupos',
  incomplete_group: 'Grupo pendiente',
  unresolved_tiebreak: 'Desempate pendiente',
  missing_best_thirds: 'Faltan mejores 3.º',
  missing_third_place_assignment: 'Falta asignación',
  missing_match_result: 'Falta resultado',
  invalid_slot: 'Slot inválido',
};

const formatSlotLabel = (slot?: string) => {
  if (!slot) return undefined;

  const winnerSlot = slot.match(/^W(\d+)$/);
  if (winnerSlot) {
    const [, matchNumber] = winnerSlot;
    return `Ganador P${matchNumber}`;
  }

  const loserSlot = slot.match(/^L(\d+)$/);
  if (loserSlot) {
    const [, matchNumber] = loserSlot;
    return `Perdedor P${matchNumber}`;
  }

  const groupPositionSlot = slot.match(/^([12])([A-L])$/);
  if (groupPositionSlot) {
    const [, position, groupCode] = groupPositionSlot;
    return `${position}.º Grupo ${groupCode}`;
  }

  const bestThirdSlot = slot.match(/^3([A-L](?:\/[A-L])*)?$/);
  if (bestThirdSlot) {
    const [, groups] = bestThirdSlot;
    return groups ? `Mejor 3.º ${groups}` : 'Mejor 3.º';
  }

  return `Origen ${slot}`;
};

const getTeamDisplay = (name?: string, sourceLabel?: string, slotLabel?: string) =>
  name || sourceLabel || slotLabel || 'TBD';

export default function BracketMatchCard({
  match,
  team1Name,
  team2Name,
  team1Code,
  team2Code,
  team1SourceLabel,
  team2SourceLabel,
}: BracketMatchCardProps) {
  const { match: m, team1_id, team2_id, team1_slot, team2_slot, winner_team_id, pendingSlots } = match;

  const pendingReason =
    pendingSlots.length > 0
      ? PENDING_REASON_LABELS[pendingSlots[0].reason] || pendingSlots[0].reason
      : null;

  const renderTeamRow = ({
    code,
    isWinner,
    name,
    slot,
    sourceLabel,
  }: {
    code?: string;
    isWinner: boolean;
    name?: string;
    slot?: string;
    sourceLabel?: string;
  }) => {
    const slotLabel = formatTournamentSlotLabel(slot);
    const displayName = getTeamDisplay(name, sourceLabel, slotLabel);
    const detailLabel = name ? sourceLabel || slotLabel : slotLabel;

    return (
      <div
        className={`grid grid-cols-[2.25rem_1fr] items-center gap-2 border-t px-2 py-1.5 first:border-t-0 ${
          isWinner
            ? 'border-green-200 bg-green-50/90 text-green-950 dark:border-green-800/70 dark:bg-green-950/40 dark:text-green-50'
            : 'border-zinc-200/80 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/20 dark:text-zinc-100'
        }`}
      >
        <span
          className={`inline-flex h-5 min-w-8 items-center justify-center rounded-full px-1.5 text-[10px] font-black uppercase tracking-wide ring-1 ${
            code
              ? 'bg-zinc-50 text-zinc-800 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700'
              : 'bg-zinc-100 text-zinc-500 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700'
          }`}
        >
          {code || '?'}
        </span>
        <div className="min-w-0">
          <div className={`truncate text-[12px] font-bold leading-4 ${name ? '' : 'italic text-zinc-500 dark:text-zinc-400'}`}>
            {displayName}
          </div>
          {detailLabel && (
            <div className="truncate text-[10px] font-medium leading-3 text-zinc-500 dark:text-zinc-400">
              {detailLabel}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <article className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-[0_1px_0_rgba(15,23,42,0.05)] dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900/80">
        <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white dark:bg-zinc-100 dark:text-zinc-950">
          {m.num ? `P${m.num}` : 'Partido'}
        </span>
        {pendingReason && (
          <span className="truncate rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-800">
            {pendingReason}
          </span>
        )}
      </div>

      <div className="border-b border-slate-200 px-2 py-1 text-[10px] leading-3 text-slate-600 dark:border-zinc-800 dark:text-zinc-400">
        <div className="truncate font-semibold text-slate-700 dark:text-zinc-300">
          {formatMatchDateShort(m.date)} · {m.time.substring(0, 5)}
        </div>
        <div className="truncate">{m.ground}</div>
      </div>

      <div>
        {renderTeamRow({
          code: team1Code,
          isWinner: Boolean(winner_team_id && winner_team_id === team1_id),
          name: team1Name,
          slot: team1_slot ?? m.team1_slot,
          sourceLabel: team1SourceLabel,
        })}
        {renderTeamRow({
          code: team2Code,
          isWinner: Boolean(winner_team_id && winner_team_id === team2_id),
          name: team2Name,
          slot: team2_slot ?? m.team2_slot,
          sourceLabel: team2SourceLabel,
        })}
      </div>
    </article>
  );
}
