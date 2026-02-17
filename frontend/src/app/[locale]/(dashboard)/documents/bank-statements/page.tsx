'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PiFileCsvBold, PiPlusBold, PiUploadBold } from 'react-icons/pi';

import { api } from '@/lib/api';
import { BankStatement, BankStatementService } from '@/services/bank-statement-service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/data-table/data-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function formatMoney(value: number | string, currencyCode?: string) {
    const amount = Number(value || 0);
    try {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: currencyCode || 'RUB',
        }).format(amount);
    } catch {
        return amount.toFixed(2);
    }
}

type BankAccountOption = {
    id: number;
    name?: string;
    bank_name?: string;
    account_number: string;
};

type RowCell<T> = { row: { original: T } };

function getErrorMessage(error: unknown, fallback: string) {
    const err = error as {
        response?: {
            data?: Record<string, string[] | string | undefined> | string;
        };
        message?: string;
    } | undefined;

    const responseData = err?.response?.data;
    if (typeof responseData === 'string' && responseData.trim()) return responseData;
    if (responseData && typeof responseData === 'object') {
        const detail = (responseData as { detail?: string; error?: string }).detail
            || (responseData as { detail?: string; error?: string }).error;
        if (typeof detail === 'string' && detail.trim()) return detail;
        const first = Object.values(responseData)[0];
        if (Array.isArray(first) && first[0]) return String(first[0]);
        if (typeof first === 'string' && first.trim()) return first;
    }
    return err?.message || fallback;
}

