'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { SalesOrder } from '@/types';
import { SalesOrderForm } from '@/components/documents/sales-order-form';

interface PageProps {
    params: {
        id: string;
    };
}

export default function SalesOrderEditRoutePage({ params }: PageProps) {
    const { data: document, isLoading, error } = useQuery({
        queryKey: ['sales-orders', params.id],
        queryFn: async () => {
            const response = await api.get<SalesOrder>(`/documents/sales-orders/${params.id}/`);
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
                <p className="text-muted-foreground">The requested sales order could not be found.</p>
            </div>
        );
    }

    return <SalesOrderForm mode="edit" initialData={document} />;
}
