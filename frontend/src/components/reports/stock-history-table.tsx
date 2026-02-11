'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { DrillDownCell } from '@/components/ui/drill-down-cell';
import { format } from 'date-fns';

interface StockHistoryTableProps {
    itemId: string | number;
    warehouseId: string | number;
    endDate: string;
    startDate?: string;
}

export function StockHistoryTable({ itemId, warehouseId, endDate, startDate = '2020-01-01' }: StockHistoryTableProps) {
    const { data, isLoading } = useQuery({
        queryKey: ['stock-history', itemId, warehouseId, endDate, startDate],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (itemId) params.append('item', itemId.toString());
            if (warehouseId) params.append('warehouse', warehouseId.toString());
            if (endDate) params.append('end', endDate);
            if (startDate) params.append('start', startDate);
            return api.get(`/reports/stock-history/?${params.toString()}`);
        },
    });

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }

    if (!data?.movements || data.movements.length === 0) {
        return <div className="p-4 text-center text-muted-foreground">No movements found for this period.</div>;
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead className="text-right">Running Balance</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.movements.map((m: any) => (
                    <TableRow key={m.id}>
                        <TableCell className="font-mono text-xs">
                            {format(new Date(m.date), 'yyyy-MM-dd HH:mm')}
                        </TableCell>
                        <TableCell>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${m.type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {m.type}
                            </span>
                        </TableCell>
                        <TableCell>
                            <DrillDownCell
                                value={`${m.document_type} #${m.document_number}`}
                                steps={[{ label: 'Open Document', url: m.document_url }]}
                            />
                        </TableCell>
                        <TableCell className={`text-right font-mono ${m.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {m.quantity > 0 ? '+' : ''}{m.quantity}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold">
                            {m.running_balance}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
