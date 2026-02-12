"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { api } from "@/lib/api"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"

interface ClassifierCurrency {
    code: string
    name: string
    symbol: string
}

interface CurrencyClassifierDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function CurrencyClassifierDialog({ open, onOpenChange }: CurrencyClassifierDialogProps) {
    const [currencies, setCurrencies] = useState<ClassifierCurrency[]>([])
    const [selected, setSelected] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [adding, setAdding] = useState(false)
    const queryClient = useQueryClient()
    const td = useTranslations("directories")
    const tc = useTranslations("common")
    const tf = useTranslations("fields")

    const loadClassifier = useCallback(async () => {
        setLoading(true)
        try {
            const res = await api.get<ClassifierCurrency[]>('/directories/currencies/load_from_classifier/')
            setCurrencies(res)
        } catch (error) {
            console.error("Failed to load classifier", error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (open) {
            loadClassifier()
        }
    }, [open, loadClassifier])

    const handleToggle = (code: string) => {
        setSelected(prev =>
            prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
        )
    }

    const handleAdd = async () => {
        if (selected.length === 0) return
        setAdding(true)
        try {
            await api.post('/directories/currencies/add_from_classifier/', { codes: selected })
            await queryClient.invalidateQueries({ queryKey: ['currencies'] })
            onOpenChange(false)
            setSelected([])
        } catch (error) {
            console.error("Failed to add currencies", error)
        } finally {
            setAdding(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{td("currenciesPage.classifierTitle")}</DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : (
                    <div className="max-h-[400px] overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]"></TableHead>
                                    <TableHead>{tc("code")}</TableHead>
                                    <TableHead>{tc("name")}</TableHead>
                                    <TableHead>{tf("symbol")}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {currencies.map((currency) => (
                                    <TableRow key={currency.code}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selected.includes(currency.code)}
                                                onCheckedChange={() => handleToggle(currency.code)}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">{currency.code}</TableCell>
                                        <TableCell>{currency.name}</TableCell>
                                        <TableCell>{currency.symbol}</TableCell>
                                    </TableRow>
                                ))}
                                {currencies.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                                            {tc("noData")}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}

                <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
                    <Button onClick={handleAdd} disabled={adding || selected.length === 0}>
                        {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {td("currenciesPage.addSelected")}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
