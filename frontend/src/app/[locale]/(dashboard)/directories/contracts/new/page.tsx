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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function CreateContractPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const tc = useTranslations('common');
    const tf = useTranslations('fields');

    const [formData, setFormData] = useState({
        number: '',
        counterparty: 0,
        currency: 0,
        contract_type: 'SALES',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        terms: '',
        is_active: true,
    });

    const createMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            const payload = {
                ...data,
                end_date: data.end_date || null,
            };
            return await api.post('/directories/contracts/', payload);
        },
        onSuccess: () => {
            toast.success('Contract created successfully');
            queryClient.invalidateQueries({ queryKey: ['contracts'] });
            router.push('/directories/contracts');
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
                    <CardTitle>Create Contract</CardTitle>
                    <CardDescription>Add a new contract to the system</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="number">{tf('number')} *</Label>
                                <Input
                                    id="number"
                                    value={formData.number}
                                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                                    placeholder="CNT-2024-001"
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="type">Type *</Label>
                                <Select
                                    value={formData.contract_type}
                                    onValueChange={(value) => setFormData({ ...formData, contract_type: value })}
                                >
                                    <SelectTrigger id="type">
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SALES">Sales Contract</SelectItem>
                                        <SelectItem value="PURCHASE">Purchase Contract</SelectItem>
                                        <SelectItem value="COMMISSION">Commission Agent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label>{tf('counterparty')} *</Label>
                            <ReferenceSelector
                                apiEndpoint="/directories/counterparties/"
                                value={formData.counterparty}
                                onSelect={(val) => setFormData({ ...formData, counterparty: val as number })}
                            />
                        </div>

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
                                <Label htmlFor="start-date">Start Date *</Label>
                                <Input
                                    id="start-date"
                                    type="date"
                                    value={formData.start_date}
                                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="end-date">End Date</Label>
                                <Input
                                    id="end-date"
                                    type="date"
                                    value={formData.end_date}
                                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="terms">Terms</Label>
                            <Input
                                id="terms"
                                value={formData.terms}
                                onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                                placeholder="Contract terms and conditions"
                            />
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
