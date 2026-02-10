'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { DrillDownModal } from '@/components/ui/drilldown-modal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AccountBalance {
    account_code: string;
    account_name: string;
    debit_balance: number;
    credit_balance: number;
}

export default function AccountBalancePage() {
    const [period, setPeriod] = useState('');
    const [drillDownOpen, setDrillDownOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

    const { data: balancesData, isLoading } = useQuery({
        queryKey: ['account-balances', period],
        queryFn: async () => {
            const params = period ? `?period=${period}` : '';
            const response = await api.get(`/api/balances/accounts/${params}`);
            return response.data;
        },
    });

    const handleDrillDown = (accountCode: string) => {
        setSelectedAccount(accountCode);
        setDrillDownOpen(true);
    };

    const columns: ColumnDef<AccountBalance>[] = [
        {
            accessorKey: 'account_code',
            header: 'Account',
            cell: ({ row }) => (
                <div>
                    <div className="font-medium">{row.original.account_code}</div>
                    <div className="text-sm text-muted-foreground">
                        {row.original.account_name}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: 'debit_balance',
            header: 'Debit Balance',
            cell: ({ row }) => (
                <Button
                    variant="link"
                    className="p-0 h-auto font-normal"
                    onClick={() => handleDrillDown(row.original.account_code)}
                >
                    ${row.original.debit_balance.toFixed(2)}
                </Button>
            ),
        },
        {
            accessorKey: 'credit_balance',
            header: 'Credit Balance',
            cell: ({ row }) => (
                <Button
                    variant="link"
                    className="p-0 h-auto font-normal"
                    onClick={() => handleDrillDown(row.original.account_code)}
                >
                    ${row.original.credit_balance.toFixed(2)}
                </Button>
            ),
        },
    ];

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Account Balances</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Period Selection</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="w-64">
                        <Label>Period</Label>
                        <Input
                            type="month"
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Balances by Account</CardTitle>
                </CardHeader>
                <CardContent>
                    <DataTable
                        columns={columns}
                        data={balancesData?.balances || []}
                        isLoading={isLoading}
                    />
                </CardContent>
            </Card>

            {selectedAccount && (
                <DrillDownModal
                    title={`Journal Entries for Account ${selectedAccount}`}
                    endpoint={`/api/balances/accounts/drilldown/?account=${selectedAccount}&period=${period}`}
                    isOpen={drillDownOpen}
                    onClose={() => setDrillDownOpen(false)}
                />
            )}
        </div>
    );
}
