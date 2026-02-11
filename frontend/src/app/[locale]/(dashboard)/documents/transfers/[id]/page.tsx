'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { TransferDocumentForm } from '@/components/documents/transfer-document-form';
import { DocumentTab } from '@/components/documents/document-tab';
import { Loader2 } from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';

export default function TransferDocumentDetailPage() {
    const params = useParams();
    const id = parseInt(params.id as string);

    const { data: doc, isLoading } = useQuery({
        queryKey: ['transfers', id],
        queryFn: async () => {
            const res = await api.get(`/documents/transfers/${id}/`);
            return res; // API already returns unwrapped data
        },
        // Ensure query doesn't return undefined
        initialData: undefined,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!doc) return <div>Document not found</div>;

    const breadcrumbs = [
        { label: 'Home', href: '/' },
        { label: 'Documents', href: '/documents' },
        { label: 'Transfers', href: '/documents/transfers' },
        { label: doc.number },
    ];

    return (
        <div className="flex flex-col h-full bg-background">
            <div className="px-6 py-2 border-b">
                <Breadcrumbs segments={breadcrumbs} />
            </div>
            <div>
                {doc.status === 'draft' ? (
                    <TransferDocumentForm mode="edit" initialData={doc} />
                ) : (
                    <div className="container mx-auto py-6">
                        <DocumentTab documentId={id} documentType="transfer" />
                    </div>
                )}
            </div>
        </div>
    );
}
