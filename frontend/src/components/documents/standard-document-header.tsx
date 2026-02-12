'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useTranslations } from 'next-intl';

interface DocumentHeaderField {
    label: string;
    value: React.ReactNode;
    span?: 1 | 2 | 3 | 4;
}

interface StandardDocumentHeaderProps {
    documentNumber: string;
    documentDate: string;
    status: 'draft' | 'posted' | 'cancelled';
    fields: DocumentHeaderField[];
    className?: string;
}

function StatusBadge({ status }: { status: 'draft' | 'posted' | 'cancelled' }) {
    const tDocuments = useTranslations('documents');

    switch (status) {
        case 'posted':
            return <Badge variant="posted">{tDocuments('posted')}</Badge>;
        case 'cancelled':
            return <Badge variant="cancelled">{tDocuments('cancelled')}</Badge>;
        default:
            return <Badge variant="draft">{tDocuments('draft')}</Badge>;
    }
}

export function StandardDocumentHeader({
    documentNumber,
    documentDate,
    status,
    fields,
    className
}: StandardDocumentHeaderProps) {
    const tCommon = useTranslations('common');

    return (
        <Card className={className}>
            <CardContent className="pt-6">
                <div className="grid grid-cols-4 gap-x-6 gap-y-4">
                    {/* Number - always first */}
                    <div>
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {tCommon('number')}
                        </Label>
                        <div className="font-mono font-bold text-lg mt-1">
                            {documentNumber}
                        </div>
                    </div>

                    {/* Date - always second */}
                    <div>
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {tCommon('date')}
                        </Label>
                        <div className="font-mono mt-1">
                            {new Date(documentDate).toLocaleDateString()}
                        </div>
                    </div>

                    {/* Status - always third */}
                    <div>
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {tCommon('status')}
                        </Label>
                        <div className="mt-1">
                            <StatusBadge status={status} />
                        </div>
                    </div>

                    <div /> {/* Spacer */}

                    {/* Custom fields in provided order */}
                    {fields.map((field, idx) => (
                        <div
                            key={idx}
                            className={field.span ? `col-span-${field.span}` : 'col-span-1'}
                        >
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                {field.label}
                            </Label>
                            <div className="mt-1">
                                {field.value}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
