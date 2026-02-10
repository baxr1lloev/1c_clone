'use client';

import { PlaceholderPage } from '@/components/ui/placeholder-page';
import { useTranslations } from 'next-intl';

export default function OSPage() {
    const t = useTranslations('nav');
    return <PlaceholderPage title="OS and NMA" description="Fixed Assets and Intangible Assets management subsystem is coming soon." />;
}
