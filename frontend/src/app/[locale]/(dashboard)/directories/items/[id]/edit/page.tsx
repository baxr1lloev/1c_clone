'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { Item } from '@/types';
import { ItemForm } from '@/components/directories/item-form';

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export default function ItemEditPage({ params }: PageProps) {
    const { id } = use(params);

    const { data: item, isLoading, error } = useQuery({
        queryKey: ['item', id, 'edit'],
        queryFn: async () => {
            return api.get<Item>(`/directories/items/${id}/`);
        },
    });

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error || !item) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center flex-col gap-4">
                <h2 className="text-xl font-bold">Item not found</h2>
                <p className="text-muted-foreground">The requested item could not be found.</p>
            </div>
        );
    }

    return <ItemForm mode="edit" initialData={item} />;
}
