'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Filter } from 'lucide-react';
import { ReferenceLink } from '@/components/ui/reference-link';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { StockHistoryTable } from '@/components/reports/stock-history-table';

interface StockBalanceItem {
    item_id: number;
    item_name: string;
    item_sku: string;
    unit: string;
    warehouse_id: number;
    warehouse_name: string;
    opening_qty: number;
    incoming_qty: number;
    outgoing_qty: number;
    closing_qty: number;
}

export default function StockBalanceReportPage() {
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [selectedItemHistory, setSelectedItemHistory] = useState<{ item: any, warehouseId: number } | null>(null);

    const { data: reportData, isLoading } = useQuery({
        queryKey: ['stock-balance', date],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (date) params.append('date', date);
            const response = await api.get(`/registers/stock-balance/?${params.toString()}`);
            return response.data as StockBalanceItem[];
        }
    });

    const handleDrillDown = (item: StockBalanceItem) => {
        setSelectedItemHistory({
            item: item,
            warehouseId: item.warehouse_id
        });
    };

    const columns: ColumnDef<StockBalanceItem>[] = [
        {
            accessorKey: 'item_name',
            header: 'Item',
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <ReferenceLink
                        type="item"
                        id={row.original.item_id}
                        label={row.original.item_name}
                        className="font-bold"
                    />
                    <div className="text-xs text-muted-foreground">{row.original.item_sku}</div>
                </div>
            )
        },
        {
            accessorKey: 'warehouse_name',
            header: 'Warehouse',
            cell: ({ row }) => (
                <ReferenceLink
                    type="warehouse"
                    id={row.original.warehouse_id}
                    label={row.original.warehouse_name}
                />
            )
        },
        { accessorKey: 'unit', header: 'Unit' },
        {
            accessorKey: 'opening_qty',
            header: 'Opening',
            cell: ({ row }) => <span className="font-mono">{row.original.opening_qty}</span>
        },
        {
            accessorKey: 'incoming_qty',
            header: 'In',
            cell: ({ row }) => <span className="font-mono text-emerald-600">+{row.original.incoming_qty}</span>
        },
        {
            accessorKey: 'outgoing_qty',
            header: 'Out',
            cell: ({ row }) => <span className="font-mono text-rose-600">-{row.original.outgoing_qty}</span>
        },
        {
            accessorKey: 'closing_qty',
            header: 'Closing',
            cell: ({ row }) => (
                <Button
                    variant="link"
                    className="p-0 h-auto font-mono font-bold decoration-dashed underline-offset-4"
                    onClick={() => handleDrillDown(row.original)}
                >
                    {row.original.closing_qty}
                </Button>
            )
        },
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Ведомость по товарам на складах</h1>
                    <p className="text-muted-foreground">Stock Balance (Click on Balance for History)</p>
                </div>
                <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Excel</Button>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><Filter className="h-4 w-4" /> Report Date</CardTitle>
                </CardHeader>
                <CardContent>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border p-1 rounded" />
                </CardContent>
            </Card>

            <Card>
                <div className="p-0">
                    <DataTable columns={columns} data={reportData || []} isLoading={isLoading} />
                </div>
            </Card>

            {/* Drill-Down History Modal */}
            <Dialog open={!!selectedItemHistory} onOpenChange={(open) => !open && setSelectedItemHistory(null)}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Stock Movement History</DialogTitle>
                        <DialogDescription>
                            History for {selectedItemHistory?.item.item_name} at {selectedItemHistory?.item.warehouse_name} (Up to {date})
                        </DialogDescription>
                    </DialogHeader>
                    {selectedItemHistory && (
                        <StockHistoryTable
                            itemId={selectedItemHistory.item.item_id}
                            warehouseId={selectedItemHistory.warehouseId}
                            endDate={date}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
