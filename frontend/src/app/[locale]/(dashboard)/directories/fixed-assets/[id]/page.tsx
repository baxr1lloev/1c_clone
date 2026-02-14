'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { FixedAsset, FixedAssetCategory } from '@/types';
import { FixedAssetForm } from '@/components/assets/fixed-asset-form';

export default function EditFixedAssetPage() {
    const params = useParams();
    const id = parseInt(params.id as string);

    const { data: asset, isLoading } = useQuery({
        queryKey: ['fixed-asset', id],
        queryFn: async () => {
            const response = await api.get<FixedAsset>(`/fixed-assets/assets/${params.id}/`);
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
            <FixedAssetForm initialData={asset} />
        </div>
    );
}
