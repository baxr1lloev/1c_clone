"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useHotkeys } from "react-hotkeys-hook"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CommandBar, CommandBarAction } from "@/components/ui/command-bar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DataTable } from "@/components/data-table/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import api from "@/lib/api"
import { PiFloppyDiskBold, PiXBold, PiPlusBold, PiTrashBold } from "react-icons/pi"
import { mapApiError } from "@/lib/error-mapper"
import { ReferenceSelector } from "@/components/ui/reference-selector"

interface InventoryDocumentLine {
    id?: number
    item: number
    item_name?: string
    quantity_book: number
    quantity_actual: number
    difference?: number
    price?: number
    amount?: number
}

interface InventoryDocument {
    id?: number
    number: string
    date: string
    comment?: string
    warehouse: number
    responsible?: string
    status?: string
    lines: InventoryDocumentLine[]
    period_is_closed?: boolean
}

interface InventoryDocumentFormProps {
    mode: 'create' | 'edit'
    initialData?: InventoryDocument
}

export function InventoryDocumentForm({ initialData, mode }: InventoryDocumentFormProps) {
    const t = useTranslations('documents')
    const tc = useTranslations('common')
    const tf = useTranslations('fields')
    const router = useRouter()
    const queryClient = useQueryClient()

    const [formData, setFormData] = useState<Partial<InventoryDocument>>(initialData || {
        date: new Date().toISOString(),
        number: 'Auto',
        status: 'draft',
        lines: [],
    })

    const [lines, setLines] = useState<InventoryDocumentLine[]>(initialData?.lines || [])

    const isPosted = initialData?.status === 'posted'
    const isPeriodClosed = initialData?.period_is_closed
    const canEdit = mode === 'create' ? true : (!isPosted && !isPeriodClosed)

    // Save Mutation
    const saveMutation = useMutation({
        mutationFn: async (data: Partial<InventoryDocument>) => {
            if (mode === 'create') {
                const res = await api.post('/documents/inventory/', data)
                return res
            } else {
                const res = await api.put(`/documents/inventory/${initialData?.id}/`, data)
                return res
            }
        },
        onSuccess: (data) => {
            toast.success(mode === 'create' ? 'Inventory created' : 'Inventory updated')
            queryClient.invalidateQueries({ queryKey: ['inventory'] })
            router.push(`/documents/inventory/${data.id}`)
        },
        onError: (error: any) => {
            const { title, description } = mapApiError(error)
            toast.error(`${title}: ${description}`)
        },
    })

    const handleSave = () => {
        const payload = {
            ...formData,
            lines: lines.map(l => ({
                item: l.item,
                quantity_book: l.quantity_book,
                quantity_actual: l.quantity_actual,
                price: l.price || 0
            }))
        }
        saveMutation.mutate(payload)
    }

    const addLine = () => {
        setLines([...lines, { item: 0, quantity_book: 0, quantity_actual: 0, price: 0 }])
    }

    const removeLine = (index: number) => {
        setLines(lines.filter((_, i) => i !== index))
    }

    const updateLine = (index: number, field: keyof InventoryDocumentLine, value: any) => {
        const newLines = [...lines]
        newLines[index] = { ...newLines[index], [field]: value }
        setLines(newLines)
    }

    // Hotkeys
    useHotkeys('ctrl+s', (e) => { e.preventDefault(); handleSave() }, [formData, lines])
    useHotkeys('esc', () => router.back(), [])

    const columns: ColumnDef<InventoryDocumentLine>[] = [
        {
            accessorKey: 'item',
            header: 'Item',
            cell: ({ row }) => (
                <ReferenceSelector
                    apiEndpoint="/directories/items/"
                    value={row.original.item}
                    onSelect={(val) => updateLine(row.index, 'item', val)}
                    disabled={!canEdit}
                />
            ),
        },
        {
            accessorKey: 'quantity_book',
            header: 'Book Qty',
            cell: ({ row }) => (
                <Input
                    type="number"
                    value={row.original.quantity_book}
                    onChange={(e) => updateLine(row.index, 'quantity_book', parseFloat(e.target.value) || 0)}
                    disabled={!canEdit}
                    className="w-24"
                />
            ),
        },
        {
            accessorKey: 'quantity_actual',
            header: 'Actual Qty',
            cell: ({ row }) => (
                <Input
                    type="number"
                    value={row.original.quantity_actual}
                    onChange={(e) => updateLine(row.index, 'quantity_actual', parseFloat(e.target.value) || 0)}
                    disabled={!canEdit}
                    className="w-24"
                />
            ),
        },
        {
            accessorKey: 'difference',
            header: 'Difference',
            cell: ({ row }) => {
                const diff = row.original.quantity_actual - row.original.quantity_book
                return (
                    <span className={diff > 0 ? 'text-green-600 font-bold' : diff < 0 ? 'text-red-600 font-bold' : ''}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(3)}
                    </span>
                )
            },
        },
        {
            accessorKey: 'price',
            header: 'Price (Surplus)',
            cell: ({ row }) => {
                const diff = row.original.quantity_actual - row.original.quantity_book
                const isSurplus = diff > 0
                return (
                    <Input
                        type="number"
                        value={row.original.price || 0}
                        onChange={(e) => updateLine(row.index, 'price', parseFloat(e.target.value) || 0)}
                        disabled={!canEdit || !isSurplus}
                        className={!isSurplus ? "opacity-50" : ""}
                    />
                )
            },
        },
        {
            accessorKey: 'amount',
            header: 'Amount',
            cell: ({ row }) => {
                const diff = row.original.quantity_actual - row.original.quantity_book
                const amount = diff > 0 ? diff * (row.original.price || 0) : 0
                return <span>{amount.toFixed(2)}</span>
            },
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => canEdit && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLine(row.index)}
                >
                    <PiTrashBold className="h-4 w-4 text-destructive" />
                </Button>
            ),
        },
    ]

    // Post Mutation
    const postMutation = useMutation({
        mutationFn: async () => {
            const res = await api.post(`/documents/inventory/${initialData?.id}/post/`)
            return res
        },
        onSuccess: () => {
            toast.success('Inventory posted')
            queryClient.invalidateQueries({ queryKey: ['inventory'] })
            router.refresh()
        },
        onError: (error: any) => {
            const { title, description } = mapApiError(error)
            toast.error(`${title}: ${description}`)
        },
    })

    // Unpost Mutation
    const unpostMutation = useMutation({
        mutationFn: async () => {
            const res = await api.post(`/documents/inventory/${initialData?.id}/unpost/`)
            return res
        },
        onSuccess: () => {
            toast.success('Inventory unposted')
            queryClient.invalidateQueries({ queryKey: ['inventory'] })
            router.refresh()
        },
        onError: (error: any) => {
            const { title, description } = mapApiError(error)
            toast.error(`${title}: ${description}`)
        },
    })

    const [printOpen, setPrintOpen] = useState(false)

    const actions: CommandBarAction[] = [
        {
            icon: <PiFloppyDiskBold />,
            label: 'Save',
            shortcut: 'Ctrl+S',
            onClick: handleSave,
            disabled: !canEdit,
        },
        ...(mode === 'edit' && !isPosted ? [{
            icon: <PiFloppyDiskBold />, // TODO: Use Post icon
            label: 'Post',
            shortcut: 'Ctrl+Enter',
            onClick: () => postMutation.mutate(),
            variant: 'default' as const, // Highlight post action
        }] : []),
        ...(isPosted ? [{
            icon: <PiXBold />,
            label: 'Unpost',
            onClick: () => unpostMutation.mutate(),
            variant: 'secondary' as const,
        }] : []),
        {
            icon: <PiXBold />,
            label: 'Cancel',
            shortcut: 'Esc',
            onClick: () => router.back(),
            variant: 'ghost',
        },
    ]

    return (
        <div className="flex flex-col h-full">
            <CommandBar mainActions={actions} />

            <div className="flex-1 overflow-auto p-6">
                <div className="max-w-6xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>{tf('number')}</Label>
                            <Input
                                value={formData.number || ''}
                                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                                disabled={!canEdit}
                            />
                        </div>
                        <div>
                            <Label>{tf('date')}</Label>
                            <Input
                                type="datetime-local"
                                value={formData.date?.slice(0, 16) || ''}
                                onChange={(e) => setFormData({ ...formData, date: new Date(e.target.value).toISOString() })}
                                disabled={!canEdit}
                            />
                        </div>
                        <div>
                            <Label>Warehouse</Label>
                            <ReferenceSelector
                                apiEndpoint="/directories/warehouses/"
                                value={formData.warehouse}
                                onSelect={(val) => setFormData({ ...formData, warehouse: val as number })}
                                disabled={!canEdit}
                            />
                        </div>
                        <div>
                            <Label>Responsible Person</Label>
                            <Input
                                value={formData.responsible || ''}
                                onChange={(e) => setFormData({ ...formData, responsible: e.target.value })}
                                disabled={!canEdit}
                            />
                        </div>
                        <div className="col-span-2">
                            <Label>{tf('comment')}</Label>
                            <Input
                                value={formData.comment || ''}
                                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                                disabled={!canEdit}
                            />
                        </div>
                    </div>

                    {/* Lines */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-lg font-semibold">Items</h3>
                            {canEdit && (
                                <Button onClick={addLine} size="sm">
                                    <PiPlusBold className="mr-2 h-4 w-4" />
                                    Add Line
                                </Button>
                            )}
                        </div>
                        <DataTable columns={columns} data={lines} isLoading={false} />
                    </div>
                </div>
            </div>
        </div>
    )
}
