'use client';

import { PlaceholderPage } from '@/components/ui/placeholder-page';
import { useTranslations } from 'next-intl';

export default function ProductionPage() {
    const t = useTranslations('nav');
    return <PlaceholderPage title="Production" description="Manufacturing and production management subsystem is coming soon." />;
}
