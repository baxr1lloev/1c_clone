'use client';

import { useParams } from 'next/navigation';
import { DocumentTab } from '@/components/documents/document-tab';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';

export default function SalesDocumentDetailPage() {
    const params = useParams();
    const id = parseInt(params.id as string);

    const breadcrumbs = [
        { label: 'Home', href: '/' },
        { label: 'Documents', href: '/documents' },
        { label: 'Sales', href: '/documents/sales' },
        { label: `Sales #${id}` },
    ];

    return (
        <div className="container mx-auto py-6 space-y-6">
            <Breadcrumbs segments={breadcrumbs} />
            <DocumentTab documentId={id} documentType="sales" />
        </div>
    );
}
