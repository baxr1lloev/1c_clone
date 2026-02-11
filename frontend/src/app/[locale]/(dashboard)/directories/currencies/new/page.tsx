'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import api from '@/lib/api';
import { PiFloppyDiskBold, PiXBold } from 'react-icons/pi';
import { mapApiError } from '@/lib/error-mapper';

export default function CreateCurrencyPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const tc = useTranslations('common');
    const tf = useTranslations('fields');

    const [formData, setFormData] = useState({
        code: '',
        name: '',
        symbol: '',
        is_base: false,
        rate_source: 'MANUAL',
    });

    const createMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            return await api.post('/directories/currencies/', data);
        },
        onSuccess: () => {
            toast.success('Currency created successfully');
            queryClient.invalidateQueries({ queryKey: ['currencies'] });
            router.push('/directories/currencies');
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
                    <CardTitle>Create Currency</CardTitle>
                    <CardDescription>Add a new currency to the system</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="code">{tf('code')} *</Label>
                                <Input
                                    id="code"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    placeholder="USD"
                                    maxLength={3}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="symbol">Symbol *</Label>
                                <Input
                                    id="symbol"
                                    value={formData.symbol}
                                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                                    placeholder="$"
                                    maxLength={5}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="name">{tf('name')} *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="US Dollar"
                                required
                            />
                        </div>

                        <div className="flex items-center space-x-2">
                            <Switch
                                id="is-base"
                                checked={formData.is_base}
                                onCheckedChange={(checked) => setFormData({ ...formData, is_base: checked })}
                            />
                            <Label htmlFor="is-base" className="cursor-pointer">
                                Base Currency
                            </Label>
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
