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
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import api from "@/lib/api"
import { PaymentDocument, PaymentType } from "@/types"
import {
    PiFloppyDiskBold,
    PiCheckCircleBold,
    PiPrinterBold,
    PiXBold,
    PiArrowUpRightBold,
    PiArrowDownLeftBold,
    PiBankBold
} from "react-icons/pi"
import { cn } from "@/lib/utils"
import { mapApiError } from "@/lib/error-mapper"
import { PrintPreviewDialog } from "@/components/documents/print-preview-dialog"
import { ReferenceSelector } from "@/components/ui/reference-selector"
import { Badge } from "@/components/ui/badge"
import { DocumentPostings } from "@/components/documents/document-postings"
import { DocumentHistoryPanel } from "@/components/documents/document-history-panel"

interface PaymentDocumentFormProps {
    mode: 'create' | 'edit'
    initialData?: PaymentDocument
}

export function PaymentDocumentForm({ initialData, mode }: PaymentDocumentFormProps) {
    const t = useTranslations('documents')
    const tc = useTranslations('common')
    const tf = useTranslations('fields')
    const router = useRouter()
    const queryClient = useQueryClient()
    const [printOpen, setPrintOpen] = useState(false)

    // Form State
    const [formData, setFormData] = useState<Partial<PaymentDocument>>(initialData || {
        date: new Date().toISOString(),
        status: 'draft',
        payment_type: 'INCOMING', // Default to Incoming
        currency: 1, // Default ID for USD
        rate: 1,
        amount: 0,
        purpose: ""
    })

    const isPosted = initialData?.is_posted ?? (formData.status === 'posted');
    const canEdit = mode === 'create' ? true : (!isPosted && (initialData?.can_edit ?? true));

    // Derived State
    const isIncoming = formData.payment_type === 'INCOMING';

    // Actions
    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            if (mode === 'create') return api.post('/documents/payments/', data);
            return api.put(`/documents/payments/${initialData!.id}/`, data);
        },
        onSuccess: () => {
            toast.success(tc('savedSuccessfully'));
            queryClient.invalidateQueries({ queryKey: ['payment-documents'] });
            if (mode === 'create') router.push('/documents/payments');
        },
        onError: (err) => {
            const { title, description } = mapApiError(err);
            toast.error(title, { description });
        }
    })

    const postMutation = useMutation({
        mutationFn: async () => api.post(`/documents/payments/${initialData!.id}/post/`),
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
            queryClient.invalidateQueries({ queryKey: ['payment-documents'] });
            router.refresh();
        }
    })

    const unpostMutation = useMutation({
        mutationFn: async () => api.post(`/documents/payments/${initialData!.id}/unpost/`),
        onMutate: async () => {
            setFormData({ ...formData, status: 'draft' });
            toast.success(t('unpostedSuccessfully'));
        },
        onError: () => {
            setFormData({ ...formData, status: 'posted' });
            toast.error("Failed to unpost");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payment-documents'] });
            router.refresh();
        }
    })

    // Shortcuts
    useHotkeys('ctrl+s', (e) => {
        e.preventDefault();
        if (!isPosted) saveMutation.mutate(formData);
    }, { enableOnFormTags: true }, [formData, isPosted]);

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
                    <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">History</TabsTrigger>
                    <TabsTrigger value="postings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary" disabled={!isPosted}>Postings</TabsTrigger>
                </TabsList>

                {/* Visual Indicator of Type */}
                <div className="flex items-center gap-2 px-4 py-2">
                    <Badge variant={isIncoming ? "default" : "destructive"} className="text-sm px-3 py-1 flex gap-2">
                        {isIncoming ? <PiArrowDownLeftBold className="h-4 w-4" /> : <PiArrowUpRightBold className="h-4 w-4" />}
                        {isIncoming ? "Incoming Payment" : "Outgoing Payment"}
                    </Badge>
                    {isPosted && <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">POSTED</Badge>}
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
                                    onClick={() => canEdit && setFormData({ ...formData, payment_type: 'INCOMING' })}
                                    disabled={!canEdit}
                                >
                                    Incoming (Receipt)
                                </button>
                                <button
                                    className={cn("flex-1 py-1.5 text-sm font-medium rounded-md transition-all", !isIncoming ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
                                    onClick={() => canEdit && setFormData({ ...formData, payment_type: 'OUTGOING' })}
                                    disabled={!canEdit}
                                >
                                    Outgoing (Payment)
                                </button>
                            </div>
                        </div>

                        <div className="col-span-6 md:col-span-4 space-y-2">
                            <Label>{tc('number')}</Label>
                            <Input
                                disabled={!canEdit}
                                value={formData.number || ''}
                                onChange={e => setFormData({ ...formData, number: e.target.value })}
                                className="font-mono bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background border-transparent"
                            />
                        </div>

                        <div className="col-span-6 md:col-span-4 space-y-2">
                            <Label>{tc('date')}</Label>
                            <Input
                                type="datetime-local"
                                disabled={!canEdit}
                                value={formData.date ? new Date(formData.date).toISOString().slice(0, 16) : ''}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                                className="bg-yellow-50/50 dark:bg-yellow-900/10 focus:bg-background border-transparent"
                            />
                        </div>
                    </div>

                    {/* Financial Core */}
                    <div className="p-6 bg-card border rounded-xl shadow-sm space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Bank Account */}
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <PiBankBold className="h-4 w-4 text-primary" />
                                    Bank Account
                                </Label>
                                <ReferenceSelector
                                    className="bg-background border-input"
                                    value={formData.bank_account as number}
                                    onSelect={(val) => setFormData({ ...formData, bank_account: val as number })}
                                    apiEndpoint="/directories/bank-accounts/"
                                    placeholder="Select Bank Account..."
                                    displayField="bank_name"
                                    disabled={!canEdit}
                                />
                            </div>

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
                        </div>

                        {/* Amount - BIG */}
                        <div className="pt-4 border-t grid grid-cols-12 gap-6 items-center">
                            <div className="col-span-12 md:col-span-8">
                                <Label className="text-lg font-bold text-muted-foreground">Amount</Label>
                                <div className="relative mt-2">
                                    <Input
                                        type="number"
                                        className="h-16 text-3xl font-bold font-mono pl-4 pr-20 bg-muted/10 border-2 focus:border-primary"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                                        disabled={!canEdit}
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        <span className="text-lg font-bold text-muted-foreground">USD</span>
                                    </div>
                                </div>
                            </div>

                            <div className="col-span-12 md:col-span-4 space-y-4">
                                <div className="space-y-1">
                                    <Label className="text-xs">Exchange Rate</Label>
                                    <Input
                                        type="number"
                                        className="h-8 font-mono text-right"
                                        value={formData.rate}
                                        onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) || 1 })}
                                        disabled={!canEdit}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Contract</Label>
                                    <ReferenceSelector
                                        value={formData.contract as number}
                                        onSelect={(val) => setFormData({ ...formData, contract: val as number })}
                                        apiEndpoint="/directories/contracts/"
                                        placeholder="Contract..."
                                        disabled={!canEdit}
                                        className="h-8"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Purpose */}
                    <div className="space-y-2">
                        <Label>Payment Purpose</Label>
                        <Textarea
                            className="min-h-[100px] resize-none bg-yellow-50/30 dark:bg-yellow-900/5 focus:bg-background"
                            placeholder="Enter payment details..."
                            value={formData.purpose || ''}
                            onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                            disabled={!canEdit}
                        />
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="history" className="p-8">
                {initialData?.id ? (
                    <DocumentHistoryPanel documentId={initialData.id} documentType="payments" />
                ) : (
                    <div className="p-8 text-center text-muted-foreground">Save the document to view history.</div>
                )}
            </TabsContent>

            <TabsContent value="postings" className="flex-1 p-8 m-0 overflow-auto">
                {initialData?.id ? (
                    <DocumentPostings documentId={initialData.id} endpoint="payments" />
                ) : (
                    <div className="p-8 text-center text-muted-foreground">Save the document to view postings.</div>
                )}
            </TabsContent>

            <PrintPreviewDialog
                open={printOpen}
                onOpenChange={setPrintOpen}
                document={initialData}
                tenant={initialData?.tenant} // Optional, but good to pass if available
            />
        </Tabs>
    )
}
