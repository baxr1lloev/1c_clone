'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DataTable } from '@/components/data-table/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { AccountCardDialog } from './account-card-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AnalysisRow {
    group_id: number;
    group_name: string;
    opening_debit: number;
    opening_credit: number;
    turnover_debit: number;
    turnover_credit: number;
    closing_debit: number;
    closing_credit: number;
}

interface AccountAnalysisDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    accountId: number;
    accountCode: string;
    periodStart: string;
    periodEnd: string;
}

export function AccountAnalysisDialog({
    open,
    onOpenChange,
    accountId,
    accountCode,
    periodStart,
    periodEnd
}: AccountAnalysisDialogProps) {

    const [groupBy, setGroupBy] = useState('counterparty');
    const [selectedSubconto, setSelectedSubconto] = useState<{ id: number, name: string } | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['account-analysis', accountId, groupBy, periodStart, periodEnd],
        queryFn: async () => {
            if (!accountId || !open) return [];

            const params = new URLSearchParams({
                start_date: periodStart,
                end_date: periodEnd,
                group_by: groupBy
            });

            const res = await api.get(`/reports/account-analysis/${accountId}/?${params.toString()}`);
            return res.data as AnalysisRow[];
        },
        enabled: open && !!accountId
    });

    const columns: ColumnDef<AnalysisRow>[] = [
        {
            accessorKey: 'group_name',
            header: 'Subconto',
            cell: ({ row }) => (
                <span className="font-medium text-primary cursor-pointer hover:underline" onClick={() => setSelectedSubconto({
                    id: row.original.group_id,
                    name: row.original.group_name
                })}>
                    {row.original.group_name}
                </span>
            )
        },
        {
            header: 'Opening',
            columns: [
                {
                    accessorKey: 'opening_debit',
                    header: 'Dt',
                    cell: ({ row }) => row.original.opening_debit ? (
                        <span className="font-mono text-xs block text-right">{row.original.opening_debit.toLocaleString()}</span>
                    ) : null
                },
                {
                    accessorKey: 'opening_credit',
                    header: 'Ct',
                    cell: ({ row }) => row.original.opening_credit ? (
                        <span className="font-mono text-xs block text-right">{row.original.opening_credit.toLocaleString()}</span>
                    ) : null
                }
            ]
        },
        {
            header: 'Turnover',
            columns: [
                {
                    accessorKey: 'turnover_debit',
                    header: 'Dt',
                    cell: ({ row }) => row.original.turnover_debit ? (
                        <span className="font-mono text-xs block text-right">{row.original.turnover_debit.toLocaleString()}</span>
                    ) : null
                },
                {
                    accessorKey: 'turnover_credit',
                    header: 'Ct',
                    cell: ({ row }) => row.original.turnover_credit ? (
                        <span className="font-mono text-xs block text-right">{row.original.turnover_credit.toLocaleString()}</span>
                    ) : null
                }
            ]
        },
        {
            header: 'Closing',
            columns: [
                {
                    accessorKey: 'closing_debit',
                    header: 'Dt',
                    cell: ({ row }) => row.original.closing_debit ? (
                        <span className="font-mono text-xs block text-right font-bold">{row.original.closing_debit.toLocaleString()}</span>
                    ) : null
                },
                {
                    accessorKey: 'closing_credit',
                    header: 'Ct',
                    cell: ({ row }) => row.original.closing_credit ? (
                        <span className="font-mono text-xs block text-right font-bold">{row.original.closing_credit.toLocaleString()}</span>
                    ) : null
                }
            ]
        },
    ];

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[1000px] h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex justify-between items-center">
                            <span>Account Analysis: {accountCode}</span>
                            <div className="flex items-center gap-2 text-sm font-normal">
                                <span>Group by:</span>
                                <Select value={groupBy} onValueChange={setGroupBy}>
                                    <SelectTrigger className="w-[180px] h-8">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="counterparty">Counterparty</SelectItem>
                                        <SelectItem value="contract">Contract</SelectItem>
                                        <SelectItem value="item">Item</SelectItem>
                                        <SelectItem value="warehouse">Warehouse</SelectItem>
                                        <SelectItem value="employee">Employee</SelectItem>
                                        <SelectItem value="project">Project</SelectItem>
                                        <SelectItem value="department">Department</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </DialogTitle>
                        <DialogDescription>
                            {periodStart} - {periodEnd}
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

            {/* Nested Dialog for Drill-Down */}
            {selectedSubconto && (
                <AccountCardDialog
                    open={!!selectedSubconto}
                    onOpenChange={(open) => !open && setSelectedSubconto(null)}
                    accountId={accountId}
                    accountCode={accountCode}
                    subcontoId={selectedSubconto.id}
                    subcontoName={selectedSubconto.name}
                    periodStart={periodStart}
                    periodEnd={periodEnd}
                />
            )}
        </>
    );
}
