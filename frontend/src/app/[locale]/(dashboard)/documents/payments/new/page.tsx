'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PaymentDocumentForm } from '@/components/documents/payment-document-form';

function NewPaymentContent() {
    const searchParams = useSearchParams();
    const typeParam = (searchParams.get('type') || '').toUpperCase();
    const initialType = typeParam === 'OUTGOING' ? 'OUTGOING' : 'INCOMING';
    return <PaymentDocumentForm mode="create" initialType={initialType} />;
}

export default function CreatePaymentPage() {
    return (
        <Suspense fallback={<div className="p-6 animate-pulse bg-muted/30 rounded-lg h-64" />}>
            <NewPaymentContent />
        </Suspense>
    );
}
