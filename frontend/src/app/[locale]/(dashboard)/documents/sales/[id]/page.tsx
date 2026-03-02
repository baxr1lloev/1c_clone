'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useTranslations } from 'next-intl';

import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// PHASE A-D: Enhanced intelligence components
import { DetailedValidationPanel } from '@/components/documents/detailed-validation-panel';
import { DocumentContextPanel } from '@/components/documents/document-context-panel';
import { SmartLineItemForm } from '@/components/documents/smart-line-item-form';
import { PriceBreakdown } from '@/components/documents/price-breakdown';
import { useDocumentValidation } from '@/hooks/use-document-validation';
import { useDocumentKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

// ENTERPRISE: Period protection
import { PeriodStatusBanner } from '@/components/documents/period-status-banner';

// Existing components
import { BackToListButton } from '@/components/documents/back-to-list-button';
import { StandardDocumentHeader } from '@/components/documents/standard-document-header';
import { DocumentActionToolbar } from '@/components/documents/document-action-toolbar';
import { DocumentTabs } from '@/components/documents/document-tabs';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { PiTrashBold } from 'react-icons/pi';

export default function LiveSalesDocumentPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const rawDocumentId = Array.isArray(params.id) ? params.id[0] : params.id;
    const documentId = Number(rawDocumentId);
    const tNav = useTranslations('nav');
    const tCommon = useTranslations('common');
    const tFields = useTranslations('fields');
    const tDetail = useTranslations('documents.detail');

    const [showLineForm, setShowLineForm] = useState(false);
    const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState('details');

    // Fetch document
    const { data: document, isLoading, isError, error } = useQuery({
        queryKey: ['sales-document', documentId],
        queryFn: async () => {
            const response = await api.get(`/documents/sales/${documentId}/`);
            return response;
        },
        enabled: Number.isFinite(documentId) && documentId > 0,
        retry: false,
    });

    // Real-time validation (auto-validates every 5 seconds!)
    const { validation, canPost, refetch: refetchValidation } = useDocumentValidation({
        documentType: 'sales',
        documentId: documentId,
        enabled: !!document && document.status === 'draft'
    });

    // PHASE A: Post document mutation with visual effects!
    const { mutate: postDocument } = useMutation({
        mutationFn: async () => {
            const response = await api.post(`/documents/sales/${documentId}/post/`);
            return response;
        },
        onSuccess: () => {
            // PHASE A: Enhanced success toast with icon and duration
            toast.success(`✅ ${tDetail('toasts.postSuccessTitle')}`, {
                description: tDetail('toasts.postSuccessDescription'),
                duration: 3000,
            });
            queryClient.invalidateQueries({ queryKey: ['sales-document', documentId] });

            // PHASE A: Auto-switch to movements tab with delay for effect
            setTimeout(() => {
                setActiveTab('movements');
            }, 500);
        },
        onError: (error: unknown) => {
            const apiError = error as { response?: { data?: { error?: string } } };
            toast.error(`❌ ${tDetail('toasts.postErrorTitle')}`, {
                description: apiError.response?.data?.error || tDetail('toasts.postErrorDescription'),
                duration: 5000,
            });
        }
    });

    // Unpost mutation
    const { mutate: unpostDocument } = useMutation({
        mutationFn: async () => {
            const response = await api.post(`/documents/sales/${documentId}/unpost/`);
            return response;
        },
        onSuccess: () => {
            toast.success(tDetail('toasts.unpostSuccess'));
            queryClient.invalidateQueries({ queryKey: ['sales-document', documentId] });
        },
    });

    // Delete line mutation
    const { mutate: deleteLine } = useMutation({
        mutationFn: async (lineId: number) => {
            await api.delete(`/documents/sales/${documentId}/lines/${lineId}`);
        },
        onSuccess: () => {
            toast.success(tDetail('toasts.lineDeleted'));
            queryClient.invalidateQueries({ queryKey: ['sales-document', documentId] });
            refetchValidation();
        },
    });

    // Save mutation
    const { mutate: saveDocument } = useMutation({
        mutationFn: async (data: Record<string, unknown>) => {
            const response = await api.patch(`/documents/sales/${documentId}/`, data);
            return response;
        },
        onSuccess: () => {
            toast.success(tDetail('toasts.documentSaved'));
            queryClient.invalidateQueries({ queryKey: ['sales-document', documentId] });
        },
    });

    // KEYBOARD SHORTCUTS - Full 1C experience!
    useDocumentKeyboardShortcuts({
        onPost: () => {
            if (canPost && document?.status === 'draft') {
                postDocument();
            }
        },
        onSave: () => saveDocument(document),
        onAddLine: () => setShowLineForm(true),
        onDeleteLine: (lineId) => {
            if (lineId) deleteLine(lineId);
        },
        onCancel: () => router.push('/documents/sales'),
        selectedLineId: selectedLineId || undefined,
        enabled: !!document
    });

    const breadcrumbs = [
        { label: tNav('main'), href: '/' },
        { label: tNav('documents'), href: '/documents' },
        { label: tNav('sales'), href: '/documents/sales' },
        { label: document?.number || `#${documentId}` },
    ];

    if (isLoading) {
        return <div className="container mx-auto py-6">{tDetail('loading')}</div>;
    }

    if (!Number.isFinite(documentId) || documentId <= 0) {
        return (
            <div className="container mx-auto py-6 space-y-4">
                <div className="text-lg font-semibold">{tDetail('notFound')}</div>
                <div className="text-sm text-muted-foreground">Некорректный идентификатор документа.</div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => router.push('/documents/sales')}>
                        К списку реализаций
                    </Button>
                    <Button onClick={() => router.push('/documents/sales/new')}>
                        Создать реализацию
                    </Button>
                </div>
            </div>
        );
    }

    if (isError || !document) {
        const apiError = error as { response?: { status?: number; data?: { error?: string } } } | undefined;
        const is404 = apiError?.response?.status === 404;
        return (
            <div className="container mx-auto py-6 space-y-4">
                <div className="text-lg font-semibold">{is404 ? tDetail('notFound') : 'Ошибка загрузки документа'}</div>
                <div className="text-sm text-muted-foreground">
                    {apiError?.response?.data?.error || (is404 ? 'Документ с таким номером не найден или недоступен.' : 'Не удалось получить данные с сервера.')}
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => router.push('/documents/sales')}>
                        К списку реализаций
                    </Button>
                    <Button onClick={() => router.push('/documents/sales/new')}>
                        Создать реализацию
                    </Button>
                </div>
            </div>
        );
    }

    const isDraft = document.status === 'draft';
    const lines = document.lines || [];

    return (
        <div className="container mx-auto py-6 space-y-6">
            <Breadcrumbs segments={breadcrumbs} />

            {/* ENTERPRISE: Period Closed Warning */}
            {document?.date && (
                <PeriodStatusBanner date={document.date} className="mb-4" />
            )}

            <BackToListButton href="/documents/sales" label={tDetail('backToList')} />

            {/* Action Toolbar */}
            <DocumentActionToolbar
                documentType="sales"
                status={document.status}
                onPost={() => postDocument()}
                onUnpost={() => unpostDocument()}
                onPostAndClose={() => {
                    postDocument();
                    setTimeout(() => router.push('/documents/sales'), 500);
                }}
                onShowPostings={() => setActiveTab('journal')}
                onDelete={() => {
                    // Delete logic
                }}
                canPost={canPost}
                canUnpost={document.status === 'posted'}
                canDelete={document.status === 'draft'}
            />

            <div className="grid grid-cols-4 gap-6">
                {/* Main content - 3 columns */}
                <div className="col-span-3 space-y-6">
                    {/* PHASE B: DETAILED VALIDATION PANEL - with exact numbers! */}
                    {isDraft && validation && (
                        <DetailedValidationPanel
                            errors={validation.errors}
                            warnings={validation.warnings}
                            canPost={canPost}
                        />
                    )}

                    {/* Document Header */}
                    <Card>
                        <CardHeader>
                            <CardTitle>{tDetail('salesDocument')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <StandardDocumentHeader
                                documentNumber={document.number}
                                documentDate={document.date}
                                status={document.status}
                                fields={[
                                    {
                                        label: tFields('customer'),
                                        value: document.counterparty?.name || tDetail('na'),
                                    },
                                    {
                                        label: tFields('warehouse'),
                                        value: document.warehouse?.name || tDetail('na')
                                    },
                                    {
                                        label: tCommon('total'),
                                        value: `${Number(document.total_amount || 0).toFixed(2)} UZS`,
                                    }
                                ]}
                            />
                        </CardContent>
                    </Card>

                    {/* Document Tabs */}
                    <DocumentTabs
                        documentId={documentId}
                        documentType="sales"
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                    />

                    {/* Line Items Table */}
                    {activeTab === 'details' && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>{tDetail('lineItems')}</CardTitle>
                                    {isDraft && (
                                        <Button
                                            onClick={() => setShowLineForm(!showLineForm)}
                                            size="sm"
                                        >
                                            {showLineForm ? tCommon('cancel') : tDetail('addLine')}
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                {/* Smart Line Item Form - with Phase A auto-focus! */}
                                {showLineForm && isDraft && (
                                    <div className="mb-6">
                                        <SmartLineItemForm
                                            documentType="sales"
                                            customerId={document.counterparty?.id}
                                            warehouseId={document.warehouse?.id}
                                            date={document.date}
                                            tenantId={document.tenant}
                                            onLineChange={(line) => {
                                                // Add line via API
                                                api.post(`/documents/sales/${documentId}/lines`, line)
                                                    .then(() => {
                                                        setShowLineForm(false);
                                                        queryClient.invalidateQueries({ queryKey: ['sales-document', documentId] });
                                                        refetchValidation();
                                                    })
                                                    .catch((error) => {
                                                        toast.error(`${tDetail('toasts.addLineFailed')}: ${error.message}`);
                                                    });
                                            }}
                                            onCancel={() => setShowLineForm(false)}
                                        />
                                    </div>
                                )}

                                {/* Lines Table */}
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>{tFields('item')}</TableHead>
                                            <TableHead>{tFields('quantity')}</TableHead>
                                            <TableHead>{tFields('price')}</TableHead>
                                            <TableHead>{tDetail('table.discount')}</TableHead>
                                            <TableHead>{tDetail('table.vat')}</TableHead>
                                            <TableHead>{tCommon('total')}</TableHead>
                                            {isDraft && <TableHead>{tCommon('actions')}</TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {lines.map((line: {
                                            id: number;
                                            item?: { name?: string };
                                            quantity?: number;
                                            unit?: string;
                                            price?: number;
                                            discount?: number;
                                            vat_rate?: number;
                                        }) => (
                                            <TableRow
                                                key={line.id}
                                                onClick={() => setSelectedLineId(line.id)}
                                                className={selectedLineId === line.id ? 'bg-blue-50' : ''}
                                            >
                                                <TableCell>{line.item?.name}</TableCell>
                                                <TableCell className="font-mono">
                                                    {line.quantity} {line.unit}
                                                </TableCell>
                                                <TableCell className="font-mono">
                                                    {Number(line.price || 0).toFixed(2)}
                                                </TableCell>
                                                <TableCell className="font-mono">
                                                    {line.discount || 0}%
                                                </TableCell>
                                                <TableCell className="font-mono">
                                                    {line.vat_rate || 0}%
                                                </TableCell>
                                                <TableCell>
                                                    {/* PRICE BREAKDOWN - Click to see calculation! */}
                                                    <PriceBreakdown
                                                        price={Number(line.price || 0)}
                                                        quantity={Number(line.quantity || 0)}
                                                        discountPercent={Number(line.discount || 0)}
                                                        vatRate={Number(line.vat_rate || 0)}
                                                    />
                                                </TableCell>
                                                {isDraft && (
                                                    <TableCell>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                deleteLine(line.id);
                                                            }}
                                                        >
                                                            <PiTrashBold className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>

                                {lines.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">
                                        {tDetail('noLineItems')}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* CONTEXT PANEL - 1 column */}
                <div className="col-span-1">
                    <DocumentContextPanel
                        customerId={document.counterparty?.id}
                        warehouseId={document.warehouse?.id}
                    />
                </div>
            </div>

            {/* Keyboard shortcuts hint */}
            <Card className="bg-gray-50">
                <CardContent className="pt-4">
                    <div className="text-xs text-muted-foreground grid grid-cols-4 gap-2">
                        <div><kbd className="px-2 py-1 bg-background border rounded">F9</kbd> {tDetail('shortcuts.post')}</div>
                        <div><kbd className="px-2 py-1 bg-background border rounded">Ins</kbd> {tDetail('shortcuts.addLine')}</div>
                        <div><kbd className="px-2 py-1 bg-background border rounded">Del</kbd> {tDetail('shortcuts.deleteLine')}</div>
                        <div><kbd className="px-2 py-1 bg-background border rounded">Ctrl+S</kbd> {tDetail('shortcuts.save')}</div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
