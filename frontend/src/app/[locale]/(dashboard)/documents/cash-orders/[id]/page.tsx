'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { CashOrder } from '@/types';
import { CashOrderForm } from '@/components/documents/cash-order-form';

interface PageProps {
    params: {
        id: string;
    };
}

export default function CashOrderEditPage({ params }: PageProps) {
    const { data: document, isLoading, error } = useQuery({
        queryKey: ['cash-orders', params.id],
        queryFn: async () => {
            const response = await api.get<CashOrder>(`/documents/cash-orders/${params.id}/`);
            return response;
        }
    });

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error || !document) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center flex-col gap-4">
                <h2 className="text-xl font-bold">Document not found</h2>
                <p className="text-muted-foreground">The requested cash order could not be found.</p>
            </div>
        );
    }

    return <CashOrderForm mode="edit" initialData={document} />;
}
