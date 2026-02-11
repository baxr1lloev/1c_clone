'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface RepostPeriodDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function RepostPeriodDialog({ open, onOpenChange }: RepostPeriodDialogProps) {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const queryClient = useQueryClient();

    const repostMutation = useMutation({
        mutationFn: async () => {
            const response = await api.post('/documents/api/repost-period/', {
                period_start: startDate,
                period_end: endDate
            });
            return response;
        },
        onSuccess: (data) => {
            toast.success(`Reposted ${data.success} documents successfully`);
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            queryClient.invalidateQueries({ queryKey: ['movements'] });
            onOpenChange(false);
        },
        onError: (error: any) => {
            toast.error(error.message || 'Reposting failed');
        }
    });

    const handleRepost = () => {
        if (!startDate || !endDate) {
            toast.error('Please select both start and end dates');
            return;
        }
        repostMutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Repost Period</DialogTitle>
                    <DialogDescription>
                        Unpost and re-post all documents in the selected period to rebuild registers.
                        <br />
                        <span className="text-orange-600 font-medium">⚠️ This operation cannot be undone</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="start-date">Start Date</Label>
                        <Input
                            id="start-date"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            disabled={repostMutation.isPending}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="end-date">End Date</Label>
                        <Input
                            id="end-date"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            disabled={repostMutation.isPending}
                        />
                    </div>

                    {repostMutation.isPending && (
                        <Alert>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <AlertDescription>
                                Reposting documents... This may take a few minutes.
                            </AlertDescription>
                        </Alert>
                    )}

                    {repostMutation.isSuccess && (
                        <Alert className="bg-green-50 border-green-200">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-green-800">
                                Period reposted successfully!
                            </AlertDescription>
                        </Alert>
                    )}

                    {repostMutation.isError && (
                        <Alert className="bg-red-50 border-red-200">
                            <XCircle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-red-800">
                                {repostMutation.error?.message || 'Reposting failed'}
                            </AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={repostMutation.isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleRepost}
                        disabled={repostMutation.isPending || !startDate || !endDate}
                    >
                        {repostMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Repost Period
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
