"use client"

import { useState, useMemo, useEffect } from "react"
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
import { SalesDocument, SalesDocumentLine } from "@/types"
import {
    PiFloppyDiskBold,
    PiCheckCircleBold,
    PiPrinterBold,
    PiXBold,
    PiPlusBold,
    PiTrashBold,
    PiClockCounterClockwiseBold,
    PiLockKeyBold
} from "react-icons/pi"
import { cn } from "@/lib/utils"
import { mapApiError } from "@/lib/error-mapper"
import { PrintPreviewDialog } from "@/components/documents/print-preview-dialog"
import { useAppStore } from "@/stores/app-store"
import { UnitSelector } from "@/components/ui/unit-selector"
import { InterfaceModeToggle } from "@/components/interface-mode-toggle"
import { ReferenceLink } from "@/components/ui/reference-link"
import { ReferenceSelector } from "@/components/ui/reference-selector"
import { DocumentPostings } from "@/components/documents/document-postings"
import { LiveStockPanel } from "@/components/documents/live-stock-panel"
import { LiveSettlementPanel } from "@/components/documents/live-settlement-panel"
import { DocumentHistoryPanel } from "@/components/documents/document-history-panel"

interface SalesDocumentFormProps {
    mode: 'create' | 'edit'
    initialData?: SalesDocument
}

// Helper: Transform DB Line (Base) to UI Line (Package)
const toUiLine = (line: SalesDocumentLine): SalesDocumentLine => {
    const coef = Number(line.coefficient) || 1;
    return {
        ...line,
        quantity: Number(line.quantity) / coef, // Display Qty = Base / Coef
        price: Number(line.price) * coef,       // Display Price = BasePrice * Coef
    }
}

// Helper: Transform UI Line (Package) to DB Line (Base)
const toDbLine = (line: SalesDocumentLine): SalesDocumentLine => {
    const coef = Number(line.coefficient) || 1;
    return {
        ...line,
        quantity: Number(line.quantity) * coef, // Base Qty = Display * Coef
        price: Number(line.price) / coef,       // Base Price = Display / Coef
    }
}

