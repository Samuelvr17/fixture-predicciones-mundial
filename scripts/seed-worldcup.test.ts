/**
 * scripts/seed-worldcup.test.ts
 * 
 * Tests para la función parseMatchKickoffForColombia
 * 
 * Ejecutar con:
 * npm run test:run
 */

import { describe, it, expect } from 'vitest';
import { parseMatchKickoffForColombia } from './seed-worldcup';

describe('parseMatchKickoffForColombia', () => {
    it('2026-06-11 + 13:00 UTC-6 -> Colombia 2026-06-11 14:00:00, UTC 2026-06-11T19:00:00Z', () => {
        const result = parseMatchKickoffForColombia("2026-06-11", "13:00 UTC-6");
        expect(result.kickoff_at_utc).toBe("2026-06-11T19:00:00.000Z");
        expect(result.match_date).toBe("2026-06-11");
        expect(result.match_time).toBe("14:00:00");
        expect(result.venue_timezone).toBe("UTC-6");
        expect(result.venue_local_time).toBe("13:00:00");
    });

    it('2026-06-12 + 12:00 UTC-4 -> Colombia 2026-06-12 11:00:00, UTC 2026-06-12T16:00:00Z', () => {
        const result = parseMatchKickoffForColombia("2026-06-12", "12:00 UTC-4");
        expect(result.kickoff_at_utc).toBe("2026-06-12T16:00:00.000Z");
        expect(result.match_date).toBe("2026-06-12");
        expect(result.match_time).toBe("11:00:00");
        expect(result.venue_timezone).toBe("UTC-4");
        expect(result.venue_local_time).toBe("12:00:00");
    });

    it('2026-06-24 + 18:00 UTC-7 -> Colombia 2026-06-24 20:00:00, UTC 2026-06-25T01:00:00Z', () => {
        const result = parseMatchKickoffForColombia("2026-06-24", "18:00 UTC-7");
        expect(result.kickoff_at_utc).toBe("2026-06-25T01:00:00.000Z");
        expect(result.match_date).toBe("2026-06-24");
        expect(result.match_time).toBe("20:00:00");
        expect(result.venue_timezone).toBe("UTC-7");
        expect(result.venue_local_time).toBe("18:00:00");
    });

    it('2026-06-24 + 21:00 UTC-7 -> Colombia 2026-06-24 23:00:00, UTC 2026-06-25T04:00:00Z', () => {
        const result = parseMatchKickoffForColombia("2026-06-24", "21:00 UTC-7");
        expect(result.kickoff_at_utc).toBe("2026-06-25T04:00:00.000Z");
        expect(result.match_date).toBe("2026-06-24");
        expect(result.match_time).toBe("23:00:00");
        expect(result.venue_timezone).toBe("UTC-7");
        expect(result.venue_local_time).toBe("21:00:00");
    });

    it('2026-06-15 + 15:00 UTC-5 -> Colombia 2026-06-15 15:00:00', () => {
        const result = parseMatchKickoffForColombia("2026-06-15", "15:00 UTC-5");
        expect(result.kickoff_at_utc).toBe("2026-06-15T20:00:00.000Z");
        expect(result.match_date).toBe("2026-06-15");
        expect(result.match_time).toBe("15:00:00");
        expect(result.venue_timezone).toBe("UTC-5");
        expect(result.venue_local_time).toBe("15:00:00");
    });
});
