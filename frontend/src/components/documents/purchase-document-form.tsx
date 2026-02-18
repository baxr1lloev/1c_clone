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
import {
    PurchaseDocument,
    PurchaseDocumentLine
} from "@/types"
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
import { ReferenceSelector } from "@/components/ui/reference-selector"
import { LiveStockPanel } from "@/components/documents/live-stock-panel"
import { LiveSettlementPanel } from "@/components/documents/live-settlement-panel"
import { DocumentPostings } from "@/components/documents/document-postings"
import { DocumentHistoryPanel } from "@/components/documents/document-history-panel"

interface PurchaseDocumentFormProps {
    initialData?: any;
    mode: 'create' | 'edit'
}

function formatBaseQuantity(value: number): string {
    if (!Number.isFinite(value)) return '0';
    return value.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
    });
}

// Helper: Transform DB Line (Base) to UI Line (Package)
const toUiLine = (line: PurchaseDocumentLine): PurchaseDocumentLine => {
    const coef = Number(line.coefficient) || 1;
    return {
        ...line,
        quantity: Number(line.quantity) / coef,
        price: Number(line.price) * coef,
    }
}

// Helper: Transform UI Line (Package) to DB Line (Base)
const toDbLine = (line: PurchaseDocumentLine) => {
    const coef = Number(line.coefficient) || 1;
    return {
        item: line.item,
        quantity: (Number(line.quantity) || 0) * coef,
        package: line.package ?? null,
        coefficient: coef,
        price: (Number(line.price) || 0) / coef,
        vat_rate: Number(line.vat_rate) || 0,
    }
}

// Helper component to fetch item details for the Unit cell
function UnitCell({ row, activeCell, isPosted, onUpdate }: { row: any, activeCell: any, isPosted: boolean, onUpdate: (updates: Partial<PurchaseDocumentLine>) => void }) {
    const itemId = row.original.item;
    const { data: item } = useQuery({
        queryKey: ['items', itemId, 'detail'],
        queryFn: async () => {
            if (!itemId) return null;
            const res = await api.get(`/directories/items/${itemId}/`);
            return res;
        },
        enabled: !!itemId
    });

    if (!item) return <div className="h-full w-full p-2 text-xs text-muted-foreground">Select Item...</div>;

    // Always include base unit
    const baseUnit = { id: null, name: item.unit || 'units', coefficient: 1 };
    const units = [
        baseUnit,
        ...(item.packages ? item.packages.map((p: any) => ({
            id: p.id,
            name: p.name,
            coefficient: Number(p.coefficient)
        })) : [])
    ];

    // Construct units list including base
    // If item.unit is "pcs", we should probably have a "base" option.
    // But UnitSelector usually takes "packages".
    // If no package selected, it's base unit.

    return (
        <div className={cn("h-full w-full", activeCell?.row === row.index && activeCell?.col === 'package' && "ring-2 ring-primary z-10 relative")}>
            <UnitSelector
                value={row.original.package || null}
                units={units}
                baseUnit={item.unit || 'units'}
                onChange={(unitId, coefficient) => {
                    onUpdate({
                        package: unitId,
                        coefficient: coefficient // Store coefficient!
                    });
                }}
                disabled={isPosted}
            />
        </div>
    );
}

