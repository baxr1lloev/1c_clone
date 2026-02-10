'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Filter } from 'lucide-react';

interface PLItem {
    id: number;
    name: string;
    level: number; // For indentation
    amount: number;
    type: 'income' | 'expense' | 'total';
}

export default function ProfitLossPage() {
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
    const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

    // Mock Data for 1C Style P&L
    const { data: reportData, isLoading } = useQuery({
        queryKey: ['profit-loss', startDate, endDate],
        queryFn: async () => {
            return [
                { id: 1, name: 'Выручка от продаж (Revenue)', level: 0, amount: 150000, type: 'income' },
                { id: 2, name: 'Себестоимость продаж (COGS)', level: 0, amount: -80000, type: 'expense' },
                { id: 3, name: 'Валовая прибыль (Gross Profit)', level: 0, amount: 70000, type: 'total' },
                { id: 4, name: 'Операционные расходы', level: 0, amount: -20000, type: 'expense' },
                { id: 5, name: 'Аренда', level: 1, amount: -5000, type: 'expense' },
                { id: 6, name: 'Зарплата', level: 1, amount: -15000, type: 'expense' },
                { id: 7, name: 'Чистая прибыль (Net Income)', level: 0, amount: 50000, type: 'total' },
            ] as PLItem[];
        }
    });

    const columns: ColumnDef<PLItem>[] = [
        {
            accessorKey: 'name',
            header: 'Indicator',
            cell: ({ row }) => (
                <div style={{ paddingLeft: `${row.original.level * 20}px` }} className={row.original.type === 'total' ? 'font-bold' : ''}>
                    {row.original.name}
                </div>
            )
        },
        {
            accessorKey: 'amount',
            header: 'Amount',
            cell: ({ row }) => (
                <div className={`font-mono text-right ${row.original.type === 'total' ? 'font-bold border-t border-black' : ''} ${row.original.amount < 0 ? 'text-red-600' : ''}`}>
                    {row.original.amount.toLocaleString()}
                </div>
            )
        }
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Отчет о прибылях и убытках</h1>
                    <p className="text-muted-foreground">Profit & Loss (P&L)</p>
                </div>
                <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Excel</Button>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><Filter className="h-4 w-4" /> Period</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-4">
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border p-1 rounded" />
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border p-1 rounded" />
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
