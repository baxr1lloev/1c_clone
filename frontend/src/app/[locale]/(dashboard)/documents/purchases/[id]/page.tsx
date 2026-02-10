'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { PurchaseDocumentForm } from '@/components/documents/purchase-document-form';
import { DocumentTab } from '@/components/documents/document-tab';
import { Loader2 } from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';

export default function PurchaseDocumentDetailPage() {
    const params = useParams();
    const id = parseInt(params.id as string);

    const { data: doc, isLoading } = useQuery({
        queryKey: ['purchase', id],
        queryFn: async () => {
            const res = await api.get(`/documents/purchases/${id}/`);
            return res.data;
        }
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
        { label: 'Purchases', href: '/documents/purchases' },
        { label: doc.number },
    ];

    return (
        <div className="flex flex-col h-full bg-background">
            <div className="px-6 py-2 border-b">
                <Breadcrumbs segments={breadcrumbs} />
            </div>

            <div className="flex-1 overflow-hidden">
                {doc.status === 'draft' ? (
                    <PurchaseDocumentForm mode="edit" initialData={doc} />
                ) : (
                    <div className="container mx-auto py-6">
                        <DocumentTab documentId={id} documentType="purchase" />
                    </div>
                )}
            </div>
        </div>
    );
}
