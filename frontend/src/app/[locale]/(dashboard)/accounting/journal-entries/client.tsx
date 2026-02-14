'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { PiFileTextBold, PiArrowsDownUpBold } from 'react-icons/pi';
import { Button } from '@/components/ui/button';
import type { JournalEntry, PaginatedResponse } from '@/types';

const demoEntries: JournalEntry[] = [
  {
    id: 1,
    tenant: 1,
    number: 'JE-2024-0001',
    date: '2024-01-20',
    description: 'Sales Document SL-2024-0001',
    document_type: 'sale',
    document_id: 1,
    total_debit: 1650,
    total_credit: 1650,
    lines: [],
    is_posted: true,
    created_by: 1,
    created_at: '2024-01-20',
    updated_at: '2024-01-20',
  },
  {
    id: 2,
    tenant: 1,
    number: 'JE-2024-0002',
    date: '2024-01-20',
    description: 'Payment received for SL-2024-0001',
    document_type: 'payment',
    document_id: 1,
    total_debit: 1650,
    total_credit: 1650,
    lines: [],
    is_posted: true,
    created_by: 1,
    created_at: '2024-01-20',
    updated_at: '2024-01-20',
  },
  {
    id: 3,
    tenant: 1,
    number: 'JE-2024-0003',
    date: '2024-01-18',
    description: 'Purchase Document PR-2024-0001',
    document_type: 'purchase',
    document_id: 1,
    total_debit: 5500,
    total_credit: 5500,
    lines: [],
    is_posted: true,
    created_by: 1,
    created_at: '2024-01-18',
    updated_at: '2024-01-18',
  },
  {
    id: 4,
    tenant: 1,
    number: 'JE-2024-0004',
    date: '2024-01-21',
    description: 'Payment made for PR-2024-0001',
    document_type: 'payment',
    document_id: 2,
    total_debit: 5500,
    total_credit: 5500,
    lines: [],
    is_posted: true,
    created_by: 1,
    created_at: '2024-01-21',
    updated_at: '2024-01-21',
  },
];

export default function JournalEntriesClient({
  accountId,
  startDate,
  endDate,
}: {
  accountId: string | null;
  startDate: string | null;
  endDate: string | null;
}) {
  const t = useTranslations('accounting');
  const tc = useTranslations('common');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['journal-entries', accountId, startDate, endDate],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (accountId) params.append('account', accountId);
        if (startDate) params.append('date_after', startDate);
        if (endDate) params.append('date_before', endDate);

        const response = await api.get<PaginatedResponse<JournalEntry>>(
          `/accounting/journal-entries/?${params.toString()}`
        );
        return response.results;
      } catch {
        return demoEntries;
      }
    },
  });

  const columns: ColumnDef<JournalEntry>[] = [
    {
      accessorKey: 'number',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="-ml-4"
        >
          {tc('number')} <PiArrowsDownUpBold className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PiFileTextBold className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono font-medium">{row.getValue('number')}</span>
        </div>
      ),
    },
    {
      accessorKey: 'date',
      header: tc('date'),
      cell: ({ row }) => new Date(row.getValue('date')).toLocaleDateString(),
    },
    {
      accessorKey: 'description',
      header: tc('description'),
      cell: ({ row }) => <span className="text-sm">{row.getValue('description')}</span>,
    },
    {
      accessorKey: 'document_type',
      header: 'Source',
      cell: ({ row }) => {
        const type = row.getValue('document_type') as string;
        const id = row.original.document_id;
        const routeMap: Record<string, string> = {
          sale: 'sales',
          purchase: 'purchases',
          payment: 'payments',
          transfer: 'transfers',
          inventory: 'inventory',
        };
        const route = routeMap[type] || `${type}s`;

        return (
          <Link href={`/documents/${route}/${id}`} className="font-medium text-primary hover:underline">
            {type.charAt(0).toUpperCase() + type.slice(1)} #{row.original.number || id}
          </Link>
        );
      },
    },
    {
      accessorKey: 'total_debit',
      header: 'Debit',
      cell: ({ row }) => (
        <span className="font-mono text-emerald-600">
          ${parseFloat(row.getValue('total_debit')).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: 'total_credit',
      header: 'Credit',
      cell: ({ row }) => (
        <span className="font-mono text-rose-600">
          ${parseFloat(row.getValue('total_credit')).toFixed(2)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('journalEntries')}</h1>
        <p className="text-muted-foreground">View all journal entries</p>
      </div>
      <DataTable
        columns={columns}
        data={data || []}
        isLoading={isLoading}
        searchColumn="number"
        searchPlaceholder="Search journal entries..."
        onRefresh={() => refetch()}
        onExport={() => {}}
      />
    </div>
  );
}

