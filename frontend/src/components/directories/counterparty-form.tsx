"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CommandBar, CommandBarAction } from "@/components/ui/command-bar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import api from "@/lib/api"
import { Counterparty, CounterpartyType } from "@/types"
import {
    PiFloppyDiskBold,
    PiCheckCircleBold,
    PiTrashBold,
    PiArrowLeftBold
} from "react-icons/pi"

import { mapApiError } from "@/lib/error-mapper"

interface CounterpartyFormProps {
    initialData?: Counterparty;
    mode: 'create' | 'edit';
}

type CounterpartyFormData = Omit<Counterparty, 'id' | 'tenant' | 'created_at' | 'updated_at' | 'contacts'>;

const defaultFormData: CounterpartyFormData = {
    name: '',
    inn: '',
    type: 'customer',
    address: '',
    phone: '',
    email: '',
    is_active: true,
};

export function CounterpartyForm({ initialData, mode }: CounterpartyFormProps) {
    const t = useTranslations('directories')
    const tc = useTranslations('common')
    const tf = useTranslations('fields')
    const router = useRouter()
    const queryClient = useQueryClient()

    const [formData, setFormData] = useState<CounterpartyFormData>(initialData ? {
        name: initialData.name,
        inn: initialData.inn,
        type: initialData.type,
        address: initialData.address,
        phone: initialData.phone,
        email: initialData.email,
        is_active: initialData.is_active
    } : defaultFormData)

    const saveMutation = useMutation({
        mutationFn: async (data: CounterpartyFormData) => {
            const payload = { ...data, type: data.type.toUpperCase() };
            if (mode === 'edit' && initialData) {
                return api.put(`/directories/counterparties/${initialData.id}/`, payload);
            }
            return api.post('/directories/counterparties/', payload);
        },
        onSuccess: () => {
            toast.success(mode === 'edit' ? 'Counterparty updated' : 'Counterparty created');
            queryClient.invalidateQueries({ queryKey: ['counterparties'] });
            router.push('/directories/counterparties');
        },
        onError: (err) => {
            const { title, description } = mapApiError(err);
            toast.error(title, { description });
        }
    })

    const deleteMutation = useMutation({
        mutationFn: async () => {
            if (initialData) return api.delete(`/directories/counterparties/${initialData.id}/`);
        },
        onSuccess: () => {
            toast.success('Counterparty deleted');
            queryClient.invalidateQueries({ queryKey: ['counterparties'] });
            router.push('/directories/counterparties');
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
                if (confirm('Are you sure you want to delete this counterparty?')) {
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
                    <h1 className="text-2xl font-bold">{mode === 'create' ? t('addCounterparty') : formData.name}</h1>
                    <p className="text-muted-foreground">{mode === 'create' ? 'Create a new business partner card' : 'Edit business partner details'}</p>
                </div>

                <div className="grid gap-6 border p-6 rounded-lg bg-card">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">{tc('name')} <span className="text-red-500">*</span></Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Company Name"
                                required
                                className="font-bold"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="type">{tf('type')}</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(v) => setFormData({ ...formData, type: v as CounterpartyType })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="customer">Customer</SelectItem>
                                    <SelectItem value="supplier">Supplier</SelectItem>
                                    <SelectItem value="agent">Agent</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="inn">{tf('inn')} (Tax ID)</Label>
                        <Input
                            id="inn"
                            value={formData.inn}
                            onChange={(e) => setFormData({ ...formData, inn: e.target.value })}
                            placeholder="123456789"
                            className="font-mono"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="address">{tf('address')}</Label>
                        <Textarea
                            id="address"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            placeholder="Full legal address"
                            rows={3}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="phone">{tf('phone')}</Label>
                            <Input
                                id="phone"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="+1-000-0000"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">{tf('email')}</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="info@company.com"
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
