'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { Badge } from '@/components/ui/badge';
import { PiTruckBold } from 'react-icons/pi';
import type { GoodsInTransit, PaginatedResponse, TransitStatus, RiskStatus } from '@/types';

const demoTransit: GoodsInTransit[] = [
  { id: 1, tenant: 1, number: 'GT-2024-0001', date: '2024-01-18', status: 'posted', is_posted: true, comment: '', source_document: 1, source_warehouse: 1, target_warehouse: 2, shipped_date: '2024-01-18', expected_date: '2024-01-22', received_date: null, transit_status: 'in_transit', risk_status: 'on_time', created_by: 1, posted_by: 1, posted_at: '2024-01-18', created_at: '2024-01-18', updated_at: '2024-01-18' },
  { id: 2, tenant: 1, number: 'GT-2024-0002', date: '2024-01-15', status: 'posted', is_posted: true, comment: '', source_document: 2, source_warehouse: 2, target_warehouse: 1, shipped_date: '2024-01-15', expected_date: '2024-01-18', received_date: '2024-01-17', transit_status: 'received', risk_status: 'on_time', created_by: 1, posted_by: 1, posted_at: '2024-01-15', created_at: '2024-01-15', updated_at: '2024-01-17' },
  { id: 3, tenant: 1, number: 'GT-2024-0003', date: '2024-01-10', status: 'posted', is_posted: true, comment: '', source_document: 3, source_warehouse: 1, target_warehouse: 3, shipped_date: '2024-01-10', expected_date: '2024-01-15', received_date: null, transit_status: 'in_transit', risk_status: 'delayed', created_by: 1, posted_by: 1, posted_at: '2024-01-10', created_at: '2024-01-10', updated_at: '2024-01-10' },
];

const transitStatusColors: Record<TransitStatus, string> = {
  shipped: 'bg-blue-100 text-blue-800',
  in_transit: 'bg-amber-100 text-amber-800',
  received: 'bg-emerald-100 text-emerald-800',
};
const riskColors: Record<RiskStatus, string> = { on_time: 'bg-emerald-100 text-emerald-800', delayed: 'bg-amber-100 text-amber-800', critical: 'bg-rose-100 text-rose-800' };

export default function TransitPage() {
  const t = useTranslations('documents');
  const tc = useTranslations('common');
  const tf = useTranslations('fields');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['transit'],
    queryFn: async () => {
      try {
        const response = await api.get<PaginatedResponse<GoodsInTransit>>('/documents/transit/');
        return response.results;
      } catch { return demoTransit; }
    },
  });

  const columns: ColumnDef<GoodsInTransit>[] = [
    {
      accessorKey: 'number',
      header: tc('number'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PiTruckBold className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono font-medium">{row.getValue('number')}</span>
        </div>
      ),
    },
    { accessorKey: 'shipped_date', header: 'Shipped', cell: ({ row }) => new Date(row.getValue('shipped_date')).toLocaleDateString() },
    { accessorKey: 'expected_date', header: 'Expected', cell: ({ row }) => new Date(row.getValue('expected_date')).toLocaleDateString() },
    { accessorKey: 'received_date', header: 'Received', cell: ({ row }) => row.getValue('received_date') ? new Date(row.getValue('received_date') as string).toLocaleDateString() : '-' },
    { accessorKey: 'transit_status', header: tc('status'), cell: ({ row }) => <Badge className={transitStatusColors[row.getValue('transit_status') as TransitStatus]}>{(row.getValue('transit_status') as string).replace('_', ' ')}</Badge> },
    { accessorKey: 'risk_status', header: 'Risk', cell: ({ row }) => <Badge className={riskColors[row.getValue('risk_status') as RiskStatus]}>{(row.getValue('risk_status') as string).replace('_', ' ')}</Badge> },
    { accessorKey: 'source_warehouse', header: tf('sourceWarehouse'), cell: ({ row }) => `WH #${row.getValue('source_warehouse')}` },
    { accessorKey: 'target_warehouse', header: tf('targetWarehouse'), cell: ({ row }) => `WH #${row.getValue('target_warehouse')}` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('transit')}</h1>
        <p className="text-muted-foreground">Track goods in transit between locations</p>
      </div>
      <DataTable columns={columns} data={data || []} isLoading={isLoading} searchColumn="number" onRefresh={() => refetch()} />
    </div>
  );
}

