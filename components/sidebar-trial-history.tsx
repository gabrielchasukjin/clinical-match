'use client';

import { isToday, isYesterday, subMonths, subWeeks } from 'date-fns';
import { useRouter } from 'next/navigation';
import type { User } from 'next-auth';
import { useState } from 'react';
import useSWR from 'swr';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import type { TrialSearchSession } from '@/lib/db/schema';
import { fetcher } from '@/lib/utils';
import { LoaderIcon } from './icons';

type GroupedSearches = {
  today: TrialSearchSession[];
  yesterday: TrialSearchSession[];
  lastWeek: TrialSearchSession[];
  lastMonth: TrialSearchSession[];
  older: TrialSearchSession[];
};

const groupSearchesByDate = (searches: TrialSearchSession[]): GroupedSearches => {
  const now = new Date();
  const oneWeekAgo = subWeeks(now, 1);
  const oneMonthAgo = subMonths(now, 1);

  return searches.reduce(
    (groups, search) => {
      const searchDate = new Date(search.created_at);

      if (isToday(searchDate)) {
        groups.today.push(search);
      } else if (isYesterday(searchDate)) {
        groups.yesterday.push(search);
      } else if (searchDate > oneWeekAgo) {
        groups.lastWeek.push(search);
      } else if (searchDate > oneMonthAgo) {
        groups.lastMonth.push(search);
      } else {
        groups.older.push(search);
      }

      return groups;
    },
    {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
    } as GroupedSearches,
  );
};

function SearchItem({ search }: { search: TrialSearchSession }) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();

  // Create a short title from the search query
  const title = search.search_query.slice(0, 50) + (search.search_query.length > 50 ? '...' : '');

  const handleClick = () => {
    // Navigate to search results with the query
    router.push(`/trials/search?q=${encodeURIComponent(search.search_query)}`);
    setOpenMobile(false);
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={handleClick} className="flex flex-col items-start h-auto py-2">
        <div className="w-full truncate text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">
          {search.match_count} {search.match_count === 1 ? 'match' : 'matches'} found
        </div>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function SidebarTrialHistory({ user }: { user: User | undefined }) {
  const { data, isLoading } = useSWR<{ searches: TrialSearchSession[] }>(
    user ? '/api/trials/history' : null,
    fetcher
  );

  if (!user) {
    return (
      <SidebarGroup>
        <div className="px-2 py-1 text-xs font-semibold text-sidebar-foreground/70">
          Trial Searches
        </div>
        <SidebarGroupContent>
          <div className="px-2 text-zinc-500 w-full flex flex-row justify-center items-center text-sm gap-2">
            Login to save your search history!
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (isLoading) {
    return (
      <SidebarGroup>
        <div className="px-2 py-1 text-xs font-semibold text-sidebar-foreground/70">
          Trial Searches
        </div>
        <SidebarGroupContent>
          <div className="flex flex-col">
            {[44, 32, 28].map((item) => (
              <div
                key={item}
                className="rounded-md h-12 flex gap-2 px-2 items-center"
              >
                <div
                  className="h-4 rounded-md flex-1 max-w-[--skeleton-width] bg-sidebar-accent-foreground/10"
                  style={
                    {
                      '--skeleton-width': `${item}%`,
                    } as React.CSSProperties
                  }
                />
              </div>
            ))}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (!data || data.searches.length === 0) {
    return (
      <SidebarGroup>
        <div className="px-2 py-1 text-xs font-semibold text-sidebar-foreground/70">
          Trial Searches
        </div>
        <SidebarGroupContent>
          <div className="px-2 text-zinc-500 w-full flex flex-row justify-center items-center text-sm gap-2">
            Your search history will appear here
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  const groupedSearches = groupSearchesByDate(data.searches);

  return (
    <SidebarGroup>
      <div className="px-2 py-1 text-xs font-semibold text-sidebar-foreground/70">
        Trial Searches
      </div>
      <SidebarGroupContent>
        <SidebarMenu>
          <div className="flex flex-col gap-4">
            {groupedSearches.today.length > 0 && (
              <div>
                <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                  Today
                </div>
                {groupedSearches.today.map((search) => (
                  <SearchItem key={search.id} search={search} />
                ))}
              </div>
            )}

            {groupedSearches.yesterday.length > 0 && (
              <div>
                <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                  Yesterday
                </div>
                {groupedSearches.yesterday.map((search) => (
                  <SearchItem key={search.id} search={search} />
                ))}
              </div>
            )}

            {groupedSearches.lastWeek.length > 0 && (
              <div>
                <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                  Last 7 days
                </div>
                {groupedSearches.lastWeek.map((search) => (
                  <SearchItem key={search.id} search={search} />
                ))}
              </div>
            )}

            {groupedSearches.lastMonth.length > 0 && (
              <div>
                <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                  Last 30 days
                </div>
                {groupedSearches.lastMonth.map((search) => (
                  <SearchItem key={search.id} search={search} />
                ))}
              </div>
            )}

            {groupedSearches.older.length > 0 && (
              <div>
                <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                  Older
                </div>
                {groupedSearches.older.map((search) => (
                  <SearchItem key={search.id} search={search} />
                ))}
              </div>
            )}
          </div>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
