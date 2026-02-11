'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/data-table/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { PiPrinterBold, PiFilePdfBold, PiArrowLeftBold } from 'react-icons/pi';
import { ReferenceLink } from '@/components/ui/reference-link';

interface AccountCardEntry {
    id: number;
    date: string;
    document_id: number;
    document_type: string;
    document_number: string;
    description: string; // Analytics content
    debit: number;
    credit: number;
    balance: number; // Running balance
}

// 1C "Account Card" (Карточка счета)
export default function AccountCardPage() {
    const searchParams = useSearchParams();
    const router = useRouter();

    // Params
    const accountId = searchParams.get('account_id') || '';
    const accountCode = searchParams.get('code') || '';
    const [startDate, setStartDate] = useState(searchParams.get('from') || new Date().toISOString().slice(0, 10));
    const [endDate, setEndDate] = useState(searchParams.get('to') || new Date().toISOString().slice(0, 10));

    // Data Fetching
    const { data, isLoading } = useQuery({
        queryKey: ['account-card', accountId, startDate, endDate],
        queryFn: async () => {
            if (!accountId) return [];
            // Mock API or Real API
            // Needs a dedicated endpoint that returns chronological entries with running balance
            const res = await api.get(`/reports/account-card/?account=${accountId}&start=${startDate}&end=${endDate}`);
            return res.data as AccountCardEntry[];
        },
        enabled: !!accountId
    });

    const columns: ColumnDef<AccountCardEntry>[] = [
        {
            accessorKey: 'date',
            header: 'Date',
            cell: ({ row }) => <span className="font-mono text-xs">{new Date(row.original.date).toLocaleDateString()}</span>
        },
        {
            accessorKey: 'document',
            header: 'Document',
            cell: ({ row }) => (
                <ReferenceLink
                    type={row.original.document_type}
                    id={row.original.document_id}
                    label={`${row.original.document_type} ${row.original.document_number}`}
                    className="text-primary font-medium hover:underline text-xs"
                />
            )
        },
        {
            accessorKey: 'description',
            header: 'Description / Analytics',
            cell: ({ row }) => (
                <span className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {row.original.description}
                </span>
            )
        },
        {
            accessorKey: 'debit',
            header: 'Debit',
            cell: ({ row }) => row.original.debit ? (
                <span className="font-mono text-xs block text-right">{row.original.debit.toLocaleString()}</span>
            ) : null
        },
        {
            accessorKey: 'credit',
            header: 'Credit',
            cell: ({ row }) => row.original.credit ? (
                <span className="font-mono text-xs block text-right">{row.original.credit.toLocaleString()}</span>
            ) : null
        },
        {
            accessorKey: 'balance',
            header: 'Balance',
            cell: ({ row }) => (
                <span className="font-mono text-xs font-bold block text-right">
                    {row.original.balance.toLocaleString()}
                </span>
            )
        }
    ];

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="outline" size="icon" onClick={() => router.back()}>
                    <PiArrowLeftBold />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        Account Card: {accountCode}
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Period: {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
                    </p>
                </div>
                <div className="ml-auto flex gap-2">
                    <Button variant="outline"><PiPrinterBold className="mr-2" /> Print</Button>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-4 p-4 bg-muted/20 border rounded-lg">
                <div className="space-y-1">
                    <Label>From</Label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-background" />
                </div>
                <div className="space-y-1">
                    <Label>To</Label>
                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-background" />
                </div>
                <div className="col-span-2 flex items-end">
                    <Button onClick={() => {/* Refetch */ }}>Generate</Button>
                </div>
            </div>

            <Card>
                <div className="p-0">
                    <DataTable
                        columns={columns}
                        data={data || []}
                        isLoading={isLoading}
                    />
                </div>
            </Card>
        </div>
    )
}
