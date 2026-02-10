'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PiDotsThreeOutlineBold, PiArrowsDownUpBold, PiStackBold, PiEyeBold } from 'react-icons/pi';
import type { SalesOrder, PaginatedResponse, DocumentStatus } from '@/types';

const decorationOrders: SalesOrder[] = [
  { id: 1, tenant: 1, number: 'SO-2024-0001', date: '2024-01-18', status: 'posted', is_posted: true, comment: '', counterparty: 1, contract: 1, warehouse: 1, currency: 1, exchange_rate: 1, rate: 1, delivery_date: '2024-01-25', subtotal: 2000, tax_amount: 200, total: 2200, total_amount: 2200, total_amount_base: 2200, order_date: '2024-01-18', lines: [], created_by: 1, posted_by: 1, posted_at: '2024-01-18', created_at: '2024-01-18', updated_at: '2024-01-18' },
  { id: 2, tenant: 1, number: 'SO-2024-0002', date: '2024-01-19', status: 'draft', is_posted: false, comment: '', counterparty: 2, contract: null, warehouse: 1, currency: 1, exchange_rate: 1, rate: 1, delivery_date: '2024-01-28', subtotal: 3500, tax_amount: 350, total: 3850, total_amount: 3850, total_amount_base: 3850, order_date: '2024-01-19', lines: [], created_by: 1, posted_by: null, posted_at: null, created_at: '2024-01-19', updated_at: '2024-01-19' },
];

const statusColors: Record<DocumentStatus, string> = { draft: 'bg-slate-100 text-slate-800', posted: 'bg-emerald-100 text-emerald-800', cancelled: 'bg-rose-100 text-rose-800' };

export default function OrdersPage() {
  const t = useTranslations('documents');
  const tc = useTranslations('common');
  const tf = useTranslations('fields');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      try {
        const response = await api.get<PaginatedResponse<SalesOrder>>('/documents/orders/');
        return response.results;
      } catch { return decorationOrders; }
    },
  });

  const columns: ColumnDef<SalesOrder>[] = [
    {
      accessorKey: 'number',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="-ml-4">
          {tc('number')} <PiArrowsDownUpBold className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PiStackBold className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono font-medium">{row.getValue('number')}</span>
        </div>
      ),
    },
    { accessorKey: 'date', header: tc('date'), cell: ({ row }) => new Date(row.getValue('date')).toLocaleDateString() },
    { accessorKey: 'status', header: tc('status'), cell: ({ row }) => <Badge className={statusColors[row.getValue('status') as DocumentStatus]}>{t(row.getValue('status') as DocumentStatus)}</Badge> },
    { accessorKey: 'counterparty', header: tf('counterparty'), cell: ({ row }) => `Customer #${row.getValue('counterparty')}` },
    { accessorKey: 'delivery_date', header: tf('deliveryDate'), cell: ({ row }) => row.getValue('delivery_date') ? new Date(row.getValue('delivery_date') as string).toLocaleDateString() : '-' },
    { accessorKey: 'total', header: tc('total'), cell: ({ row }) => <span className="font-mono font-bold">${parseFloat(row.getValue('total')).toFixed(2)}</span> },
    {
      id: 'actions',
      header: tc('actions'),
      cell: () => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><PiDotsThreeOutlineBold className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem><PiEyeBold className="mr-2 h-4 w-4" />{tc('view')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('orders')}</h1>
        <p className="text-muted-foreground">Manage sales orders and reservations</p>
      </div>
      <DataTable columns={columns} data={data || []} isLoading={isLoading} searchColumn="number" onRefresh={() => refetch()} onAdd={() => window.location.href = '/documents/orders/new'} addLabel={t('createOrder')} />
    </div>
  );
}

