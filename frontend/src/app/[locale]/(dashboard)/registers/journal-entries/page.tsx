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

interface JournalEntry {
    id: number;
    period: string;
    debit_account: string;
    debit_account_name: string;
    credit_account: string;
    credit_account_name: string;
    amount: number;
    description: string;
    document_type: string;
    document_id: number;
    document_number: string;
}

export default function JournalEntriesPage() {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const { data: entriesData, isLoading } = useQuery({
        queryKey: ['journal-entries', startDate, endDate],
        queryFn: async () => {
            try {
                const params = new URLSearchParams();
                if (startDate) params.append('period_after', startDate);
                if (endDate) params.append('period_before', endDate);
                const response = await api.get(`/api/accounting/journal-entries/?${params.toString()}`);
                return response?.data ?? response ?? [];
            } catch {
                return [];
            }
        },
    });

    const columns: ColumnDef<JournalEntry>[] = [
        {
            accessorKey: 'period',
            header: 'Period',
        },
        {
            accessorKey: 'debit_account',
            header: 'Debit',
            cell: ({ row }) => (
                <div>
                    <div className="font-medium">{row.original.debit_account}</div>
                    <div className="text-sm text-muted-foreground">
                        {row.original.debit_account_name}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: 'credit_account',
            header: 'Credit',
            cell: ({ row }) => (
                <div>
                    <div className="font-medium">{row.original.credit_account}</div>
                    <div className="text-sm text-muted-foreground">
                        {row.original.credit_account_name}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: 'amount',
            header: 'Amount',
            cell: ({ row }) => `$${row.original.amount.toFixed(2)}`,
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
            accessorKey: 'description',
            header: 'Description',
        },
    ];

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Journal Entries Register</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Start Period</Label>
                            <Input
                                type="month"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>End Period</Label>
                            <Input
                                type="month"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Journal Entries</CardTitle>
                </CardHeader>
                <CardContent>
                    <DataTable
                        columns={columns}
                        data={entriesData?.results || []}
                        isLoading={isLoading}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
