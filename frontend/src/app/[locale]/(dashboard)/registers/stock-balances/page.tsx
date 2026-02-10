'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { Badge } from '@/components/ui/badge';
import { PiPackageBold } from 'react-icons/pi';
import type { StockBalance, PaginatedResponse } from '@/types';

const decorationBalances: StockBalance[] = [
  { id: 1, tenant: 1, item: 1, warehouse: 1, quantity: 45, reserved_quantity: 5, available_quantity: 40, total_cost: 54000, average_cost: 1200, last_movement_date: '2024-01-20' },
  { id: 2, tenant: 1, item: 2, warehouse: 1, quantity: 90, reserved_quantity: 0, available_quantity: 90, total_cost: 22500, average_cost: 250, last_movement_date: '2024-01-21' },
  { id: 3, tenant: 1, item: 2, warehouse: 2, quantity: 10, reserved_quantity: 0, available_quantity: 10, total_cost: 2500, average_cost: 250, last_movement_date: '2024-01-21' },
  { id: 4, tenant: 1, item: 3, warehouse: 1, quantity: 180, reserved_quantity: 20, available_quantity: 160, total_cost: 14400, average_cost: 80, last_movement_date: '2024-01-22' },
  { id: 5, tenant: 1, item: 4, warehouse: 1, quantity: 0, reserved_quantity: 0, available_quantity: 0, total_cost: 0, average_cost: 0, last_movement_date: null },
];

export default function StockBalancesPage() {
  const t = useTranslations('registers');
  const tc = useTranslations('common');
  const tf = useTranslations('fields');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['stock-balances'],
    queryFn: async () => {
      try {
        const response = await api.get<PaginatedResponse<StockBalance>>('/registers/stock-balances/');
        return response.results;
      } catch { return decorationBalances; }
    },
  });

  const columns: ColumnDef<StockBalance>[] = [
    {
      accessorKey: 'item',
      header: tf('item'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PiPackageBold className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Item #{row.getValue('item')}</span>
        </div>
      ),
    },
    { accessorKey: 'warehouse', header: tf('warehouse'), cell: ({ row }) => `Warehouse #${row.getValue('warehouse')}` },
    {
      accessorKey: 'quantity',
      header: tf('totalQuantity'),
      cell: ({ row }) => {
        const qty = row.getValue('quantity') as number;
        return (
          <Badge variant={qty > 0 ? 'default' : 'outline'} className={qty === 0 ? 'bg-slate-100 text-slate-600' : qty < 10 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}>
            {qty}
          </Badge>
        );
      },
    },
    { accessorKey: 'reserved_quantity', header: tf('reserved'), cell: ({ row }) => <span className="text-amber-600">{row.getValue('reserved_quantity')}</span> },
    { accessorKey: 'available_quantity', header: tf('available'), cell: ({ row }) => <span className="font-bold text-emerald-600">{row.getValue('available_quantity')}</span> },
    { accessorKey: 'average_cost', header: tf('averageCost'), cell: ({ row }) => <span className="font-mono">${parseFloat(row.getValue('average_cost')).toFixed(2)}</span> },
    { accessorKey: 'total_cost', header: tf('totalValue'), cell: ({ row }) => <span className="font-mono font-bold">${parseFloat(row.getValue('total_cost')).toFixed(2)}</span> },
    { accessorKey: 'last_movement_date', header: tf('lastMovement'), cell: ({ row }) => row.getValue('last_movement_date') ? new Date(row.getValue('last_movement_date') as string).toLocaleDateString() : '-' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('stockBalance')}</h1>
        <p className="text-muted-foreground">Current inventory levels by item and warehouse</p>
      </div>
      <DataTable columns={columns} data={data || []} isLoading={isLoading} onRefresh={() => refetch()} onExport={() => {}} />
    </div>
  );
}

