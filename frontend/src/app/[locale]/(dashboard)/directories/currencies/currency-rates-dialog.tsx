"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { Loader2 } from "lucide-react"
import type { PaginatedResponse } from "@/types"
import { useTranslations } from "next-intl"

interface ExchangeRate {
    id: number
    date: string
    rate: string
}

interface Currency {
    id: number
    code: string
    name: string
}

interface CurrencyRatesDialogProps {
    currency: Currency | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

type ExchangeRatesResponse = PaginatedResponse<ExchangeRate> | ExchangeRate[]

function normalizeRatesResponse(response: ExchangeRatesResponse): ExchangeRate[] {
    if (Array.isArray(response)) return response
    if (Array.isArray(response?.results)) return response.results
    return []
}

export function CurrencyRatesDialog({ currency, open, onOpenChange }: CurrencyRatesDialogProps) {
    const [rates, setRates] = useState<ExchangeRate[]>([])
    const [loading, setLoading] = useState(false)
    const [newRate, setNewRate] = useState({ date: new Date().toISOString().split('T')[0], rate: '' })
    const [adding, setAdding] = useState(false)
    const td = useTranslations("directories")
    const tc = useTranslations("common")
    const tf = useTranslations("fields")

    const loadHistory = useCallback(async () => {
        if (!currency) return
        setLoading(true)
        try {
            const res = await api.get<ExchangeRatesResponse>(`/directories/currencies/${currency.id}/history/`)
            setRates(normalizeRatesResponse(res))
        } catch (error) {
            console.error("Failed to load rates", error)
        } finally {
            setLoading(false)
        }
    }, [currency])

    useEffect(() => {
        if (open && currency) {
            loadHistory()
        }
    }, [open, currency, loadHistory])

    const handleAddRate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!currency) return
        setAdding(true)
        try {
            await api.post('/directories/exchange-rates/', {
                currency: currency.id,
                date: newRate.date,
                rate: newRate.rate
            })
            await loadHistory()
            setNewRate(prev => ({ ...prev, rate: '' }))
        } catch (error) {
            console.error("Failed to add rate", error)
        } finally {
            setAdding(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{td("currenciesPage.exchangeRatesFor", { code: currency?.code || "-" })}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleAddRate} className="flex gap-2 my-4">
                    <Input
                        type="date"
                        value={newRate.date}
                        onChange={e => setNewRate({ ...newRate, date: e.target.value })}
                        required
                        className="w-[140px]"
                    />
                    <Input
                        type="number"
                        step="0.000001"
                        placeholder={td("currenciesPage.ratePlaceholder")}
                        value={newRate.rate}
                        onChange={e => setNewRate({ ...newRate, rate: e.target.value })}
                        required
                        className="flex-1"
                    />
                    <Button type="submit" disabled={adding}>
                        {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : tc("add")}
                    </Button>
                </form>

                {loading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : (
                    <div className="max-h-[300px] overflow-auto border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{tc("date")}</TableHead>
                                    <TableHead className="text-right">{tf("exchangeRate")}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rates.map((rate) => (
                                    <TableRow key={rate.id}>
                                        <TableCell>{rate.date}</TableCell>
                                        <TableCell className="text-right">{rate.rate}</TableCell>
                                    </TableRow>
                                ))}
                                {rates.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center text-muted-foreground py-4">
                                            {td("currenciesPage.noRatesHistory")}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
