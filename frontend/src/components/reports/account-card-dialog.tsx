'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DataTable } from '@/components/data-table/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { ReferenceLink } from '@/components/ui/reference-link';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface AccountCardEntry {
    id: number;
    date: string;
    document_id: number;
    document_type: string;
    document_number: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
}

interface AccountCardDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    accountId: number;
    accountCode: string;
    subcontoId?: number | string; // e.g. Counterparty ID
    subcontoName?: string;
    periodStart: string;
    periodEnd: string;
}

export function AccountCardDialog({
    open,
    onOpenChange,
    accountId,
    accountCode,
    subcontoId,
    subcontoName,
    periodStart,
    periodEnd
}: AccountCardDialogProps) {

    const { data, isLoading } = useQuery({
        queryKey: ['account-card', accountId, subcontoId, periodStart, periodEnd],
        queryFn: async () => {
            if (!accountId || !open) return [];

            // Build query params
            const params = new URLSearchParams({
                account: accountId.toString(),
                start_date: periodStart,
                end_date: periodEnd
            });

            if (subcontoId) {
                // Determine subconto type based on account? 
                // For now, assume generic 'subconto' param or specific 'counterparty' if known
                // But the backend AccountCardView might expect specific params.
                // Let's assume standard filters for now.
                params.append('counterparty', subcontoId.toString());
                // TODO: Make this dynamic based on Account Type (Warehouse/Item etc)
            }

            const res = await api.get(`/reports/account-card/?${params.toString()}`);
            return res.data as AccountCardEntry[];
        },
        enabled: open && !!accountId
    });

    const columns: ColumnDef<AccountCardEntry>[] = [
        {
            accessorKey: 'date',
            header: 'Date',
            cell: ({ row }) => <span className="font-mono text-xs">{format(new Date(row.original.date), 'dd.MM.yyyy')}</span>
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
            header: 'Analytics',
            cell: ({ row }) => (
                <span className="text-xs text-muted-foreground whitespace-pre-wrap max-w-[200px] block truncate" title={row.original.description}>
                    {row.original.description}
                </span>
            )
        },
        {
            accessorKey: 'debit',
            header: 'Debit',
            cell: ({ row }) => row.original.debit ? (
                <span className="font-mono text-xs block text-right text-blue-600">{row.original.debit.toLocaleString()}</span>
            ) : null
        },
        {
            accessorKey: 'credit',
            header: 'Credit',
            cell: ({ row }) => row.original.credit ? (
                <span className="font-mono text-xs block text-right text-red-600">{row.original.credit.toLocaleString()}</span>
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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[900px] h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Account Card: {accountCode}</DialogTitle>
                    <DialogDescription>
                        {periodStart} - {periodEnd}
                        {subcontoName && <span className="block font-medium text-primary mt-1">Filter: {subcontoName}</span>}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-auto min-h-0 border rounded-md">
                    <DataTable
                        columns={columns}
                        data={data || []}
                        isLoading={isLoading}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
