'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { LinkableCell } from '@/components/ui/linkable-cell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from 'lucide-react';

interface StockMovement {
  id: number;
  date: string;
  item_id: number;
  item_name: string;
  warehouse_id: number;
  warehouse_name: string;
  quantity: number;
  type: string;
  batch_id: number | null;
}

export default function StockMovementsPage() {
  const t = useTranslations();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: movementsData, isLoading } = useQuery({
    queryKey: ['stock-movements', startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append('date_after', startDate);
      if (endDate) params.append('date_before', endDate);
      const response = await api.get(`/api/registers/stock-movements/?${params.toString()}`);
      return response.data;
    },
  });

  const columns: ColumnDef<StockMovement>[] = [
    {
      accessorKey: 'date',
      header: 'Date',
      cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
    },
    {
      accessorKey: 'item_name',
      header: 'Item',
      cell: ({ row }) => (
        <LinkableCell
          id={row.original.item_id}
          type="item"
          label={row.original.item_name}
        />
      ),
    },
    {
      accessorKey: 'warehouse_name',
      header: 'Warehouse',
      cell: ({ row }) => (
        <LinkableCell
          id={row.original.warehouse_id}
          type="warehouse"
          label={row.original.warehouse_name}
        />
      ),
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => (
        <span className={row.original.type === 'IN' ? 'text-green-600' : 'text-red-600'}>
          {row.original.type === 'IN' ? '+ Receipt' : '- Expense'}
        </span>
      ),
    },
    {
      accessorKey: 'quantity',
      header: 'Quantity',
      cell: ({ row }) => row.original.quantity.toFixed(3),
    },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Stock Movements Register</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movements</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={movementsData?.results || []}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