// Helper to calculate base quantity display
function BaseQtyCell({ row, activeCell, isPosted, onUpdate }: { row: any, activeCell: any, isPosted: boolean, onUpdate: (val: number) => void }) {
    // We need current coefficient to display base qty
    // Since we store coefficient in line, we use it.
    // Fallback to 1 if missing.
    const coef = Number(row.original.coefficient) || 1;
    const qty = Number(row.original.quantity) || 0;
    const baseQty = qty * coef;

    // We need item base unit name
    const itemId = row.original.item;
    const { data: item } = useQuery({
        queryKey: ['items', itemId, 'minimal'],
        queryFn: async () => {
            if (!itemId) return null;
            const res = await api.get(`/directories/items/${itemId}/`);
            return res;
        },
        enabled: !!itemId,
        staleTime: 60000 // Cache for a bit
    });

    const baseUnitName = item?.unit || item?.base_unit || '';

    return (
        <div className="flex gap-1">
            <Input
                id={`p-cell-${row.index}-quantity`}
                type="number"
                step="0.001"
                min="0"
                disabled={isPosted}
                className={cn("h-8 w-20 text-right px-1 border-transparent focus:border-transparent focus:ring-0 rounded-none bg-transparent hover:bg-muted/10 transition-colors", activeCell?.row === row.index && activeCell?.col === 'quantity' && "bg-white ring-2 ring-primary z-20 relative font-bold")}
                value={row.original.quantity}
                // onKeyDown handled in parent
                onFocus={(e) => e.target.select()}
                onClick={(e) => e.currentTarget.select()}
                onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    onUpdate(Number.isFinite(value) ? value : 0);
                }}
            />
            <div className="flex flex-col justify-center px-1 border-l border-dashed min-w-[3rem]">
                <span className="text-[9px] text-muted-foreground leading-none">Base</span>
                <span className="text-[10px] font-mono text-muted-foreground text-right font-bold">{formatBaseQuantity(baseQty)} <span className="text-[8px] font-normal">{baseUnitName}</span></span>
            </div>
        </div>
    )
}


