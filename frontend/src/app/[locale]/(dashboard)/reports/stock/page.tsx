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

interface StockReportRow {
    item_id: number;
    item_name: string;
    item_sku: string;
    warehouse_id: number;
    warehouse_name: string;
    opening_quantity: number;
    receipts: number;
    expenses: number;
    closing_quantity: number;
}

export default function StockReportPage() {
    const [drillDownOpen, setDrillDownOpen] = useState(false);
    const [drillDownConfig, setDrillDownConfig] = useState<{
        title: string;
        endpoint: string;
    } | null>(null);

    const { data: reportData, isLoading } = useQuery({
        queryKey: ['stock-report'],
        queryFn: async () => {
            const date = new Date().toISOString().split('T')[0];
            const response = await api.get(`/reports/stock-as-of-date/?date=${date}`) as { items?: { item_id?: number; item_name?: string; item_sku?: string; warehouse_id?: number; warehouse_name?: string; quantity?: number }[] };
            const items = response?.items ?? [];
            return { rows: items.map((r: any) => ({
                item_id: r.item_id,
                item_name: r.item_name ?? '',
                item_sku: r.item_sku ?? '',
                warehouse_id: r.warehouse_id,
                warehouse_name: r.warehouse_name ?? '',
                opening_quantity: 0,
                receipts: 0,
                expenses: 0,
                closing_quantity: Number(r.quantity ?? 0),
            })) };
        },
    });

    const handleDrillDown = (itemId: number, warehouseId: number, type: string) => {
        const start = new Date();
        start.setMonth(start.getMonth() - 1);
        const end = new Date();
        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];
        setDrillDownConfig({
            title: `${type} Movements`,
            endpoint: `/reports/stock-history/?item=${itemId}&warehouse=${warehouseId}&start=${startStr}&end=${endStr}`,
        });
        setDrillDownOpen(true);
    };

    const columns: ColumnDef<StockReportRow>[] = [
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
            accessorKey: 'opening_quantity',
            header: 'Opening',
            cell: ({ row }) => row.original.opening_quantity.toFixed(3),
        },
        {
            accessorKey: 'receipts',
            header: 'Receipts',
            cell: ({ row }) => (
                <Button
                    variant="link"
                    className="p-0 h-auto font-normal text-green-600"
                    onClick={() => handleDrillDown(row.original.item_id, row.original.warehouse_id, 'IN')}
                >
                    +{row.original.receipts.toFixed(3)}
                </Button>
            ),
        },
        {
            accessorKey: 'expenses',
            header: 'Expenses',
            cell: ({ row }) => (
                <Button
                    variant="link"
                    className="p-0 h-auto font-normal text-red-600"
                    onClick={() => handleDrillDown(row.original.item_id, row.original.warehouse_id, 'OUT')}
                >
                    -{row.original.expenses.toFixed(3)}
                </Button>
            ),
        },
        {
            accessorKey: 'closing_quantity',
            header: 'Closing',
            cell: ({ row }) => (
                <span className="font-medium">
                    {row.original.closing_quantity.toFixed(3)}
                </span>
            ),
        },
    ];

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Stock Report</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Stock Movement Summary</CardTitle>
                </CardHeader>
                <CardContent>
                    <DataTable
                        columns={columns}
                        data={reportData?.rows || []}
                        isLoading={isLoading}
                    />
                </CardContent>
            </Card>

            {drillDownConfig && (
                <DrillDownModal
                    title={drillDownConfig.title}
                    endpoint={drillDownConfig.endpoint}
                    isOpen={drillDownOpen}
                    onClose={() => setDrillDownOpen(false)}
                />
            )}
        </div>
    );
}
