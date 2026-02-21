'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import api from '@/lib/api';
import { DataTable } from '@/components/data-table/data-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ReferenceSelector } from '@/components/ui/reference-selector';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { PiPlusBold } from 'react-icons/pi';

type ApiList<T> = T[] | { results?: T[] };

interface StockBalanceRow {
    id: number;
    item: number;
    item_name: string;
    item_sku?: string;
    warehouse: number;
    warehouse_name: string;
    quantity: number | string;
    amount: number | string;
    last_updated?: string;
}

interface WarehouseOption {
    id: number;
    name: string;
}

interface CounterpartyOption {
    id: number;
    name: string;
}

interface ContractOption {
    id: number;
    number: string;
}

interface BankAccountOption {
    id: number;
    name: string;
    account_number: string;
}

const today = () => new Date().toISOString().slice(0, 10);

function asList<T>(payload: ApiList<T>): T[] {
    if (Array.isArray(payload)) return payload;
    return payload?.results || [];
}

function toNumber(value: unknown): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatQuantity(value: unknown): string {
    return toNumber(value).toLocaleString('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
    });
}

function formatAmount(value: unknown): string {
    return toNumber(value).toLocaleString('ru-RU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function extractErrorMessage(error: unknown, fallback: string): string {
    const err = error as {
        response?: {
            data?: Record<string, unknown> | string;
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

export default function StockBalanceReportPage() {
    const queryClient = useQueryClient();

    // Stock opening balance
    const [isStockDialogOpen, setIsStockDialogOpen] = useState(false);
    const [date, setDate] = useState(today());
    const [warehouseId, setWarehouseId] = useState('');
    const [itemId, setItemId] = useState<number | null>(null);
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState('');
    const [comment, setComment] = useState('');
    const [postImmediately, setPostImmediately] = useState(true);

    // Settlement opening balance
    const [isSettlementDialogOpen, setIsSettlementDialogOpen] = useState(false);
    const [settlementDate, setSettlementDate] = useState(today());
    const [settlementCounterpartyId, setSettlementCounterpartyId] = useState('');
    const [settlementContractId, setSettlementContractId] = useState('');
    const [settlementType, setSettlementType] = useState<'receivable' | 'payable'>('receivable');
    const [settlementAmount, setSettlementAmount] = useState('');
    const [settlementComment, setSettlementComment] = useState('');
    const [settlementPostImmediately, setSettlementPostImmediately] = useState(true);

    // Bank opening balance
    const [isBankDialogOpen, setIsBankDialogOpen] = useState(false);
    const [bankDate, setBankDate] = useState(today());
    const [bankAccountId, setBankAccountId] = useState('');
    const [bankAmount, setBankAmount] = useState('');
    const [bankComment, setBankComment] = useState('');
    const [bankPostImmediately, setBankPostImmediately] = useState(true);

    const {
        data: balances = [],
        isLoading: isBalancesLoading,
        refetch: refetchBalances,
    } = useQuery({
        queryKey: ['stock-balances-report'],
        queryFn: async () => {
            const response = await api.get<ApiList<StockBalanceRow>>('/registers/stock-balances/');
            return asList(response);
        },
    });

    const {
        data: warehouses = [],
        isLoading: isWarehousesLoading,
        isError: isWarehousesError,
        refetch: refetchWarehouses,
    } = useQuery({
        queryKey: ['warehouses', 'for-stock-opening'],
        queryFn: async () => {
            const response = await api.get<ApiList<WarehouseOption>>('/directories/warehouses/');
            return asList(response);
        },
    });

    const {
        data: counterparties = [],
        isLoading: isCounterpartiesLoading,
    } = useQuery({
        queryKey: ['counterparties', 'for-opening-settlement'],
        queryFn: async () => {
            const response = await api.get<ApiList<CounterpartyOption>>('/directories/counterparties/');
            return asList(response);
        },
    });

    const {
        data: contracts = [],
        isLoading: isContractsLoading,
    } = useQuery({
        queryKey: ['contracts', 'for-opening-settlement', settlementCounterpartyId],
        queryFn: async () => {
            if (!settlementCounterpartyId) return [];
            const response = await api.get<ApiList<ContractOption>>(
                `/directories/contracts/?counterparty=${settlementCounterpartyId}`,
            );
            return asList(response);
        },
        enabled: !!settlementCounterpartyId,
    });

    const {
        data: bankAccounts = [],
        isLoading: isBankAccountsLoading,
    } = useQuery({
        queryKey: ['bank-accounts', 'for-opening-balance'],
        queryFn: async () => {
            const response = await api.get<ApiList<BankAccountOption>>('/directories/bank-accounts/');
            return asList(response);
        },
    });

    const calculatedAmount = useMemo(() => {
        return toNumber(quantity) * toNumber(price);
    }, [quantity, price]);

    const resetStockForm = () => {
        setDate(today());
        setWarehouseId('');
        setItemId(null);
        setQuantity('');
        setPrice('');
        setComment('');
        setPostImmediately(true);
    };

    const resetSettlementForm = () => {
        setSettlementDate(today());
        setSettlementCounterpartyId('');
        setSettlementContractId('');
        setSettlementType('receivable');
        setSettlementAmount('');
        setSettlementComment('');
        setSettlementPostImmediately(true);
    };

    const resetBankForm = () => {
        setBankDate(today());
        setBankAccountId('');
        setBankAmount('');
        setBankComment('');
        setBankPostImmediately(true);
    };

    const createStockOpeningBalanceMutation = useMutation({
        mutationFn: async () => {
            if (!warehouseId) throw new Error('Выберите склад.');
            if (!itemId) throw new Error('Выберите номенклатуру.');

            const qty = toNumber(quantity);
            const unitPrice = toNumber(price);
            if (qty <= 0) throw new Error('Количество должно быть больше 0.');
            if (unitPrice < 0) throw new Error('Цена не может быть отрицательной.');

            const payload: Record<string, unknown> = {
                operation_type: 'stock',
                warehouse: Number(warehouseId),
                comment,
                post_immediately: postImmediately,
                stock_lines: [{ item: itemId, quantity: qty, price: unitPrice }],
            };
            if (date) payload.date = date;
            return api.post('/documents/opening-balances/', payload);
        },
        onSuccess: () => {
            toast.success('Остаток по товару успешно добавлен.');
            setIsStockDialogOpen(false);
            resetStockForm();
            queryClient.invalidateQueries({ queryKey: ['stock-balances-report'] });
            queryClient.invalidateQueries({ queryKey: ['stock-balances'] });
        },
        onError: (error: unknown) => {
            toast.error(extractErrorMessage(error, 'Не удалось добавить остаток по товару.'));
        },
    });

    const createSettlementOpeningBalanceMutation = useMutation({
        mutationFn: async () => {
            if (!settlementCounterpartyId) throw new Error('Выберите контрагента.');
            if (!settlementContractId) throw new Error('Выберите договор.');
            const amount = toNumber(settlementAmount);
            if (amount <= 0) throw new Error('Сумма должна быть больше 0.');

            const payload: Record<string, unknown> = {
                operation_type: 'settlement',
                comment: settlementComment,
                post_immediately: settlementPostImmediately,
                settlement_lines: [{
                    counterparty: Number(settlementCounterpartyId),
                    contract: Number(settlementContractId),
                    type: settlementType,
                    amount,
                }],
            };
            if (settlementDate) payload.date = settlementDate;
            return api.post('/documents/opening-balances/', payload);
        },
        onSuccess: () => {
            toast.success('Остаток по взаиморасчетам успешно добавлен.');
            setIsSettlementDialogOpen(false);
            resetSettlementForm();
        },
        onError: (error: unknown) => {
            toast.error(extractErrorMessage(error, 'Не удалось добавить остаток по взаиморасчетам.'));
        },
    });

    const createBankOpeningBalanceMutation = useMutation({
        mutationFn: async () => {
            if (!bankAccountId) throw new Error('Выберите банковский счет.');
            const amount = toNumber(bankAmount);
            if (amount <= 0) throw new Error('Сумма должна быть больше 0.');

            const payload: Record<string, unknown> = {
                operation_type: 'account',
                comment: bankComment,
                post_immediately: bankPostImmediately,
                account_lines: [{ bank_account: Number(bankAccountId), amount }],
            };
            if (bankDate) payload.date = bankDate;
            return api.post('/documents/opening-balances/', payload);
        },
        onSuccess: () => {
            toast.success('Остаток по банковскому счету успешно добавлен.');
            setIsBankDialogOpen(false);
            resetBankForm();
        },
        onError: (error: unknown) => {
            toast.error(extractErrorMessage(error, 'Не удалось добавить остаток по банковскому счету.'));
        },
    });

    const columns: ColumnDef<StockBalanceRow>[] = [
        {
            accessorKey: 'item_name',
            header: 'Номенклатура',
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium">{row.original.item_name}</span>
                    <span className="text-xs text-muted-foreground">{row.original.item_sku || '-'}</span>
                </div>
            ),
        },
        { accessorKey: 'warehouse_name', header: 'Склад' },
        {
            accessorKey: 'quantity',
            header: 'Количество',
            cell: ({ row }) => <span className="font-mono font-semibold">{formatQuantity(row.original.quantity)}</span>,
        },
        {
            accessorKey: 'amount',
            header: 'Сумма',
            cell: ({ row }) => <span className="font-mono">{formatAmount(row.original.amount)}</span>,
        },
        {
            accessorKey: 'last_updated',
            header: 'Обновлено',
            cell: ({ row }) => (
                row.original.last_updated
                    ? new Date(row.original.last_updated).toLocaleString('ru-RU')
                    : '-'
            ),
        },
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold">Ввод начальных остатков</h1>
                    <p className="text-muted-foreground">
                        Добавляйте начальные остатки по товарам, взаиморасчетам и банковским счетам.
                    </p>
                </div>

                <div className="flex gap-2">
                    <Dialog open={isStockDialogOpen} onOpenChange={setIsStockDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <PiPlusBold className="h-4 w-4" />
                                Остаток товара
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Ввод начального остатка товара</DialogTitle>
                            </DialogHeader>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="opening-date">Дата</Label>
                                    <Input
                                        id="opening-date"
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="opening-warehouse">Склад</Label>
                                    <select
                                        id="opening-warehouse"
                                        value={warehouseId}
                                        onChange={(e) => setWarehouseId(e.target.value)}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    >
                                        <option value="">
                                            {isWarehousesLoading ? 'Загрузка складов...' : 'Выберите склад'}
                                        </option>
                                        {warehouses.map((warehouse) => (
                                            <option key={warehouse.id} value={String(warehouse.id)}>
                                                {warehouse.name}
                                            </option>
                                        ))}
                                    </select>

                                    {!isWarehousesLoading && !isWarehousesError && warehouses.length === 0 && (
                                        <div className="text-xs text-amber-500">
                                            Склады не найдены. Создайте склад в разделе «Справочники → Склады».
                                        </div>
                                    )}

                                    {isWarehousesError && (
                                        <div className="flex items-center gap-2 text-xs text-rose-500">
                                            Не удалось загрузить склады.
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => refetchWarehouses()}
                                            >
                                                Повторить
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <Label>Номенклатура</Label>
                                    <ReferenceSelector
                                        value={itemId}
                                        onSelect={(value) => setItemId(value)}
                                        apiEndpoint="/directories/items/"
                                        placeholder="Начните вводить название или SKU"
                                        label=""
                                        displayField="name"
                                        secondaryField="sku"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="opening-qty">Количество</Label>
                                    <Input
                                        id="opening-qty"
                                        type="number"
                                        min="0"
                                        step="0.001"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        placeholder="0"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="opening-price">Цена</Label>
                                    <Input
                                        id="opening-price"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={price}
                                        onChange={(e) => setPrice(e.target.value)}
                                        placeholder="0.00"
                                    />
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="opening-amount">Сумма (авто)</Label>
                                    <Input id="opening-amount" value={formatAmount(calculatedAmount)} disabled />
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="opening-comment">Комментарий</Label>
                                    <Textarea
                                        id="opening-comment"
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        placeholder="Основание ввода остатка"
                                    />
                                </div>

                                <div className="md:col-span-2 flex items-center justify-between rounded-md border p-3">
                                    <div>
                                        <div className="font-medium">Провести документ сразу</div>
                                        <div className="text-xs text-muted-foreground">
                                            Если включено, остаток сразу попадет в движения и отобразится в таблице.
                                        </div>
                                    </div>
                                    <Switch checked={postImmediately} onCheckedChange={setPostImmediately} />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 mt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setIsStockDialogOpen(false);
                                        resetStockForm();
                                    }}
                                >
                                    Отмена
                                </Button>
                                <Button
                                    onClick={() => createStockOpeningBalanceMutation.mutate()}
                                    disabled={createStockOpeningBalanceMutation.isPending}
                                >
                                    {createStockOpeningBalanceMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isSettlementDialogOpen} onOpenChange={setIsSettlementDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                <PiPlusBold className="h-4 w-4" />
                                Покупатель/Поставщик
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Ввод остатка по взаиморасчетам</DialogTitle>
                            </DialogHeader>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="settlement-date">Дата</Label>
                                    <Input
                                        id="settlement-date"
                                        type="date"
                                        value={settlementDate}
                                        onChange={(e) => setSettlementDate(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="settlement-type">Тип остатка</Label>
                                    <select
                                        id="settlement-type"
                                        value={settlementType}
                                        onChange={(e) => setSettlementType(e.target.value as 'receivable' | 'payable')}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    >
                                        <option value="receivable">Долг покупателя (нам должны)</option>
                                        <option value="payable">Долг поставщику (мы должны)</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="settlement-counterparty">Контрагент</Label>
                                    <select
                                        id="settlement-counterparty"
                                        value={settlementCounterpartyId}
                                        onChange={(e) => {
                                            setSettlementCounterpartyId(e.target.value);
                                            setSettlementContractId('');
                                        }}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    >
                                        <option value="">
                                            {isCounterpartiesLoading ? 'Загрузка контрагентов...' : 'Выберите контрагента'}
                                        </option>
                                        {counterparties.map((counterparty) => (
                                            <option key={counterparty.id} value={String(counterparty.id)}>
                                                {counterparty.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="settlement-contract">Договор</Label>
                                    <select
                                        id="settlement-contract"
                                        value={settlementContractId}
                                        onChange={(e) => setSettlementContractId(e.target.value)}
                                        disabled={!settlementCounterpartyId}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
                                    >
                                        <option value="">
                                            {!settlementCounterpartyId
                                                ? 'Сначала выберите контрагента'
                                                : (isContractsLoading ? 'Загрузка договоров...' : 'Выберите договор')}
                                        </option>
                                        {contracts.map((contract) => (
                                            <option key={contract.id} value={String(contract.id)}>
                                                {contract.number}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="settlement-amount">Сумма</Label>
                                    <Input
                                        id="settlement-amount"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={settlementAmount}
                                        onChange={(e) => setSettlementAmount(e.target.value)}
                                        placeholder="0.00"
                                    />
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="settlement-comment">Комментарий</Label>
                                    <Textarea
                                        id="settlement-comment"
                                        value={settlementComment}
                                        onChange={(e) => setSettlementComment(e.target.value)}
                                        placeholder="Основание ввода остатка по расчетам"
                                    />
                                </div>

                                <div className="md:col-span-2 flex items-center justify-between rounded-md border p-3">
                                    <div>
                                        <div className="font-medium">Провести документ сразу</div>
                                        <div className="text-xs text-muted-foreground">
                                            Будут сформированы проводки и движения регистра взаиморасчетов.
                                        </div>
                                    </div>
                                    <Switch checked={settlementPostImmediately} onCheckedChange={setSettlementPostImmediately} />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 mt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setIsSettlementDialogOpen(false);
                                        resetSettlementForm();
                                    }}
                                >
                                    Отмена
                                </Button>
                                <Button
                                    onClick={() => createSettlementOpeningBalanceMutation.mutate()}
                                    disabled={createSettlementOpeningBalanceMutation.isPending}
                                >
                                    {createSettlementOpeningBalanceMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isBankDialogOpen} onOpenChange={setIsBankDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                <PiPlusBold className="h-4 w-4" />
                                Банковский счет
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Ввод остатка по банковскому счету</DialogTitle>
                            </DialogHeader>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="bank-date">Дата</Label>
                                    <Input
                                        id="bank-date"
                                        type="date"
                                        value={bankDate}
                                        onChange={(e) => setBankDate(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="bank-account">Банковский счет</Label>
                                    <select
                                        id="bank-account"
                                        value={bankAccountId}
                                        onChange={(e) => setBankAccountId(e.target.value)}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    >
                                        <option value="">
                                            {isBankAccountsLoading ? 'Загрузка счетов...' : 'Выберите банковский счет'}
                                        </option>
                                        {bankAccounts.map((bankAccount) => (
                                            <option key={bankAccount.id} value={String(bankAccount.id)}>
                                                {bankAccount.name} ({bankAccount.account_number})
                                            </option>
                                        ))}
                                    </select>
                                    {!isBankAccountsLoading && bankAccounts.length === 0 && (
                                        <div className="text-xs text-amber-500">
                                            Банковские счета не найдены. Создайте счет в разделе «Банк и касса → Банковские счета».
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="bank-amount">Сумма</Label>
                                    <Input
                                        id="bank-amount"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={bankAmount}
                                        onChange={(e) => setBankAmount(e.target.value)}
                                        placeholder="0.00"
                                    />
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="bank-comment">Комментарий</Label>
                                    <Textarea
                                        id="bank-comment"
                                        value={bankComment}
                                        onChange={(e) => setBankComment(e.target.value)}
                                        placeholder="Основание ввода остатка по банковскому счету"
                                    />
                                </div>

                                <div className="md:col-span-2 flex items-center justify-between rounded-md border p-3">
                                    <div>
                                        <div className="font-medium">Провести документ сразу</div>
                                        <div className="text-xs text-muted-foreground">
                                            Будут сформированы проводки по счету 1030/51/52 против счета 000.
                                        </div>
                                    </div>
                                    <Switch checked={bankPostImmediately} onCheckedChange={setBankPostImmediately} />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 mt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setIsBankDialogOpen(false);
                                        resetBankForm();
                                    }}
                                >
                                    Отмена
                                </Button>
                                <Button
                                    onClick={() => createBankOpeningBalanceMutation.mutate()}
                                    disabled={createBankOpeningBalanceMutation.isPending}
                                >
                                    {createBankOpeningBalanceMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Текущие остатки товаров</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <DataTable
                        columns={columns}
                        data={balances}
                        isLoading={isBalancesLoading}
                        onRefresh={refetchBalances}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
