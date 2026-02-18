'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    PiArrowLeftBold,
    PiBankBold,
    PiCheckBold,
    PiFileTextBold,
    PiPencilBold,
    PiPlusBold,
    PiTrashBold,
    PiXBold,
} from 'react-icons/pi';

import { BankStatementLine, BankStatementOperationType, BankStatementService } from '@/services/bank-statement-service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/data-table/data-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ReferenceSelector } from '@/components/ui/reference-selector';

const OPERATION_TYPE_OPTIONS: { value: BankStatementOperationType; label: string }[] = [
    { value: 'CUSTOMER_PAYMENT', label: 'Покупатель (оплата от покупателя)' },
    { value: 'SUPPLIER_PAYMENT', label: 'Поставщик (оплата поставщику)' },
    { value: 'TAX_PAYMENT', label: 'Налог' },
    { value: 'BANK_FEE', label: 'Комиссия банка' },
    { value: 'TRANSFER_INTERNAL', label: 'Безнал / перевод между счетами' },
    { value: 'SALARY_PAYMENT', label: 'Зарплата' },
    { value: 'ACCOUNTABLE', label: 'Касса / подотчет' },
    { value: 'LOAN_RETURN', label: 'Учредитель / возврат займа' },
    { value: 'OTHER', label: 'Ввод остатка / прочее' },
];

const QUICK_OPERATION_PRESETS: Array<{ label: string; value: BankStatementOperationType }> = [
    { label: 'Ввод остатка', value: 'OTHER' },
    { label: 'Покупатель', value: 'CUSTOMER_PAYMENT' },
    { label: 'Поставщик', value: 'SUPPLIER_PAYMENT' },
    { label: 'Касса', value: 'ACCOUNTABLE' },
];

type CreatePaymentsResult = {
    created_count: number;
    errors: string[];
};

type TableRow<T> = { original: T };
type RowCell<T> = { row: TableRow<T> };

function getErrorMessage(error: unknown, fallback: string) {
    const err = error as { response?: { data?: { error?: string } } } | undefined;
    return err?.response?.data?.error || fallback;
}

type LineFormState = {
    transaction_date: string;
    bank_document_number: string;
    description: string;
    payment_purpose: string;
    operation_type: BankStatementOperationType | '';
    counterparty_name: string;
    contract: number | null;
    debit_amount: string;
    credit_amount: string;
};

const emptyLineForm: LineFormState = {
    transaction_date: '',
    bank_document_number: '',
    description: '',
    payment_purpose: '',
    operation_type: '',
    counterparty_name: '',
    contract: null,
    debit_amount: '',
    credit_amount: '',
};

function normalizeAmount(value: string) {
    const parsed = Number(value || '0');
    return Number.isFinite(parsed) ? parsed : 0;
}

