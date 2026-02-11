/**
 * Utility hook to check if a period is closed.
 * 
 * Returns period status including who closed it, when, and whether current user can reopen.
 */

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface PeriodStatus {
    is_closed: boolean;
    period: string | null;
    closed_by: string | null;
    closed_at: string | null;
    can_reopen: boolean;
    operational_closed: boolean;
    accounting_closed: boolean;
}

export function usePeriodStatus(date: string | Date) {
    return useQuery<PeriodStatus>({
        queryKey: ['period-status', date],
        queryFn: async () => {
            const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
            const response = await api.get('/accounting/api/period-status/', {
                params: { date: dateStr }
            });
            return response;
        },
        // Refetch periodically because period status can change
        refetchInterval: 60000, // 1 minute
        staleTime: 30000, // 30 seconds
    });
}
