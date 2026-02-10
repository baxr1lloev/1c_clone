'use client';

import { useTranslations } from 'next-intl';
import { PiWarningBold, PiCaretLeftBold } from 'react-icons/pi';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface UnderConstructionProps {
    title: string;
    description?: string;
    module?: string;
}

export default function UnderConstruction({ title, description, module }: UnderConstructionProps) {
    const router = useRouter();

    return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] bg-slate-50 dark:bg-zinc-950 p-8 text-center">
            <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <PiWarningBold className="w-12 h-12 text-orange-500" />
            </div>

            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                {title}
            </h1>

            <p className="text-muted-foreground max-w-md mb-8 text-lg">
                {description || "This feature is currently under development. It will be part of the upcoming full release."}
            </p>

            {module && (
                <div className="mb-8 px-4 py-2 bg-slate-200 dark:bg-zinc-800 rounded-md font-mono text-sm">
                    Module: {module}
                </div>
            )}

            <Button variant="outline" onClick={() => router.back()} className="gap-2">
                <PiCaretLeftBold /> Go Back
            </Button>
        </div>
    );
}