export function SalesDocumentForm({ initialData, mode }: SalesDocumentFormProps) {
    const t = useTranslations('documents')
    const tc = useTranslations('common')
    const tf = useTranslations('fields')
    const router = useRouter()
    const queryClient = useQueryClient()
    const [printOpen, setPrintOpen] = useState(false)

    // Form State
    const [formData, setFormData] = useState<Partial<SalesDocument>>(initialData || {
        date: new Date().toISOString(),
        status: 'draft',
        lines: [],
        currency: 1, // Default ID for USD
        exchange_rate: 12500,
        contract: 1
    })

    const { currentTenant } = useAppStore();
    const isPosted = initialData?.is_posted ?? (initialData?.status === 'posted');
    const canEdit = mode === 'create' ? true : (!isPosted && (initialData?.can_edit ?? true));
    const isPeriodClosed = initialData?.period_is_closed ?? false;

    // Lines State (UI Units)
    const [lines, setLines] = useState<SalesDocumentLine[]>(
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
            staleTime: 1000 * 60 * 5 // Cache for 5 mins
        });
    }

    // Prepare Payload for Save/Post
    const preparePayload = () => {
        const dbLines = lines.map(toDbLine);
        return {
            ...formData,
            rate: formData.exchange_rate,
            lines: dbLines
        };
    }

    // Actions
    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            if (mode === 'create') return api.post('/documents/sales/', data);
            return api.put(`/documents/sales/${initialData!.id}/`, data);
        },
        onSuccess: () => {
            toast.success(tc('savedSuccessfully'));
            queryClient.invalidateQueries({ queryKey: ['sales-documents'] });
            if (mode === 'create') router.push('/documents/sales');
        },
        onError: (err) => {
            const { title, description } = mapApiError(err);
            toast.error(title, { description });
        }
    })

    const postMutation = useMutation({
        mutationFn: async () => api.post(`/documents/sales/${initialData!.id}/post/`),
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ['sales-documents'] });
            const previousData = queryClient.getQueryData(['sales-documents']);
            setFormData({ ...formData, status: 'posted' });
            toast.success(t('postedSuccessfully'));
            return { previousData };
        },
        onError: (err: any) => {
            setFormData({ ...formData, status: 'draft' });
            const { title, description } = mapApiError(err);
            toast.error(title, { description });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales-documents'] });
            router.refresh();
        }
    })

    const unpostMutation = useMutation({
        mutationFn: async () => api.post(`/documents/sales/${initialData!.id}/unpost/`),
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ['sales-documents'] });
            setFormData({ ...formData, status: 'draft' });
            toast.success(t('unpostedSuccessfully'));
        },
        onError: () => {
            setFormData({ ...formData, status: 'posted' });
            toast.error("Failed to unpost");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales-documents'] });
            router.refresh();
        }
    })

    // Formatting Shortcuts
    useHotkeys('ctrl+s', (e) => {
        e.preventDefault();
        if (!isPosted) {
            saveMutation.mutate(preparePayload());
            toast.info("Saving...");
        }
    }, { enableOnFormTags: true }, [formData, lines, isPosted]);

    useHotkeys('ctrl+enter, f9', (e) => {
        e.preventDefault();
        if (!isPosted && initialData?.id) {
            postMutation.mutate();
        }
    }, { enableOnFormTags: true }, [isPosted, initialData]);

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
        }] : []),
        ...(initialData?.can_unpost ? [{
            label: t('unpost'),
            icon: <PiXBold />,
            onClick: () => unpostMutation.mutate(),
            variant: 'destructive' as const
        }] : []),
        {
            label: tc('print'),
            icon: <PiPrinterBold />,
            onClick: () => setPrintOpen(true),
            variant: 'ghost' as const
        }
    ]

    // Totals
    const totals = useMemo(() => {
        const totalAmount = lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
        const tax = lines.reduce((sum, line) => sum + (Number(line.vat_amount) || 0), 0);
        const exchangeRate = formData.exchange_rate || 12500;
        const grandTotal = totalAmount + tax;

        return {
            total: totalAmount,
            tax: tax,
            grandTotal: grandTotal,
            grandTotalBase: grandTotal * exchangeRate
        }
    }, [lines, formData.exchange_rate]);

    const [activeCell, setActiveCell] = useState<{ row: number, col: string } | null>(null);

    // Helper: Recalculate Line Totals
    const recalculateLine = (line: SalesDocumentLine): SalesDocumentLine => {
        const qty = Number(line.quantity) || 0;
        const price = Number(line.price) || 0;
        const rate = Number(line.vat_rate) || 0; // Default 0 if undefined, but we'll default 20

        const amount = qty * price;
        const vatAmount = amount * (rate / 100);
        const total = amount + vatAmount;

        return {
            ...line,
            amount: amount,
            vat_amount: vatAmount,
            total_with_vat: total
        };
    };

    // Columns
    const columns: ColumnDef<SalesDocumentLine>[] = [
        {
            accessorKey: 'item',
            header: tf('item'),
            cell: ({ row }) => (
                <div className={cn("h-full w-full p-1", activeCell?.row === row.index && activeCell?.col === 'item' && "ring-2 ring-primary inset-0")}>
                    <ReferenceSelector
                        value={row.original.item}
                        onSelect={(val) => {
                            const newLines = [...lines];
                            let newLine = { ...newLines[row.index], item: val as number, package: null };
                            // TODO: Fetch default VAT from item? For now default 20
                            if (newLine.vat_rate === undefined) newLine.vat_rate = 20;
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
                    <div className={cn("h-full w-full", activeCell?.row === row.index && activeCell?.col === 'package' && "ring-2 ring-primary z-10 relative")}>
                        <UnitSelector
                            value={row.original.package || null}
                            units={units}
                            baseUnit={item?.base_unit || 'pcs'}
                            onChange={(unitId, coefficient) => {
                                const newLines = [...lines];
                                const oldCoef = Number(newLines[row.index].coefficient) || 1;
                                const currentPrice = Number(newLines[row.index].price) || 0;
                                // Recalculate Price: BasePrice = Price / OldCoef. NewPrice = BasePrice * NewCoef
                                // This ensures 1 Box ($100) -> 1 Pc ($10).
                                const newPrice = (currentPrice / oldCoef) * coefficient;

                                let newLine = {
                                    ...newLines[row.index],
                                    package: unitId,
                                    coefficient: coefficient,
                                    price: parseFloat(newPrice.toFixed(2)) // Round to 2 decimals for UI
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
            id: 'vat_rate',
            header: '% VAT',
            cell: ({ row }) => (
                <select
                    className="h-8 w-full bg-transparent border-none text-right px-2 text-xs"
                    disabled={!canEdit}
                    value={row.original.vat_rate ?? 20}
                    onChange={(e) => {
                        const newLines = [...lines];
                        let newLine = { ...newLines[row.index], vat_rate: parseInt(e.target.value) };
                        newLines[row.index] = recalculateLine(newLine);
                        setLines(newLines);
                    }}
                >
                    <option value="0">0%</option>
                    <option value="12">12%</option>
                    <option value="20">20%</option>
                </select>
            )
        },
        {
            id: 'vat_amount',
            header: 'VAT Sum',
            cell: ({ row }) => <span className="font-mono text-muted-foreground block text-right px-2 text-xs">
                {(Number(row.original.vat_amount) || 0).toFixed(2)}
            </span>
        },
        {
            id: 'total_line',
            header: 'Total',
            cell: ({ row }) => <span className="font-mono font-bold block text-right px-2">
                {(Number(row.original.total_with_vat) || 0).toFixed(2)}
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
                <InterfaceModeToggle />
            </div>

            <TabsContent value="main" className="flex-1 flex flex-col h-full m-0 p-0 outline-none">
                <CommandBar mainActions={actions} className="border-b shrink-0" />
                <PrintPreviewDialog document={{ ...formData, lines }} tenant={currentTenant} open={printOpen} onOpenChange={setPrintOpen} />

                {/* Fixed Header Fields */}
                <div className="flex flex-col gap-4 border-b bg-muted/10 shrink-0">
                    {/* Top Bar for Operation and Invoice Status */}
                    <div className="flex items-center justify-between px-4 pt-2">
                        <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground whitespace-nowrap">Operation:</Label>
                            <select
                                className="h-7 text-xs bg-transparent border-none font-medium focus:ring-0 cursor-pointer hover:bg-muted/50 rounded px-1"
                                value={formData.operation_type || 'goods'}
                                disabled={!canEdit}
                                onChange={(e) => setFormData({ ...formData, operation_type: e.target.value as any })}
                            >
                                <option value="goods">Goods (Invoice, UPD)</option>
                                <option value="services">Services (Act, UPD)</option>
                                <option value="goods_services">Goods, Services, Commission</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Invoice (Schet-Factura):</span>
                            <button className="text-xs text-blue-600 hover:underline font-medium" onClick={() => toast.info("Invoice creation logic to be implemented")}>
                                Not Issued
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-5 gap-4 px-4 pb-4">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{tc('number')}</Label>
                            <Input disabled={!canEdit} value={formData.number || ''} onChange={e => setFormData({ ...formData, number: e.target.value })} className="h-8 font-mono bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background border-transparent" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{tc('date')}</Label>
                            <Input type="datetime-local" disabled={!canEdit} value={formData.date ? new Date(formData.date).toISOString().slice(0, 16) : ''} onChange={e => setFormData({ ...formData, date: e.target.value })} className="h-8 bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background border-transparent" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Organization</Label>
                            <Input disabled value="My Company" className="h-8 bg-muted/50 border-transparent text-muted-foreground" />
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
                            <ReferenceSelector
                                className="bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background border-transparent"
                                value={formData.contract as number}
                                onSelect={(val) => setFormData({ ...formData, contract: val as number })}
                                apiEndpoint="/directories/contracts/"
                                placeholder="Main Contract"
                                displayField="number"
                            />
                        </div>

                        {/* Analytics Fields */}
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Project</Label>
                            <ReferenceSelector
                                className="bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background border-transparent"
                                value={formData.project as number}
                                onSelect={(val) => setFormData({ ...formData, project: val as number })}
                                apiEndpoint="/directories/projects/"
                                placeholder="Select Project..."
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Department</Label>
                            <ReferenceSelector
                                className="bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background border-transparent"
                                value={formData.department as number}
                                onSelect={(val) => setFormData({ ...formData, department: val as number })}
                                apiEndpoint="/directories/departments/"
                                placeholder="Select Department..."
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Manager</Label>
                            <ReferenceSelector
                                className="bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background border-transparent"
                                value={formData.manager as number}
                                onSelect={(val) => setFormData({ ...formData, manager: val as number })}
                                apiEndpoint="/directories/employees/"
                                placeholder="Responsible Manager"
                                displayField="last_name"
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
                                        value={formData.exchange_rate}
                                        readOnly
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 1C-Style Operational Panels */}
                <div className="grid grid-cols-2 gap-4 px-4">
                    <LiveStockPanel
                        warehouseId={formData.warehouse as number | null}
                        lines={lines.map(l => ({ item: l.item, quantity: (Number(l.quantity) || 0) * (Number(l.coefficient) || 1) }))}
                        operation="OUT"
                    />
                    <LiveSettlementPanel
                        counterpartyId={formData.counterparty as number | null}
                        contractId={formData.contract as number | null}
                        currencyId={formData.currency as number | null}
                        amount={totals.grandTotal}
                        operation="ACCRUAL"
                    />
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
                                vat_rate: 20, vat_amount: 0, total_with_vat: 0,
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
                            <span className="font-mono font-bold text-lg text-primary">${totals.grandTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex flex-col items-end border-l pl-4 ml-4">
                            <span className="text-muted-foreground text-xs font-bold">Base Value</span>
                            <span className="font-mono font-bold text-lg">{totals.grandTotalBase.toLocaleString()} UZS</span>
                        </div>
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="history" className="p-8">
                {initialData?.id ? (
                    <DocumentHistoryPanel documentId={initialData.id} documentType="sales" />
                ) : (
                    <div className="p-8 text-center text-muted-foreground">Save the document to view history.</div>
                )}
            </TabsContent>

            <TabsContent value="postings" className="flex-1 p-8 m-0 overflow-auto">
                {initialData?.id ? (
                    <DocumentPostings documentId={initialData.id} endpoint="sales" />
                ) : (
                    <div className="p-8 text-center text-muted-foreground">Save the document to view postings.</div>
                )}
            </TabsContent>
        </Tabs>
    )
}
