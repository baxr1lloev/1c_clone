'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Filter } from 'lucide-react';

interface StockBalanceItem {
    item_id: number;
    item_name: string;
    item_code: string;
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

    const { data: reportData, isLoading } = useQuery({
        queryKey: ['stock-balance', date],
        queryFn: async () => {
            // Mock data for now if API missing
            // return api.get(...)
            return [
                { item_id: 1, item_name: 'iPhone 15 Pro', item_code: 'IP15P', unit: 'pcs', warehouse_name: 'Main Warehouse', opening_qty: 10, incoming_qty: 5, outgoing_qty: 2, closing_qty: 13 },
                { item_id: 2, item_name: 'Samsung S24', item_code: 'S24', unit: 'pcs', warehouse_name: 'Main Warehouse', opening_qty: 20, incoming_qty: 0, outgoing_qty: 5, closing_qty: 15 },
            ] as StockBalanceItem[];
        }
    });

    const columns: ColumnDef<StockBalanceItem>[] = [
        {
            accessorKey: 'item_name',
            header: 'Item',
            cell: ({ row }) => (
                <div>
                    <div className="font-bold">{row.original.item_name}</div>
                    <div className="text-xs text-muted-foreground">{row.original.item_code}</div>
                </div>
            )
        },
        { accessorKey: 'warehouse_name', header: 'Warehouse' },
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
            cell: ({ row }) => <span className="font-mono font-bold">{row.original.closing_qty}</span>
        },
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Ведомость по товарам на складах</h1>
                    <p className="text-muted-foreground">Stock Balance</p>
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
        </div>
    )
}
