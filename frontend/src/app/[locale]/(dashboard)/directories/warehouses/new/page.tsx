'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import api from '@/lib/api';
import { PiFloppyDiskBold, PiXBold } from 'react-icons/pi';
import { mapApiError } from '@/lib/error-mapper';

export default function CreateWarehousePage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const tc = useTranslations('common');
    const tf = useTranslations('fields');

    const [formData, setFormData] = useState({
        name: '',
        code: '',
        address: '',
        warehouse_type: 'PHYSICAL',
        is_active: true,
    });

    const createMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            return await api.post('/directories/warehouses/', data);
        },
        onSuccess: () => {
            toast.success('Warehouse created successfully');
            queryClient.invalidateQueries({ queryKey: ['warehouses'] });
            router.push('/directories/warehouses');
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
                    <CardTitle>Create Warehouse</CardTitle>
                    <CardDescription>Add a new warehouse to the system</CardDescription>
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
                                    placeholder="WH01"
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="type">Type *</Label>
                                <Select
                                    value={formData.warehouse_type}
                                    onValueChange={(value) => setFormData({ ...formData, warehouse_type: value })}
                                >
                                    <SelectTrigger id="type">
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PHYSICAL">Physical Store/Warehouse</SelectItem>
                                        <SelectItem value="VIRTUAL">Virtual/Logical</SelectItem>
                                        <SelectItem value="TRANSIT">Goods in Transit</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="name">{tf('name')} *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Main Warehouse"
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="address">Address</Label>
                            <Input
                                id="address"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                placeholder="123 Storage Street"
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
