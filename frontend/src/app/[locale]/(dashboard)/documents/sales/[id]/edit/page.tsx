'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { SalesDocumentForm } from '@/components/documents/sales-document-form';
import api from '@/lib/api';
import { Loader2 } from 'lucide-react';
import { SalesDocument } from '@/types';

export default function EditSalesDocumentPage() {
    const params = useParams();
    const id = parseInt(params.id as string);

    const { data: document, isLoading } = useQuery({
        queryKey: ['sales', id],
        queryFn: async () => {
            const response = await api.get(`/documents/sales/${id}/`);
            return response.data as SalesDocument;
        },
        enabled: !!id,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[500px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!document) {
        return <div>Document not found</div>;
    }

    return <SalesDocumentForm mode="edit" initialData={document} />;
}
