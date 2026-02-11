"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BulkProgressModalProps {
    progress: {
        current: number;
        total: number;
        failed: Array<{ id: number; error: string }>;
    };
    onClose: () => void;
}

export function BulkProgressModal({ progress, onClose }: BulkProgressModalProps) {
    const percentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
    const successCount = progress.current - progress.failed.length;

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Bulk Operation in Progress</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-2 text-sm">
                            <span>Processing documents...</span>
                            <span className="font-medium">{progress.current} / {progress.total}</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                    </div>

                    <div className="flex gap-4 text-sm">
                        <div>
                            <Badge variant="default" className="bg-green-500">
                                ✅ Success: {successCount}
                            </Badge>
                        </div>
                        <div>
                            <Badge variant="destructive">
                                ❌ Failed: {progress.failed.length}
                            </Badge>
                        </div>
                    </div>

                    {progress.failed.length > 0 && (
                        <div>
                            <div className="text-sm font-medium mb-2">Errors:</div>
                            <ScrollArea className="h-32 border rounded p-2">
                                <div className="space-y-1 text-xs">
                                    {progress.failed.map((f, idx) => (
                                        <div key={idx} className="text-red-600">
                                            Document #{f.id}: {f.error}
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
