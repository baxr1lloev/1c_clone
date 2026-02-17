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
import { Item, ItemType, ItemUnit } from "@/types"
import {
    PiFloppyDiskBold,
    PiCheckCircleBold,
    PiTrashBold,
    PiArrowLeftBold,
    PiPlusBold
} from "react-icons/pi"

interface ItemFormProps {
    initialData?: Item;
    mode: 'create' | 'edit';
}

type ItemPackageFormData = {
    id?: number;
    name: string;
    coefficient: number;
    is_default: boolean;
}

type ItemFormData = {
    sku: string;
    name: string;
    description: string;
    type: ItemType;
    base_unit: string;
    purchase_price: number;
    sale_price: number;
    category: string;
    is_active: boolean;
    units: ItemPackageFormData[];
};

const CATEGORY_NONE = '__none__';

const normalizePackages = (source: (ItemUnit | ItemPackageFormData)[] | undefined): ItemPackageFormData[] => {
    if (!source?.length) return [];

    return source.map((pkg) => ({
        id: pkg.id,
        name: pkg.name ?? '',
        coefficient: Number(pkg.coefficient) || 1,
        is_default: Boolean((pkg as ItemPackageFormData).is_default),
    }));
};

const detectItemType = (initialData: Item): ItemType => {
    if (initialData.type) return initialData.type;
    if (initialData.item_type === 'SERVICE') return 'service';
    return 'goods';
};

const defaultFormData: ItemFormData = {
    sku: '',
    name: '',
    description: '',
    type: 'goods',
    base_unit: 'pcs',
    purchase_price: 0,
    sale_price: 0,
    category: CATEGORY_NONE,
    is_active: true,
    units: [
        {
            name: '',
            coefficient: 1,
            is_default: true,
        },
    ]
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
        description: initialData.description ?? '',
        type: detectItemType(initialData),
        purchase_price: initialData.purchase_price ?? 0,
        sale_price: initialData.sale_price ?? 0,
        category: initialData.category != null ? String(initialData.category) : CATEGORY_NONE,
        is_active: initialData.is_active ?? true,
        base_unit: initialData.base_unit ?? initialData.unit ?? 'pcs',
        units: normalizePackages(initialData.units ?? initialData.packages)
    } : defaultFormData)

    const addPackage = () => {
        setFormData((prev) => ({
            ...prev,
            units: [
                ...prev.units,
                {
                    name: '',
                    coefficient: 1,
                    is_default: prev.units.length === 0,
                },
            ],
        }))
    }

    const updatePackage = (index: number, patch: Partial<ItemPackageFormData>) => {
        setFormData((prev) => ({
            ...prev,
            units: prev.units.map((pkg, pkgIndex) => pkgIndex === index ? { ...pkg, ...patch } : pkg),
        }))
    }

    const setDefaultPackage = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            units: prev.units.map((pkg, pkgIndex) => ({ ...pkg, is_default: pkgIndex === index })),
        }))
    }

    const removePackage = (index: number) => {
        setFormData((prev) => {
            const nextPackages = prev.units.filter((_, pkgIndex) => pkgIndex !== index)
            const hasDefault = nextPackages.some((pkg) => pkg.is_default)
            if (!hasDefault && nextPackages.length > 0) {
                nextPackages[0] = { ...nextPackages[0], is_default: true }
            }
            return { ...prev, units: nextPackages }
        })
    }

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

            const packages = data.units
                .map((pkg) => ({
                    name: pkg.name.trim(),
                    coefficient: Number(pkg.coefficient),
                    is_default: Boolean(pkg.is_default),
                }))
                .filter((pkg) => pkg.name.length > 0);

            if (packages.some((pkg) => !Number.isFinite(pkg.coefficient) || pkg.coefficient <= 0)) {
                throw new Error('Package coefficient must be greater than 0');
            }

            const seenNames = new Set<string>();
            for (const pkg of packages) {
                const key = pkg.name.toLowerCase();
                if (seenNames.has(key)) {
                    throw new Error(`Duplicate package name: ${pkg.name}`);
                }
                seenNames.add(key);
            }

            const defaultCount = packages.filter((pkg) => pkg.is_default).length;
            if (defaultCount > 1) {
                throw new Error('Only one default package is allowed');
            }
            if (packages.length > 0 && defaultCount === 0) {
                packages[0].is_default = true;
            }

            const payload = {
                name: data.name.trim(),
                sku: data.sku.trim(),
                item_type: data.type === 'goods' ? 'GOODS' : 'SERVICE',
                unit: data.base_unit || 'pcs',
                purchase_price: Number(data.purchase_price) || 0,
                selling_price: Number(data.sale_price) || 0,
                category: categoryId,
                packages,
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
        onError: (error: unknown) => {
            const err = error as {
                response?: { data?: { details?: string } | string };
                message?: string;
            };
            console.error('Item save error:', err);
            const errorMessage = err?.response?.data && typeof err.response.data === 'object'
                ? (err.response.data as { details?: string }).details ?? err.response.data
                : err?.response?.data || err?.message || 'Failed to save item';
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
                    {mode === 'create' ? (
                        <p className="text-xs text-amber-400 mt-1">UI version: item-form-packaging-v2</p>
                    ) : null}
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

                    <div className="space-y-3 border-t pt-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label>{t('packaging')} / Packaging</Label>
                                <p className="text-xs text-muted-foreground">
                                    {t('packagingHint', { unit: formData.base_unit || 'pcs' })}
                                </p>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={addPackage}>
                                <PiPlusBold className="mr-1" />
                                {tc('add')} / Упаковка
                            </Button>
                        </div>

                        {formData.units.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                {t('noPackagesAdded')}
                            </p>
                        )}

                        {formData.units.map((pkg, index) => (
                            <div key={pkg.id ?? index} className="grid grid-cols-12 gap-2 items-end">
                                <div className="col-span-5 space-y-1">
                                    <Label className="text-xs">{t('packageName')}</Label>
                                    <Input
                                        value={pkg.name}
                                        onChange={(e) => updatePackage(index, { name: e.target.value })}
                                        placeholder="Box"
                                    />
                                </div>
                                <div className="col-span-4 space-y-1">
                                    <Label className="text-xs">{t('coefficient')}</Label>
                                    <Input
                                        type="number"
                                        min="0.001"
                                        step="0.001"
                                        value={pkg.coefficient}
                                        onChange={(e) => updatePackage(index, { coefficient: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <Button
                                        type="button"
                                        variant={pkg.is_default ? "default" : "outline"}
                                        size="sm"
                                        className="w-full"
                                        onClick={() => setDefaultPackage(index)}
                                    >
                                        {t('default')}
                                    </Button>
                                </div>
                                <div className="col-span-1">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removePackage(index)}
                                        aria-label="Delete package"
                                    >
                                        <PiTrashBold />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="category">{tf('category')}</Label>
                            <Select
                                value={formData.category === '' || formData.category == null ? CATEGORY_NONE : String(formData.category)}
                                onValueChange={(v) => setFormData({ ...formData, category: v === CATEGORY_NONE ? CATEGORY_NONE : v })}
                            >
                                <SelectTrigger id="category">
                                    <SelectValue placeholder={tf('category')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={CATEGORY_NONE}>{t('noCategory') ?? '-'}</SelectItem>
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
