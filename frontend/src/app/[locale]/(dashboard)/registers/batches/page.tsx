'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { LinkableCell } from '@/components/ui/linkable-cell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface BatchAllocation {
    batch_id: number;
    batch_number: string;
    item_id: number;
    item_name: string;
    warehouse_id: number;
    warehouse_name: string;
    receipt_date: string;
    receipt_document: string;
    quantity_received: number;
    quantity_remaining: number;
    cost_per_unit: number;
}

export default function BatchAllocationPage() {
    const [itemFilter, setItemFilter] = useState('');

    const { data: batchesData, isLoading } = useQuery({
        queryKey: ['batch-allocations', itemFilter],
        queryFn: async () => {
            const params = itemFilter ? `?item=${itemFilter}` : '';
            const response = await api.get(`/api/registers/batches/${params}`);
            return response.data;
        },
    });

    const columns: ColumnDef<BatchAllocation>[] = [
        {
            accessorKey: 'batch_number',
            header: 'Batch',
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
            accessorKey: 'receipt_date',
            header: 'Receipt Date',
            cell: ({ row }) => new Date(row.original.receipt_date).toLocaleDateString(),
        },
        {
            accessorKey: 'quantity_received',
            header: 'Received',
            cell: ({ row }) => row.original.quantity_received.toFixed(3),
        },
        {
            accessorKey: 'quantity_remaining',
            header: 'Remaining',
            cell: ({ row }) => (
                <span className={row.original.quantity_remaining > 0 ? 'text-green-600' : 'text-muted-foreground'}>
                    {row.original.quantity_remaining.toFixed(3)}
                </span>
            ),
        },
        {
            accessorKey: 'cost_per_unit',
            header: 'Cost/Unit',
            cell: ({ row }) => `$${row.original.cost_per_unit.toFixed(2)}`,
        },
    ];

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Batch Allocation (FIFO)</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="w-64">
                        <Label>Item ID</Label>
                        <Input
                            type="number"
                            placeholder="Filter by item..."
                            value={itemFilter}
                            onChange={(e) => setItemFilter(e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Active Batches</CardTitle>
                </CardHeader>
                <CardContent>
                    <DataTable
                        columns={columns}
                        data={batchesData?.batches || []}
                        isLoading={isLoading}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
