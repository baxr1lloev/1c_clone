'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CashOrderForm } from '@/components/documents/cash-order-form';
import { CashOrderType } from '@/types';

function NewCashOrderContent() {
    const searchParams = useSearchParams();
    const type = (searchParams.get('type') as CashOrderType) || 'incoming';
    return <CashOrderForm mode="create" initialType={type} />;
}

export default function NewCashOrderPage() {
    return (
        <Suspense fallback={<div className="p-6 animate-pulse bg-muted/30 rounded-lg h-64" />}>
            <NewCashOrderContent />
        </Suspense>
    );
}
