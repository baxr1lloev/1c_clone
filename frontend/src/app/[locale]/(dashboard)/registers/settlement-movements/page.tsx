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

interface SettlementMovement {
    id: number;
    date: string;
    counterparty_id: number;
    counterparty_name: string;
    amount: number;
    currency: string;
    document_type: string;
    document_id: number;
    document_number: string;
}

export default function SettlementMovementsPage() {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const { data: movementsData, isLoading } = useQuery({
        queryKey: ['settlement-movements', startDate, endDate],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (startDate) params.append('date_after', startDate);
            if (endDate) params.append('date_before', endDate);
            const response = await api.get(`/api/registers/settlement-movements/?${params.toString()}`);
            return response.data;
        },
    });

    const columns: ColumnDef<SettlementMovement>[] = [
        {
            accessorKey: 'date',
            header: 'Date',
            cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
        },
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
            accessorKey: 'document_number',
            header: 'Document',
            cell: ({ row }) => (
                <LinkableCell
                    id={row.original.document_id}
                    type={row.original.document_type as any}
                    label={row.original.document_number}
                />
            ),
        },
        {
            accessorKey: 'amount',
            header: 'Amount',
            cell: ({ row }) => {
                const amount = row.original.amount;
                return (
                    <span className={amount > 0 ? 'text-green-600' : 'text-red-600'}>
                        {amount > 0 ? '+' : ''}{amount.toFixed(2)} {row.original.currency}
                    </span>
                );
            },
        },
    ];

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Settlement Movements Register</h1>
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
