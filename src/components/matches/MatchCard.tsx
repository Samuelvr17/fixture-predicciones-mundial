import type { MatchWithNormalizedResult } from '@/app/groups/[groupId]/matches/page';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { formatMatchDateShort } from '@/lib/utils/matchDate';

interface MatchCardProps {
    match: MatchWithNormalizedResult;
}

export default function MatchCard({ match }: MatchCardProps) {
    const isKnockout = match.round !== 'group';

    const formatTime = (time: string) => {
        return time;
    };

    const formatDate = (date: string) => {
        return formatMatchDateShort(date);
    };

    return (
        <Card padding="compact" className="space-y-3">
            {/* Match Number */}
            {match.match_number && (
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Partido #{match.match_number}
                </div>
            )}

            {/* Teams */}
            <div className="space-y-2">
                {/* Team 1 */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 flex-1">
                        {match.team1 ? (
                            <>
                                {match.team1.flag_url && (
                                    <img
                                        src={match.team1.flag_url}
                                        alt={match.team1.name}
                                        className="w-6 h-4 object-cover"
                                    />
                                )}
                                <span className="font-medium">{match.team1.name}</span>
                            </>
                        ) : (
                            <span className="text-zinc-400 dark:text-zinc-500">
                                {match.team1_slot} <span className="text-xs">(pendiente)</span>
                            </span>
                        )}
                    </div>
                    {match.result && (
                        <span className="font-bold text-lg">{match.result.team1_score}</span>
                    )}
                </div>

                {/* Team 2 */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 flex-1">
                        {match.team2 ? (
                            <>
                                {match.team2.flag_url && (
                                    <img
                                        src={match.team2.flag_url}
                                        alt={match.team2.name}
                                        className="w-6 h-4 object-cover"
                                    />
                                )}
                                <span className="font-medium">{match.team2.name}</span>
                            </>
                        ) : (
                            <span className="text-zinc-400 dark:text-zinc-500">
                                {match.team2_slot} <span className="text-xs">(pendiente)</span>
                            </span>
                        )}
                    </div>
                    {match.result && (
                        <span className="font-bold text-lg">{match.result.team2_score}</span>
                    )}
                </div>
            </div>

            {/* Result / Status */}
            {match.result ? (
                <Alert variant="success" className="py-2">
                    Final: {match.result.team1_score} - {match.result.team2_score}
                    {isKnockout && match.result.winner_team_id && (
                        <span className="ml-2">
                            {match.team1?.id === match.result.winner_team_id && '✓ ' + match.team1.name}
                            {match.team2?.id === match.result.winner_team_id && '✓ ' + match.team2.name}
                        </span>
                    )}
                </Alert>
            ) : (
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    Pendiente
                </div>
            )}

            {/* Date, Time, Venue */}
            <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                <div className="flex items-center space-x-2">
                    <span>📅 {formatDate(match.match_date)}</span>
                    <span>🕐 {formatTime(match.match_time)}</span>
                    <span className="text-zinc-400 dark:text-zinc-500">(Hora Colombia)</span>
                </div>
                <div>📍 {match.venue}</div>
                {match.group_code && (
                    <div>Grupo {match.group_code}</div>
                )}
            </div>
        </Card>
    );
}
