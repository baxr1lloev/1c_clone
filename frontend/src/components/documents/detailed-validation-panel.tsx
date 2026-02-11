'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    PiWarningBold,
    PiXCircleBold,
    PiCheckCircleBold,
    PiArrowRightBold,
    PiEyeBold
} from 'react-icons/pi';
import { cn } from '@/lib/utils';

interface ValidationError {
    field?: string;
    message: string;
    severity: 'error' | 'warning';
    details?: {
        item_name?: string;
        required?: number;
        available?: number;
        shortage?: number;
        line_number?: number;
    };
    actions?: {
        label: string;
        onClick: () => void;
        variant?: 'default' | 'outline' | 'destructive';
    }[];
}

interface DetailedValidationPanelProps {
    errors: ValidationError[];
    warnings: ValidationError[];
    canPost: boolean;
}

export function DetailedValidationPanel({
    errors,
    warnings,
    canPost
}: DetailedValidationPanelProps) {
    if (errors.length === 0 && warnings.length === 0) {
        return (
            <Alert className="border-2 border-green-500 bg-green-50">
                <PiCheckCircleBold className="h-5 w-5 text-green-600" />
                <AlertTitle className="text-green-900 font-bold">
                    ✓ Ready to Post
                </AlertTitle>
                <AlertDescription className="text-green-700">
                    All validations passed. Document is ready for posting.
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-3">
            {/* Errors */}
            {errors.map((error, index) => (
                <Alert key={`error-${index}`} variant="destructive" className="border-2">
                    <PiXCircleBold className="h-5 w-5" />
                    <AlertTitle className="font-bold flex items-center gap-2">
                        {error.field && <Badge variant="destructive">{error.field}</Badge>}
                        Error: Cannot Post
                    </AlertTitle>
                    <AlertDescription>
                        <div className="mt-2 space-y-3">
                            {/* Basic message */}
                            <div className="font-medium">{error.message}</div>

                            {/* PHASE B: Detailed breakdown with numbers! */}
                            {error.details && (
                                <div className="bg-red-100 p-3 rounded-lg border border-red-300">
                                    {error.details.item_name && (
                                        <div className="font-bold text-red-900 mb-2">
                                            Товар: {error.details.item_name}
                                            {error.details.line_number && (
                                                <span className="ml-2 text-sm">
                                                    (Строка #{error.details.line_number})
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-3 gap-3 text-sm">
                                        {error.details.available !== undefined && (
                                            <div>
                                                <div className="text-red-700 text-xs uppercase">На складе:</div>
                                                <div className="font-mono font-bold text-lg">
                                                    {error.details.available} шт
                                                </div>
                                            </div>
                                        )}

                                        {error.details.required !== undefined && (
                                            <div>
                                                <div className="text-red-700 text-xs uppercase">Требуется:</div>
                                                <div className="font-mono font-bold text-lg">
                                                    {error.details.required} шт
                                                </div>
                                            </div>
                                        )}

                                        {error.details.shortage !== undefined && (
                                            <div>
                                                <div className="text-red-900 text-xs uppercase font-bold">
                                                    НЕ ХВАТАЕТ:
                                                </div>
                                                <div className="font-mono font-bold text-xl text-red-600">
                                                    {error.details.shortage} шт ⚠️
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* PHASE B: Action buttons! */}
                            {error.actions && error.actions.length > 0 && (
                                <div className="flex gap-2 mt-3">
                                    {error.actions.map((action, idx) => (
                                        <Button
                                            key={idx}
                                            size="sm"
                                            onClick={action.onClick}
                                            variant={action.variant || 'outline'}
                                        >
                                            {action.label}
                                        </Button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </AlertDescription>
                </Alert>
            ))}

            {/* Warnings */}
            {warnings.map((warning, index) => (
                <Alert key={`warning-${index}`} className="border-2 border-yellow-500 bg-yellow-50">
                    <PiWarningBold className="h-5 w-5 text-yellow-600" />
                    <AlertTitle className="text-yellow-900 font-bold flex items-center gap-2">
                        {warning.field && <Badge variant="outline" className="bg-yellow-100">{warning.field}</Badge>}
                        Warning
                    </AlertTitle>
                    <AlertDescription>
                        <div className="mt-2 space-y-3">
                            <div className="font-medium text-yellow-900">{warning.message}</div>

                            {/* Details for warnings */}
                            {warning.details && (
                                <div className="bg-yellow-100 p-3 rounded-lg border border-yellow-300">
                                    {warning.details.item_name && (
                                        <div className="font-bold text-yellow-900 mb-2">
                                            {warning.details.item_name}
                                        </div>
                                    )}

                                    {warning.details.available !== undefined && (
                                        <div className="text-sm">
                                            <span className="text-yellow-700">Остаток после продажи: </span>
                                            <span className="font-mono font-bold">
                                                {warning.details.available} шт
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Action buttons for warnings */}
                            {warning.actions && warning.actions.length > 0 && (
                                <div className="flex gap-2 mt-3">
                                    {warning.actions.map((action, idx) => (
                                        <Button
                                            key={idx}
                                            size="sm"
                                            onClick={action.onClick}
                                            variant={action.variant || 'outline'}
                                            className="border-yellow-600"
                                        >
                                            {action.label}
                                        </Button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </AlertDescription>
                </Alert>
            ))}

            {/* Summary */}
            <div className={cn(
                "flex items-center justify-between p-4 rounded-lg border-2",
                canPost
                    ? "bg-yellow-50 border-yellow-500"
                    : "bg-red-50 border-red-500"
            )}>
                <div className="flex items-center gap-3">
                    {canPost ? (
                        <>
                            <PiWarningBold className="h-6 w-6 text-yellow-600" />
                            <div>
                                <div className="font-bold text-yellow-900">Can Post with Warnings</div>
                                <div className="text-sm text-yellow-700">
                                    {warnings.length} warning(s) - please review
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <PiXCircleBold className="h-6 w-6 text-red-600" />
                            <div>
                                <div className="font-bold text-red-900">Cannot Post</div>
                                <div className="text-sm text-red-700">
                                    {errors.length} error(s) must be fixed
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {!canPost && (
                    <Badge variant="destructive" className="text-sm py-1 px-3">
                        ⚠️ Blocked
                    </Badge>
                )}
            </div>
        </div>
    );
}
