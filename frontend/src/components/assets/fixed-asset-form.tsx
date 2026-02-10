'use client';

import { useState, useEffect } from 'react';
import { useForm, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { PiFloppyDiskBackBold, PiXBold } from 'react-icons/pi';

import api from '@/lib/api';
import { FixedAsset, FixedAssetCategory, User } from '@/types';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
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
    residual_value: z.coerce.number().min(0),

    depreciation_method: z.enum(['LINEAR', 'DECLINING']),
    useful_life_months: z.coerce.number().min(1),
    depreciation_rate: z.coerce.number().optional(),

    acquisition_date: z.string().min(1, 'Required'),
    commissioning_date: z.string().min(1, 'Required'),

    location: z.string().optional(),
    responsible_person: z.coerce.number().optional().nullable(),

    status: z.enum(['IN_USE', 'MOTHBALLED', 'DISPOSED']),
    description: z.string().optional(),
    serial_number: z.string().optional(),
    manufacturer: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface FixedAssetFormProps {
    initialData?: FixedAsset;
    onSuccess?: () => void;
}

export function FixedAssetForm({ initialData, onSuccess }: FixedAssetFormProps) {
    const t = useTranslations('directories.fixedAssets');
    const tc = useTranslations('common');
    const router = useRouter();
    const queryClient = useQueryClient();
    const isEdit = !!initialData;

    // Fetch Categories
    const { data: categories } = useQuery({
        queryKey: ['fixed-asset-categories'],
        queryFn: async () => {
            const res = await api.get('/fixed_assets/categories/');
            return res.data.results as FixedAssetCategory[];
        }
    });

    // Fetch Users (for responsible person)
    const { data: users } = useQuery({
        queryKey: ['users'],
        queryFn: async () => {
            const res = await api.get('/accounts/users/');
            return res.data.results as User[];
        }
    });

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema) as Resolver<FormValues>,
        defaultValues: {
            inventory_number: initialData?.inventory_number || '',
            name: initialData?.name || '',
            category: initialData?.category || undefined,
            initial_cost: initialData?.initial_cost || 0,
            residual_value: initialData?.residual_value || 0,
            depreciation_method: initialData?.depreciation_method || 'LINEAR',
            useful_life_months: initialData?.useful_life_months || 60,
            depreciation_rate: initialData?.depreciation_rate || undefined,
            acquisition_date: initialData?.acquisition_date || new Date().toISOString().split('T')[0],
            commissioning_date: initialData?.commissioning_date || new Date().toISOString().split('T')[0],
            location: initialData?.location || '',
            responsible_person: initialData?.responsible_person || null,
            status: initialData?.status || 'IN_USE',
            description: initialData?.description || '',
            serial_number: initialData?.serial_number || '',
            manufacturer: initialData?.manufacturer || '',
        },
    });

    const mutation = useMutation({
        mutationFn: async (values: FormValues) => {
            if (isEdit) {
                return api.patch(`/fixed_assets/assets/${initialData.id}/`, values);
            } else {
                return api.post('/fixed_assets/assets/', values);
            }
        },
        onSuccess: () => {
            toast.success(isEdit ? tc('updatedSuccessfully') : tc('createdSuccessfully'));
            queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
            if (onSuccess) {
                onSuccess();
            } else {
                router.push('/directories/fixed-assets');
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
                        {isEdit ? t('editFixedAsset') : t('newFixedAsset')}
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
                                                <SelectItem value="MOTHBALLED">{t('statusMothballed')}</SelectItem>
                                                <SelectItem value="DISPOSED">{t('statusDisposed')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    {/* Financial & Depreciation */}
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('financials')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
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
                                    name="residual_value"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('residualValue')}</FormLabel>
                                            <FormControl>
                                                <Input type="number" step="0.01" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="depreciation_method"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('depreciationMethod')}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="LINEAR">{t('methodLinear')}</SelectItem>
                                                <SelectItem value="DECLINING">{t('methodDeclining')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-2 gap-4">
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
                                <FormField
                                    control={form.control}
                                    name="depreciation_rate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('depreciationRate')}</FormLabel>
                                            <FormControl>
                                                <Input type="number" step="0.01" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Dates & Location */}
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('datesAndLocation')}</CardTitle>
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

                            <FormField
                                control={form.control}
                                name="location"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('location')}</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="responsible_person"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('responsiblePerson')}</FormLabel>
                                        <Select onValueChange={(val) => field.onChange(val ? parseInt(val) : null)} value={field.value?.toString()}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('selectPerson')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {users?.map((user) => (
                                                    <SelectItem key={user.id} value={user.id.toString()}>
                                                        {user.first_name} {user.last_name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
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
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="serial_number"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('serialNumber')}</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="manufacturer"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('manufacturer')}</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </form>
        </Form>
    );
}
