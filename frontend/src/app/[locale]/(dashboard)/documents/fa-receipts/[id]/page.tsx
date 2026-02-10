'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { FAReceiptDocument } from '@/types';
import { FAReceiptDocumentForm } from '@/components/documents/fa-receipt-document-form';

export default function EditFAReceiptPage() {
    const params = useParams();
    const id = parseInt(params.id as string);

    const { data: doc, isLoading } = useQuery({
        queryKey: ['fa-receipt', id],
        queryFn: async () => {
            const response = await api.get<FAReceiptDocument>(`/documents/fa-receipts/${params.id}/`);
            return response;
        },
    });

    if (isLoading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!doc) {
        return <div>Document not found</div>;
    }

    return (
        <div className="container mx-auto py-6 max-w-4xl">
            <FAReceiptDocumentForm initialData={doc} mode={doc.status === 'posted' ? 'view' : 'edit'} />
        </div>
    );
}
