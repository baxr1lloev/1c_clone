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

interface TransferDocumentLine {
    id?: number
    item: number
    item_name?: string
    quantity: number
}

interface TransferDocument {
    id?: number
    number: string
    date: string
    comment?: string
    from_warehouse: number
    to_warehouse: number
    counterparty?: number | null
    status?: string
    lines: TransferDocumentLine[]
}

interface TransferDocumentFormProps {
    mode: 'create' | 'edit'
    initialData?: TransferDocument
}

export function TransferDocumentForm({ initialData, mode }: TransferDocumentFormProps) {
    const tDetail = useTranslations('documents.detail')
    const tTransferForm = useTranslations('documents.transferForm')
    const tc = useTranslations('common')
    const tf = useTranslations('fields')
    const router = useRouter()
    const queryClient = useQueryClient()

    const [formData, setFormData] = useState<Partial<TransferDocument>>(initialData || {
        date: new Date().toISOString(),
        number: 'Auto',
        status: 'draft',
        lines: [],
    })

    const [lines, setLines] = useState<TransferDocumentLine[]>(initialData?.lines || [])

    const isPosted = initialData?.status === 'posted'
    const canEdit = mode === 'create' ? true : !isPosted

    // Save Mutation
    const saveMutation = useMutation({
        mutationFn: async (data: Partial<TransferDocument>) => {
            if (mode === 'create') {
                const res = await api.post('/documents/transfers/', data)
                return res
            } else {
                const res = await api.put(`/documents/transfers/${initialData?.id}/`, data)
                return res
            }
        },
        onSuccess: (data) => {
            toast.success(mode === 'create' ? tTransferForm('created') : tTransferForm('updated'))
            queryClient.invalidateQueries({ queryKey: ['transfers'] })
            router.push(`/documents/transfers/${data.id}`)
        },
        onError: (error: unknown) => {
            const { title, description } = mapApiError(error)
            toast.error(title, { description })
        },
    })

    const handleSave = () => {
        const payload = {
            ...formData,
            lines: lines.map(l => ({ item: l.item, quantity: l.quantity }))
        }
        saveMutation.mutate(payload)
    }

    const addLine = () => {
        setLines([...lines, { item: 0, quantity: 1 }])
    }

    const removeLine = (index: number) => {
        setLines(lines.filter((_, i) => i !== index))
    }

    const updateLine = (index: number, field: 'item' | 'quantity', value: number) => {
        const newLines = [...lines]
        newLines[index] = { ...newLines[index], [field]: value }
        setLines(newLines)
    }

    // Hotkeys
    useHotkeys('ctrl+s', (e) => { e.preventDefault(); handleSave() }, [formData, lines])
    useHotkeys('esc', () => router.back(), [])

    const columns: ColumnDef<TransferDocumentLine>[] = [
        {
            accessorKey: 'item',
            header: tf('item'),
            cell: ({ row }) => (
                <ReferenceSelector
                    apiEndpoint="/directories/items/"
                    value={row.original.item}
                    onSelect={(val) => updateLine(row.index, 'item', Number(val || 0))}
                    placeholder={tTransferForm('selectItem')}
                    label=""
                    disabled={!canEdit}
                />
            ),
        },
        {
            accessorKey: 'quantity',
            header: tf('quantity'),
            cell: ({ row }) => (
                <Input
                    type="number"
                    value={row.original.quantity}
                    onChange={(e) => updateLine(row.index, 'quantity', parseFloat(e.target.value) || 0)}
                    disabled={!canEdit}
                    className="w-32"
                />
            ),
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

    const actions: CommandBarAction[] = [
        {
            icon: <PiFloppyDiskBold />,
            label: tc('save'),
            shortcut: 'Ctrl+S',
            onClick: handleSave,
            disabled: !canEdit,
        },
        {
            icon: <PiXBold />,
            label: tc('cancel'),
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
                            <Label>{tf('sourceWarehouse')}</Label>
                            <ReferenceSelector
                                apiEndpoint="/directories/warehouses/"
                                value={formData.from_warehouse}
                                onSelect={(val) => setFormData({ ...formData, from_warehouse: val as number })}
                                placeholder={tTransferForm('selectWarehouse')}
                                label=""
                                disabled={!canEdit}
                            />
                        </div>
                        <div>
                            <Label>{tf('targetWarehouse')}</Label>
                            <ReferenceSelector
                                apiEndpoint="/directories/warehouses/"
                                value={formData.to_warehouse}
                                onSelect={(val) => setFormData({ ...formData, to_warehouse: val as number })}
                                placeholder={tTransferForm('selectWarehouse')}
                                label=""
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
                            <h3 className="text-lg font-semibold">{tTransferForm('items')}</h3>
                            {canEdit && (
                                <Button onClick={addLine} size="sm">
                                    <PiPlusBold className="mr-2 h-4 w-4" />
                                    {tDetail('shortcuts.addLine')}
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
