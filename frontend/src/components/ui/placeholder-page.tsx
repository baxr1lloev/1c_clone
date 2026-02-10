'use client';

import { useTranslations } from 'next-intl';
import { PiSquaresFourBold } from 'react-icons/pi';

interface PlaceholderPageProps {
    title: string;
    description?: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
    const t = useTranslations('common');

    return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-6rem)] space-y-4 text-center p-8">
            <div className="bg-muted/30 p-6 rounded-full">
                <PiSquaresFourBold className="w-16 h-16 text-muted-foreground/50" />
            </div>
            <div className="space-y-2 max-w-md">
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                <p className="text-muted-foreground">
                    {description || t('underConstruction', { defaultMessage: 'This section is currently under development.' })}
                </p>
            </div>
        </div>
    );
}
