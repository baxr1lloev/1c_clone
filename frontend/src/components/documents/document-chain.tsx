'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    PiArrowRightBold,
    PiPlusBold,
    PiFileTextBold,
    PiArrowSquareOutBold,
    PiLinkSimpleBold,
    PiMoneyBold,
    PiCheckCircleBold,
    PiWarningCircleBold,
    PiSpinnerGapBold,
} from 'react-icons/pi';
import { useTranslations } from 'next-intl';

interface DocumentChainProps {
    documentType: 'sales-documents' | 'purchase-documents' | 'payments' | 'sales-orders' | 'transfers';
    documentId: number;
}

interface ChainData {
    base_document: {
        type: string;
        type_display: string;
        id: number;
        display: string;
        url: string;
    } | null;
    child_documents: Array<{
        type: string;
        type_display: string;
        id: number;
        number: string;
        date: string;
        status: string;
        url: string;
    }>;
    available_creations: Array<{
        type: string;
        label: string;
    }>;
    settlement: {
        total_amount: number;
        paid_amount: number;
        remaining_amount: number;
        is_fully_paid: boolean;
        payments_count: number;
    } | null;
}

export function DocumentChain({ documentType, documentId }: DocumentChainProps) {
    const t = useTranslations('documents');
    const router = useRouter();
    const queryClient = useQueryClient();

    const { data, isLoading, error } = useQuery<ChainData>({
        queryKey: ['document-chain', documentType, documentId],
        queryFn: async () => {
            const response = await api.get(`/${documentType}/${documentId}/chain/`);
            return response.data;
        },
    });

    if (isLoading) {
        return (
            <Card className="mt-4">
                <CardContent className="py-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <PiSpinnerGapBold className="h-4 w-4 animate-spin" />
                        Loading document chain...
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error || !data) {
        return null; // Silently fail if chain endpoint not available
    }

    const hasContent = data.base_document ||
        data.child_documents.length > 0 ||
        data.available_creations.length > 0 ||
        data.settlement;

    if (!hasContent) {
        return null;
    }

    return (
        <Card className="mt-4">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <PiLinkSimpleBold className="h-5 w-5" />
                    Document Chain
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Base Document (Source) */}
                {data.base_document && (
                    <div className="p-3 border rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                            Based on
                        </div>
                        <Link
                            href={data.base_document.url}
                            className="flex items-center gap-2 font-medium text-primary hover:underline"
                        >
                            <PiFileTextBold className="h-4 w-4" />
                            {data.base_document.display}
                            <PiArrowSquareOutBold className="h-3 w-3 ml-auto" />
                        </Link>
                        <div className="text-xs text-muted-foreground mt-1">
                            {data.base_document.type_display}
                        </div>
                    </div>
                )}

                {/* Child Documents (Related) */}
                {data.child_documents.length > 0 && (
                    <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                            Related Documents ({data.child_documents.length})
                        </div>
                        <div className="space-y-2">
                            {data.child_documents.map((doc) => (
                                <Link
                                    key={`${doc.type}-${doc.id}`}
                                    href={doc.url}
                                    className="flex items-center justify-between p-2 border rounded hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <PiFileTextBold className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">{doc.number}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {doc.type_display}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(doc.date).toLocaleDateString()}
                                        </span>
                                        <Badge variant={doc.status === 'posted' ? 'default' : 'secondary'}>
                                            {doc.status}
                                        </Badge>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Settlement Summary */}
                {data.settlement && (
                    <div className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <PiMoneyBold className="h-4 w-4" />
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">
                                Settlement
                            </span>
                            {data.settlement.is_fully_paid ? (
                                <Badge variant="default" className="ml-auto bg-green-600">
                                    <PiCheckCircleBold className="h-3 w-3 mr-1" />
                                    Paid
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="ml-auto text-amber-600 border-amber-400">
                                    <PiWarningCircleBold className="h-3 w-3 mr-1" />
                                    Unpaid
                                </Badge>
                            )}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                            <div>
                                <div className="text-muted-foreground text-xs">Total</div>
                                <div className="font-medium">
                                    {data.settlement.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div>
                                <div className="text-muted-foreground text-xs">Paid</div>
                                <div className="font-medium text-green-600">
                                    {data.settlement.paid_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div>
                                <div className="text-muted-foreground text-xs">Remaining</div>
                                <div className={`font-medium ${data.settlement.remaining_amount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                                    {data.settlement.remaining_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Create on Basis Buttons */}
                {data.available_creations.length > 0 && (
                    <div>
                        <Separator className="my-3" />
                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                            Create on Basis
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {data.available_creations.map((creation) => (
                                <CreateOnBasisButton
                                    key={creation.type}
                                    documentType={documentType}
                                    documentId={documentId}
                                    targetType={creation.type}
                                    label={creation.label}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

interface CreateOnBasisButtonProps {
    documentType: string;
    documentId: number;
    targetType: string;
    label: string;
}

function CreateOnBasisButton({ documentType, documentId, targetType, label }: CreateOnBasisButtonProps) {
    const router = useRouter();
    const queryClient = useQueryClient();

    const { mutate, isPending } = useMutation({
        mutationFn: async () => {
            const response = await api.post(
                `/${documentType}/${documentId}/create_on_basis/`,
                { target_type: targetType }
            );
            return response.data;
        },
        onSuccess: (data) => {
            // Invalidate chain data
            queryClient.invalidateQueries({ queryKey: ['document-chain'] });

            // Navigate to new document
            if (data.url) {
                router.push(data.url);
            }
        },
        onError: (error: any) => {
            console.error('Failed to create document:', error);
            alert(error.response?.data?.error || 'Failed to create document');
        }
    });

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            disabled={isPending}
            className="gap-1"
        >
            {isPending ? (
                <PiSpinnerGapBold className="h-4 w-4 animate-spin" />
            ) : (
                <PiPlusBold className="h-4 w-4" />
            )}
            {label}
        </Button>
    );
}

export default DocumentChain;
