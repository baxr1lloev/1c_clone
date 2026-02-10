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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SalesReportRow {
    counterparty_id: number;
    counterparty_name: string;
    total_sales: number;
    total_quantity: number;
    document_count: number;
}

export default function SalesReportPage() {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [drillDownOpen, setDrillDownOpen] = useState(false);
    const [selectedCounterparty, setSelectedCounterparty] = useState<number | null>(null);

    const { data: reportData, isLoading } = useQuery({
        queryKey: ['sales-report', startDate, endDate],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);
            const response = await api.get(`/api/reports/sales/?${params.toString()}`);
            return response.data;
        },
    });

    const handleDrillDown = (counterpartyId: number) => {
        setSelectedCounterparty(counterpartyId);
        setDrillDownOpen(true);
    };

    const columns: ColumnDef<SalesReportRow>[] = [
        {
            accessorKey: 'counterparty_name',
            header: 'Counterparty',
            cell: ({ row }) => (
                <LinkableCell
                    id={row.original.counterparty_id}
                    type="counterparty"
                    label={row.original.counterparty_name}
                />
            ),
        },
        {
            accessorKey: 'document_count',
            header: 'Documents',
            cell: ({ row }) => (
                <Button
                    variant="link"
                    className="p-0 h-auto font-normal"
                    onClick={() => handleDrillDown(row.original.counterparty_id)}
                >
                    {row.original.document_count}
                </Button>
            ),
        },
        {
            accessorKey: 'total_quantity',
            header: 'Total Quantity',
            cell: ({ row }) => row.original.total_quantity.toFixed(3),
        },
        {
            accessorKey: 'total_sales',
            header: 'Total Sales',
            cell: ({ row }) => (
                <Button
                    variant="link"
                    className="p-0 h-auto font-normal"
                    onClick={() => handleDrillDown(row.original.counterparty_id)}
                >
                    ${row.original.total_sales.toFixed(2)}
                </Button>
            ),
        },
    ];

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Sales Report</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Period Selection</CardTitle>
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
                    <CardTitle>Sales by Counterparty</CardTitle>
                </CardHeader>
                <CardContent>
                    <DataTable
                        columns={columns}
                        data={reportData?.rows || []}
                        isLoading={isLoading}
                    />
                </CardContent>
            </Card>

            {selectedCounterparty && (
                <DrillDownModal
                    title="Sales Documents"
                    endpoint={`/api/reports/sales/drilldown/?counterparty=${selectedCounterparty}&start_date=${startDate}&end_date=${endDate}`}
                    isOpen={drillDownOpen}
                    onClose={() => setDrillDownOpen(false)}
                />
            )}
        </div>
    );
}