export default function BankStatementsPage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    const [openCreate, setOpenCreate] = useState(false);
    const [openUpload, setOpenUpload] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [bankAccount, setBankAccount] = useState('');
    const [statementDate, setStatementDate] = useState('');
    const [openingBalance, setOpeningBalance] = useState('');

    const { data: statements, isLoading } = useQuery({
        queryKey: ['bank-statements'],
        queryFn: BankStatementService.getAll,
    });

    const {
        data: bankAccounts = [],
        isLoading: isBankAccountsLoading,
        isFetching: isBankAccountsFetching,
        isError: isBankAccountsError,
        error: bankAccountsError,
        refetch: refetchBankAccounts,
    } = useQuery<BankAccountOption[]>({
        queryKey: ['bank-accounts', 'statement-form'],
        queryFn: async () => {
            const res = await api.get('/directories/bank-accounts/');
            if (Array.isArray(res)) return res;
            return res?.results || [];
        },
    });

    const {
        data: exchangeSettings = [],
        isLoading: isExchangeSettingsLoading,
        isFetching: isExchangeSettingsFetching,
        isError: isExchangeSettingsError,
        error: exchangeSettingsError,
        refetch: refetchExchangeSettings,
    } = useQuery<Array<{ id: number }>>({
        queryKey: ['bank-exchange-settings', 'statement-form'],
        queryFn: async () => {
            const res = await api.get('/directories/bank-exchange-settings/');
            if (Array.isArray(res)) return res;
            return res?.results || [];
        },
    });

    const { data: openingHint } = useQuery({
        queryKey: ['bank-statement-opening-hint', bankAccount, statementDate],
        queryFn: () => BankStatementService.suggestOpeningBalance(bankAccount, statementDate),
        enabled: Boolean(bankAccount && statementDate),
    });

    const bankAccountsReady = !isBankAccountsLoading && !isBankAccountsFetching && !isBankAccountsError;
    const exchangeSettingsReady = !isExchangeSettingsLoading && !isExchangeSettingsFetching && !isExchangeSettingsError;
    const noBankAccounts = bankAccountsReady && bankAccounts.length === 0;
    const noExchangeSettings = exchangeSettingsReady && exchangeSettings.length === 0;

    const openingBalanceLocked = Boolean(openingHint?.opening_balance_locked);

    const resolveOpeningBalance = () => {
        if (openingBalanceLocked) {
            return String(openingHint?.opening_balance ?? '0');
        }
        if (openingBalance !== '') return openingBalance;
        return String(openingHint?.opening_balance ?? '0');
    };

    const resetForm = () => {
        setFile(null);
        setBankAccount('');
        setStatementDate('');
        setOpeningBalance('');
    };

    const validateBeforeSubmit = () => {
        if (isBankAccountsError) {
            toast.error(getErrorMessage(bankAccountsError, 'Failed to load bank accounts'));
            return false;
        }
        if (!bankAccountsReady) {
            toast.error('Bank accounts are still loading, please wait');
            return false;
        }
        if (noBankAccounts) {
            toast.error('Create a bank account first');
            router.push('/directories/bank-accounts');
            return false;
        }
        if (!bankAccount || !statementDate) {
            toast.error('Fill required fields');
            return false;
        }
        if (openingHint && !openingHint.can_create_for_date) {
            toast.error(`Cannot create statement before ${openingHint.latest_statement_date}`);
            return false;
        }
        return true;
    };

    const createMutation = useMutation({
        mutationFn: async () => {
            if (!validateBeforeSubmit()) throw new Error('Validation failed');
            return BankStatementService.create({
                bank_account: Number(bankAccount),
                statement_date: statementDate,
                opening_balance: resolveOpeningBalance(),
            });
        },
        onSuccess: (data) => {
            toast.success('Statement created');
            setOpenCreate(false);
            resetForm();
            queryClient.invalidateQueries({ queryKey: ['bank-statements'] });
            router.push(`/documents/bank-statements/${data.id}`);
        },
        onError: (error: unknown) => toast.error(getErrorMessage(error, 'Failed to create statement')),
    });

    const uploadMutation = useMutation({
        mutationFn: async () => {
            if (!file) throw new Error('Select file');
            if (!validateBeforeSubmit()) throw new Error('Validation failed');
            return BankStatementService.upload(file, bankAccount, statementDate, resolveOpeningBalance());
        },
        onSuccess: (data) => {
            toast.success('Statement uploaded');
            setOpenUpload(false);
            resetForm();
            queryClient.invalidateQueries({ queryKey: ['bank-statements'] });
            router.push(`/documents/bank-statements/${data.id}`);
        },
        onError: (error: unknown) => toast.error(getErrorMessage(error, 'Failed to upload statement')),
    });

    const columns = [
        {
            accessorKey: 'number',
            header: 'Number',
            cell: ({ row }: RowCell<BankStatement>) => (
                <Link href={`/ru/documents/bank-statements/${row.original.id}`} className="font-medium text-primary hover:underline">
                    {row.original.number}
                </Link>
            ),
        },
        { accessorKey: 'statement_date', header: 'Statement Date' },
        {
            accessorKey: 'source',
            header: 'Source',
            cell: ({ row }: RowCell<BankStatement>) => (
                row.original.source === 'imported'
                    ? <Badge variant="outline" className="border-0 bg-blue-100 text-blue-800">Imported</Badge>
                    : <Badge variant="outline" className="border-0 bg-slate-100 text-slate-800">Manual</Badge>
            ),
        },
        {
            accessorKey: 'bank_account_name',
            header: 'Account',
            cell: ({ row }: RowCell<BankStatement>) => (
                <div className="flex flex-col">
                    <span>{row.original.bank_account_name}</span>
                    <span className="text-xs text-muted-foreground">{row.original.bank_account_number}</span>
                </div>
            ),
        },
        {
            accessorKey: 'opening_balance',
            header: 'Opening',
            cell: ({ row }: RowCell<BankStatement>) => formatMoney(row.original.opening_balance, row.original.currency_code),
        },
        {
            accessorKey: 'total_receipts',
            header: 'Receipts',
            cell: ({ row }: RowCell<BankStatement>) => <span className="font-medium text-green-600">+{formatMoney(row.original.total_receipts, row.original.currency_code)}</span>,
        },
        {
            accessorKey: 'total_payments',
            header: 'Payments',
            cell: ({ row }: RowCell<BankStatement>) => <span className="font-medium text-red-600">-{formatMoney(row.original.total_payments, row.original.currency_code)}</span>,
        },
        {
            accessorKey: 'closing_balance',
            header: 'Closing',
            cell: ({ row }: RowCell<BankStatement>) => formatMoney(row.original.closing_balance, row.original.currency_code),
        },
        {
            accessorKey: 'accounting_balance_difference',
            header: 'Difference',
            cell: ({ row }: RowCell<BankStatement>) => {
                const diff = Number(row.original.accounting_balance_difference || 0);
                if (diff === 0) return <span className="text-green-600">0.00</span>;
                return (
                    <span className={diff > 0 ? 'text-red-600' : 'text-amber-600'}>
                        {diff > 0 ? '+' : '-'}{Math.abs(diff).toFixed(2)}
                    </span>
                );
            },
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }: RowCell<BankStatement>) => {
                const isBalanced = row.original.is_balanced !== false;
                const unmatched = row.original.unmatched_count ?? Math.max((row.original.lines_count || 0) - (row.original.matched_count || 0), 0);
                if (!isBalanced) return <Badge variant="outline" className="border-0 bg-red-100 text-red-800">Difference</Badge>;
                if (unmatched > 0) return <Badge variant="outline" className="border-0 bg-orange-100 text-orange-800">Unmatched</Badge>;
                if (row.original.status === 'posted') return <Badge variant="outline" className="border-0 bg-green-100 text-green-800">Posted</Badge>;
                if (row.original.status === 'processing') return <Badge variant="outline" className="border-0 bg-blue-100 text-blue-800">Processing</Badge>;
                return <Badge variant="outline" className="border-0 bg-slate-100 text-slate-800">Draft</Badge>;
            },
        },
        {
            accessorKey: 'matching_percentage',
            header: 'Matching',
            cell: ({ row }: RowCell<BankStatement>) => {
                const percentage = row.original.matching_percentage || 0;
                const matches = row.original.matched_count || 0;
                const total = row.original.lines_count || 0;
                return (
                    <div className="flex flex-col items-center">
                        <span className={`font-bold ${percentage >= 100 ? 'text-green-600' : percentage >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>{percentage}%</span>
                        <span className="text-xs text-muted-foreground">{matches} / {total}</span>
                    </div>
                );
            },
        },
    ];

    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col space-y-4 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Bank Statements</h1>
                    <p className="text-muted-foreground">Import and process statements from bank-client exchange</p>
                </div>
                <div className="flex gap-2">
                    <Button className="gap-2" variant="outline" onClick={() => router.push('/documents/payments/new?type=INCOMING')}>
                        <PiPlusBold className="h-4 w-4" />
                        New payment
                    </Button>

                    <Dialog
                        open={openCreate}
                        onOpenChange={(next) => {
                            if (next && isBankAccountsError) {
                                toast.error(getErrorMessage(bankAccountsError, 'Failed to load bank accounts'));
                                return;
                            }
                            if (next && noBankAccounts) {
                                toast.error('Create bank account first');
                                router.push('/directories/bank-accounts');
                                return;
                            }
                            if (next && !statementDate) {
                                setStatementDate(new Date().toISOString().slice(0, 10));
                            }
                            setOpenCreate(next);
                        }}
                    >
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <PiPlusBold className="h-4 w-4" />
                                Create statement
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[540px]">
                            <DialogHeader><DialogTitle>Create bank statement</DialogTitle></DialogHeader>
                            <div className="grid gap-4 py-2">
                                <div className="grid gap-2">
                                    <Label>Bank account *</Label>
                                    <Select value={bankAccount} onValueChange={(v) => { setBankAccount(v); setOpeningBalance(''); }}>
                                        <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                                        <SelectContent>
                                            {bankAccounts.map((acc) => (
                                                <SelectItem key={acc.id} value={String(acc.id)}>
                                                    {acc.name || acc.bank_name} ({acc.account_number})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Statement date *</Label>
                                        <Input type="date" value={statementDate} onChange={(e) => { setStatementDate(e.target.value); setOpeningBalance(''); }} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Opening balance</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={openingBalanceLocked ? String(openingHint?.opening_balance || '0') : openingBalance}
                                            onChange={(e) => setOpeningBalance(e.target.value)}
                                            disabled={openingBalanceLocked}
                                        />
                                    </div>
                                </div>
                                {openingHint ? (
                                    <div className="space-y-1 rounded-md border bg-muted/40 p-3 text-sm">
                                        {openingHint.previous_statement_date ? (
                                            <p>Previous statement: {openingHint.previous_statement_date}</p>
                                        ) : null}
                                        <p>Accounting balance: {Number(openingHint.accounting_balance || 0).toFixed(2)}</p>
                                        {openingHint.continuity_warning ? <p className="text-amber-600">{openingHint.continuity_warning}</p> : null}
                                        {!openingHint.can_create_for_date ? (
                                            <p className="text-red-600">Cannot create statement before {openingHint.latest_statement_date}</p>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancel</Button>
                                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                                    {createMutation.isPending ? 'Creating...' : 'Create'}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog
                        open={openUpload}
                        onOpenChange={(next) => {
                            if (next && isBankAccountsError) {
                                toast.error(getErrorMessage(bankAccountsError, 'Failed to load bank accounts'));
                                return;
                            }
                            if (next && noBankAccounts) {
                                toast.error('Create bank account first');
                                router.push('/directories/bank-accounts');
                                return;
                            }
                            if (next && !statementDate) {
                                setStatementDate(new Date().toISOString().slice(0, 10));
                            }
                            setOpenUpload(next);
                        }}
                    >
                        <DialogTrigger asChild>
                            <Button className="gap-2" variant="outline">
                                <PiUploadBold className="h-4 w-4" />
                                Upload statement
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[540px]">
                            <DialogHeader><DialogTitle>Upload statement</DialogTitle></DialogHeader>
                            <div className="grid gap-4 py-2">
                                <div className="grid gap-2">
                                    <Label>Bank account *</Label>
                                    <Select value={bankAccount} onValueChange={(v) => { setBankAccount(v); setOpeningBalance(''); }}>
                                        <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                                        <SelectContent>
                                            {bankAccounts.map((acc) => (
                                                <SelectItem key={acc.id} value={String(acc.id)}>
                                                    {acc.name || acc.bank_name} ({acc.account_number})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Statement date *</Label>
                                        <Input type="date" value={statementDate} onChange={(e) => { setStatementDate(e.target.value); setOpeningBalance(''); }} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Opening balance</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={openingBalanceLocked ? String(openingHint?.opening_balance || '0') : openingBalance}
                                            onChange={(e) => setOpeningBalance(e.target.value)}
                                            disabled={openingBalanceLocked}
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Statement file (CSV/TXT/XLS)</Label>
                                    <label className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-800">
                                        <PiFileCsvBold className="mb-2 h-8 w-8 text-gray-500" />
                                        <p className="text-sm text-gray-500">{file ? file.name : 'Click to choose file'}</p>
                                        <input
                                            type="file"
                                            className="hidden"
                                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                                            accept=".csv,.txt,.xls,.xlsx"
                                        />
                                    </label>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setOpenUpload(false)}>Cancel</Button>
                                <Button onClick={() => uploadMutation.mutate()} disabled={uploadMutation.isPending}>
                                    {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {(isBankAccountsError || isExchangeSettingsError) ? (
                <Card className="border-destructive/40 bg-destructive/10">
                    <CardHeader className="pb-2"><CardTitle className="text-base">Bank and Cash data failed to load</CardTitle></CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        {isBankAccountsError ? (
                            <p>Bank accounts: {getErrorMessage(bankAccountsError, 'Load failed')}</p>
                        ) : null}
                        {isExchangeSettingsError ? (
                            <p>Exchange settings: {getErrorMessage(exchangeSettingsError, 'Load failed')}</p>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={() => refetchBankAccounts()}>
                                Retry bank accounts
                            </Button>
                            <Button variant="outline" onClick={() => refetchExchangeSettings()}>
                                Retry exchange settings
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : null}

            {(noBankAccounts || noExchangeSettings) ? (
                <Card className="border-dashed">
                    <CardHeader className="pb-2"><CardTitle className="text-base">Setup before first statement</CardTitle></CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <p className="text-muted-foreground">For stable import flow, create bank account and exchange settings first.</p>
                        <div className="flex flex-wrap gap-2">
                            {noBankAccounts ? (
                                <Button onClick={() => router.push('/directories/bank-accounts')}>1. Create bank account</Button>
                            ) : null}
                            {noExchangeSettings ? (
                                <Button variant="outline" onClick={() => router.push('/directories/bank-exchange-settings')}>2. Configure exchange</Button>
                            ) : null}
                        </div>
                    </CardContent>
                </Card>
            ) : null}

            <Card className="flex-1 border-0 bg-transparent shadow-none">
                <CardContent className="p-0">
                    <DataTable
                        columns={columns}
                        data={statements || []}
                        isLoading={isLoading}
                        searchColumn="number"
                        searchPlaceholder="Search by number..."
                    />
                </CardContent>
            </Card>
        </div>
    );
}
