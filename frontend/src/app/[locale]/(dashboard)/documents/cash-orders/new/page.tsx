'use client';

import { useSearchParams } from 'next/navigation';
import { CashOrderForm } from '@/components/documents/cash-order-form';
import { CashOrderType } from '@/types';

export default function NewCashOrderPage() {
    const searchParams = useSearchParams();
    const type = (searchParams.get('type') as CashOrderType) || 'incoming';

    return <CashOrderForm mode="create" initialType={type} />;
}
