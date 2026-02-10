"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2, Trash2 } from "lucide-react"

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

export function CurrencyRatesDialog({ currency, open, onOpenChange }: CurrencyRatesDialogProps) {
    const [rates, setRates] = useState<ExchangeRate[]>([])
    const [loading, setLoading] = useState(false)
    const [newRate, setNewRate] = useState({ date: new Date().toISOString().split('T')[0], rate: '' })
    const [adding, setAdding] = useState(false)

    useEffect(() => {
        if (open && currency) {
            loadHistory()
        }
    }, [open, currency])

    const loadHistory = async () => {
        if (!currency) return
        setLoading(true)
        try {
            const res = await api.get<ExchangeRate[]>(`/directories/currencies/${currency.id}/history/`)
            setRates(res || [])
        } catch (error) {
            console.error("Failed to load rates", error)
        } finally {
            setLoading(false)
        }
    }

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
                    <DialogTitle>Exchange Rates: {currency?.code}</DialogTitle>
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
                        placeholder="Rate"
                        value={newRate.rate}
                        onChange={e => setNewRate({ ...newRate, rate: e.target.value })}
                        required
                        className="flex-1"
                    />
                    <Button type="submit" disabled={adding}>
                        {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
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
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Rate</TableHead>
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
                                            No rates history found
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

