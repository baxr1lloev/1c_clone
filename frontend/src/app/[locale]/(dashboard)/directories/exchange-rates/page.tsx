'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { PiTrendUpBold } from 'react-icons/pi';
import type { ExchangeRate, PaginatedResponse } from '@/types';

const demoRates: ExchangeRate[] = [
  { id: 1, tenant: 1, currency: 2, rate: 0.92, date: '2024-01-20', created_at: '2024-01-20', updated_at: '2024-01-20' },
  { id: 2, tenant: 1, currency: 3, rate: 12500, date: '2024-01-20', created_at: '2024-01-20', updated_at: '2024-01-20' },
  { id: 3, tenant: 1, currency: 4, rate: 89.5, date: '2024-01-20', created_at: '2024-01-20', updated_at: '2024-01-20' },
];

export default function ExchangeRatesPage() {
  const t = useTranslations('directories');
  const tc = useTranslations('common');
  const tf = useTranslations('fields');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: async () => {
      try {
        const response = await api.get<PaginatedResponse<ExchangeRate>>('/directories/exchange-rates/');
        return response.results;
      } catch { return demoRates; }
    },
  });

  const columns: ColumnDef<ExchangeRate>[] = [
    {
      accessorKey: 'currency',
      header: tf('currency'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PiTrendUpBold className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono">Currency #{row.getValue('currency')}</span>
        </div>
      ),
    },
    {
      accessorKey: 'rate',
      header: tf('exchangeRate'),
      cell: ({ row }) => <span className="font-mono font-bold">{(row.getValue('rate') as number).toFixed(4)}</span>,
    },
    {
      accessorKey: 'date',
      header: tc('date'),
      cell: ({ row }) => new Date(row.getValue('date')).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('exchangeRates')}</h1>
        <p className="text-muted-foreground">Daily currency exchange rates</p>
      </div>
      <DataTable columns={columns} data={data || []} isLoading={isLoading} onRefresh={() => refetch()} />
    </div>
  );
}

