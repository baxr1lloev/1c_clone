'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { InventoryDocumentForm } from '@/components/documents/inventory-document-form';
import { DocumentTab } from '@/components/documents/document-tab';
import { Loader2 } from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';

export default function InventoryDocumentDetailPage() {
    const params = useParams();
    const id = parseInt(params.id as string);

    const { data: doc, isLoading } = useQuery({
        queryKey: ['inventory', id],
        queryFn: async () => {
            // For Form, we can use standard detail endpoint
            // Assuming detail serializer returns enough info for Form
            const res = await api.get(`/documents/inventory/${id}/`);
            return res;
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
        { label: 'Inventory (Phys. Count)', href: '/documents/inventory' },
        { label: doc.number },
    ];

    return (
        <div className="flex flex-col h-full bg-background">
            <div className="px-6 py-2 border-b">
                <Breadcrumbs segments={breadcrumbs} />
            </div>

            <div className="flex-1 overflow-hidden">
                {doc.status === 'draft' ? (
                    <InventoryDocumentForm initialData={doc} mode="edit" />
                ) : (
                    <div className="container mx-auto py-6">
                        <DocumentTab documentId={id} documentType="inventory" />
                    </div>
                )}
            </div>
        </div>
    );
}
