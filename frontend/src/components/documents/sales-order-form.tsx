"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useHotkeys } from "react-hotkeys-hook"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { CommandBar, CommandBarAction } from "@/components/ui/command-bar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "@/components/data-table/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import api from "@/lib/api"
import { SalesOrder, SalesOrderLine } from "@/types"
import {
    PiFloppyDiskBold,
    PiCheckCircleBold,
    PiPrinterBold,
    PiXBold,
    PiPlusBold,
    PiTrashBold
} from "react-icons/pi"
import { cn } from "@/lib/utils"
import { mapApiError } from "@/lib/error-mapper"
import { UnitSelector } from "@/components/ui/unit-selector"
import { ReferenceSelector } from "@/components/ui/reference-selector"
import { DocumentPostings } from "@/components/documents/document-postings"
import { DocumentHistoryPanel } from "@/components/documents/document-history-panel"

interface SalesOrderFormProps {
    mode: 'create' | 'edit'
    initialData?: SalesOrder
}

// Helper: Transform DB Line (Base) to UI Line (Package)
const toUiLine = (line: SalesOrderLine): SalesOrderLine => {
    const coef = Number(line.coefficient) || 1;
    return {
        ...line,
        quantity: Number(line.quantity) / coef,
        price: Number(line.price) * coef,
    }
}

// Helper: Transform UI Line (Package) to DB Line (Base)
const toDbLine = (line: SalesOrderLine): SalesOrderLine => {
    const coef = Number(line.coefficient) || 1;
    return {
        ...line,
        quantity: Number(line.quantity) * coef,
        price: Number(line.price) / coef,
    }
}

