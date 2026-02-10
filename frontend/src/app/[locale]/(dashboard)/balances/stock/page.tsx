'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { LinkableCell } from '@/components/ui/linkable-cell';
import { DrillDownModal } from '@/components/ui/drilldown-modal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface StockBalance {
    item_id: number;
    item_name: string;
    item_sku: string;
    warehouse_id: number;
    warehouse_name: string;
    quantity: number;
    amount: number;
}

export default function StockBalancePage() {
    const [drillDownOpen, setDrillDownOpen] = useState(false);
    const [selectedBalance, setSelectedBalance] = useState<StockBalance | null>(null);

    const { data: balancesData, isLoading } = useQuery({
        queryKey: ['stock-balances'],
        queryFn: async () => {
            const response = await api.get('/api/balances/stock/');
            return response.data;
        },
    });

    const columns: ColumnDef<StockBalance>[] = [
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
            accessorKey: 'item_sku',
            header: 'SKU',
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
            accessorKey: 'quantity',
            header: 'Quantity',
            cell: ({ row }) => row.original.quantity.toFixed(3),
        },
        {
            accessorKey: 'amount',
            header: 'Value',
            cell: ({ row }) => `$${row.original.amount.toFixed(2)}`,
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        setSelectedBalance(row.original);
                        setDrillDownOpen(true);
                    }}
                >
                    Show Movements
                </Button>
            ),
        },
    ];

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Stock Balance</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Current Stock Balances</CardTitle>
                </CardHeader>
                <CardContent>
                    <DataTable
                        columns={columns}
                        data={balancesData?.balances || []}
                        isLoading={isLoading}
                    />
                </CardContent>
            </Card>

            {selectedBalance && (
                <DrillDownModal
                    title={`Movements: ${selectedBalance.item_name} at ${selectedBalance.warehouse_name}`}
                    endpoint={`/api/balances/stock/movements/?item=${selectedBalance.item_id}&warehouse=${selectedBalance.warehouse_id}`}
                    isOpen={drillDownOpen}
                    onClose={() => setDrillDownOpen(false)}
                />
            )}
        </div>
    );
}