export default function BankStatementDetailPage() {
    const locale = useLocale();
    const params = useParams();
    const queryClient = useQueryClient();
    const id = params.id as string;
    const localePath = (path: string) => `/${locale}${path.startsWith('/') ? path : `/${path}`}`;

    const [openLineDialog, setOpenLineDialog] = useState(false);
    const [editingLine, setEditingLine] = useState<BankStatementLine | null>(null);
    const [lineForm, setLineForm] = useState<LineFormState>(emptyLineForm);

    const { data: statement, isLoading } = useQuery({
        queryKey: ['bank-statement', id],
        queryFn: () => BankStatementService.getById(id),
    });

    const currencyCode = statement?.currency_code || 'RUB';

    const moneyFormatter = useMemo(() => {
        try {
            return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: currencyCode });
        } catch {
            return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
    }, [currencyCode]);

    const formatMoney = (value: number | string) => moneyFormatter.format(Number(value || 0));
    const formatSigned = (value: number | string, sign: '+' | '-') => `${sign}${formatMoney(value)}`;

    const postMutation = useMutation({
        mutationFn: () => BankStatementService.post(id),
        onSuccess: () => {
            toast.success('Выписка проведена');
            queryClient.invalidateQueries({ queryKey: ['bank-statement', id] });
        },
        onError: (error: unknown) => toast.error(getErrorMessage(error, 'Не удалось провести выписку')),
    });

    const unpostMutation = useMutation({
        mutationFn: () => BankStatementService.unpost(id),
        onSuccess: () => {
            toast.success('Проведение отменено');
            queryClient.invalidateQueries({ queryKey: ['bank-statement', id] });
        },
        onError: (error: unknown) => toast.error(getErrorMessage(error, 'Не удалось отменить проведение')),
    });

    const createLineMutation = useMutation({
        mutationFn: (data: LineFormState) => BankStatementService.createLine(id, data),
        onSuccess: () => {
            toast.success('Строка добавлена');
            setOpenLineDialog(false);
            resetLineForm();
            queryClient.invalidateQueries({ queryKey: ['bank-statement', id] });
        },
        onError: (error: unknown) => toast.error(getErrorMessage(error, 'Не удалось добавить строку')),
    });

    const updateLineMutation = useMutation({
        mutationFn: ({ lineId, data }: { lineId: number; data: LineFormState }) =>
            BankStatementService.updateLine(id, lineId, data),
        onSuccess: () => {
            toast.success('Строка обновлена');
            setOpenLineDialog(false);
            setEditingLine(null);
            resetLineForm();
            queryClient.invalidateQueries({ queryKey: ['bank-statement', id] });
        },
        onError: (error: unknown) => toast.error(getErrorMessage(error, 'Не удалось обновить строку')),
    });

    const deleteLineMutation = useMutation({
        mutationFn: (lineId: number) => BankStatementService.deleteLine(id, lineId),
        onSuccess: () => {
            toast.success('Строка удалена');
            queryClient.invalidateQueries({ queryKey: ['bank-statement', id] });
        },
        onError: (error: unknown) => toast.error(getErrorMessage(error, 'Не удалось удалить строку')),
    });

    const createPaymentMutation = useMutation({
        mutationFn: ({ lineId }: { lineId: number }) => BankStatementService.createPaymentFromLine(id, lineId),
        onSuccess: () => {
            toast.success('Платежный документ создан');
            queryClient.invalidateQueries({ queryKey: ['bank-statement', id] });
        },
        onError: (error: unknown) => toast.error(getErrorMessage(error, 'Не удалось создать платежный документ')),
    });

    const createPaymentsForUnmatchedMutation = useMutation({
        mutationFn: (autoPost: boolean) => BankStatementService.createPaymentsForUnmatched(id, autoPost),
        onSuccess: (data: CreatePaymentsResult) => {
            toast.success(`Создано документов: ${data?.created_count || 0}`);
            if (Array.isArray(data?.errors) && data.errors.length > 0) {
                toast.warning(`Ошибки: ${data.errors.join(', ')}`);
            }
            queryClient.invalidateQueries({ queryKey: ['bank-statement', id] });
        },
        onError: (error: unknown) => toast.error(getErrorMessage(error, 'Не удалось создать документы')),
    });

    const resetLineForm = () => {
        if (!statement) {
            setLineForm(emptyLineForm);
            return;
        }
        setLineForm({
            ...emptyLineForm,
            transaction_date: statement.statement_date,
        });
    };

    const openAddLineDialog = () => {
        setEditingLine(null);
        resetLineForm();
        setOpenLineDialog(true);
    };

    const openEditLineDialog = (line: BankStatementLine) => {
        setEditingLine(line);
        setLineForm({
            transaction_date: line.transaction_date || '',
            bank_document_number: line.bank_document_number || '',
            description: line.description || '',
            payment_purpose: line.payment_purpose || '',
            operation_type: line.operation_type || '',
            counterparty_name: line.counterparty_name || '',
            contract: line.contract ?? null,
            debit_amount: line.debit_amount || '',
            credit_amount: line.credit_amount || '',
        });
        setOpenLineDialog(true);
    };

    const handleSaveLine = () => {
        if (!lineForm.transaction_date) {
            toast.error('Дата операции обязательна');
            return;
        }

        const debit = normalizeAmount(lineForm.debit_amount);
        const credit = normalizeAmount(lineForm.credit_amount);
        if (debit <= 0 && credit <= 0) {
            toast.error('Заполните сумму поступления или списания');
            return;
        }
        if (debit > 0 && credit > 0) {
            toast.error('Можно заполнить только одно поле: дебет или кредит');
            return;
        }

        const payload: LineFormState = {
            ...lineForm,
            debit_amount: debit > 0 ? lineForm.debit_amount : '0',
            credit_amount: credit > 0 ? lineForm.credit_amount : '0',
        };

        if (editingLine) {
            updateLineMutation.mutate({ lineId: editingLine.id, data: payload });
        } else {
            createLineMutation.mutate(payload);
        }
    };

    if (isLoading) return <div className="p-6">Загрузка...</div>;
    if (!statement) return <div className="p-6">Выписка не найдена</div>;

    const unmatchedCount = Math.max((statement.lines_count || 0) - (statement.matched_count || 0), 0);
    const difference = Number(statement.accounting_balance_difference || 0);

    const columns = [
        { accessorKey: 'transaction_date', header: 'Дата' },
        { accessorKey: 'bank_document_number', header: '№ док. банка' },
        {
            accessorKey: 'description',
            header: 'Описание',
            cell: ({ row }: RowCell<BankStatementLine>) => (
                <div className="max-w-sm">
                    <p className="truncate" title={row.original.description || ''}>{row.original.description || '-'}</p>
                </div>
            ),
        },
        {
            accessorKey: 'payment_purpose',
            header: 'Назначение платежа',
            cell: ({ row }: RowCell<BankStatementLine>) => (
                <div className="max-w-sm">
                    <p className="truncate" title={row.original.payment_purpose || ''}>{row.original.payment_purpose || '-'}</p>
                </div>
            ),
        },
        {
            accessorKey: 'operation_type_display',
            header: 'Операция',
            cell: ({ row }: RowCell<BankStatementLine>) => row.original.operation_type_display || 'Не задано',
        },
        {
            accessorKey: 'counterparty_name',
            header: 'Контрагент',
            cell: ({ row }: RowCell<BankStatementLine>) => row.original.counterparty_name || <span className="text-muted-foreground">-</span>,
        },
        {
            accessorKey: 'debit_amount',
            header: 'Поступление',
            cell: ({ row }: RowCell<BankStatementLine>) => {
                const amount = Number(row.original.debit_amount);
                return amount > 0 ? <span className="font-medium text-green-600">{formatSigned(amount, '+')}</span> : null;
            },
        },
        {
            accessorKey: 'credit_amount',
            header: 'Списание',
            cell: ({ row }: RowCell<BankStatementLine>) => {
                const amount = Number(row.original.credit_amount);
                return amount > 0 ? <span className="font-medium text-red-600">{formatSigned(amount, '-')}</span> : null;
            },
        },
        {
            accessorKey: 'balance',
            header: 'Остаток',
            cell: ({ row }: RowCell<BankStatementLine>) => formatMoney(row.original.balance),
        },
        {
            accessorKey: 'status',
            header: 'Статус',
            cell: ({ row }: RowCell<BankStatementLine>) => {
                const line = row.original;
                const matched = line.status === 'matched' || Boolean(line.created_payment_document);
                if (matched) {
                    return (
                        <div className="flex flex-col gap-1">
                            <Badge variant="default" className="w-fit bg-green-600 hover:bg-green-700">
                                Сопоставлено
                            </Badge>
                            {line.created_payment_document_number ? (
                                <Link href={localePath(`/documents/payments/${line.created_payment_document}`)} className="text-xs text-blue-600 hover:underline">
                                    {line.created_payment_document_number}
                                </Link>
                            ) : null}
                        </div>
                    );
                }
                return <Badge variant="secondary">Не сопоставлено</Badge>;
            },
        },
        ...(statement.status === 'draft'
            ? [{
                  id: 'actions',
                  header: 'Действия',
                  cell: ({ row }: RowCell<BankStatementLine>) => {
                      const line = row.original;
                      const canCreatePayment = line.status === 'unmatched' && !line.matched_document_id;
                      return (
                          <div className="flex gap-2">
                              {canCreatePayment ? (
                                  <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => createPaymentMutation.mutate({ lineId: line.id })}
                                      title="Создать платежный документ"
                                  >
                                      <PiFileTextBold className="h-4 w-4 text-blue-600" />
                                  </Button>
                              ) : null}
                              <Button variant="ghost" size="icon" onClick={() => openEditLineDialog(line)}>
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
                  },
              }]
            : []),
    ];

    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col space-y-4 p-6">
            <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-4">
                    <Link href={localePath('/documents/bank-statements')}>
                        <Button variant="ghost" size="icon">
                            <PiArrowLeftBold className="h-5 w-5" />
                        </Button>
                    </Link>
                    <PiBankBold className="h-8 w-8 text-primary" />
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold">Выписка {statement.number}</h1>
                            <Badge variant="outline">{statement.status_display}</Badge>
                        </div>
                        <p className="text-muted-foreground">
                            {statement.statement_date} - {statement.bank_account_name} ({statement.bank_account_number})
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {statement.status === 'draft' ? (
                        <Button
                            variant="outline"
                            onClick={() => createPaymentsForUnmatchedMutation.mutate(false)}
                            disabled={createPaymentsForUnmatchedMutation.isPending}
                        >
                            <PiFileTextBold className="mr-2" />
                            Создать документы по несопоставленным
                        </Button>
                    ) : null}
                    {statement.can_post ? (
                        <Button
                            onClick={() => postMutation.mutate()}
                            disabled={postMutation.isPending}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            <PiCheckBold className="mr-2" />
                            Провести
                        </Button>
                    ) : null}
                    {statement.can_unpost ? (
                        <Button onClick={() => unpostMutation.mutate()} disabled={unpostMutation.isPending} variant="destructive">
                            <PiXBold className="mr-2" />
                            Отменить проведение
                        </Button>
                    ) : null}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-7">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Входящий остаток</CardTitle>
                    </CardHeader>
                    <CardContent><p className="text-2xl font-bold">{formatMoney(statement.opening_balance)}</p></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Поступления</CardTitle>
                    </CardHeader>
                    <CardContent><p className="text-2xl font-bold text-green-600">{formatSigned(statement.total_receipts, '+')}</p></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Списания</CardTitle>
                    </CardHeader>
                    <CardContent><p className="text-2xl font-bold text-red-600">{formatSigned(statement.total_payments, '-')}</p></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Исходящий остаток</CardTitle>
                    </CardHeader>
                    <CardContent><p className="text-2xl font-bold">{formatMoney(statement.closing_balance)}</p></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Строк</CardTitle>
                    </CardHeader>
                    <CardContent><p className="text-2xl font-bold">{statement.lines_count || 0}</p></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Сопоставлено</CardTitle>
                    </CardHeader>
                    <CardContent><p className="text-2xl font-bold text-green-600">{statement.matched_count || 0}</p></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Разница</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className={`text-2xl font-bold ${difference === 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {difference === 0 ? formatMoney(0) : formatSigned(Math.abs(difference), difference > 0 ? '+' : '-')}
                        </p>
                        <p className="text-xs text-muted-foreground">Не сопоставлено: {unmatchedCount}</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="flex-1 border-0 bg-transparent shadow-none">
                <CardHeader className="flex flex-row items-center justify-between px-0 pt-0">
                    <CardTitle>Операции ({statement.lines_count || 0})</CardTitle>
                    {statement.status === 'draft' ? (
                        <Dialog open={openLineDialog} onOpenChange={setOpenLineDialog}>
                            <DialogTrigger asChild>
                                <Button onClick={openAddLineDialog} className="gap-2">
                                    <PiPlusBold className="h-4 w-4" />
                                    Добавить строку
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[760px]">
                                <DialogHeader>
                                    <DialogTitle>{editingLine ? 'Изменить строку' : 'Добавить строку'}</DialogTitle>
                                </DialogHeader>
                                <div className="grid grid-cols-1 gap-4 py-2 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="line-date">Дата операции *</Label>
                                        <Input
                                            id="line-date"
                                            type="date"
                                            value={lineForm.transaction_date}
                                            onChange={(e) => setLineForm({ ...lineForm, transaction_date: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="line-bank-doc">№ документа банка</Label>
                                        <Input
                                            id="line-bank-doc"
                                            value={lineForm.bank_document_number}
                                            onChange={(e) => setLineForm({ ...lineForm, bank_document_number: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor="line-description">Описание</Label>
                                        <Input
                                            id="line-description"
                                            value={lineForm.description}
                                            onChange={(e) => setLineForm({ ...lineForm, description: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor="line-purpose">Назначение платежа</Label>
                                        <Input
                                            id="line-purpose"
                                            value={lineForm.payment_purpose}
                                            onChange={(e) => setLineForm({ ...lineForm, payment_purpose: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="line-operation-type">Тип операции</Label>
                                        <select
                                            id="line-operation-type"
                                            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={lineForm.operation_type}
                                            onChange={(e) => setLineForm({ ...lineForm, operation_type: e.target.value as BankStatementOperationType | '' })}
                                        >
                                            <option value="">Автоопределение</option>
                                            {OPERATION_TYPE_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="flex flex-wrap gap-2">
                                            {QUICK_OPERATION_PRESETS.map((preset) => (
                                                <Button
                                                    key={preset.value}
                                                    type="button"
                                                    variant={lineForm.operation_type === preset.value ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => setLineForm({ ...lineForm, operation_type: preset.value })}
                                                >
                                                    {preset.label}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="line-counterparty">Контрагент (текст)</Label>
                                        <Input
                                            id="line-counterparty"
                                            value={lineForm.counterparty_name}
                                            onChange={(e) => setLineForm({ ...lineForm, counterparty_name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Договор</Label>
                                        <ReferenceSelector
                                            value={lineForm.contract || undefined}
                                            onSelect={(val) => setLineForm({ ...lineForm, contract: (val as number) || null })}
                                            apiEndpoint="/directories/contracts/"
                                            placeholder="Выберите договор..."
                                            className="h-10"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="line-debit">Поступление</Label>
                                        <Input
                                            id="line-debit"
                                            type="number"
                                            step="0.01"
                                            value={lineForm.debit_amount}
                                            onChange={(e) => setLineForm({ ...lineForm, debit_amount: e.target.value, credit_amount: '' })}
                                            placeholder="0,00"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="line-credit">Списание</Label>
                                        <Input
                                            id="line-credit"
                                            type="number"
                                            step="0.01"
                                            value={lineForm.credit_amount}
                                            onChange={(e) => setLineForm({ ...lineForm, credit_amount: e.target.value, debit_amount: '' })}
                                            placeholder="0,00"
                                        />
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
                    ) : null}
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
