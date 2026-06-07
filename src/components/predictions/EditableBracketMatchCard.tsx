import type { ResolvedMatch } from '@/lib/tournament/bracket';
import { getTeamDisplayName } from '@/lib/i18n/teamNames';
import { formatMatchDateShort } from '@/lib/utils/matchDate';
import type { Database } from '@/types/database.types';
import { formatSlotLabel as formatTournamentSlotLabel } from '@/lib/tournament/slotLabels';
import { Button } from '@/components/ui/Button';

type Team = Database['public']['Tables']['teams']['Row'];

interface EditableBracketMatchCardProps {
  match: ResolvedMatch;
  teams: Map<string, Team>;
  team1Score: string;
  team2Score: string;
  predictedWinner: string | null;
  isBeforeDeadline: boolean;
  isSaving: boolean;
  error?: string;
  success: boolean;
  onTeam1ScoreChange: (value: string) => void;
  onTeam2ScoreChange: (value: string) => void;
  onWinnerChange: (winnerId: string | null) => void;
  onSave: () => void;
}

const PENDING_REASON_LABELS: Record<string, string> = {
  missing_standings: 'Faltan grupos',
  incomplete_group: 'Grupo pendiente',
  unresolved_tiebreak: 'Desempate pendiente',
  missing_best_thirds: 'Faltan mejores 3.º',
  missing_third_place_assignment: 'Falta asignación',
  missing_match_result: 'Falta predicción',
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

const getPredictedWinnerId = (
  team1Score: number,
  team2Score: number,
  predictedWinner: string | null,
  team1_id?: string,
  team2_id?: string,
) => {
  if (predictedWinner) {
    return predictedWinner;
  }

  if (team1Score > team2Score) {
    return team1_id;
  }

  if (team2Score > team1Score) {
    return team2_id;
  }

  return undefined;
};

const getTeamDisplay = (team?: Team, sourceLabel?: string, slotLabel?: string) =>
  team ? getTeamDisplayName(team) : sourceLabel || slotLabel || 'TBD';

export default function EditableBracketMatchCard({
  match,
  teams,
  team1Score,
  team2Score,
  predictedWinner,
  isBeforeDeadline,
  isSaving,
  error,
  success,
  onTeam1ScoreChange,
  onTeam2ScoreChange,
  onWinnerChange,
  onSave,
}: EditableBracketMatchCardProps) {
  const { match: m, team1_id, team2_id, team1_slot, team2_slot, pendingSlots } = match;
  const team1 = team1_id ? teams.get(team1_id) : undefined;
  const team2 = team2_id ? teams.get(team2_id) : undefined;
  
  const team1ScoreNum = parseInt(team1Score, 10) || 0;
  const team2ScoreNum = parseInt(team2Score, 10) || 0;
  const winnerTeamId = getPredictedWinnerId(team1ScoreNum, team2ScoreNum, predictedWinner, team1_id, team2_id);
  
  const isTie = team1ScoreNum === team2ScoreNum;
  const isTieWithoutWinner = isTie && !predictedWinner;
  
  const pendingReason =
    pendingSlots.length > 0
      ? PENDING_REASON_LABELS[pendingSlots[0].reason] || pendingSlots[0].reason
      : isTieWithoutWinner
        ? 'Clasificado pendiente'
        : null;

  const canEditScores = isBeforeDeadline && pendingSlots.length === 0;
  const canEditWinner = isBeforeDeadline && team1 && team2;

  const renderTeamRow = ({
    team,
    teamId,
    score,
    slot,
    onScoreChange,
    showWinnerIndicator,
  }: {
    team?: Team;
    teamId?: string;
    score: string;
    slot?: string;
    onScoreChange?: (value: string) => void;
    showWinnerIndicator?: boolean;
  }) => {
    const slotLabel = formatTournamentSlotLabel(slot);
    const displayName = getTeamDisplay(team, undefined, slotLabel);
    const isWinner = Boolean(winnerTeamId && teamId && winnerTeamId === teamId);

    return (
      <div
        className={`grid grid-cols-[2rem_1fr_2rem] items-center gap-1.5 border-t px-2 py-1 first:border-t-0 ${
          isWinner && showWinnerIndicator
            ? 'border-green-200 bg-green-50/90 text-green-950 dark:border-green-800/70 dark:bg-green-950/40 dark:text-green-50'
            : 'border-zinc-200/80 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/20 dark:text-zinc-100'
        }`}
      >
        <span
          className={`inline-flex h-4.5 min-w-7 items-center justify-center rounded-full px-1 text-[9px] font-black uppercase tracking-wide ring-1 ${
            team?.code
              ? 'bg-zinc-50 text-zinc-800 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700'
              : 'bg-zinc-100 text-zinc-500 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700'
          }`}
        >
          {team?.code || '?'}
        </span>
        <div className="min-w-0">
          <div className={`truncate text-[11px] font-bold leading-tight ${team ? '' : 'italic text-zinc-500 dark:text-zinc-400'}`}>
            {displayName}
          </div>
          {slotLabel && (
            <div className="truncate text-[9px] font-medium leading-none text-zinc-500 dark:text-zinc-400">
              {slotLabel}
            </div>
          )}
        </div>
        {canEditScores && onScoreChange ? (
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={score}
            onChange={(e) => onScoreChange(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            className="w-9 px-1 py-0.5 text-right text-sm font-bold border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 tabular-nums"
          />
        ) : (
          <span className="text-right text-base font-black tabular-nums">
            {parseInt(score, 10) || 0}
          </span>
        )}
      </div>
    );
  };

  return (
    <article className="flex w-full flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-[0_1px_0_rgba(15,23,42,0.05)] dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-900/80">
        <span className="rounded-full bg-slate-950 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white dark:bg-zinc-100 dark:text-zinc-950">
          {m.num ? `P${m.num}` : 'Partido'}
        </span>
        {pendingReason && (
          <span className="truncate rounded-full bg-amber-50 px-1 py-0.5 text-[8px] font-bold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-800">
            {pendingReason}
          </span>
        )}
      </div>

      <div className="border-b border-slate-200 px-2 py-0.5 text-[9px] leading-none text-slate-600 dark:border-zinc-800 dark:text-zinc-400">
        <div className="truncate font-semibold text-slate-700 dark:text-zinc-300">
          {formatMatchDateShort(m.date)} · {m.time.substring(0, 5)}
        </div>
        <div className="truncate">{m.ground}</div>
      </div>

      <div>
        {renderTeamRow({
          team: team1,
          teamId: team1_id,
          score: team1Score,
          slot: team1_slot ?? m.team1_slot,
          onScoreChange: canEditScores ? onTeam1ScoreChange : undefined,
          showWinnerIndicator: !isTie,
        })}
        {renderTeamRow({
          team: team2,
          teamId: team2_id,
          score: team2Score,
          slot: team2_slot ?? m.team2_slot,
          onScoreChange: canEditScores ? onTeam2ScoreChange : undefined,
          showWinnerIndicator: !isTie,
        })}
      </div>

      <div className="border-t border-zinc-200 bg-zinc-50 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-900/50">
        {isTie && canEditWinner && (
          <div className="mb-1">
            <select
              value={predictedWinner ?? ''}
              onChange={(e) => onWinnerChange(e.target.value || null)}
              className="h-8 w-full px-1.5 py-0 text-[10px] border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            >
              <option value="">¿Quién clasifica?</option>
              {team1 && <option value={team1.id}>{getTeamDisplayName(team1)}</option>}
              {team2 && <option value={team2.id}>{getTeamDisplayName(team2)}</option>}
            </select>
          </div>
        )}

        {isTieWithoutWinner && !canEditWinner && (
          <div className="mb-1 flex h-8 items-center rounded border border-amber-200 bg-amber-50 px-2 text-[9px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            Falta clasificado
          </div>
        )}

        {error && (
          <div className="mb-1 truncate text-[9px] text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {canEditScores && (
          <Button
            onClick={onSave}
            disabled={isSaving}
            className={`h-8 w-full px-2 py-0 text-xs leading-none ${success ? 'border-green-500 text-green-700 dark:border-green-600 dark:text-green-400' : ''}`}
          >
            {isSaving ? 'Guardando...' : success ? '✓ Guardado' : 'Guardar'}
          </Button>
        )}
      </div>
    </article>
  );
}
