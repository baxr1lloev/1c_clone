'use client';

import { ReferenceSelector } from '@/components/ui/reference-selector';

interface ItemSelectProps {
    value: { id: number; name?: string } | null;
    onChange: (item: { id: number; name?: string } | null) => void;
    tenantId: number;
    disabled?: boolean;
}

export function ItemSelect({ value, onChange, tenantId, disabled }: ItemSelectProps) {
    return (
        <ReferenceSelector
            value={value?.id ?? null}
            onSelect={(id, item) => onChange(id != null ? (item ?? { id, name: '' }) : null)}
            apiEndpoint="/directories/items/"
            placeholder="Select item..."
            disabled={disabled}
            displayField="name"
            secondaryField="sku"
        />
    );
}
