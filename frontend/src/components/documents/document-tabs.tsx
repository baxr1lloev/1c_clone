'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

import { EnhancedJournalEntriesTable } from './enhanced-journal-entries-table';
import { MovementsTable } from './movements-table';
import { AuditTrailTable } from './audit-trail-table';
import { DocumentChain } from './document-chain';
import { Badge } from '@/components/ui/badge';
import { useParams } from 'next/navigation';

interface DocumentTabsProps {
    documentId: number;
    documentType: 'sales' | 'purchase' | 'transfer' | 'inventory';
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export function DocumentTabs({ documentId, documentType, activeTab, onTabChange }: DocumentTabsProps) {
    const params = useParams();
    const locale = params.locale as string;

    // Fetch movements
    const { data: movements } = useQuery({
        queryKey: ['movements', documentType, documentId],
        queryFn: async () => {
            const response = await api.get(`/documents/${documentType}/${documentId}/movements`);
            return response;
        },
        enabled: activeTab === 'movements',
    });

    // Fetch journal entries - PHASE C: Now using enhanced table!
    const { data: journalEntries } = useQuery({
        queryKey: ['journal-entries', documentType, documentId],
        queryFn: async () => {
            const response = await api.get(`/documents/${documentType}/${documentId}/journal-entries`);
            return response;
        },
        enabled: activeTab === 'journal',
    });

    // Fetch audit trail
    const { data: auditTrail } = useQuery({
        queryKey: ['audit-trail', documentType, documentId],
        queryFn: async () => {
            const response = await api.get(`/documents/${documentType}/${documentId}/audit`);
            return response;
        },
        enabled: activeTab === 'audit',
    });

    // Fetch document chain
    const { data: documentChain } = useQuery({
        queryKey: ['document-chain', documentType, documentId],
        queryFn: async () => {
            const response = await api.get(`/documents/${documentType}/${documentId}/chain`);
            return response;
        },
        enabled: activeTab === 'chain',
    });

    return (
        <Card className="mt-6">
            <CardContent className="p-0">
                <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
                    <div className="border-b px-6">
                        <TabsList className="h-12 bg-transparent p-0">
                            <TabsTrigger
                                value="details"
                                className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 font-medium"
                            >
                                Details
                            </TabsTrigger>
                            <TabsTrigger
                                value="movements"
                                className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 font-medium"
                            >
                                Movements
                                {movements && movements.length > 0 && (
                                    <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                                        {movements.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger
                                value="journal"
                                className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 font-medium"
                            >
                                Journal Entries
                                {journalEntries && journalEntries.length > 0 && (
                                    <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                                        {journalEntries.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger
                                value="audit"
                                className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 font-medium"
                            >
                                Audit Trail
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="details" className="mt-6 px-6">
                        <p className="text-sm text-muted-foreground">
                            Document details are shown in the main view above.
                        </p>
                    </TabsContent>

                    <TabsContent value="movements" className="mt-6">
                        {movements && movements.length > 0 ? (
                            <MovementsTable movements={movements} />
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                No movements yet. Post the document to create movements.
                            </p>
                        )}
                    </TabsContent>

                    <TabsContent value="journal" className="mt-6">
                        {/* PHASE C: Enhanced table with drill-down! */}
                        <EnhancedJournalEntriesTable
                            entries={journalEntries || []}
                            locale={locale}
                        />
                    </TabsContent>

                    <TabsContent value="audit" className="mt-6">
                        {auditTrail && auditTrail.length > 0 ? (
                            <AuditTrailTable trail={auditTrail} />
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                No audit trail available.
                            </p>
                        )}
                    </TabsContent>
                    <TabsContent value="chain" className="mt-6">
                        <DocumentChain
                            documentType={
                                documentType === 'sales' ? 'sales-documents' :
                                    documentType === 'purchase' ? 'purchase-documents' :
                                        documentType === 'transfer' ? 'transfers' :
                                            'sales-documents' // Fallback/Default
                            }
                            documentId={documentId}
                        />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
