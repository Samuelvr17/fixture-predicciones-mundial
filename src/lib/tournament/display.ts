import type { Round } from './bracket';
import type { Database } from '@/types/database.types';

export type MatchRound = Database['public']['Enums']['match_round'];
export type BracketSide = 'left' | 'right';

export const GROUP_ORDER = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
] as const;

export const MATCH_ROUND_ORDER = [
  'group',
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'third_place',
  'final',
] as const satisfies readonly MatchRound[];

export const BRACKET_ROUND_ORDER = [
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'final',
  'third_place',
] as const satisfies readonly Round[];

export const KNOCKOUT_ROUND_ORDER = [
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'third_place',
  'final',
] as const satisfies readonly Round[];

export const KNOCKOUT_ROUNDS = new Set<MatchRound>(KNOCKOUT_ROUND_ORDER);

export const isKnockoutRound = (round: string): round is Round =>
  KNOCKOUT_ROUNDS.has(round as MatchRound);

export const BRACKET_SIDE_ROUNDS = [
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
] as const satisfies readonly Round[];

export const BRACKET_LEFT_DISPLAY_ROUNDS = BRACKET_SIDE_ROUNDS;
export const BRACKET_RIGHT_DISPLAY_ROUNDS = [...BRACKET_SIDE_ROUNDS].reverse();

export const BRACKET_SIDE_MATCH_NUMBERS: Record<
  BracketSide,
  Partial<Record<Round, number[]>>
> = {
  left: {
    round_of_32: [74, 77, 73, 75, 83, 84, 81, 82],
    round_of_16: [89, 90, 93, 94],
    quarter_final: [97, 98],
    semi_final: [101],
  },
  right: {
    round_of_32: [76, 78, 79, 80, 86, 88, 85, 87],
    round_of_16: [91, 92, 95, 96],
    quarter_final: [99, 100],
    semi_final: [102],
  },
};

export const ROUND_LABELS: Record<MatchRound, string> = {
  group: 'Fase de Grupos',
  round_of_32: 'Dieciseisavos',
  round_of_16: 'Octavos',
  quarter_final: 'Cuartos de final',
  semi_final: 'Semifinales',
  third_place: 'Tercer puesto',
  final: 'Final',
};

export const getRoundLabel = (round: string) =>
  ROUND_LABELS[round as MatchRound] ?? round;
