'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type RealtimeRefreshFilter = {
  table: string;
  filter: string;
};

type RealtimeRefreshProps = {
  tables: string[];
  channelName?: string;
  debounceMs?: number;
  filters?: RealtimeRefreshFilter[];
};

export default function RealtimeRefresh({
  tables,
  channelName = 'realtime-refresh',
  debounceMs = 800,
  filters = [],
}: RealtimeRefreshProps) {
  const router = useRouter();
  const tablesKey = tables.join('|');
  const filtersKey = filters.map(({ table, filter }) => `${table}:${filter}`).join('|');

  useEffect(() => {
    if (tables.length === 0) {
      return;
    }

    const supabase = createClient();
    const channel = supabase.channel(channelName);
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }

      refreshTimeout = setTimeout(() => {
        router.refresh();
      }, debounceMs);
    };

    for (const table of tables) {
      const tableFilter = filters.find((filter) => filter.table === table)?.filter;

      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          ...(tableFilter ? { filter: tableFilter } : {}),
        },
        scheduleRefresh
      );
    }

    channel.subscribe();

    return () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }

      supabase.removeChannel(channel);
    };
  }, [channelName, debounceMs, filtersKey, router, tablesKey]);

  return null;
}
