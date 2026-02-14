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

interface SettlementBalanceRow {
    counterparty: number;
    counterparty_name: string;
    contract: number;
    contract_number: string;
    currency_code: string;
    amount: number;
}

interface SettlementBalance {
    counterparty_id: number;
    counterparty_name: string;
    contract_id: number;
    contract_number: string;
    currency: string;
    amount: number;
}

export default function SettlementBalancePage() {
    const [drillDownOpen, setDrillDownOpen] = useState(false);
    const [selectedBalance, setSelectedBalance] = useState<SettlementBalance | null>(null);

    const { data: balancesData, isLoading } = useQuery({
        queryKey: ['settlement-balances'],
        queryFn: async () => {
            const response = await api.get('/registers/settlements/') as { results?: SettlementBalanceRow[] } | SettlementBalanceRow[];
            const list = Array.isArray(response) ? response : (response.results ?? []);
            return { balances: list.map((r: SettlementBalanceRow) => ({
                counterparty_id: r.counterparty,
                counterparty_name: r.counterparty_name,
                contract_id: r.contract,
                contract_number: r.contract_number,
                currency: r.currency_code,
                amount: Number(r.amount ?? 0),
            })) };
        },
    });

    const columns: ColumnDef<SettlementBalance>[] = [
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
            accessorKey: 'contract_number',
            header: 'Contract',
        },
        {
            accessorKey: 'currency',
            header: 'Currency',
        },
        {
            accessorKey: 'amount',
            header: 'Balance',
            cell: ({ row }) => {
                const amount = row.original.amount;
                return (
                    <span className={amount > 0 ? 'text-green-600' : amount < 0 ? 'text-red-600' : ''}>
                        ${amount.toFixed(2)}
                    </span>
                );
            },
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        setSelectedBalance(row.original);
                        setDrillDownOpen(true);
                    }}
                >
                    Show Movements
                </Button>
            ),
        },
    ];

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Settlement Balance</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Current Settlement Balances</CardTitle>
                </CardHeader>
                <CardContent>
                    <DataTable
                        columns={columns}
                        data={balancesData?.balances || []}
                        isLoading={isLoading}
                    />
                </CardContent>
            </Card>

            {selectedBalance && (
                <DrillDownModal
                    title={`Movements: ${selectedBalance.counterparty_name}`}
                    endpoint={`/reports/settlement-history/?counterparty=${selectedBalance.counterparty_id}&contract=${selectedBalance.contract_id}`}
                    isOpen={drillDownOpen}
                    onClose={() => setDrillDownOpen(false)}
                />
            )}
        </div>
    );
}
