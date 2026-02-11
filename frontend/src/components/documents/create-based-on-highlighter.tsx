'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { PiArrowRightBold, PiCheckCircleBold, PiWarningBold } from 'react-icons/pi';

interface HighlightedField {
    name: string;
    oldValue: any;
    newValue: any;
    status: 'transferred' | 'changed' | 'attention';
    label: string;
}

interface CreateBasedOnHighlighterProps {
    baseDocument: any;
    newDocument: any;
    documentType: string;
    children: React.ReactNode;
}

// PHASE E: Smart Create-Based-On Component
export function CreateBasedOnHighlighter({
    baseDocument,
    newDocument,
    documentType,
    children
}: CreateBasedOnHighlighterProps) {
    if (!baseDocument) {
        return <>{children}</>;
    }

    // Analyze what changed
    const highlightedFields: HighlightedField[] = [];

    // Customer - usually transfers
    if (newDocument.counterparty === baseDocument.counterparty) {
        highlightedFields.push({
            name: 'counterparty',
            oldValue: baseDocument.counterparty,
            newValue: newDocument.counterparty,
            status: 'transferred',
            label: 'Customer'
        });
    }

    // Warehouse - might change (e.g., Sales → Invoice doesn't need warehouse)
    if (newDocument.warehouse !== baseDocument.warehouse) {
        highlightedFields.push({
            name: 'warehouse',
            oldValue: baseDocument.warehouse,
            newValue: newDocument.warehouse,
            status: newDocument.warehouse ? 'changed' : 'attention',
            label: 'Warehouse'
        });
    }

    // Total - usually transfers but user should verify
    if (Math.abs((newDocument.total || 0) - (baseDocument.total || 0)) < 0.01) {
        highlightedFields.push({
            name: 'total',
            oldValue: baseDocument.total,
            newValue: newDocument.total,
            status: 'transferred',
            label: 'Total'
        });
    } else {
        highlightedFields.push({
            name: 'total',
            oldValue: baseDocument.total,
            newValue: newDocument.total,
            status: 'attention',
            label: 'Total'
        });
    }

    const transferred = highlightedFields.filter(f => f.status === 'transferred');
    const changed = highlightedFields.filter(f => f.status === 'changed');
    const needsAttention = highlightedFields.filter(f => f.status === 'attention');

    return (
        <div className="space-y-4">
            {/* Summary Banner */}
            <Alert className="border-2 border-blue-500 bg-blue-50">
                <PiCheckCircleBold className="h-5 w-5 text-blue-600" />
                <AlertDescription>
                    <div className="font-bold text-blue-900 mb-2">
                        Created based on: {baseDocument.number}
                    </div>
                    <div className="flex gap-4 text-sm">
                        {transferred.length > 0 && (
                            <div className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                                <span>{transferred.length} transferred</span>
                            </div>
                        )}
                        {changed.length > 0 && (
                            <div className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                                <span>{changed.length} changed</span>
                            </div>
                        )}
                        {needsAttention.length > 0 && (
                            <div className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                                <span>{needsAttention.length} require attention</span>
                            </div>
                        )}
                    </div>
                </AlertDescription>
            </Alert>

            {/* Detailed Changes */}
            {highlightedFields.length > 0 && (
                <Card className="border-2 border-blue-300">
                    <CardHeader>
                        <CardTitle className="text-sm text-muted-foreground uppercase">
                            Changes Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {highlightedFields.map((field, idx) => (
                                <div
                                    key={idx}
                                    className={cn(
                                        'p-3 rounded-lg border-2',
                                        field.status === 'transferred' && 'bg-green-50 border-green-300',
                                        field.status === 'changed' && 'bg-yellow-50 border-yellow-300',
                                        field.status === 'attention' && 'bg-red-50 border-red-300'
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {field.status === 'transferred' && (
                                                <PiCheckCircleBold className="h-4 w-4 text-green-600" />
                                            )}
                                            {field.status === 'changed' && (
                                                <PiArrowRightBold className="h-4 w-4 text-yellow-600" />
                                            )}
                                            {field.status === 'attention' && (
                                                <PiWarningBold className="h-4 w-4 text-red-600" />
                                            )}
                                            <span className="font-medium">{field.label}</span>
                                        </div>
                                        <Badge
                                            variant={
                                                field.status === 'transferred' ? 'default' :
                                                    field.status === 'changed' ? 'secondary' :
                                                        'destructive'
                                            }
                                        >
                                            {field.status === 'transferred' && 'Transferred'}
                                            {field.status === 'changed' && 'Changed'}
                                            {field.status === 'attention' && 'Review'}
                                        </Badge>
                                    </div>

                                    {field.status !== 'transferred' && (
                                        <div className="mt-2 text-sm font-mono">
                                            <div className="text-muted-foreground">
                                                Was: {field.oldValue || 'N/A'}
                                            </div>
                                            <div className="font-bold">
                                                Now: {field.newValue || 'N/A'}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Render children with highlighting context */}
            <div className="relative">
                {children}
            </div>
        </div>
    );
}

// Helper function to get field highlight status
export function useFieldHighlight(fieldName: string, baseDocument: any, newDocument: any) {
    if (!baseDocument) return null;

    const oldValue = baseDocument[fieldName];
    const newValue = newDocument[fieldName];

    if (oldValue === newValue) return 'transferred';
    if (newValue && oldValue) return 'changed';
    if (!newValue) return 'attention';
    return null;
}
