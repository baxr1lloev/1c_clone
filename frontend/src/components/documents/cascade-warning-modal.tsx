"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PiWarningBold, PiXCircleBold } from "react-icons/pi";

interface CascadeDependency {
    can_unpost: boolean;
    can_delete: boolean;
    warnings: string[];
    blockers: string[];
    children: Array<{
        type: string;
        documents: Array<{
            number: string;
            status: string;
        }>;
    }>;
}

interface CascadeWarningModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    dependency: CascadeDependency | null;
    action: 'unpost' | 'delete';
    onProceed: () => void;
}

/**
 * ENTERPRISE: Cascade Dependency Warning Modal
 * 
 * Shows user what will happen BEFORE they unpost/delete a document with children.
 * Prevents breaking document chains by showing blockers.
 */
export function CascadeWarningModal({
    open,
    onOpenChange,
    dependency,
    action,
    onProceed
}: CascadeWarningModalProps) {
    if (!dependency) return null;

    const canProceed = action === 'unpost' ? dependency.can_unpost : dependency.can_delete;
    const hasBlockers = dependency.blockers.length > 0;
    const hasWarnings = dependency.warnings.length > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {hasBlockers ? (
                            <>
                                <PiXCircleBold className="h-5 w-5 text-destructive" />
                                Cannot {action === 'unpost' ? 'Unpost' : 'Delete'} Document
                            </>
                        ) : (
                            <>
                                <PiWarningBold className="h-5 w-5 text-yellow-600" />
                                {action === 'unpost' ? 'Unpost' : 'Delete'} with Dependencies?
                            </>
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        This document has related documents. Review the impact before proceeding.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                    {/* Blockers - Hard stops */}
                    {hasBlockers && (
                        <Alert variant="destructive">
                            <AlertTitle className="font-bold mb-2">❌ Cannot Proceed</AlertTitle>
                            <AlertDescription>
                                <ul className="list-disc list-inside space-y-1">
                                    {dependency.blockers.map((blocker, i) => (
                                        <li key={i} className="text-sm">{blocker}</li>
                                    ))}
                                </ul>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Warnings - Soft warnings */}
                    {hasWarnings && !hasBlockers && (
                        <Alert variant="default" className="border-yellow-300 bg-yellow-50 dark:bg-yellow-950">
                            <AlertTitle className="font-bold mb-2 text-yellow-800 dark:text-yellow-200">
                                ⚠️ Warning
                            </AlertTitle>
                            <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                                <ul className="list-disc list-inside space-y-1">
                                    {dependency.warnings.map((warn, i) => (
                                        <li key={i} className="text-sm">{warn}</li>
                                    ))}
                                </ul>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Related Documents List */}
                    {dependency.children.length > 0 && (
                        <div className="border rounded-lg p-4">
                            <div className="font-semibold mb-3">Related Documents:</div>
                            <ScrollArea className="h-auto max-h-64">
                                <div className="space-y-3">
                                    {dependency.children.map((child, i) => (
                                        <div key={i}>
                                            <div className="font-medium text-sm mb-1.5">{child.type}:</div>
                                            <div className="ml-4 space-y-1">
                                                {child.documents.map((doc, j) => (
                                                    <div key={j} className="flex items-center gap-2 text-sm">
                                                        <span className="font-mono">{doc.number}</span>
                                                        <Badge
                                                            variant={doc.status === 'posted' ? 'default' : 'outline'}
                                                            className="text-xs"
                                                        >
                                                            {doc.status}
                                                        </Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    )}

                    {/* Instructions */}
                    {hasBlockers && (
                        <Alert>
                            <AlertDescription className="text-sm">
                                To {action === 'unpost' ? 'unpost' : 'delete'} this document, you must first {action === 'unpost' ? 'unpost' : 'delete'} all related posted documents.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    {canProceed && (
                        <Button
                            variant="destructive"
                            onClick={() => {
                                onProceed();
                                onOpenChange(false);
                            }}
                        >
                            {action === 'unpost' ? 'Unpost Anyway' : 'Delete Anyway'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
