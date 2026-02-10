"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import api from "@/lib/api"
import { toast } from "sonner"
import { PiArrowLeftBold, PiCalculatorBold } from "react-icons/pi"

interface FixedAssetDetail {
    id: number
    inventory_number: string
    name: string
    category: number
    category_name: string
    initial_cost: string
    residual_value: string
    accumulated_depreciation: string
    current_value: string
    depreciation_base: string
    depreciation_method: string
    useful_life_months: number
    depreciation_rate: string | null
    acquisition_date: string
    commissioning_date: string
    disposal_date: string | null
    location: string
    responsible_person: number | null
    responsible_person_name: string | null
    status: string
    description: string
    serial_number: string
    manufacturer: string
}

export default function FixedAssetDetailPage({ params }: { params: { id: string } }) {
    const t = useTranslations('common')
    const router = useRouter()
    const queryClient = useQueryClient()

    const { data: asset, isLoading } = useQuery({
        queryKey: ['fixed-asset', params.id],
        queryFn: async () => {
            const res = await api.get(`/fixed-assets/assets/${params.id}/`)
            return res.data as FixedAssetDetail
        }
    })

    const calculateDepreciationMutation = useMutation({
        mutationFn: async () => {
            const res = await api.post(`/fixed-assets/assets/${params.id}/calculate_depreciation/`)
            return res.data
        },
        onSuccess: (data) => {
            toast.success(`Monthly Depreciation: $${parseFloat(data.monthly_depreciation).toLocaleString()}`)
        },
        onError: () => {
            toast.error('Failed to calculate depreciation')
        }
    })

    if (isLoading) {
        return <div className="p-6">Loading...</div>
    }

    if (!asset) {
        return <div className="p-6">Asset not found</div>
    }

    const statusColors = {
        IN_USE: 'default',
        MOTHBALLED: 'secondary',
        DISPOSED: 'destructive',
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center p-6 border-b">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.back()}>
                        <PiArrowLeftBold className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">{asset.inventory_number}</h1>
                        <p className="text-sm text-muted-foreground">{asset.name}</p>
                    </div>
                    <Badge variant={statusColors[asset.status as keyof typeof statusColors] as any}>
                        {asset.status.replace('_', ' ')}
                    </Badge>
                </div>
                <Button onClick={() => calculateDepreciationMutation.mutate()}>
                    <PiCalculatorBold className="mr-2 h-4 w-4" />
                    Calculate Depreciation
                </Button>
            </div>

            <div className="flex-1 overflow-auto p-6">
                <div className="max-w-6xl mx-auto space-y-6">
                    {/* Financial Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Financial Information</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Initial Cost</p>
                                <p className="text-2xl font-bold">${parseFloat(asset.initial_cost).toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Accumulated Depreciation</p>
                                <p className="text-2xl font-bold text-destructive">
                                    ${parseFloat(asset.accumulated_depreciation).toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Current Book Value</p>
                                <p className="text-2xl font-bold text-green-600">
                                    ${parseFloat(asset.current_value).toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Residual Value</p>
                                <p className="text-2xl font-bold">${parseFloat(asset.residual_value).toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Depreciation Settings */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Depreciation Settings</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Method</p>
                                    <p className="font-semibold">{asset.depreciation_method === 'LINEAR' ? 'Linear (Straight-line)' : 'Declining Balance'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Useful Life</p>
                                    <p className="font-semibold">{asset.useful_life_months} months ({(asset.useful_life_months / 12).toFixed(1)} years)</p>
                                </div>
                                {asset.depreciation_rate && (
                                    <div>
                                        <p className="text-sm text-muted-foreground">Depreciation Rate</p>
                                        <p className="font-semibold">{asset.depreciation_rate}%</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Asset Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Asset Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Category</p>
                                    <p className="font-semibold">{asset.category_name}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Location</p>
                                    <p className="font-semibold">{asset.location || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Serial Number</p>
                                    <p className="font-semibold">{asset.serial_number || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Manufacturer</p>
                                    <p className="font-semibold">{asset.manufacturer || '-'}</p>
                                </div>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Acquisition Date</p>
                                    <p className="font-semibold">{new Date(asset.acquisition_date).toLocaleDateString()}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Commissioning Date</p>
                                    <p className="font-semibold">{asset.commissioning_date ? new Date(asset.commissioning_date).toLocaleDateString() : '-'}</p>
                                </div>
                                {asset.disposal_date && (
                                    <div>
                                        <p className="text-sm text-muted-foreground">Disposal Date</p>
                                        <p className="font-semibold">{new Date(asset.disposal_date).toLocaleDateString()}</p>
                                    </div>
                                )}
                            </div>
                            {asset.description && (
                                <>
                                    <Separator />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Description</p>
                                        <p className="mt-1">{asset.description}</p>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
