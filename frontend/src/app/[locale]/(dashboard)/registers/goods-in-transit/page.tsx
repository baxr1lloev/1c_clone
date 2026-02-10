'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { Badge } from '@/components/ui/badge';
import { PiTruckBold } from 'react-icons/pi';
import type { StockBalance, PaginatedResponse } from '@/types';

export default function GoodsInTransitPage() {
  const t = useTranslations('registers');
  const tc = useTranslations('common');
  const tf = useTranslations('fields');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['goods-in-transit'],
    queryFn: async () => {
      try {
        const response = await api.get<PaginatedResponse<StockBalance>>('/registers/goods-in-transit/');
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
          <PiTruckBold className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Item #{row.getValue('item')}</span>
        </div>
      ),
    },
    { accessorKey: 'warehouse', header: tf('sourceWarehouse'), cell: ({ row }) => `Warehouse #${row.getValue('warehouse')}` },
    {
      accessorKey: 'quantity',
      header: tf('quantity'),
      cell: ({ row }) => {
        const qty = row.getValue('quantity') as number;
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200">
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
        <h1 className="text-3xl font-bold tracking-tight">{t('goodsInTransit')}</h1>
        <p className="text-muted-foreground">Items currently in transit between warehouses</p>
      </div>
      <DataTable columns={columns} data={data || []} isLoading={isLoading} onRefresh={() => refetch()} onExport={() => {}} />
    </div>
  );
}