export function PurchaseDocumentForm({ initialData, mode }: PurchaseDocumentFormProps) {
    const t = useTranslations('documents')
    const tc = useTranslations('common')
    const tf = useTranslations('fields')
    const router = useRouter()
    const queryClient = useQueryClient()

    const [printOpen, setPrintOpen] = useState(false)

    // Form State
    const [formData, setFormData] = useState<Partial<PurchaseDocument>>(initialData || {
        date: new Date().toISOString(),
        status: 'draft',
        lines: [],
        currency: 1, // Default currency ID, ideally fetch default
        exchange_rate: 1,
        contract: null
    })

    // Derived State
    const { currentTenant } = useAppStore();
    const isPeriodClosed = false; // closingDate not available in store yet
    const isPosted = formData.status === 'posted' || isPeriodClosed;

    // Lines State (UI Units)
    const [lines, setLines] = useState<PurchaseDocumentLine[]>(
        initialData?.lines?.map(toUiLine) || []
    )

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
            if (mode === 'create') return api.post('/documents/purchases/', data);
            return api.put(`/documents/purchases/${initialData!.id}/`, data);
        },
        onSuccess: () => {
            toast.success(tc('savedSuccessfully'));
            queryClient.invalidateQueries({ queryKey: ['purchase-documents'] });
            if (mode === 'create') router.push('/documents/purchases');
        },
        onError: (err) => {
            const { title, description } = mapApiError(err);
            toast.error(title, { description });
        }
    })

    const postMutation = useMutation({
        mutationFn: async () => api.post(`/documents/purchases/${initialData!.id}/post/`),
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ['purchase-documents'] });
            setFormData({ ...formData, status: 'posted' });
            toast.success(t('postedSuccessfully'));
        },
        onError: (err: any) => {
            setFormData({ ...formData, status: 'draft' });
            const { title, description } = mapApiError(err);
            toast.error(title, { description });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase-documents'] });
            router.refresh();
        }
    })

    const unpostMutation = useMutation({
        mutationFn: async () => api.post(`/documents/purchases/${initialData!.id}/unpost/`),
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ['purchase-documents'] });
            setFormData({ ...formData, status: 'draft' });
            toast.success(t('unpostedSuccessfully'));
        },
        onError: () => {
            setFormData({ ...formData, status: 'posted' });
            toast.error("Failed to unpost");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase-documents'] });
            router.refresh();
        }
    })

    // Shortcuts
    useHotkeys('ctrl+s', (e) => { e.preventDefault(); if (!isPosted) saveMutation.mutate(preparePayload()); }, { enableOnFormTags: true }, [formData, lines, isPosted]);
    useHotkeys('ctrl+enter', (e) => { e.preventDefault(); if (!isPosted && initialData?.id) postMutation.mutate(); }, { enableOnFormTags: true }, [isPosted, initialData]);
    useHotkeys('esc', (e) => { e.preventDefault(); router.back(); }, { enableOnFormTags: true }, []);

    const actions: CommandBarAction[] = [
        ...(!isPosted ? [{
            label: t('post'),
            icon: <PiCheckCircleBold />,
            onClick: () => postMutation.mutate(),
            disabled: mode === 'create',
            shortcut: 'Ctrl+Ent',
            variant: 'default' as const
        }] : []),
        ...(!isPosted ? [{
            label: tc('save'),
            icon: <PiFloppyDiskBold />,
            onClick: () => saveMutation.mutate(preparePayload()),
            shortcut: 'Ctrl+S',
            variant: 'secondary' as const
        }] : []),
        ...(!isPosted ? [{
            label: tc('saveAndClose'),
                onClick: () => {
                    saveMutation.mutate(preparePayload());
                    router.push('/documents/purchases');
                },
            variant: 'outline' as const
        }] : []),
        ...(isPosted ? [{
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
        },
        ...(!isPosted ? [{
            label: tc('add'), // "Add Line"
            icon: <PiPlusBold />,
            onClick: () => setLines([...lines, {
                id: Date.now(),
                item: 0,
                quantity: 1,
                package: null,
                coefficient: 1,
                price: 0,
                amount: 0,
                vat_rate: 12,
                vat_amount: 0,
                total_with_vat: 0,
                document: initialData?.id || 0,
                warehouse: formData.warehouse || 1,
                price_base: 0,
                amount_base: 0
            } as PurchaseDocumentLine]),
            shortcut: 'Ins',
            variant: 'secondary' as const
        }] : [])
    ]

    const totals = useMemo(() => {
        const totalAmount = lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
        const tax = lines.reduce((sum, line) => sum + (Number(line.vat_amount) || 0), 0);
        const exchangeRate = formData.exchange_rate || 1;
        const grandTotal = lines.reduce((sum, line) => sum + (Number(line.total_with_vat) || 0), 0) || (totalAmount + tax);

        return {
            total: totalAmount,
            tax: tax,
            grandTotal: grandTotal,
            grandTotalBase: grandTotal * exchangeRate
        }
    }, [lines, formData.exchange_rate]);

    const [activeCell, setActiveCell] = useState<{ row: number, col: string } | null>(null);

    const handleCellKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colId: string) => {
        if (!['Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F2'].includes(e.key)) return;

        const cols = ['item', 'package', 'quantity', 'price'];
        const colIndex = cols.indexOf(colId);

        if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'Tab') {
            e.preventDefault();
            if (colIndex < cols.length - 1) {
                const nextCol = cols[colIndex + 1];
                setActiveCell({ row: rowIndex, col: nextCol });
                setTimeout(() => document.getElementById(`p-cell-${rowIndex}-${nextCol}`)?.focus(), 0);
            } else if (rowIndex < lines.length - 1) {
                setActiveCell({ row: rowIndex + 1, col: cols[0] });
                setTimeout(() => document.getElementById(`p-cell-${rowIndex + 1}-${cols[0]}`)?.focus(), 0);
            } else if (!isPosted) {
                const newLine: PurchaseDocumentLine = {
                    id: Date.now(),
                    item: 0,
                    quantity: 1,
                    package: null,
                    coefficient: 1,
                    price: 0,
                    amount: 0,
                    vat_rate: 12,
                    vat_amount: 0,
                    total_with_vat: 0,
                    document: initialData?.id || 0,
                    warehouse: formData.warehouse || 1,
                    price_base: 0,
                    amount_base: 0
                } as PurchaseDocumentLine;
                setLines([...lines, newLine]);
                setActiveCell({ row: rowIndex + 1, col: cols[0] });
            }
        }
    };

    // Helper: Recalculate Line Totals (Mirrors Backend Logic)
    const recalculateLine = (line: PurchaseDocumentLine): PurchaseDocumentLine => {
        const qty = Number(line.quantity) || 0;
        const price = Number(line.price) || 0;
        const rate = Number(line.vat_rate) || 0;

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

    const columns: ColumnDef<PurchaseDocumentLine>[] = [
        {
            accessorKey: 'item', header: tf('item'),
            cell: ({ row }) => (
                <div className={cn("h-full w-full p-1", activeCell?.row === row.index && activeCell?.col === 'item' && "ring-2 ring-primary inset-0")}>
                    <ReferenceSelector
                        apiEndpoint="/directories/items/"
                        value={row.original.item}
                        displayField="name"
                        placeholder="Select Item"
                        onSelect={(val, item) => {
                            const newLines = [...lines];
                            // Reset package and price when item changes
                            let newLine = {
                                ...newLines[row.index],
                                item: val as number,
                                package: null,
                                coefficient: 1,
                                price: Number(item?.purchase_price) || 0, // Auto-fill price
                                vat_rate: 12 // Default to 12% or fetch from item if available
                            };
                            newLines[row.index] = recalculateLine(newLine);
                            setLines(newLines);
                        }}
                        disabled={isPosted}
                        className="h-full border-none"
                    />
                </div>
            )
        },
        {
            accessorKey: 'package', header: "Unit",
            cell: ({ row }) => (
                <UnitCell
                    row={row}
                    activeCell={activeCell}
                    isPosted={isPosted}
                    onUpdate={(updates) => {
                        const newLines = [...lines];

                        // Smart Price Recalculation if coef changes
                        const oldCoef = Number(newLines[row.index].coefficient) || 1;
                        const newCoef = Number(updates.coefficient) || 1;

                        let newPrice = Number(newLines[row.index].price) || 0;
                        if (oldCoef !== newCoef && oldCoef !== 0) {
                            newPrice = (newPrice / oldCoef) * newCoef;
                        }

                        let newLine = {
                            ...newLines[row.index],
                            ...updates,
                            price: parseFloat(newPrice.toFixed(2))
                        };
                        newLines[row.index] = recalculateLine(newLine);
                        setLines(newLines);
                    }}
                />
            )
        },
        {
            accessorKey: 'quantity', header: tf('quantity'),
            cell: ({ row }) => (
                <BaseQtyCell
                    row={row}
                    activeCell={activeCell}
                    isPosted={isPosted}
                    onUpdate={(val) => {
                        const newLines = [...lines];
                        let newLine = { ...newLines[row.index], quantity: val };
                        newLines[row.index] = recalculateLine(newLine);
                        setLines(newLines);
                    }}
                />
            )
        },
        {
            accessorKey: 'price', header: tf('price'),
            cell: ({ row }) => (
                <Input
                    id={`p-cell-${row.index}-price`}
                    type="number"
                    disabled={isPosted}
                    className={cn("h-8 w-full text-right px-1 border-transparent focus:border-transparent focus:ring-0 rounded-none bg-transparent hover:bg-muted/10 transition-colors", activeCell?.row === row.index && activeCell?.col === 'price' && "bg-white ring-2 ring-primary z-20 relative font-bold")}
                    value={row.original.price}
                    onKeyDown={(e) => handleCellKeyDown(e, row.index, 'price')}
                    onFocus={() => setActiveCell({ row: row.index, col: 'price' })}
                    onClick={(e) => e.currentTarget.select()}
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
            accessorKey: 'amount', header: tf('amount'),
            cell: ({ row }) => <span className="font-mono font-bold block text-right px-2">{(Number(row.original.amount) || 0).toFixed(2)}</span>
        },
        {
            id: 'vat_rate',
            header: '% VAT',
            cell: ({ row }) => (
                <select
                    className="h-8 w-full bg-transparent border-none text-right px-2 text-xs text-muted-foreground focus:text-foreground"
                    disabled={isPosted}
                    value={row.original.vat_rate ?? 12}
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
            id: 'vat_amount', header: 'VAT Sum',
            cell: ({ row }) => <span className="font-mono text-muted-foreground block text-right px-2 text-xs">{(Number(row.original.vat_amount) || 0).toFixed(2)}</span>
        },
        {
            id: 'total_line', header: 'Total',
            cell: ({ row }) => <span className="font-mono font-bold block text-right px-2">{(Number(row.original.total_with_vat) || 0).toFixed(2)}</span>
        },
        {
            id: 'actions',
            cell: ({ row }) => !isPosted && (
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover/row:opacity-100 transition-opacity" onClick={() => setLines(lines.filter((_, i) => i !== row.index))} tabIndex={-1}>
                    <PiTrashBold className="h-4 w-4" />
                </Button>
            )
        }
    ]

    return (
        <Tabs defaultValue="main" className="h-[calc(100vh-4rem)] flex flex-col bg-background">
            <div className="border-b px-4 flex items-center justify-between shrink-0 bg-muted/10">
                <TabsList className="bg-transparent p-0">
                    <TabsTrigger value="main" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Main</TabsTrigger>
                    <TabsTrigger value="history" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">History</TabsTrigger>
                    <TabsTrigger value="postings" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none" disabled={!isPosted}>Postings</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground mr-2">Interface Mode:</span>
                    <InterfaceModeToggle />
                </div>
            </div>

            <TabsContent value="main" className="flex-1 flex flex-col h-full m-0 p-0 outline-none data-[state=inactive]:hidden">
                <CommandBar mainActions={actions} className="border-b shrink-0" />
                <PrintPreviewDialog document={{ ...formData, lines }} tenant={currentTenant} open={printOpen} onOpenChange={setPrintOpen} />

                <div className="grid grid-cols-4 gap-4 p-4 border-b bg-muted/10 shrink-0 relative">
                    <div className="absolute top-2 right-4 flex gap-2">
                        {isPeriodClosed && <div className="flex items-center gap-2 text-red-600 font-bold border border-red-200 bg-red-50 px-3 py-1 rounded-sm shadow-sm"><PiLockKeyBold /> Period Closed</div>}
                        {isPosted && !isPeriodClosed ? <div className="flex items-center gap-2 text-emerald-600 font-bold border border-emerald-200 bg-emerald-50 px-3 py-1 rounded-sm shadow-sm"><PiCheckCircleBold /> {t('posted')}</div> : <div className="flex items-center gap-2 text-muted-foreground font-medium border border-border px-3 py-1 rounded-sm bg-background">{t('draft')}</div>}
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{tc('number')}</Label>
                        <Input disabled={isPosted} value={formData.number || ''} onChange={e => setFormData({ ...formData, number: e.target.value })} className="h-8 font-mono disabled:opacity-100" placeholder="Auto" />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{tc('date')}</Label>
                        <Input type="datetime-local" disabled={isPosted} value={formData.date ? new Date(formData.date).toISOString().slice(0, 16) : ''} onChange={e => setFormData({ ...formData, date: e.target.value })} className="h-8 disabled:opacity-100" />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Supplier (Vendor)</Label>
                        <ReferenceSelector
                            apiEndpoint="/directories/counterparties/"
                            value={formData.supplier || null}
                            displayField="name"
                            placeholder="Select Supplier..."
                            onSelect={(val) => setFormData({ ...formData, supplier: val as number })}
                            disabled={isPosted}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{tf('warehouse')}</Label>
                        <ReferenceSelector
                            apiEndpoint="/directories/warehouses/"
                            value={formData.warehouse || null}
                            displayField="name"
                            placeholder="Select Warehouse"
                            onSelect={(val) => setFormData({ ...formData, warehouse: val as number })}
                            disabled={isPosted}
                        />
                    </div>

                    {/* Analytics Fields */}
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Project</Label>
                        <ReferenceSelector
                            apiEndpoint="/directories/projects/"
                            value={formData.project as number || null}
                            displayField="name"
                            placeholder="Select Project"
                            onSelect={(val) => setFormData({ ...formData, project: val as number })}
                            disabled={isPosted}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Department</Label>
                        <ReferenceSelector
                            apiEndpoint="/directories/departments/"
                            value={formData.department as number || null}
                            displayField="name"
                            placeholder="Select Department"
                            onSelect={(val) => setFormData({ ...formData, department: val as number })}
                            disabled={isPosted}
                        />
                    </div>
                </div>

                {/* 1C-Style Operational Panels */}
                <div className="grid grid-cols-2 gap-4 px-4">
                    <LiveStockPanel
                        warehouseId={formData.warehouse as number | null}
                        lines={lines.map(l => ({ item: l.item, quantity: (Number(l.quantity) || 0) * (Number(l.coefficient) || 1) }))}
                        operation="IN"
                    />
                    <LiveSettlementPanel
                        counterpartyId={formData.supplier as number | null}
                        contractId={formData.contract as number | null}
                        currencyId={formData.currency as number | null}
                        amount={totals.grandTotal}
                        operation="ACCRUAL"
                    />
                </div>

                <div className="flex-1 overflow-auto bg-white dark:bg-zinc-950 relative data-table">
                    <DataTable
                        columns={columns}
                        data={lines}
                        onAdd={!isPosted ? () => setLines([...lines, { id: Date.now(), item: 0, quantity: 1, package: null, coefficient: 1, price: 0, amount: 0, vat_rate: 12, vat_amount: 0, total_with_vat: 0, document: initialData?.id || 0, warehouse: formData.warehouse || 1, price_base: 0, amount_base: 0 }]) : undefined}
                        addLabel={!isPosted ? "Add Line" : undefined}
                    />
                    {!isPosted && (
                        <div className="p-2 border-t bg-muted/5">
                            <Button variant="outline" size="sm" onClick={() => setLines([...lines, { id: Date.now(), item: 0, quantity: 1, package: null, coefficient: 1, price: 0, amount: 0, vat_rate: 12, vat_amount: 0, total_with_vat: 0, document: initialData?.id || 0, warehouse: formData.warehouse || 1, price_base: 0, amount_base: 0 }])}>
                                <PiPlusBold className="mr-2 h-4 w-4" /> {tc('add')}
                            </Button>
                        </div>
                    )}
                </div>

                <div className="shrink-0 border-t bg-muted/90 p-2 backdrop-blur">
                    <div className="flex items-center justify-end gap-6 text-sm">
                        <div className="flex flex-col items-end"><span className="text-muted-foreground text-xs">{tf('subtotal')}</span><span className="font-mono">{totals.total.toFixed(2)}</span></div>
                        <div className="flex flex-col items-end"><span className="text-muted-foreground text-xs">VAT (12%)</span><span className="font-mono">{totals.tax.toFixed(2)}</span></div>
                        <div className="flex flex-col items-end"><span className="text-muted-foreground text-xs font-bold">{tc('total')}</span><span className="font-mono font-bold text-lg text-primary">${totals.grandTotal.toFixed(2)}</span></div>
                        <div className="flex flex-col items-end border-l pl-4 ml-4">
                            <span className="text-muted-foreground text-xs font-bold">Total (Base Val)</span>
                            <span className="font-mono font-bold text-lg">{totals.grandTotalBase.toLocaleString()} UZS</span>
                        </div>
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="history" className="p-8">
                {initialData?.id ? (
                    <DocumentHistoryPanel documentId={initialData.id} documentType="purchases" />
                ) : (
                    <div className="p-8 text-center text-muted-foreground">Save the document to view history.</div>
                )}
            </TabsContent>

            <TabsContent value="postings" className="flex-1 p-8 m-0 overflow-auto">
                {initialData?.id ? (
                    <DocumentPostings documentId={initialData.id} endpoint="purchases" />
                ) : (
                    <div className="p-8 text-center text-muted-foreground">Save the document to view postings.</div>
                )}
            </TabsContent>
        </Tabs>
    )
}
