import { ResolvedMatch } from '@/lib/tournament/bracket';
import { formatMatchDateShort } from '@/lib/utils/matchDate';

interface BracketMatchCardProps {
  match: ResolvedMatch;
  team1Name?: string;
  team2Name?: string;
  team1Code?: string;
  team2Code?: string;
  team1SourceLabel?: string;
  team2SourceLabel?: string;
}

const ROUND_LABELS: Record<string, string> = {
  round_of_32: 'Dieciseisavos',
  round_of_16: 'Octavos',
  quarter_final: 'Cuartos',
  semi_final: 'Semifinales',
  third_place: 'Tercer Puesto',
  final: 'Final',
};

const PENDING_REASON_LABELS: Record<string, string> = {
  missing_standings: 'Faltan posiciones de grupo',
  incomplete_group: 'Grupo pendiente por completar',
  unresolved_tiebreak: 'Desempate pendiente',
  missing_best_thirds: 'Faltan mejores terceros',
  missing_third_place_assignment: 'Asignación de terceros pendiente',
  missing_match_result: 'Falta resultado del partido',
  invalid_slot: 'Slot inválido',
};

const formatSlotLabel = (slot?: string) => {
  if (!slot) return undefined;

  const winnerSlot = slot.match(/^W(\d+)$/);
  if (winnerSlot) {
    const [, matchNumber] = winnerSlot;
    return `Ganador del partido ${matchNumber}`;
  }

  const loserSlot = slot.match(/^L(\d+)$/);
  if (loserSlot) {
    const [, matchNumber] = loserSlot;
    return `Perdedor del partido ${matchNumber}`;
  }

  const groupPositionSlot = slot.match(/^([12])([A-L])$/);
  if (groupPositionSlot) {
    const [, position, groupCode] = groupPositionSlot;
    return `${position}.º del Grupo ${groupCode}`;
  }

  const bestThirdSlot = slot.match(/^3([A-L](?:\/[A-L])*)?$/);
  if (bestThirdSlot) {
    const [, groups] = bestThirdSlot;
    return groups ? `Mejor 3.º (${groups})` : 'Mejor 3.º';
  }

  return `Origen ${slot}`;
};

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

  const formatDate = (dateStr: string) => {
    return formatMatchDateShort(dateStr);
  };

  const formatTime = (timeStr: string) => {
    return timeStr.substring(0, 5);
  };

  const getPendingReason = () => {
    if (pendingSlots.length === 0) return null;
    // Return the first pending slot's reason
    return PENDING_REASON_LABELS[pendingSlots[0].reason] || pendingSlots[0].reason;
  };

  const isTeam1Pending = Boolean(!team1_id && team1_slot);
  const isTeam2Pending = Boolean(!team2_id && team2_slot);
  const pendingReason = getPendingReason();
  const winnerName = winner_team_id === team1_id ? team1Name : team2Name;

  const renderTeamRow = ({
    code,
    isPending,
    isWinner,
    name,
    slot,
    sourceLabel,
  }: {
    code?: string;
    isPending: boolean;
    isWinner: boolean;
    name?: string;
    slot?: string;
    sourceLabel?: string;
  }) => {
    const slotLabel = formatSlotLabel(slot);
    const secondaryLabels = [sourceLabel, slotLabel].filter(
      (label, index, labels): label is string => Boolean(label) && labels.indexOf(label) === index,
    );

    return (
      <div
        className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-colors ${
          isWinner
            ? 'border-green-200 bg-green-50 dark:border-green-800/70 dark:bg-green-950/40'
            : 'border-zinc-100 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-950/40'
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className={`inline-flex min-w-11 justify-center rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-wide ring-1 ${
              code
                ? 'bg-white text-zinc-800 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700'
                : 'bg-zinc-200/70 text-zinc-500 ring-zinc-300/70 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700'
            }`}
          >
            {code || 'TBD'}
          </span>
          <div className="min-w-0 flex-1">
            <span
              className={`block truncate text-sm font-semibold ${
                isPending
                  ? 'text-zinc-500 italic dark:text-zinc-400'
                  : isWinner
                    ? 'text-green-950 dark:text-green-50'
                    : 'text-zinc-900 dark:text-zinc-100'
              }`}
            >
              {name || 'TBD'}
            </span>
            {secondaryLabels.map((label) => (
              <span
                key={label}
                className="block truncate text-[11px] text-zinc-500 dark:text-zinc-400"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
        {isWinner && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-green-700 dark:bg-green-900/70 dark:text-green-200">
            Avanza
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      {/* Match number and round */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {m.num && (
          <span className="inline-flex items-center rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-black text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-950">
            Partido #{m.num}
          </span>
        )}
        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 dark:ring-indigo-800/70">
          {ROUND_LABELS[m.round] || m.round}
        </span>
      </div>

      {/* Date and venue */}
      <div className="mb-4 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-950/60 dark:text-zinc-400">
        <div className="font-semibold text-zinc-700 dark:text-zinc-300">
          {formatDate(m.date)} · {formatTime(m.time)}
        </div>
        <div className="truncate">{m.ground}</div>
      </div>

      {/* Teams */}
      <div className="space-y-2">
        {renderTeamRow({
          code: team1Code,
          isPending: isTeam1Pending,
          isWinner: Boolean(winner_team_id && winner_team_id === team1_id),
          name: team1Name,
          slot: team1_slot ?? m.team1_slot,
          sourceLabel: team1SourceLabel,
        })}

        {renderTeamRow({
          code: team2Code,
          isPending: isTeam2Pending,
          isWinner: Boolean(winner_team_id && winner_team_id === team2_id),
          name: team2Name,
          slot: team2_slot ?? m.team2_slot,
          sourceLabel: team2SourceLabel,
        })}
      </div>

      {/* Pending status */}
      {pendingReason && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800/80 dark:bg-amber-950/40">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-xs font-black text-amber-700 dark:bg-amber-900 dark:text-amber-200">
              !
            </span>
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">
              {pendingReason}
            </span>
          </div>
        </div>
      )}

      {/* Winner indicator */}
      {winner_team_id && (
        <div className="mt-3 rounded-xl bg-green-50 px-3 py-2 ring-1 ring-green-200 dark:bg-green-950/40 dark:ring-green-800/70">
          <span className="text-xs font-bold text-green-700 dark:text-green-200">
            Ganador / avanza: {winnerName || 'TBD'}
          </span>
        </div>
      )}
    </div>
  );
}
