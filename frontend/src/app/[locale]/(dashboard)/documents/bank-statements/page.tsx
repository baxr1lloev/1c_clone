'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PiBankBold, PiPlusBold, PiUploadBold, PiFileCsvBold } from 'react-icons/pi';
import { DataTable } from '@/components/data-table/data-table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BankStatementService, BankStatement } from '@/services/bank-statement-service';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function BankStatementsPage() {
    const t = useTranslations('documents');
    const [open, setOpen] = useState(false);
    const [openCreate, setOpenCreate] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [bankAccount, setBankAccount] = useState('');
    const [statementDate, setStatementDate] = useState('');
    const [openingBalance, setOpeningBalance] = useState('0');
    const queryClient = useQueryClient();

    // Fetch Bank Statements
    const { data: statements, isLoading } = useQuery({
        queryKey: ['bank-statements'],
        queryFn: BankStatementService.getAll
    });

    // Fetch Bank Accounts (Simple fetch)
    const { data: bankAccounts } = useQuery({
        queryKey: ['bank-accounts'],
        queryFn: async () => {
            const res = await api.get('/directories/bank-accounts/');
            // Handle paginated response structure if needed, assuming list for now or check structure
            // Usually paginated: { results: [] }
            return res.results || res.data;
        }
    });

    // Create Mutation
    const createMutation = useMutation({
        mutationFn: async () => {
            if (!bankAccount || !statementDate) throw new Error('Missing fields');
            return await BankStatementService.create({
                bank_account: Number(bankAccount),
                statement_date: statementDate,
                opening_balance: openingBalance,
            });
        },
        onSuccess: (data) => {
            toast.success('Выписка успешно создана');
            setOpenCreate(false);
            setBankAccount('');
            setStatementDate('');
            setOpeningBalance('0');
            queryClient.invalidateQueries({ queryKey: ['bank-statements'] });
            // Redirect to detail page
            window.location.href = `/ru/documents/bank-statements/${data.id}`;
        },
        onError: (error: any) => {
            toast.error(`Ошибка создания: ${error.response?.data?.error || error.message}`);
        }
    });

    // Upload Mutation
    const uploadMutation = useMutation({
        mutationFn: async () => {
            if (!file || !bankAccount || !statementDate) throw new Error('Missing fields');
            return await BankStatementService.upload(file, bankAccount, statementDate, openingBalance);
        },
        onSuccess: () => {
            toast.success('Выписка успешно загружена');
            setOpen(false);
            setFile(null);
            setBankAccount('');
            setStatementDate('');
            setOpeningBalance('0');
            queryClient.invalidateQueries({ queryKey: ['bank-statements'] });
        },
        onError: (error: any) => {
            toast.error(`Ошибка загрузки: ${error.response?.data?.error || error.message}`);
        }
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleCreate = () => {
        if (!bankAccount || !statementDate) {
            toast.error('Пожалуйста, заполните все обязательные поля');
            return;
        }
        createMutation.mutate();
    };

    const handleUpload = () => {
        if (!file || !bankAccount || !statementDate) {
            toast.error('Пожалуйста, заполните все поля');
            return;
        }
        uploadMutation.mutate();
    };

    const columns = [
        {
            accessorKey: 'number',
            header: 'Номер',
            cell: ({ row }: any) => (
                <Link href={`/ru/documents/bank-statements/${row.original.id}`} className="font-medium text-primary hover:underline">
                    {row.original.number}
                </Link>
            ),
        },
        {
            accessorKey: 'statement_date',
            header: 'Дата выписки',
        },
        {
            accessorKey: 'bank_account_name',
            header: 'Счет',
            cell: ({ row }: any) => (
                <div className="flex flex-col">
                    <span>{row.original.bank_account_name}</span>
                    <span className="text-xs text-muted-foreground">{row.original.bank_account_number}</span>
                </div>
            )
        },
        {
            accessorKey: 'opening_balance',
            header: 'Вх. остаток',
            cell: ({ row }: any) => row.original.opening_balance ? Number(row.original.opening_balance).toFixed(2) : '0.00'
        },
        {
            accessorKey: 'total_receipts',
            header: 'Поступление',
            cell: ({ row }: any) => (
                <span className="text-green-600 font-medium">
                    {row.original.total_receipts ? `+${Number(row.original.total_receipts).toFixed(2)}` : '0.00'}
                </span>
            )
        },
        {
            accessorKey: 'total_payments',
            header: 'Списание',
            cell: ({ row }: any) => (
                <span className="text-red-600 font-medium">
                    {row.original.total_payments ? `-${Number(row.original.total_payments).toFixed(2)}` : '0.00'}
                </span>
            )
        },
        {
            accessorKey: 'closing_balance',
            header: 'Исх. остаток',
            cell: ({ row }: any) => row.original.closing_balance ? Number(row.original.closing_balance).toFixed(2) : '0.00'
        },
        {
            accessorKey: 'status',
            header: 'Статус',
            cell: ({ row }: any) => {
                const status = row.original.status;
                const statusMap: Record<string, { label: string, color: string, emoji: string }> = {
                    'draft': { label: 'Черновик', color: 'bg-yellow-100 text-yellow-800', emoji: '🟡' },
                    'processing': { label: 'Обработка', color: 'bg-blue-100 text-blue-800', emoji: '🔵' },
                    'posted': { label: 'Проведён', color: 'bg-green-100 text-green-800', emoji: '🟢' },
                };
                const config = statusMap[status] || { label: status, color: 'bg-gray-100', emoji: '⚪' };

                return (
                    <Badge variant="outline" className={`${config.color} border-0`}>
                        {config.emoji} {config.label}
                    </Badge>
                );
            }
        },
        {
            accessorKey: 'matching_percentage',
            header: 'Сопоставление',
            cell: ({ row }: any) => {
                const percentage = row.original.matching_percentage || 0;
                const matches = row.original.matched_count || 0;
                const total = row.original.lines_count || 0;

                let colorClass = "text-red-500";
                if (percentage >= 100) colorClass = "text-green-600";
                else if (percentage >= 50) colorClass = "text-yellow-600";

                return (
                    <div className="flex flex-col items-center">
                        <span className={`font-bold ${colorClass}`}>{percentage}%</span>
                        <span className="text-xs text-muted-foreground">{matches} / {total}</span>
                    </div>
                );
            }
        }
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Банковские выписки</h1>
                    <p className="text-muted-foreground">Загрузка и обработка выписок из банк-клиента</p>
                </div>
                <div className="flex gap-2">
                    <Dialog open={openCreate} onOpenChange={setOpenCreate}>
                        <DialogTrigger asChild>
                            <Button className="gap-2" variant="default" suppressHydrationWarning>
                                <PiPlusBold className="h-4 w-4" />
                                Создать выписку
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>Создание банковской выписки</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="create-bank-account">Банковский счет *</Label>
                                    <Select value={bankAccount} onValueChange={setBankAccount}>
                                        <SelectTrigger id="create-bank-account">
                                            <SelectValue placeholder="Выберите счет" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {bankAccounts && bankAccounts.map((acc: any) => (
                                                <SelectItem key={acc.id} value={String(acc.id)}>
                                                    {acc.bank_name} - {acc.currency?.code} ({acc.account_number})
                                                </SelectItem>
                                            ))}
                                            {!bankAccounts && <SelectItem value="loading" disabled>Загрузка...</SelectItem>}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="create-date">Дата выписки *</Label>
                                        <Input
                                            id="create-date"
                                            type="date"
                                            value={statementDate}
                                            onChange={(e) => setStatementDate(e.target.value)}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="create-balance">Вх. остаток</Label>
                                        <Input
                                            id="create-balance"
                                            type="number"
                                            step="0.01"
                                            value={openingBalance}
                                            onChange={(e) => setOpeningBalance(e.target.value)}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setOpenCreate(false)}>Отмена</Button>
                                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                                    {createMutation.isPending ? 'Создание...' : 'Создать'}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2" variant="outline" suppressHydrationWarning>
                                <PiUploadBold className="h-4 w-4" />
                                Загрузить выписку
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>Загрузка выписки</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="bank-account">Банковский счет</Label>
                                    <Select value={bankAccount} onValueChange={setBankAccount}>
                                        <SelectTrigger id="bank-account">
                                            <SelectValue placeholder="Выберите счет" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {bankAccounts && bankAccounts.map((acc: any) => (
                                                <SelectItem key={acc.id} value={String(acc.id)}>
                                                    {acc.bank_name} - {acc.currency?.code} ({acc.account_number})
                                                </SelectItem>
                                            ))}
                                            {!bankAccounts && <SelectItem value="loading" disabled>Загрузка...</SelectItem>}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="date">Дата выписки</Label>
                                        <Input
                                            id="date"
                                            type="date"
                                            value={statementDate}
                                            onChange={(e) => setStatementDate(e.target.value)}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="balance">Вх. остаток</Label>
                                        <Input
                                            id="balance"
                                            type="number"
                                            step="0.01"
                                            value={openingBalance}
                                            onChange={(e) => setOpeningBalance(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="file">Файл выписки (CSV, 1C)</Label>
                                    <div className="flex items-center justify-center w-full">
                                        <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                <PiFileCsvBold className="w-8 h-8 mb-2 text-gray-500" />
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    {file ? file.name : <span className="font-semibold">Нажмите для выбора файла</span>}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">CSV, TXT, XLS</p>
                                            </div>
                                            <input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} accept=".csv,.txt,.xls,.xlsx" />
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
                                <Button onClick={handleUpload} disabled={uploadMutation.isPending}>
                                    {uploadMutation.isPending ? 'Загрузка...' : 'Загрузить'}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Card className="flex-1 border-0 shadow-none bg-transparent">
                <CardContent className="p-0">
                    <DataTable
                        columns={columns}
                        data={statements || []}
                        isLoading={isLoading}
                        searchColumn="number"
                        searchPlaceholder="Поиск по номеру..."
                    />
                </CardContent>
            </Card>
        </div>
    );
}

