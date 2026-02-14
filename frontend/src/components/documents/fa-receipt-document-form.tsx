'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

import api from '@/lib/api';
import { FAReceiptDocument, Counterparty, FixedAsset } from '@/types';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const formSchema = z.object({
    number: z.string().min(1, 'Required'),
    date: z.string().min(1, 'Required'),
    supplier: z.number().min(1, 'Required'),
    asset: z.number().min(1, 'Required'),
});

type FormValues = z.infer<typeof formSchema>;

interface FAReceiptDocumentFormProps {
    initialData?: FAReceiptDocument;
    onSuccess?: () => void;
    mode?: 'create' | 'edit' | 'view';
}

export function FAReceiptDocumentForm({ initialData, onSuccess, mode = 'create' }: FAReceiptDocumentFormProps) {
    const t = useTranslations('documents.faReceipts');
    const tc = useTranslations('common');
    const router = useRouter();
    const queryClient = useQueryClient();

    // Fetch Counterparties (Suppliers)
    const { data: suppliers } = useQuery({
        queryKey: ['suppliers'],
        queryFn: async () => {
            const res: any = await api.get('/directories/counterparties/', { params: { type: 'supplier' } });
            return res.results as Counterparty[];
        }
    });

    // Fetch Assets (Only those not in use?)
    // For simplicity, fetch all. Ideally, filter by status.
    const { data: assets } = useQuery({
        queryKey: ['fixed-assets-generic'],
        queryFn: async () => {
            const res: any = await api.get('/fixed-assets/assets/');
            return res.results as FixedAsset[];
        }
    });

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            number: initialData?.number || `FAR-${format(new Date(), 'yyyyMMdd-HHmm')}`,
            date: initialData?.date || format(new Date(), 'yyyy-MM-dd'),
            supplier: initialData?.supplier || undefined,
            asset: initialData?.asset || undefined,
        },
    });

    const mutation = useMutation({
        mutationFn: async (values: FormValues) => {
            if (initialData) {
                return api.patch(`/fixed-assets/receipts/${initialData.id}/`, values);
            } else {
                return api.post('/fixed-assets/receipts/', values);
            }
        },
        onSuccess: (data) => {
            toast.success(initialData ? tc('updatedSuccessfully') : tc('createdSuccessfully'));
            queryClient.invalidateQueries({ queryKey: ['fa-receipts'] });
            // If creating, maybe redirect to edit to allow posting?
            const docId = data.id;
            if (!initialData) {
                router.push(`/documents/fa-receipts/${docId}`);
            }
        },
        onError: (error) => {
            console.error(error);
            toast.error(tc('errorSaving'));
        }
    });

    const postMutation = useMutation({
        mutationFn: async () => api.post(`/fixed-assets/receipts/${initialData?.id}/post/`),
        onSuccess: () => {
            toast.success(tc('postedSuccessfully'));
            queryClient.invalidateQueries({ queryKey: ['fa-receipts'] });
            queryClient.invalidateQueries({ queryKey: ['fixed-asset', initialData?.asset] });
            router.refresh(); // Refresh server components if any
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || tc('errorPosting'));
        }
    });

    const onSubmit = (values: FormValues) => {
        mutation.mutate(values);
    };

    const isPosted = initialData?.status === 'posted';
    const isReadOnly = mode === 'view' || isPosted;

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold tracking-tight">
                            {initialData ? t('editReceipt') : t('newReceipt')}
                        </h1>
                        {initialData?.status && (
                            <Badge variant={isPosted ? "default" : "secondary"}>
                                {initialData.status}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" onClick={() => router.back()}>
                            {tc('cancel')}
                        </Button>
                        {!isReadOnly && (
                            <Button type="submit" disabled={mutation.isPending}>
                                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {tc('save')}
                            </Button>
                        )}
                        {initialData && !isPosted && (
                            <Button
                                type="button"
                                variant="default"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => postMutation.mutate()}
                                disabled={postMutation.isPending}
                            >
                                {postMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {tc('post')}
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('documentDetails')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="number"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('number')}</FormLabel>
                                            <FormControl>
                                                <Input {...field} disabled={isReadOnly} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="date"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('date')}</FormLabel>
                                            <FormControl>
                                                <Input type="date" {...field} disabled={isReadOnly} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t('transactionDetails')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField
                                control={form.control}
                                name="supplier"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('supplier')}</FormLabel>
                                        <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()} disabled={isReadOnly}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('selectSupplier')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {suppliers?.map((s) => (
                                                    <SelectItem key={s.id} value={s.id.toString()}>
                                                        {s.name}
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
                                name="asset"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('asset')}</FormLabel>
                                        <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()} disabled={isReadOnly}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('selectAsset')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {assets?.map((a) => (
                                                    <SelectItem key={a.id} value={a.id.toString()}>
                                                        {a.name} ({a.inventory_number})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>{t('assetHelp')}</FormDescription>
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
