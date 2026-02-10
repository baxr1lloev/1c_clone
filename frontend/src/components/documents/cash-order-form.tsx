"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useHotkeys } from "react-hotkeys-hook"
import { useQueryClient, useMutation } from "@tanstack/react-query"
import { CommandBar, CommandBarAction } from "@/components/ui/command-bar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import api from "@/lib/api"
import { CashOrder, CashOrderType } from "@/types"
import {
    PiFloppyDiskBold,
    PiCheckCircleBold,
    PiPrinterBold,
    PiXBold,
    PiArrowUpRightBold,
    PiArrowDownLeftBold,
    PiMoneyBold
} from "react-icons/pi"
import { cn } from "@/lib/utils"
import { mapApiError } from "@/lib/error-mapper"
import { PrintPreviewDialog } from "@/components/documents/print-preview-dialog"
import { ReferenceSelector } from "@/components/ui/reference-selector"
import { Badge } from "@/components/ui/badge"
import { DocumentPostings } from "@/components/documents/document-postings"

interface CashOrderFormProps {
    mode: 'create' | 'edit'
    initialData?: CashOrder
    initialType?: CashOrderType
}

export function CashOrderForm({ initialData, mode, initialType = 'incoming' }: CashOrderFormProps) {
    const t = useTranslations('documents')
    const tc = useTranslations('common')
    const tf = useTranslations('fields')
    const router = useRouter()
    const queryClient = useQueryClient()
    const [printOpen, setPrintOpen] = useState(false)

    // Form State
    const [formData, setFormData] = useState<Partial<CashOrder>>(initialData || {
        date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        status: 'draft',
        order_type: initialType,
        currency: 1, // Default ID for main currency
        amount: 0,
        purpose: "",
        basis: "",
        counterparty_name: "",
        counterparty: null
    })

    const isPosted = initialData?.is_posted ?? (formData.status === 'posted');
    const canEdit = mode === 'create' ? true : (!isPosted && (initialData?.can_edit ?? true));

    // Derived State
    const isIncoming = formData.order_type === 'incoming';

    // Actions
    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            const payload = {
                ...data,
                // Ensure counterparty_name is set if counterparty ID is not
                counterparty_name: data.counterparty_name || (data.counterparty ? `ID:${data.counterparty}` : 'Unknown'),
            };

            if (mode === 'create') return api.post('/documents/cash-orders/', payload);
            return api.put(`/documents/cash-orders/${initialData!.id}/`, payload);
        },
        onSuccess: (response) => {
            toast.success(tc('savedSuccessfully'));
            queryClient.invalidateQueries({ queryKey: ['cash-orders'] });
            if (mode === 'create') {
                router.push(`/documents/cash-orders/${response.data.id}`);
            }
        },
        onError: (err) => {
            const { title, description } = mapApiError(err);
            toast.error(title, { description });
        }
    })

    const postMutation = useMutation({
        mutationFn: async () => api.post(`/documents/cash-orders/${initialData!.id}/post_document/`),
        onMutate: async () => {
            setFormData({ ...formData, status: 'posted' });
            toast.success(t('postedSuccessfully'));
        },
        onError: (err: any) => {
            setFormData({ ...formData, status: 'draft' });
            const { title, description } = mapApiError(err);
            toast.error(title, { description });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cash-orders'] });
            router.refresh();
        }
    })

    const unpostMutation = useMutation({
        mutationFn: async () => api.post(`/documents/cash-orders/${initialData!.id}/unpost_document/`),
        onMutate: async () => {
            setFormData({ ...formData, status: 'draft' });
            toast.success(t('unpostedSuccessfully'));
        },
        onError: (err: any) => {
            setFormData({ ...formData, status: 'posted' });
            toast.error("Failed to unpost");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cash-orders'] });
            router.refresh();
        }
    })

    // Shortcuts
    useHotkeys('ctrl+s', (e) => {
        e.preventDefault();
        if (canEdit) saveMutation.mutate(formData);
    }, { enableOnFormTags: true }, [formData, canEdit]);

    useHotkeys('ctrl+enter, f9', (e) => {
        e.preventDefault();
        if (!isPosted && initialData?.id) postMutation.mutate();
    }, { enableOnFormTags: true }, [isPosted, initialData]);

    useHotkeys('esc', () => router.back(), { enableOnFormTags: true });

    // Actions Bar
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
            onClick: () => saveMutation.mutate(formData),
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

    return (
        <Tabs defaultValue="main" className="h-[calc(100vh-4rem)] flex flex-col bg-background">
            {/* Header */}
            <div className="border-b px-4 flex items-center justify-between shrink-0 bg-muted/10">
                <TabsList className="bg-transparent p-0">
                    <TabsTrigger value="main" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Main</TabsTrigger>
                    <TabsTrigger value="postings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary" disabled={!isPosted}>Postings</TabsTrigger>
                </TabsList>

                {/* Visual Indicator of Type */}
                <div className="flex items-center gap-2 px-4 py-2">
                    <Badge variant={isIncoming ? "default" : "secondary"} className={cn("text-sm px-3 py-1 flex gap-2", isIncoming ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700 text-white")}>
                        {isIncoming ? <PiArrowDownLeftBold className="h-4 w-4" /> : <PiArrowUpRightBold className="h-4 w-4" />}
                        {isIncoming ? "PKO (Incoming)" : "RKO (Outgoing)"}
                    </Badge>
                    {isPosted ?
                        <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">POSTED</Badge> :
                        <Badge variant="outline">DRAFT</Badge>
                    }
                </div>
            </div>

            <TabsContent value="main" className="flex-1 flex flex-col m-0 p-0 outline-none overflow-auto">
                <CommandBar mainActions={actions} className="border-b shrink-0" />

                <div className="p-8 max-w-4xl mx-auto w-full space-y-8">

                    {/* Top Row: Basic Info */}
                    <div className="grid grid-cols-12 gap-6">
                        {/* Operation Type Selector */}
                        <div className="col-span-12 md:col-span-4 space-y-2">
                            <Label>Operation Type</Label>
                            <div className="flex p-1 bg-muted rounded-lg">
                                <button
                                    className={cn("flex-1 py-1.5 text-sm font-medium rounded-md transition-all", isIncoming ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
                                    onClick={() => canEdit && setFormData({ ...formData, order_type: 'incoming' })}
                                    disabled={!canEdit}
                                >
                                    PKO (In)
                                </button>
                                <button
                                    className={cn("flex-1 py-1.5 text-sm font-medium rounded-md transition-all", !isIncoming ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
                                    onClick={() => canEdit && setFormData({ ...formData, order_type: 'outgoing' })}
                                    disabled={!canEdit}
                                >
                                    RKO (Out)
                                </button>
                            </div>
                        </div>

                        <div className="col-span-6 md:col-span-4 space-y-2">
                            <Label>{tc('number')}</Label>
                            <Input
                                disabled={!canEdit}
                                value={formData.number || ''}
                                onChange={e => setFormData({ ...formData, number: e.target.value })}
                                placeholder="Auto"
                                className="font-mono bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background border-transparent"
                            />
                        </div>

                        <div className="col-span-6 md:col-span-4 space-y-2">
                            <Label>{tc('date')}</Label>
                            <Input
                                type="date"
                                disabled={!canEdit}
                                value={formData.date?.substring(0, 10)}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                                className="bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background border-transparent"
                            />
                        </div>
                    </div>

                    {/* Financial Core */}
                    <div className="p-6 bg-card border rounded-xl shadow-sm space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Counterparty */}
                            <div className="space-y-2">
                                <Label>{tf('counterparty')}</Label>
                                <ReferenceSelector
                                    className="bg-background border-input"
                                    value={formData.counterparty as number}
                                    onSelect={(val) => setFormData({ ...formData, counterparty: val as number })}
                                    apiEndpoint="/directories/counterparties/"
                                    placeholder={isIncoming ? "Payer (Client)" : "Payee (Supplier)"}
                                    disabled={!canEdit}
                                />
                            </div>

                            {/* Basis */}
                            <div className="space-y-2">
                                <Label>Basis Document</Label>
                                <Input
                                    value={formData.basis || ''}
                                    onChange={e => setFormData({ ...formData, basis: e.target.value })}
                                    placeholder="e.g. Invoice #123"
                                    disabled={!canEdit}
                                />
                            </div>
                        </div>

                        {/* Amount - BIG */}
                        <div className="pt-4 border-t grid grid-cols-12 gap-6 items-center">
                            <div className="col-span-12 md:col-span-12">
                                <Label className="text-lg font-bold text-muted-foreground">Amount</Label>
                                <div className="relative mt-2">
                                    <Input
                                        type="number"
                                        className="h-16 text-3xl font-bold font-mono pl-4 pr-20 bg-muted/10 border-2 focus:border-primary"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                                        disabled={!canEdit}
                                        min="0"
                                        step="0.01"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        <span className="text-lg font-bold text-muted-foreground">
                                            {initialData?.currency_code || 'USD'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Purpose */}
                    <div className="space-y-2">
                        <Label>Purpose / Description</Label>
                        <Textarea
                            className="min-h-[100px] resize-none bg-yellow-50/30 dark:bg-yellow-900/5 focus:bg-background"
                            placeholder="Reason for cash transaction..."
                            value={formData.purpose || ''}
                            onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                            disabled={!canEdit}
                        />
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="postings" className="flex-1 p-8 m-0 overflow-auto">
                {initialData?.id ? (
                    <DocumentPostings documentId={initialData.id} endpoint="cash-orders" />
                ) : (
                    <div className="p-8 text-center text-muted-foreground">Save the document to view postings.</div>
                )}
            </TabsContent>

            <PrintPreviewDialog
                open={printOpen}
                onOpenChange={setPrintOpen}
                document={initialData}
                tenant={initialData?.tenant}
            />
        </Tabs>
    )
}
