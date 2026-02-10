'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { IntangibleAsset } from '@/types';
import { IntangibleAssetForm } from '@/components/assets/intangible-asset-form';

export default function EditIntangibleAssetPage() {
    const params = useParams();
    const id = parseInt(params.id as string);

    const { data: asset, isLoading } = useQuery({
        queryKey: ['intangible-asset', id],
        queryFn: async () => {
            const response = await api.get<IntangibleAsset>(`/directories/intangible-assets/${params.id}/`);
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

    if (!asset) {
        return <div>Asset not found</div>;
    }

    return (
        <div className="container mx-auto py-6 max-w-4xl">
            <IntangibleAssetForm initialData={asset} />
        </div>
    );
}
