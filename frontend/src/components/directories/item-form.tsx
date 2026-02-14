"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CommandBar, CommandBarAction } from "@/components/ui/command-bar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import api from "@/lib/api"
import { Item, ItemType } from "@/types"
import {
    PiFloppyDiskBold,
    PiCheckCircleBold,
    PiTrashBold,
    PiArrowLeftBold
} from "react-icons/pi"

interface ItemFormProps {
    initialData?: Item;
    mode: 'create' | 'edit';
}

type ItemFormData = Omit<Item, 'id' | 'tenant' | 'created_at' | 'updated_at'> & {
    purchase_price?: number;
    sale_price?: number;
};

const CATEGORY_NONE = '__none__';

const defaultFormData: ItemFormData = {
    sku: '',
    name: '',
    description: '',
    type: 'goods',
    base_unit: 'pcs',
    purchase_price: 0,
    sale_price: 0,
    category: CATEGORY_NONE as unknown as string,
    is_active: true,
    units: []
};

export function ItemForm({ initialData, mode }: ItemFormProps) {
    const t = useTranslations('directories')
    const tc = useTranslations('common')
    const tf = useTranslations('fields')
    const router = useRouter()
    const queryClient = useQueryClient()

    const [formData, setFormData] = useState<ItemFormData>(initialData ? {
        sku: initialData.sku,
        name: initialData.name,
        description: initialData.description,
        type: initialData.type,
        purchase_price: initialData.purchase_price ?? 0,
        sale_price: initialData.sale_price ?? 0,
        category: initialData.category != null ? String(initialData.category) : (CATEGORY_NONE as unknown as string),
        is_active: initialData.is_active,
        base_unit: initialData.base_unit ?? 'pcs',
        units: initialData.units ?? []
    } : defaultFormData)

    const { data: categories = [] } = useQuery({
        queryKey: ['categories'],
        queryFn: async () => {
            const res = await api.get('/directories/categories/');
            return Array.isArray(res) ? res : (res?.results ?? []);
        },
    })

    const saveMutation = useMutation({
        mutationFn: async (data: ItemFormData) => {
            // Client-side validation
            if (!data.name || !data.name.trim()) {
                throw new Error('Name is required');
            }
            if (!data.sku || !data.sku.trim()) {
                throw new Error('SKU is required');
            }
            
            const catVal = data.category;
            const categoryId = (catVal === '' || catVal === CATEGORY_NONE || catVal == null) ? null : Number(catVal);
            if (categoryId !== null && Number.isNaN(categoryId)) throw new Error('Invalid category');
            const payload = {
                name: data.name.trim(),
                sku: data.sku.trim(),
                item_type: data.type === 'goods' ? 'GOODS' : 'SERVICE',
                unit: data.base_unit || 'pcs',
                purchase_price: Number(data.purchase_price) || 0,
                selling_price: Number(data.sale_price) || 0,
                category: categoryId,
            };
            console.log('Sending payload:', payload);
            if (mode === 'edit' && initialData) {
                return api.put(`/directories/items/${initialData.id}/`, payload);
            }
            return api.post('/directories/items/', payload);
        },
        onSuccess: () => {
            toast.success(mode === 'edit' ? 'Item updated' : 'Item created');
            queryClient.invalidateQueries({ queryKey: ['items'] });
            router.push('/directories/items');
        },
        onError: (error: any) => {
            console.error('Item save error:', error);
            const errorMessage = error?.response?.data?.details || error?.response?.data || error?.message || 'Failed to save item';
            const errorText = typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage);
            toast.error(`Failed to save item: ${errorText}`);
        }
    })

    const deleteMutation = useMutation({
        mutationFn: async () => {
            if (initialData) return api.delete(`/directories/items/${initialData.id}/`);
        },
        onSuccess: () => {
            toast.success('Item deleted');
            queryClient.invalidateQueries({ queryKey: ['items'] });
            router.push('/directories/items');
        },
        onError: () => toast.error('Failed to delete')
    })

    const actions: CommandBarAction[] = [
        {
            label: tc('saveAndClose'),
            icon: <PiCheckCircleBold />,
            onClick: () => saveMutation.mutate(formData),
            variant: 'default',
            shortcut: 'Ctrl+Enter'
        },
        {
            label: tc('save'),
            icon: <PiFloppyDiskBold />,
            onClick: () => saveMutation.mutate(formData),
            variant: 'secondary',
            shortcut: 'Ctrl+S'
        },
        ...(mode === 'edit' ? [{
            label: tc('delete'),
            icon: <PiTrashBold />,
            onClick: () => {
                if (confirm('Are you sure you want to delete this item?')) {
                    deleteMutation.mutate()
                }
            },
            variant: 'destructive' as const
        }] : []),
        {
            label: tc('cancel'),
            icon: <PiArrowLeftBold />,
            onClick: () => router.back(),
            variant: 'ghost'
        }
    ]

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
            <CommandBar mainActions={actions} className="border-b shrink-0" />

            <div className="p-8 max-w-2xl mx-auto w-full overflow-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">{mode === 'create' ? t('addItem') : formData.name}</h1>
                    <p className="text-muted-foreground">{mode === 'create' ? 'Create a new product or service card' : 'Edit item details'}</p>
                </div>

                <div className="grid gap-6 border p-6 rounded-lg bg-card">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="sku">{tf('sku')}</Label>
                            <Input
                                id="sku"
                                value={formData.sku}
                                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                placeholder="PROD-001"
                                required
                                className="font-mono"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="type">{tf('type')}</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(v) => setFormData({ ...formData, type: v as ItemType })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="goods">Goods</SelectItem>
                                    <SelectItem value="service">Service</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="name">{tc('name')} <span className="text-red-500">*</span></Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Product Name"
                            required
                            className="font-bold"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">{tc('description')}</Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Product description"
                            rows={3}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="category">{tf('category')}</Label>
                            <Select
                                value={formData.category === '' || formData.category == null ? CATEGORY_NONE : String(formData.category)}
                                onValueChange={(v) => setFormData({ ...formData, category: v === CATEGORY_NONE ? (CATEGORY_NONE as unknown as string) : v })}
                            >
                                <SelectTrigger id="category">
                                    <SelectValue placeholder={tf('category')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={CATEGORY_NONE}>{t('noCategory') ?? '—'}</SelectItem>
                                    {categories.map((c: { id: number; name: string }) => (
                                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="unit">{tf('unit')}</Label>
                            <Input
                                id="unit"
                                value={formData.base_unit}
                                onChange={(e) => setFormData({ ...formData, base_unit: e.target.value })}
                                placeholder="pcs"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="purchase_price">{tf('purchasePrice')}</Label>
                            <Input
                                id="purchase_price"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.purchase_price}
                                onChange={(e) => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="sale_price">{tf('salePrice')}</Label>
                            <Input
                                id="sale_price"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.sale_price}
                                onChange={(e) => setFormData({ ...formData, sale_price: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-4 border-t">
                        <Switch
                            id="is_active"
                            checked={formData.is_active}
                            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                        />
                        <Label htmlFor="is_active">{tf('isActive')}</Label>
                    </div>
                </div>
            </div>
        </div>
    )
}
