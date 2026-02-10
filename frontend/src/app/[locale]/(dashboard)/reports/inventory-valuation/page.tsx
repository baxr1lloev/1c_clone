'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface InventoryItem {
    item_id: number;
    item_name: string;
    item_sku: string;
    warehouse_name: string;
    total_quantity: number;
    average_cost: number;
    total_value: number;
    batches_count: number;
}

interface InventoryValuation {
    items: InventoryItem[];
    summary: {
        total_items: number;
        total_quantity: number;
        total_value: number;
        average_cost: number;
    };
}

export default function InventoryValuationPage() {
    const t = useTranslations();
    const [warehouseFilter, setWarehouseFilter] = useState<string>('');

    // Fetch inventory valuation
    const { data: valuation, isLoading } = useQuery({
        queryKey: ['inventory-valuation', warehouseFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (warehouseFilter) params.append('warehouse', warehouseFilter);

            const response = await api.get(`/reports/inventory-valuation/?${params}`);
            return response.data as InventoryValuation;
        }
    });

    const columns: ColumnDef<InventoryItem>[] = [
        {
            accessorKey: 'item_name',
            header: 'Item',
            cell: ({ row }) => (
                <div>
                    <div className="font-medium">{row.original.item_name}</div>
                    <div className="text-xs text-muted-foreground">{row.original.item_sku}</div>
                </div>
            )
        },
        {
            accessorKey: 'warehouse_name',
            header: 'Warehouse',
        },
        {
            accessorKey: 'total_quantity',
            header: 'Quantity',
            cell: ({ row }) => (
                <span className="font-mono">{row.original.total_quantity.toLocaleString()}</span>
            )
        },
        {
            accessorKey: 'batches_count',
            header: 'Batches',
            cell: ({ row }) => (
                <span className="text-muted-foreground">{row.original.batches_count}</span>
            )
        },
        {
            accessorKey: 'average_cost',
            header: 'Avg Cost',
            cell: ({ row }) => (
                <span className="font-mono">
                    {row.original.average_cost.toLocaleString()} сўм
                </span>
            )
        },
        {
            accessorKey: 'total_value',
            header: 'Total Value',
            cell: ({ row }) => (
                <span className="font-mono font-bold">
                    {row.original.total_value.toLocaleString()} сўм
                </span>
            )
        }
    ];

    const exportToExcel = () => {
        // Download Excel export
        window.open(`/api/reports/inventory-valuation/export/?warehouse=${warehouseFilter}`, '_blank');
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Inventory Valuation Report</h1>
                    <p className="text-muted-foreground">Оценка запасов - FIFO batch costing</p>
                </div>
                <Button onClick={exportToExcel} variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Export to Excel
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Items
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-8 w-16" />
                        ) : (
                            <p className="text-2xl font-bold">
                                {valuation?.summary.total_items || 0}
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Quantity
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-8 w-24" />
                        ) : (
                            <p className="text-2xl font-bold">
                                {valuation?.summary.total_quantity?.toLocaleString() || 0}
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Value
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-8 w-32" />
                        ) : (
                            <p className="text-2xl font-bold text-green-600">
                                {valuation?.summary.total_value?.toLocaleString() || 0} <span className="text-sm font-normal">сўм</span>
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Average Cost
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-8 w-28" />
                        ) : (
                            <p className="text-2xl font-bold">
                                {valuation?.summary.average_cost?.toLocaleString() || 0} <span className="text-sm font-normal">сўм</span>
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Inventory Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Inventory by Item</CardTitle>
                </CardHeader>
                <CardContent>
                    <DataTable
                        columns={columns}
                        data={valuation?.items || []}
                        isLoading={isLoading}
                    />
                </CardContent>
            </Card>

            {/* Explanation */}
            <Card className="bg-muted/50">
                <CardHeader>
                    <CardTitle className="text-base">About This Report</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                    <p>
                        This report shows the total value of inventory using <strong>FIFO (First-In, First-Out)</strong> batch costing.
                    </p>
                    <p>
                        <strong>Average Cost</strong> is calculated from all remaining batches for each item.
                        <strong>Total Value</strong> is the sum of (quantity × unit cost) for all batches.
                    </p>
                    <p className="text-green-600 font-medium">
                        ✓ This is the REAL inventory value based on actual purchase costs, not estimates!
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
