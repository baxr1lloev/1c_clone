'use client';

'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PiBankBold, PiArrowLeftBold, PiCheckBold, PiXBold } from 'react-icons/pi';
import { DataTable } from '@/components/data-table/data-table';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BankStatementService } from '@/services/bank-statement-service';
import { toast } from 'sonner';

export default function BankStatementDetailPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const id = params.id as string;

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
                <CardHeader className="px-0 pt-0">
                    <CardTitle>Операции ({statement.lines_count})</CardTitle>
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