export function SalesOrderForm({ initialData, mode }: SalesOrderFormProps) {
    const t = useTranslations('documents')
    const tc = useTranslations('common')
    const tf = useTranslations('fields')
    const router = useRouter()
    const queryClient = useQueryClient()

    // Form State
    const [formData, setFormData] = useState<Partial<SalesOrder>>(initialData || {
        date: new Date().toISOString(),
        order_date: new Date().toISOString().split('T')[0],
        status: 'draft',
        lines: [],
        currency: 1,
        rate: 12500,
        contract: 1
    })

    const isPosted = initialData?.status === 'posted' || initialData?.status === 'confirmed' as any;
    const canEdit = mode === 'create' ? true : !isPosted;

    // Lines State (UI Units)
    const [lines, setLines] = useState<SalesOrderLine[]>(
        initialData?.lines?.map(toUiLine) || []
    )

    // Dynamic Item Fetcher Hook
    const useItemDetails = (itemId: number) => {
        return useQuery({
            queryKey: ['item', itemId],
            queryFn: async () => {
                const res = await api.get(`/directories/items/${itemId}/`);
                return res;
            },
            enabled: !!itemId,
            staleTime: 1000 * 60 * 5
        });
    }

    // Prepare Payload for Save/Post
    const preparePayload = () => {
        const dbLines = lines.map(toDbLine);
        return {
            ...formData,
            lines: dbLines
        };
    }

    // Actions
    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            if (mode === 'create') return api.post('/documents/sales-orders/', data);
            return api.put(`/documents/sales-orders/${initialData!.id}/`, data);
        },
        onSuccess: () => {
            toast.success(tc('savedSuccessfully'));
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            if (mode === 'create') router.push('/documents/sales-orders');
        },
        onError: (err) => {
            const { title, description } = mapApiError(err);
            toast.error(title, { description });
        }
    })

    const postMutation = useMutation({
        mutationFn: async () => api.post(`/documents/sales-orders/${initialData!.id}/post/`),
        onSuccess: () => {
            toast.success(t('postedSuccessfully'));
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            router.refresh();
        },
        onError: (err: any) => {
            const { title, description } = mapApiError(err);
            toast.error(title, { description });
        }
    })

    // Hotkeys
    useHotkeys('ctrl+s', (e) => {
        e.preventDefault();
        if (!isPosted) {
            saveMutation.mutate(preparePayload());
        }
    }, { enableOnFormTags: true }, [formData, lines, isPosted]);

    useHotkeys('esc', (e) => router.back(), { enableOnFormTags: true });

    // Actions
    const actions: CommandBarAction[] = [
        ...(initialData?.can_post ? [{
            label: t('post'),
            icon: <PiCheckCircleBold />,
            onClick: () => postMutation.mutate(),
            disabled: mode === 'create',
            shortcut: 'F9',
            variant: 'default' as const
        }] : []),
        ...(canEdit ? [{
            label: tc('save'),
            icon: <PiFloppyDiskBold />,
            onClick: () => saveMutation.mutate(preparePayload()),
            shortcut: 'Ctrl+S',
            variant: 'secondary' as const
        }] : [])
    ]

    // Totals
    const totals = useMemo(() => {
        const totalAmount = lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
        const exchangeRate = formData.rate || 12500;
        return {
            total: totalAmount,
            totalBase: totalAmount * exchangeRate
        }
    }, [lines, formData.rate]);

    // Helper: Recalculate Line Totals
    const recalculateLine = (line: SalesOrderLine): SalesOrderLine => {
        const qty = Number(line.quantity) || 0;
        const price = Number(line.price) || 0;
        const amount = qty * price;

        return {
            ...line,
            amount: amount
        };
    };

    // Columns
    const columns: ColumnDef<SalesOrderLine>[] = [
        {
            accessorKey: 'item',
            header: tf('item'),
            cell: ({ row }) => (
                <div className="h-full w-full p-1">
                    <ReferenceSelector
                        value={row.original.item}
                        onSelect={(val) => {
                            const newLines = [...lines];
                            let newLine = { ...newLines[row.index], item: val as number, package: null };
                            newLines[row.index] = recalculateLine(newLine);
                            setLines(newLines);
                        }}
                        apiEndpoint="/directories/items/"
                        className="border-none shadow-none bg-transparent"
                    />
                </div>
            )
        },
        {
            accessorKey: 'package',
            header: "Unit",
            cell: ({ row }) => {
                const { data: item } = useItemDetails(row.original.item);
                const units = useMemo(() => {
                    if (!item) return [];
                    const base = { id: null, name: item.base_unit || 'pcs', coefficient: 1 };
                    const pkgs = item.units?.map((p: any) => ({
                        id: p.id, name: p.name, coefficient: Number(p.coefficient)
                    })) || [];
                    return [base, ...pkgs];
                }, [item]);

                return (
                    <div className="h-full w-full">
                        <UnitSelector
                            value={row.original.package || null}
                            units={units}
                            baseUnit={item?.base_unit || 'pcs'}
                            onChange={(unitId, coefficient) => {
                                const newLines = [...lines];
                                const oldCoef = Number(newLines[row.index].coefficient) || 1;
                                const currentPrice = Number(newLines[row.index].price) || 0;
                                const newPrice = (currentPrice / oldCoef) * coefficient;

                                let newLine = {
                                    ...newLines[row.index],
                                    package: unitId,
                                    coefficient: coefficient,
                                    price: parseFloat(newPrice.toFixed(2))
                                };
                                newLines[row.index] = recalculateLine(newLine);
                                setLines(newLines);
                            }}
                            disabled={!canEdit}
                        />
                    </div>
                )
            }
        },
        {
            accessorKey: 'quantity',
            header: tf('quantity'),
            cell: ({ row }) => {
                const item = row.original.item;
                const { data: itemData } = useItemDetails(item);
                const coef = Number(row.original.coefficient) || 1;
                const baseQty = Number(row.original.quantity || 0) * coef;

                return (
                    <div className="flex gap-1 h-full items-center">
                        <Input
                            type="number"
                            disabled={!canEdit}
                            className="h-8 w-20 text-right font-bold border-transparent focus:border-primary bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background"
                            value={row.original.quantity}
                            onChange={(e) => {
                                const newLines = [...lines];
                                let newLine = { ...newLines[row.index], quantity: parseFloat(e.target.value) };
                                newLines[row.index] = recalculateLine(newLine);
                                setLines(newLines);
                            }}
                        />
                        <div className="flex flex-col justify-center px-1 border-l border-dashed min-w-[3rem]">
                            <span className="text-[9px] text-muted-foreground leading-none">Base</span>
                            <span className="text-[10px] font-mono text-muted-foreground text-right font-bold">
                                {baseQty.toFixed(0)} <span className="text-[8px] font-normal">{itemData?.base_unit || 'pcs'}</span>
                            </span>
                        </div>
                    </div>
                )
            }
        },
        {
            id: 'price',
            header: tf('price'),
            cell: ({ row }) => (
                <Input
                    type="number"
                    disabled={isPosted}
                    className="h-8 w-full text-right border-transparent focus:border-primary bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background"
                    value={row.original.price}
                    onChange={(e) => {
                        const newLines = [...lines];
                        let newLine = { ...newLines[row.index], price: parseFloat(e.target.value) };
                        newLines[row.index] = recalculateLine(newLine);
                        setLines(newLines);
                    }}
                />
            )
        },
        {
            id: 'amount',
            header: tf('amount'),
            cell: ({ row }) => <span className="font-mono font-bold block text-right px-2">
                {(Number(row.original.amount) || 0).toFixed(2)}
            </span>
        },
        {
            id: 'actions',
            cell: ({ row }) => !isPosted && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={() => setLines(lines.filter((_, i) => i !== row.index))}
                >
                    <PiTrashBold className="h-4 w-4" />
                </Button>
            )
        }
    ];

    return (
        <Tabs defaultValue="main" className="h-[calc(100vh-4rem)] flex flex-col bg-background">
            {/* Header / Tabs List */}
            <div className="border-b px-4 flex items-center justify-between shrink-0 bg-muted/10">
                <TabsList className="bg-transparent p-0">
                    <TabsTrigger value="main" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Main</TabsTrigger>
                    <TabsTrigger value="history" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">History</TabsTrigger>
                    <TabsTrigger value="postings" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none" disabled={!isPosted}>Postings</TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="main" className="flex-1 flex flex-col h-full m-0 p-0 outline-none">
                <CommandBar mainActions={actions} className="border-b shrink-0" />

                {/* Fixed Header Fields */}
                <div className="flex flex-col gap-4 border-b bg-muted/10 shrink-0">
                    <div className="grid grid-cols-5 gap-4 px-4 py-4">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{tc('number')}</Label>
                            <Input disabled={!canEdit} value={formData.number || ''} onChange={e => setFormData({ ...formData, number: e.target.value })} className="h-8 font-mono bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background border-transparent" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{tc('date')}</Label>
                            <Input type="datetime-local" disabled={!canEdit} value={formData.date ? new Date(formData.date).toISOString().slice(0, 16) : ''} onChange={e => setFormData({ ...formData, date: e.target.value })} className="h-8 bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background border-transparent" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Order Date</Label>
                            <Input type="date" disabled={!canEdit} value={formData.order_date || ''} onChange={e => setFormData({ ...formData, order_date: e.target.value })} className="h-8 bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background border-transparent" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{tf('counterparty')}</Label>
                            <ReferenceSelector className="bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background border-transparent" value={formData.counterparty as number} onSelect={(val) => setFormData({ ...formData, counterparty: val as number })} apiEndpoint="/directories/counterparties/" placeholder="Select Customer..." />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{tf('warehouse')}</Label>
                            <ReferenceSelector className="bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background border-transparent" value={formData.warehouse as number} onSelect={(val) => setFormData({ ...formData, warehouse: val as number })} apiEndpoint="/directories/warehouses/" placeholder="Main Warehouse" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Contract</Label>
                            <ReferenceSelector
                                className="bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background border-transparent"
                                value={formData.contract as number}
                                onSelect={(val) => setFormData({ ...formData, contract: val as number })}
                                apiEndpoint="/directories/contracts/"
                                placeholder="Main Contract"
                                displayField="number"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Currency</Label>
                            <div className="flex gap-2">
                                <Input
                                    disabled={!canEdit}
                                    value={formData.currency || 1}
                                    onChange={e => setFormData({ ...formData, currency: parseInt(e.target.value) || 1 })}
                                    className="h-8 w-20 font-bold disabled:opacity-100 disabled:bg-muted/50 bg-yellow-50/50 dark:bg-yellow-900/10 border-transparent"
                                />
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    @
                                    <Input
                                        className="h-8 w-24 bg-muted/50"
                                        type="number"
                                        value={formData.rate}
                                        readOnly
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Delivery Date</Label>
                            <Input type="date" disabled={!canEdit} value={formData.delivery_date || ''} onChange={e => setFormData({ ...formData, delivery_date: e.target.value })} className="h-8 bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background border-transparent" />
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto bg-white dark:bg-zinc-950 relative">
                    <DataTable
                        columns={columns}
                        data={lines}
                    />
                    {!isPosted && (
                        <div className="p-2 border-t bg-muted/5">
                            <Button variant="outline" size="sm" onClick={() => setLines([...lines, {
                                id: Date.now(), item: 1, quantity: 1, package: null, coefficient: 1, price: 0, amount: 0,
                                document: initialData?.id || 0, warehouse: formData.warehouse || 1
                            }])}>
                                <PiPlusBold className="mr-2 h-4 w-4" /> {tc('add')}
                            </Button>
                        </div>
                    )}
                </div>

                {/* Footer Totals */}
                <div className="shrink-0 border-t bg-muted/90 p-2 backdrop-blur">
                    <div className="flex items-center justify-end gap-6 text-sm">
                        <div className="flex flex-col items-end">
                            <span className="text-muted-foreground text-xs font-bold">{tc('total')}</span>
                            <span className="font-mono font-bold text-lg text-primary">${totals.total.toFixed(2)}</span>
                        </div>
                        <div className="flex flex-col items-end border-l pl-4 ml-4">
                            <span className="text-muted-foreground text-xs font-bold">Base Value</span>
                            <span className="font-mono font-bold text-lg">{totals.totalBase.toLocaleString()} UZS</span>
                        </div>
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="history" className="p-8">
                {initialData?.id ? (
                    <DocumentHistoryPanel documentId={initialData.id} documentType="sales-orders" />
                ) : (
                    <div className="p-8 text-center text-muted-foreground">Save the document to view history.</div>
                )}
            </TabsContent>

            <TabsContent value="postings" className="flex-1 p-8 m-0 overflow-auto">
                {initialData?.id ? (
                    <DocumentPostings documentId={initialData.id} endpoint="sales-orders" />
                ) : (
                    <div className="p-8 text-center text-muted-foreground">Save the document to view postings.</div>
                )}
            </TabsContent>
        </Tabs>
    )
}
