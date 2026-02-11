'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';

import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { BackToListButton } from '@/components/documents/back-to-list-button';
import { StandardDocumentHeader } from '@/components/documents/standard-document-header';
import { DocumentActionToolbar } from '@/components/documents/document-action-toolbar';
import { DocumentTabs } from '@/components/documents/document-tabs';
import { ReferenceLink } from '@/components/ui/reference-link';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function SalesDocumentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const id = parseInt(params.id as string);

    const [activeTab, setActiveTab] = useState('items');

    // Fetch document data
    const { data: document, isLoading } = useQuery({
        queryKey: ['sales-document', id],
        queryFn: async () => {
            const response = await api.get(`/documents/sales/${id}`);
            return response.data;
        },
    });

    // Post mutation
    const { mutate: postDocument, isPending: isPosting } = useMutation({
        mutationFn: async () => {
            await api.post(`/documents/sales/${id}/post`);
        },
        onSuccess: () => {
            toast.success('Document posted successfully!');
            queryClient.invalidateQueries({ queryKey: ['sales-document', id] });
            // Auto-switch to Movements tab to show what happened
            setActiveTab('movements');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || 'Failed to post document');
        },
    });

    // Unpost mutation
    const { mutate: unpostDocument } = useMutation({
        mutationFn: async () => {
            await api.post(`/documents/sales/${id}/unpost`);
        },
        onSuccess: () => {
            toast.success('Document unposted successfully!');
            queryClient.invalidateQueries({ queryKey: ['sales-document', id] });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || 'Failed to unpost document');
        },
    });

    // Post and Close
    const handlePostAndClose = async () => {
        await postDocument();
        setTimeout(() => router.push('/documents/sales'), 1000);
    };

    // Show Postings - switch to Accounting tab
    const handleShowPostings = () => {
        setActiveTab('accounting');
    };

    // Keyboard shortcuts
    useKeyboardShortcuts({
        onPost: () => document?.can_post && postDocument(),
        enabled: !!document,
    });

    const breadcrumbs = [
        { label: 'Home', href: '/' },
        { label: 'Documents', href: '/documents' },
        { label: 'Sales', href: '/documents/sales' },
        { label: document?.number || `#${id}` },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (!document) {
        return <div>Document not found</div>;
    }

    return (
        <div className="container mx-auto">
            {/* Breadcrumbs */}
            <div className="py-4">
                <Breadcrumbs segments={breadcrumbs} />
            </div>

            {/* Back Button */}
            <BackToListButton
                href="/documents/sales"
                label="← Back to Sales List"
                className="mb-4"
            />

            {/* Document Action Toolbar - 1C Style */}
            <DocumentActionToolbar
                documentId={id}
                documentType="sales"
                status={document.status}
                canPost={document.can_post || false}
                canUnpost={document.can_unpost || false}
                canDelete={document.status === 'draft'}
                onPost={() => postDocument()}
                onUnpost={() => unpostDocument()}
                onPostAndClose={handlePostAndClose}
                onShowPostings={document.status === 'posted' ? handleShowPostings : undefined}
                createBasedOnOptions={
                    document.status === 'posted'
                        ? [
                            {
                                label: '→ Payment',
                                onClick: () => router.push(`/documents/payments/new?based_on=sales:${id}`),
                            },
                        ]
                        : undefined
                }
            />

            {/* Document Header - Consistent Layout */}
            <div className="mt-4">
                <StandardDocumentHeader
                    documentNumber={document.number}
                    documentDate={document.date}
                    status={document.status}
                    fields={[
                        {
                            label: 'Customer',
                            value: (
                                <ReferenceLink
                                    id={document.counterparty_id}
                                    type="counterparty"
                                    label={document.counterparty_name}
                                    showIcon
                                />
                            ),
                        },
                        {
                            label: 'Contract',
                            value: (
                                <ReferenceLink
                                    id={document.contract_id}
                                    type="contract"
                                    label={document.contract_number || `#${document.contract_id}`}
                                />
                            ),
                        },
                        {
                            label: 'Warehouse',
                            value: (
                                <ReferenceLink
                                    id={document.warehouse_id}
                                    type="warehouse"
                                    label={document.warehouse_name}
                                    showIcon
                                />
                            ),
                        },
                        {
                            label: 'Currency',
                            value: document.currency_code || 'UZS',
                        },
                        {
                            label: 'Total',
                            value: (
                                <div className="text-lg font-bold font-mono">
                                    {document.total_amount?.toFixed(2)} {document.currency_code}
                                </div>
                            ),
                            span: 2,
                        },
                    ]}
                />
            </div>

            {/* Document Tabs - 5-Tab 1C Interface */}
            <div className="mt-6">
                <DocumentTabs
                    documentId={id}
                    documentType="sales"
                    isPosted={document.status === 'posted'}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    itemsContent={<div>Line items table here</div>}
                />
            </div>
        </div>
    );
}
