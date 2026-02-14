'use client';

import { useState } from 'react';
import { useForm, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';

import api from '@/lib/api';
import { IntangibleAsset, IntangibleAssetCategory } from '@/types';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const formSchema = z.object({
    inventory_number: z.string().min(1, 'Required'),
    name: z.string().min(1, 'Required'),
    category: z.number().min(1, 'Required'),

    initial_cost: z.coerce.number().min(0),
    useful_life_months: z.coerce.number().min(1),

    acquisition_date: z.string().min(1, 'Required'),
    commissioning_date: z.string().min(1, 'Required'),

    status: z.enum(['IN_USE', 'WRITTEN_OFF']),
    description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface IntangibleAssetFormProps {
    initialData?: IntangibleAsset;
    onSuccess?: () => void;
}

export function IntangibleAssetForm({ initialData, onSuccess }: IntangibleAssetFormProps) {
    const t = useTranslations('directories.intangibleAssets');
    const tc = useTranslations('common');
    const router = useRouter();
    const queryClient = useQueryClient();
    const isEdit = !!initialData;

    // Fetch Categories (api.get returns response body; handle both shapes and failures)
    const { data: categories } = useQuery({
        queryKey: ['intangible-asset-categories'],
        queryFn: async () => {
            try {
                const res = await api.get('/fixed-assets/ia/categories/');
                const list = Array.isArray(res) ? res : (res?.results ?? res?.data?.results);
                return (list || []) as IntangibleAssetCategory[];
            } catch {
                return [];
            }
        }
    });

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema) as Resolver<FormValues>,
        defaultValues: {
            inventory_number: initialData?.inventory_number || '',
            name: initialData?.name || '',
            category: initialData?.category || undefined,
            initial_cost: initialData?.initial_cost || 0,
            useful_life_months: initialData?.useful_life_months || 60,
            acquisition_date: initialData?.acquisition_date || new Date().toISOString().split('T')[0],
            commissioning_date: initialData?.commissioning_date || new Date().toISOString().split('T')[0],
            status: initialData?.status || 'IN_USE',
            description: initialData?.description || '',
        },
    });

    const mutation = useMutation({
        mutationFn: async (values: FormValues) => {
            if (isEdit) {
                return api.patch(`/fixed-assets/ia/assets/${initialData.id}/`, values);
            } else {
                return api.post('/fixed-assets/ia/assets/', values);
            }
        },
        onSuccess: () => {
            toast.success(isEdit ? tc('updatedSuccessfully') : tc('createdSuccessfully'));
            queryClient.invalidateQueries({ queryKey: ['intangible-assets'] });
            if (onSuccess) {
                onSuccess();
            } else {
                router.push('/directories/intangible-assets');
            }
        },
        onError: (error: any) => {
            console.error(error);
            toast.error(tc('errorSaving'));
        },
    });

    const onSubmit = (values: FormValues) => {
        mutation.mutate(values);
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold tracking-tight">
                        {isEdit ? t('editIntangibleAsset') : t('newIntangibleAsset')}
                    </h1>
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" onClick={() => router.back()}>
                            {tc('cancel')}
                        </Button>
                        <Button type="submit" disabled={mutation.isPending}>
                            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {tc('save')}
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* General Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('generalInfo')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField
                                control={form.control}
                                name="inventory_number"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('inventoryNumber')}</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('name')}</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="category"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('category')}</FormLabel>
                                        <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('selectCategory')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {categories?.map((cat) => (
                                                    <SelectItem key={cat.id} value={cat.id.toString()}>
                                                        {cat.name} ({cat.code})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{tc('status')}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="IN_USE">{t('statusInUse')}</SelectItem>
                                                <SelectItem value="WRITTEN_OFF">{t('statusWrittenOff')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    {/* Financial & Amortization */}
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('financials')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField
                                control={form.control}
                                name="initial_cost"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('initialCost')}</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="useful_life_months"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('usefulLifeMonths')}</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    {/* Dates */}
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('dates')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="acquisition_date"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('acquisitionDate')}</FormLabel>
                                            <FormControl>
                                                <Input type="date" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="commissioning_date"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('commissioningDate')}</FormLabel>
                                            <FormControl>
                                                <Input type="date" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Additional Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('additionalInfo')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('description')}</FormLabel>
                                        <FormControl>
                                            <Textarea {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>
                </div>
            </form>
        </Form>
    );
}
