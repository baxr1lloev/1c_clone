'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PiWarningBold, PiXCircleBold, PiCheckCircleBold } from 'react-icons/pi';

interface ValidationError {
    type: string;
    message: string;
    line_id?: number | string;
    [key: string]: any;
}

interface ValidationWarning {
    type: string;
    message: string;
    line_id?: number | string;
    [key: string]: any;
}

interface ValidationPanelProps {
    errors: ValidationError[];
    warnings: ValidationWarning[];
    canPost: boolean;
    className?: string;
}

export function ValidationPanel({ errors, warnings, canPost, className }: ValidationPanelProps) {
    const hasErrors = errors.length > 0;
    const hasWarnings = warnings.length > 0;

    if (!hasErrors && !hasWarnings) {
        return (
            <Card className={className}>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-green-600">
                        <PiCheckCircleBold className="h-5 w-5" />
                        <span className="font-medium">Document is valid and ready to post</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={className}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Validation</CardTitle>
                    <Badge variant={canPost ? "outline" : "destructive"}>
                        {canPost ? 'Can Post' : 'Cannot Post'}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Errors - blocking */}
                {hasErrors && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-red-600 font-semibold">
                            <PiXCircleBold className="h-5 w-5" />
                            <span>{errors.length} Error{errors.length > 1 ? 's' : ''}</span>
                        </div>
                        {errors.map((error, idx) => (
                            <Alert key={idx} variant="destructive">
                                <PiXCircleBold className="h-4 w-4" />
                                <AlertTitle className="font-semibold">
                                    {error.type.replace(/_/g, ' ').toUpperCase()}
                                </AlertTitle>
                                <AlertDescription>
                                    {error.message}
                                    {error.line_id && (
                                        <div className="text-xs mt-1">
                                            Line: {error.line_id}
                                        </div>
                                    )}
                                    {error.required && error.available && (
                                        <div className="mt-2 p-2 bg-red-50 rounded text-sm font-mono">
                                            Required: {error.required}<br />
                                            Available: {error.available}<br />
                                            <strong>Short: {error.short}</strong>
                                        </div>
                                    )}
                                </AlertDescription>
                            </Alert>
                        ))}
                    </div>
                )}

                {hasErrors && hasWarnings && <Separator />}

                {/* Warnings - non-blocking */}
                {hasWarnings && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-yellow-600 font-semibold">
                            <PiWarningBold className="h-5 w-5" />
                            <span>{warnings.length} Warning{warnings.length > 1 ? 's' : ''}</span>
                        </div>
                        {warnings.map((warning, idx) => (
                            <Alert key={idx} variant="default" className="border-yellow-500 bg-yellow-50">
                                <PiWarningBold className="h-4 w-4 text-yellow-600" />
                                <AlertTitle className="font-semibold text-yellow-800">
                                    {warning.type.replace(/_/g, ' ').toUpperCase()}
                                </AlertTitle>
                                <AlertDescription className="text-yellow-700">
                                    {warning.message}
                                    {warning.line_id && (
                                        <div className="text-xs mt-1">
                                            Line: {warning.line_id}
                                        </div>
                                    )}
                                </AlertDescription>
                            </Alert>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
