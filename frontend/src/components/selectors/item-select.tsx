'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { ReferenceSelector } from '@/components/ui/reference-selector';

interface ItemSelectProps {
    value: any;
    onChange: (item: any) => void;
    tenantId: number;
    disabled?: boolean;
}

export function ItemSelect({ value, onChange, tenantId, disabled }: ItemSelectProps) {
    const [search, setSearch] = useState('');

    const { data: items, isLoading } = useQuery({
        queryKey: ['items', search, tenantId],
        queryFn: async () => {
            const response = await api.get('/directories/items', {
                params: {
                    search: search,
                    page_size: 50
                }
            });
            return response.data.results || response.data;
        },
    });

    return (
        <ReferenceSelector
            value={value?.name || ''}
            onSelect={(item) => onChange(item)}
            options={items || []}
            isLoading={isLoading}
            onSearch={setSearch}
            placeholder="Select item..."
            disabled={disabled}
            displayField="name"
            valueField="id"
        />
    );
}
