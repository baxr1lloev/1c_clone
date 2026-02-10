'use client';

import { PlaceholderPage } from '@/components/ui/placeholder-page';
import { useTranslations } from 'next-intl';

export default function SalaryPage() {
    const t = useTranslations('nav');
    return <PlaceholderPage title="Salary and Personnel" description="Payroll and HR management subsystem is coming soon." />;
}
