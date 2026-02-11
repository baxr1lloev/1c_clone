'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ReferenceSelector } from '@/components/ui/reference-selector';
import { toast } from 'sonner';
import api from '@/lib/api';
import { PiFloppyDiskBold, PiXBold } from 'react-icons/pi';
import { mapApiError } from '@/lib/error-mapper';

export default function CreateExchangeRatePage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const tc = useTranslations('common');
    const tf = useTranslations('fields');

    const [formData, setFormData] = useState({
        currency: 0,
        date: new Date().toISOString().split('T')[0],
        rate: '',
    });

    const createMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            const payload = {
                ...data,
                rate: parseFloat(data.rate),
            };
            return await api.post('/directories/exchange-rates/', payload);
        },
        onSuccess: () => {
            toast.success('Exchange rate created successfully');
            queryClient.invalidateQueries({ queryKey: ['exchange-rates'] });
            router.push('/directories/exchange-rates');
        },
        onError: (error: any) => {
            const { title, description } = mapApiError(error);
            toast.error(title, { description });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate(formData);
    };

    return (
        <div className="container max-w-2xl py-6">
            <Card>
                <CardHeader>
                    <CardTitle>Create Exchange Rate</CardTitle>
                    <CardDescription>Add a new exchange rate to the system</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <Label>{tf('currency')} *</Label>
                            <ReferenceSelector
                                apiEndpoint="/directories/currencies/"
                                value={formData.currency}
                                onSelect={(val) => setFormData({ ...formData, currency: val as number })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="date">{tf('date')} *</Label>
                                <Input
                                    id="date"
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="rate">Rate *</Label>
                                <Input
                                    id="rate"
                                    type="number"
                                    step="0.000001"
                                    value={formData.rate}
                                    onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                                    placeholder="12500.00"
                                    required
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => router.back()}
                            >
                                <PiXBold className="mr-2 h-4 w-4" />
                                {tc('cancel')}
                            </Button>
                            <Button type="submit" disabled={createMutation.isPending}>
                                <PiFloppyDiskBold className="mr-2 h-4 w-4" />
                                {createMutation.isPending ? 'Creating...' : tc('save')}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
