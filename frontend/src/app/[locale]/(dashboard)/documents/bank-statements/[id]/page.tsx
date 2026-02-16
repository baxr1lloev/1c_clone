'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PiBankBold, PiArrowLeftBold, PiCheckBold, PiXBold, PiPlusBold, PiPencilBold, PiTrashBold } from 'react-icons/pi';
import { DataTable } from '@/components/data-table/data-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BankStatementService, BankStatementLine } from '@/services/bank-statement-service';
import { toast } from 'sonner';

export default function BankStatementDetailPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const id = params.id as string;
    const [openLineDialog, setOpenLineDialog] = useState(false);
    const [editingLine, setEditingLine] = useState<BankStatementLine | null>(null);
    const [lineForm, setLineForm] = useState({
        transaction_date: '',
        description: '',
        counterparty_name: '',
        debit_amount: '',
        credit_amount: '',
    });

    const { data: statement, isLoading } = useQuery({
        queryKey: ['bank-statement', id],
        queryFn: () => BankStatementService.getById(id)
    });

    const postMutation = useMutation({
        mutationFn: () => BankStatementService.post(id),
        onSuccess: () => {
            toast.success('Выписка проведена');
            queryClient.invalidateQueries({ queryKey: ['bank-statement', id] });
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Ошибка проведения')
    });

    const unpostMutation = useMutation({
        mutationFn: () => BankStatementService.unpost(id),
        onSuccess: () => {
            toast.success('Проведение отменено');
            queryClient.invalidateQueries({ queryKey: ['bank-statement', id] });
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Ошибка отмены проведения')
    });

    const createLineMutation = useMutation({
        mutationFn: (data: any) => BankStatementService.createLine(id, data),
        onSuccess: () => {
            toast.success('Строка добавлена');
            setOpenLineDialog(false);
            resetLineForm();
            queryClient.invalidateQueries({ queryKey: ['bank-statement', id] });
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Ошибка добавления строки')
    });

    const updateLineMutation = useMutation({
        mutationFn: ({ lineId, data }: { lineId: number, data: any }) => 
            BankStatementService.updateLine(id, lineId, data),
        onSuccess: () => {
            toast.success('Строка обновлена');
            setOpenLineDialog(false);
            setEditingLine(null);
            resetLineForm();
            queryClient.invalidateQueries({ queryKey: ['bank-statement', id] });
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Ошибка обновления строки')
    });

    const deleteLineMutation = useMutation({
        mutationFn: (lineId: number) => BankStatementService.deleteLine(id, lineId),
        onSuccess: () => {
            toast.success('Строка удалена');
            queryClient.invalidateQueries({ queryKey: ['bank-statement', id] });
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Ошибка удаления строки')
    });

    const resetLineForm = () => {
        if (statement) {
            setLineForm({
                transaction_date: statement.statement_date,
                description: '',
                counterparty_name: '',
                debit_amount: '',
                credit_amount: '',
            });
        }
    };

    const openAddLineDialog = () => {
        setEditingLine(null);
        if (statement) {
            setLineForm({
                transaction_date: statement.statement_date,
                description: '',
                counterparty_name: '',
                debit_amount: '',
                credit_amount: '',
            });
        }
        setOpenLineDialog(true);
    };

    const openEditLineDialog = (line: BankStatementLine) => {
        setEditingLine(line);
        setLineForm({
            transaction_date: line.transaction_date,
            description: line.description || '',
            counterparty_name: line.counterparty_name || '',
            debit_amount: line.debit_amount || '',
            credit_amount: line.credit_amount || '',
        });
        setOpenLineDialog(true);
    };

    const handleSaveLine = () => {
        if (!lineForm.transaction_date || (!lineForm.debit_amount && !lineForm.credit_amount)) {
            toast.error('Заполните обязательные поля');
            return;
        }

        const data = {
            transaction_date: lineForm.transaction_date,
            description: lineForm.description,
            counterparty_name: lineForm.counterparty_name,
            debit_amount: lineForm.debit_amount || '0',
            credit_amount: lineForm.credit_amount || '0',
        };

        if (editingLine) {
            updateLineMutation.mutate({ lineId: editingLine.id, data });
        } else {
            createLineMutation.mutate(data);
        }
    };

    if (isLoading) return <div className="p-6">Загрузка...</div>;
    if (!statement) return <div className="p-6">Выписка не найдена</div>;

    const columns = [
        {
            accessorKey: 'transaction_date',
            header: 'Дата',
        },
        {
            accessorKey: 'description',
            header: 'Описание',
            cell: ({ row }: any) => {
                return (
                    <div className="max-w-md">
                        <p className="truncate" title={row.original.description}>{row.original.description}</p>
                    </div>
                );
            }
        },
        {
            accessorKey: 'counterparty_name',
            header: 'Контрагент',
            cell: ({ row }: any) => {
                const counterparty = row.original.counterparty_name;
                return counterparty ? (
                    <span>{counterparty}</span>
                ) : (
                    <span className="text-muted-foreground italic">Не определен</span>
                );
            }
        },
        {
            accessorKey: 'debit_amount',
            header: 'Поступление',
            cell: ({ row }: any) => {
                const amount = Number(row.original.debit_amount);
                return amount > 0 ? (
                    <span className="text-green-600 font-medium">
                        +{new Intl.NumberFormat('ru-RU', {
                            style: 'currency',
                            currency: 'USD'
                        }).format(amount)}
                    </span>
                ) : null;
            }
        },
        {
            accessorKey: 'credit_amount',
            header: 'Списание',
            cell: ({ row }: any) => {
                const amount = Number(row.original.credit_amount);
                return amount > 0 ? (
                    <span className="text-red-600 font-medium">
                        -{new Intl.NumberFormat('ru-RU', {
                            style: 'currency',
                            currency: 'USD'
                        }).format(amount)}
                    </span>
                ) : null;
            }
        },
        {
            accessorKey: 'balance',
            header: 'Остаток',
            cell: ({ row }: any) => {
                return new Intl.NumberFormat('ru-RU', {
                    style: 'currency',
                    currency: 'USD'
                }).format(Number(row.original.balance));
            }
        },
        {
            accessorKey: 'status',
            header: 'Статус',
            cell: ({ row }: any) => {
                const status = row.original.status;
                if (status === 'matched') {
                    return (
                        <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700">
                            <PiCheckBold className="h-3 w-3" /> Сопоставлено
                        </Badge>
                    );
                }
                return (
                    <Badge variant="secondary" className="gap-1 text-muted-foreground">
                        <PiXBold className="h-3 w-3" /> Не сопоставлено
                    </Badge>
                );
            }
        },
        ...(statement?.status === 'draft' ? [{
            id: 'actions',
            header: 'Действия',
            cell: ({ row }: any) => {
                const line = row.original;
                return (
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditLineDialog(line)}
                        >
                            <PiPencilBold className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                if (confirm('Удалить эту строку?')) {
                                    deleteLineMutation.mutate(line.id);
                                }
                            }}
                        >
                            <PiTrashBold className="h-4 w-4 text-red-600" />
                        </Button>
                    </div>
                );
            }
        }] : []),
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-4">
                    <Link href="/ru/documents/bank-statements">
                        <Button variant="ghost" size="icon">
                            <PiArrowLeftBold className="h-5 w-5" />
                        </Button>
                    </Link>
                    <PiBankBold className="h-8 w-8 text-primary" />
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold">Банковская выписка {statement.number}</h1>
                            <Badge variant="outline">{statement.status_display}</Badge>
                        </div>
                        <p className="text-muted-foreground">
                            {statement.statement_date} • {statement.bank_account_name} ({statement.bank_account_number})
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">
                        Сопоставить все
                    </Button>

                    {statement.can_post && (
                        <Button
                            onClick={() => postMutation.mutate()}
                            disabled={postMutation.isPending}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            <PiCheckBold className="mr-2" />
                            Провести
                        </Button>
                    )}

                    {statement.can_unpost && (
                        <Button
                            onClick={() => unpostMutation.mutate()}
                            disabled={unpostMutation.isPending}
                            variant="destructive"
                        >
                            <PiXBold className="mr-2" />
                            Отменить проведение
                        </Button>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Начальный остаток
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">
                            {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'USD' }).format(Number(statement.opening_balance))}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Поступления
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-green-600">
                            +{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'USD' }).format(Number(statement.total_receipts))}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Списания
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-red-600">
                            -{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'USD' }).format(Number(statement.total_payments))}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Конечный остаток
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">
                            {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'USD' }).format(Number(statement.closing_balance))}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Transactions Table */}
            <Card className="flex-1 border-0 shadow-none bg-transparent">
                <CardHeader className="px-0 pt-0 flex flex-row items-center justify-between">
                    <CardTitle>Операции ({statement.lines_count})</CardTitle>
                    {statement.status === 'draft' && (
                        <Dialog open={openLineDialog} onOpenChange={setOpenLineDialog}>
                            <DialogTrigger asChild>
                                <Button onClick={openAddLineDialog} className="gap-2">
                                    <PiPlusBold className="h-4 w-4" />
                                    Добавить строку
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px]">
                                <DialogHeader>
                                    <DialogTitle>
                                        {editingLine ? 'Редактировать строку' : 'Добавить строку'}
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="line-date">Дата операции *</Label>
                                        <Input
                                            id="line-date"
                                            type="date"
                                            value={lineForm.transaction_date}
                                            onChange={(e) => setLineForm({ ...lineForm, transaction_date: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="line-description">Описание</Label>
                                        <Input
                                            id="line-description"
                                            value={lineForm.description}
                                            onChange={(e) => setLineForm({ ...lineForm, description: e.target.value })}
                                            placeholder="Описание операции"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="line-counterparty">Контрагент</Label>
                                        <Input
                                            id="line-counterparty"
                                            value={lineForm.counterparty_name}
                                            onChange={(e) => setLineForm({ ...lineForm, counterparty_name: e.target.value })}
                                            placeholder="Название контрагента"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="line-debit">Поступление</Label>
                                            <Input
                                                id="line-debit"
                                                type="number"
                                                step="0.01"
                                                value={lineForm.debit_amount}
                                                onChange={(e) => setLineForm({ ...lineForm, debit_amount: e.target.value, credit_amount: '' })}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="line-credit">Списание</Label>
                                            <Input
                                                id="line-credit"
                                                type="number"
                                                step="0.01"
                                                value={lineForm.credit_amount}
                                                onChange={(e) => setLineForm({ ...lineForm, credit_amount: e.target.value, debit_amount: '' })}
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => setOpenLineDialog(false)}>Отмена</Button>
                                    <Button 
                                        onClick={handleSaveLine} 
                                        disabled={createLineMutation.isPending || updateLineMutation.isPending}
                                    >
                                        {createLineMutation.isPending || updateLineMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}
                </CardHeader>
                <CardContent className="p-0">
                    <DataTable
                        columns={columns}
                        data={statement.lines || []}
                        searchColumn="description"
                        searchPlaceholder="Поиск по описанию..."
                    />
                </CardContent>
            </Card>
        </div>
    );
}
