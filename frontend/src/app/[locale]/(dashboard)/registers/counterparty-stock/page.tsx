'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { Badge } from '@/components/ui/badge';
import { PiUsersBold } from 'react-icons/pi';
import type { StockBalance, PaginatedResponse } from '@/types';

export default function CounterpartyStockPage() {
  const t = useTranslations('registers');
  const tc = useTranslations('common');
  const tf = useTranslations('fields');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['counterparty-stock'],
    queryFn: async () => {
      try {
        const response = await api.get<PaginatedResponse<StockBalance>>('/registers/counterparty-stock/');
        return response.results;
      } catch { return []; }
    },
  });

  const columns: ColumnDef<StockBalance>[] = [
    {
      accessorKey: 'item',
      header: tf('item'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PiUsersBold className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Item #{row.getValue('item')}</span>
        </div>
      ),
    },
    { accessorKey: 'warehouse', header: tf('counterparty'), cell: ({ row }) => `Partner #${row.getValue('warehouse')}` },
    {
      accessorKey: 'quantity',
      header: tf('quantity'),
      cell: ({ row }) => {
        const qty = row.getValue('quantity') as number;
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 hover:bg-purple-50 border-purple-200">
            {qty}
          </Badge>
        );
      },
    },
    { accessorKey: 'total_cost', header: tf('totalValue'), cell: ({ row }) => <span className="font-mono">${parseFloat(row.getValue('total_cost')).toFixed(2)}</span> },
    { accessorKey: 'last_movement_date', header: tf('lastMovement'), cell: ({ row }) => row.getValue('last_movement_date') ? new Date(row.getValue('last_movement_date') as string).toLocaleDateString() : '-' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('counterpartyStock')}</h1>
        <p className="text-muted-foreground">Stock held by counterparties (consignment)</p>
      </div>
      <DataTable columns={columns} data={data || []} isLoading={isLoading} onRefresh={() => refetch()} onExport={() => {}} />
    </div>
  );
}

