'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Play, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function SequenceRestorationPage() {
    const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);

    const { mutate, isPending, data } = useMutation({
        mutationFn: async (date: string) => {
            const res = await api.post('/reports/sequence/restore/', { start_date: date });
            return res.data;
        },
        onSuccess: (data) => {
            if (data.error_count > 0) {
                toast.error(`Finished with ${data.error_count} errors`);
            } else {
                toast.success('Sequence restored successfully!');
            }
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || 'Failed to restore sequence');
        }
    });

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold tracking-tight">Sequence Restoration (Level 7)</h1>
            </div>

            <Card className="border-orange-200 bg-orange-50/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-800">
                        <AlertTriangle className="w-5 h-5" />
                        Warning
                    </CardTitle>
                    <CardDescription className="text-orange-700">
                        This operation will <b>Unpost</b> and <b>Repost</b> all documents starting from the selected date.
                        This ensures that costs (FIFO/Avg) and stock balances are calculated correctly in chronological order.
                        <br />
                        <b>This may change historical data!</b> Ensure you have a backup or are sure about this action.
                    </CardDescription>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Run Restoration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="date">Start Date</Label>
                        <Input
                            type="date"
                            id="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>

                    <Button
                        onClick={() => mutate(startDate)}
                        disabled={isPending}
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                    >
                        {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                        {isPending ? 'Restoring...' : 'Start Restoration'}
                    </Button>
                </CardContent>
            </Card>

            {data && (
                <Card>
                    <CardHeader>
                        <CardTitle>Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="p-4 bg-muted rounded-lg text-center">
                                <div className="text-sm text-muted-foreground">Found</div>
                                <div className="text-2xl font-bold">{data.total_found}</div>
                            </div>
                            <div className="p-4 bg-green-100 rounded-lg text-center">
                                <div className="text-sm text-green-700">Success</div>
                                <div className="text-2xl font-bold text-green-700">{data.success_count}</div>
                            </div>
                            <div className="p-4 bg-red-100 rounded-lg text-center">
                                <div className="text-sm text-red-700">Errors</div>
                                <div className="text-2xl font-bold text-red-700">{data.error_count}</div>
                            </div>
                        </div>

                        <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-xs h-64 overflow-auto">
                            {data.logs.map((log: string, i: number) => (
                                <div key={i} className={log.includes('❌') ? 'text-red-400' : ''}>
                                    {log}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
