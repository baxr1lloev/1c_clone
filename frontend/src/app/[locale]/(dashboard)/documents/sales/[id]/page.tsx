'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';

import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

// PHASE A-D: Enhanced intelligence components
import { DetailedValidationPanel } from '@/components/documents/detailed-validation-panel';
import { DocumentContextPanel } from '@/components/documents/document-context-panel';
import { SmartLineItemForm } from '@/components/documents/smart-line-item-form';
import { PriceBreakdown } from '@/components/documents/price-breakdown';
import { EnhancedJournalEntriesTable } from '@/components/documents/enhanced-journal-entries-table';
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
    const documentId = parseInt(params.id as string);

    const [showLineForm, setShowLineForm] = useState(false);
    const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState('details');

    // Fetch document
    const { data: document, isLoading } = useQuery({
        queryKey: ['sales-document', documentId],
        queryFn: async () => {
            const response = await api.get(`/documents/sales/${documentId}/`);
            return response;
        },
    });

    // Real-time validation (auto-validates every 5 seconds!)
    const { validation, canPost, refetch: refetchValidation } = useDocumentValidation({
        documentType: 'sales',
        documentId: documentId,
        enabled: !!document && document.status === 'draft'
    });

    // PHASE A: Post document mutation with visual effects!
    const { mutate: postDocument, isPending: isPosting } = useMutation({
        mutationFn: async () => {
            const response = await api.post(`/documents/sales/${documentId}/post/`);
            return response;
        },
        onSuccess: () => {
            // PHASE A: Enhanced success toast with icon and duration
            toast.success('✅ Document Posted!', {
                description: 'Movements and journal entries created',
                duration: 3000,
            });
            queryClient.invalidateQueries({ queryKey: ['sales-document', documentId] });

            // PHASE A: Auto-switch to movements tab with delay for effect
            setTimeout(() => {
                setActiveTab('movements');
            }, 500);
        },
        onError: (error: any) => {
            toast.error('❌ Posting Failed', {
                description: error.response?.data?.error || 'Failed to post document',
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
            toast.success('Document unposted successfully!');
            queryClient.invalidateQueries({ queryKey: ['sales-document', documentId] });
        },
    });

    // Delete line mutation
    const { mutate: deleteLine } = useMutation({
        mutationFn: async (lineId: number) => {
            await api.delete(`/documents/sales/${documentId}/lines/${lineId}`);
        },
        onSuccess: () => {
            toast.success('Line deleted');
            queryClient.invalidateQueries({ queryKey: ['sales-document', documentId] });
            refetchValidation();
        },
    });

    // Save mutation
    const { mutate: saveDocument } = useMutation({
        mutationFn: async (data: any) => {
            const response = await api.patch(`/documents/sales/${documentId}/`, data);
            return response;
        },
        onSuccess: () => {
            toast.success('Document saved');
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
        { label: 'Home', href: '/' },
        { label: 'Documents', href: '/documents' },
        { label: 'Sales', href: '/documents/sales' },
        { label: document?.number || `#${documentId}` },
    ];

    if (isLoading) {
        return <div className="container mx-auto py-6">Loading...</div>;
    }

    if (!document) {
        return <div className="container mx-auto py-6">Document not found</div>;
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

            <BackToListButton href="/documents/sales" />

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
                            <CardTitle>Sales Document</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <StandardDocumentHeader
                                documentNumber={document.number}
                                documentDate={document.date}
                                status={document.status}
                                fields={[
                                    {
                                        label: 'Customer',
                                        value: document.counterparty?.name || 'N/A',
                                    },
                                    {
                                        label: 'Warehouse',
                                        value: document.warehouse?.name || 'N/A'
                                    },
                                    {
                                        label: 'Total',
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
                                    <CardTitle>Line Items</CardTitle>
                                    {isDraft && (
                                        <Button
                                            onClick={() => setShowLineForm(!showLineForm)}
                                            size="sm"
                                        >
                                            {showLineForm ? 'Cancel' : 'Add Line (Ins)'}
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
                                                        toast.error('Failed to add line: ' + error.message);
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
                                            <TableHead>Item</TableHead>
                                            <TableHead>Quantity</TableHead>
                                            <TableHead>Price</TableHead>
                                            <TableHead>Discount</TableHead>
                                            <TableHead>VAT</TableHead>
                                            <TableHead>Total</TableHead>
                                            {isDraft && <TableHead>Actions</TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {lines.map((line: any) => (
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
                                        No line items yet. Click "Add Line" or press <kbd>Ins</kbd>
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
                        <div><kbd className="px-2 py-1 bg-white border rounded">F9</kbd> Post</div>
                        <div><kbd className="px-2 py-1 bg-white border rounded">Ins</kbd> Add Line</div>
                        <div><kbd className="px-2 py-1 bg-white border rounded">Del</kbd> Delete Line</div>
                        <div><kbd className="px-2 py-1 bg-white border rounded">Ctrl+S</kbd> Save</div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
