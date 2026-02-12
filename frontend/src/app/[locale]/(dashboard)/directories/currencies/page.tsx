"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ColumnDef } from "@tanstack/react-table"
import { Plus, Trash2, Edit, Download, Globe, History } from "lucide-react"
import { useTranslations } from "next-intl"

import { api } from "@/lib/api"
import type { ApiError, PaginatedResponse } from "@/types"
import { DataTable } from "@/components/data-table/data-table"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CommandBar, CommandBarAction } from "@/components/ui/command-bar"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { CurrencyClassifierDialog } from "./currency-classifier-dialog"
import { CurrencyRatesDialog } from "./currency-rates-dialog"

interface Currency {
  id: number
  code: string
  name: string
  symbol: string
  rate_source: 'MANUAL' | 'CBR' | 'MARKUP'
  markup_percent: string
  markup_base_currency?: number
}

interface CurrencyFormData {
  code: string
  name: string
  symbol: string
  rate_source: 'MANUAL' | 'CBR' | 'MARKUP'
  manual_rate: string
  rate_date: string
}

const RATE_SOURCE_VALUES = ['MANUAL', 'CBR', 'MARKUP'] as const

type CurrencyListResponse = PaginatedResponse<Currency> | Currency[]
type ExchangeRate = { id: number; date: string; rate: string | number }
type ExchangeRatesResponse = PaginatedResponse<ExchangeRate> | ExchangeRate[]

function normalizeCurrenciesResponse(response: CurrencyListResponse): Currency[] {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.results)) return response.results
  return []
}

function normalizeExchangeRatesResponse(response: ExchangeRatesResponse): ExchangeRate[] {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.results)) return response.results
  return []
}

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

function getDefaultFormData(): CurrencyFormData {
  return {
    code: "",
    name: "",
    symbol: "",
    rate_source: "MANUAL",
    manual_rate: "",
    rate_date: getTodayDateString(),
  }
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback
  const maybeMessage = (error as { message?: string }).message
  const maybeDetail = (error as { response?: { data?: ApiError } }).response?.data?.detail
  return maybeDetail || maybeMessage || fallback
}

export default function CurrenciesPage() {
  const queryClient = useQueryClient()
  const td = useTranslations("directories")
  const tc = useTranslations("common")
  const tf = useTranslations("fields")

  // State
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Currency | null>(null)

  const [isClassifierOpen, setIsClassifierOpen] = useState(false)
  const [isRatesOpen, setIsRatesOpen] = useState(false)
  const [selectedCurrencyForRates, setSelectedCurrencyForRates] = useState<Currency | null>(null)

  const [formData, setFormData] = useState<CurrencyFormData>(getDefaultFormData())

  // Queries
  const { data = [], isLoading, refetch, isError, error } = useQuery<Currency[], unknown>({
    queryKey: ["currencies"],
    queryFn: async () => {
      const res = await api.get<CurrencyListResponse>("/directories/currencies/")
      return normalizeCurrenciesResponse(res)
    }
  })

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (data: CurrencyFormData) => {
      const payload = {
        code: data.code,
        name: data.name,
        symbol: data.symbol,
        rate_source: data.rate_source,
      }

      const currencyResponse = selectedItem
        ? await api.patch<Currency>(`/directories/currencies/${selectedItem.id}/`, payload)
        : await api.post<Currency>("/directories/currencies/", payload)

      const currencyId = selectedItem?.id || Number((currencyResponse as { id?: number })?.id || 0)
      if (!currencyId) {
        throw new Error(td("currenciesPage.saveFailed"))
      }

      const rawRate = data.manual_rate.trim().replace(",", ".")
      if (data.rate_source === "MANUAL" && rawRate) {
        const rateValue = Number(rawRate)
        if (!Number.isFinite(rateValue) || rateValue <= 0) {
          throw new Error(td("currenciesPage.invalidManualRate"))
        }

        try {
          await api.post("/directories/exchange-rates/", {
            currency: currencyId,
            date: data.rate_date || getTodayDateString(),
            rate: rawRate,
          })
        } catch (createError) {
          const status = (createError as { response?: { status?: number } })?.response?.status
          if (status !== 400) throw createError

          const existingResponse = await api.get<ExchangeRatesResponse>(
            `/directories/exchange-rates/?currency=${currencyId}&date=${data.rate_date || getTodayDateString()}`
          )
          const existingRate = normalizeExchangeRatesResponse(existingResponse)[0]
          if (!existingRate?.id) {
            throw new Error(td("currenciesPage.rateSaveFailed"))
          }

          await api.patch(`/directories/exchange-rates/${existingRate.id}/`, {
            rate: rawRate,
          })
        }
      }

      return currencyResponse
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currencies"] })
      setIsFormOpen(false)
      toast.success(selectedItem ? tc("updatedSuccessfully") : tc("createdSuccessfully"))
      handleCloseForm()
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, td("currenciesPage.saveFailed")))
      console.error(error)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/directories/currencies/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currencies"] })
      toast.success(tc("deletedSuccessfully"))
    },
    onError: () => {
      toast.error(tc("errorDeleting"))
    }
  })

  const updateRatesMutation = useMutation({
    mutationFn: async () => api.post("/directories/currencies/update_rates/"),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["currencies"] })
      const updated = Number((res as { updated?: number })?.updated || 0)
      toast.success(td("currenciesPage.ratesUpdated", { count: updated }))
    },
    onError: () => toast.error(td("currenciesPage.ratesUpdateFailed"))
  })

  // Handlers
  const handleOpenCreate = () => {
    setSelectedItem(null)
    setFormData(getDefaultFormData())
    setIsFormOpen(true)
  }

  const handleOpenEdit = async (item: Currency) => {
    setSelectedItem(item)
    setFormData({
      code: item.code,
      name: item.name,
      symbol: item.symbol,
      rate_source: item.rate_source,
      manual_rate: "",
      rate_date: getTodayDateString(),
    })
    setIsFormOpen(true)

    if (item.rate_source !== "MANUAL") return

    try {
      const historyResponse = await api.get<ExchangeRatesResponse>(`/directories/currencies/${item.id}/history/`)
      const latestRate = normalizeExchangeRatesResponse(historyResponse)[0]
      if (!latestRate) return

      setFormData((prev) => ({
        ...prev,
        manual_rate: String(latestRate.rate ?? ""),
        rate_date: latestRate.date || prev.rate_date,
      }))
    } catch (historyError) {
      console.error(historyError)
    }
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setSelectedItem(null)
    setFormData(getDefaultFormData())
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.rate_source === "MANUAL" && !selectedItem && !formData.manual_rate.trim()) {
      toast.error(td("currenciesPage.manualRateRequired"))
      return
    }
    saveMutation.mutate(formData)
  }

  const handleOpenRates = (currency: Currency) => {
    setSelectedCurrencyForRates(currency)
    setIsRatesOpen(true)
  }

  const rateSourceLabels: Record<Currency["rate_source"], string> = {
    MANUAL: td("currenciesPage.rateSourceOptions.manual"),
    CBR: td("currenciesPage.rateSourceOptions.internet"),
    MARKUP: td("currenciesPage.rateSourceOptions.markup"),
  }

  // Columns
  const columns: ColumnDef<Currency>[] = [
    {
      accessorKey: "code",
      header: tc("code"),
      cell: ({ row }) => <span className="font-bold">{row.original.code}</span>
    },
    {
      accessorKey: "name",
      header: tc("name"),
    },
    {
      accessorKey: "symbol",
      header: tf("symbol"),
    },
    {
      accessorKey: "rate_source",
      header: td("currenciesPage.rateSource"),
      cell: ({ row }) => {
        const source = row.original.rate_source
        return (
          <span className={`text-xs px-2 py-1 rounded-full ${source === 'CBR' ? 'bg-blue-100 text-blue-800' :
            source === 'MARKUP' ? 'bg-orange-100 text-orange-800' :
              'bg-gray-100 text-gray-800'
            }`}>
            {rateSourceLabels[source]}
          </span>
        )
      }
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const item = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">{td("currenciesPage.openMenu")}</span>
                <Edit className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{tc("actions")}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleOpenEdit(item)}>
                <Edit className="mr-2 h-4 w-4" /> {tc("edit")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleOpenRates(item)}>
                <History className="mr-2 h-4 w-4" /> {td("currenciesPage.ratesHistory")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (window.confirm(td("currenciesPage.deleteConfirm", { code: item.code }))) {
                    deleteMutation.mutate(item.id)
                  }
                }}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" /> {tc("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    }
  ]

  // Command Bar Actions
  const mainActions: CommandBarAction[] = [
    {
      label: td("addCurrency"),
      icon: <Plus className="w-4 h-4" />,
      onClick: handleOpenCreate,
      variant: "default",
      shortcut: "Insert"
    },
    {
      label: td("currenciesPage.addFromClassifier"),
      icon: <Globe className="w-4 h-4" />,
      onClick: () => setIsClassifierOpen(true),
      variant: "secondary",
    },
    {
      label: td("currenciesPage.downloadRates"),
      icon: <Download className="w-4 h-4" />,
      onClick: () => updateRatesMutation.mutate(),
      variant: "secondary",
      disabled: updateRatesMutation.isPending
    }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{td("currencies")}</h1>
        <p className="text-muted-foreground">{td("currenciesPage.subtitle")}</p>
        {isError && (
          <p className="text-sm text-destructive mt-2">
            {td("currenciesPage.backendConnectivityIssue", {
              message: getApiErrorMessage(error, td("currenciesPage.connectionErrorFallback"))
            })}
          </p>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        searchColumn="name"
        searchPlaceholder={td("currenciesPage.searchPlaceholder")}
        onRefresh={() => refetch()}
        commandBar={
          <CommandBar
            mainActions={mainActions}
            onRefresh={() => refetch()}
          />
        }
      />

      {/* Forms & Dialogs */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedItem ? td("editCurrency") : td("addCurrency")}</DialogTitle>
            <DialogDescription>
              {selectedItem ? td("currenciesPage.updateDescription") : td("currenciesPage.createDescription")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">{tc("code")}</Label>
                  <Input id="code" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} placeholder="USD" maxLength={3} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="symbol">{tf("symbol")}</Label>
                  <Input id="symbol" value={formData.symbol} onChange={(e) => setFormData({ ...formData, symbol: e.target.value })} placeholder="$" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">{tc("name")}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={td("currenciesPage.namePlaceholder")}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rate_source">{td("currenciesPage.rateSource")}</Label>
                <select
                  id="rate_source"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={formData.rate_source}
                  onChange={(e) => {
                    const nextValue = e.target.value
                    if (RATE_SOURCE_VALUES.includes(nextValue as CurrencyFormData["rate_source"])) {
                      setFormData({ ...formData, rate_source: nextValue as CurrencyFormData["rate_source"] })
                    }
                  }}
                >
                  <option value="MANUAL">{td("currenciesPage.rateSourceOptions.manual")}</option>
                  <option value="CBR">{td("currenciesPage.rateSourceOptions.internet")}</option>
                  <option value="MARKUP">{td("currenciesPage.rateSourceOptions.markup")}</option>
                </select>
              </div>
              {formData.rate_source === "MANUAL" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rate_date">{tc("date")}</Label>
                      <Input
                        id="rate_date"
                        type="date"
                        value={formData.rate_date}
                        onChange={(e) => setFormData({ ...formData, rate_date: e.target.value })}
                        required={Boolean(formData.manual_rate.trim())}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual_rate">{tf("exchangeRate")}</Label>
                      <Input
                        id="manual_rate"
                        type="number"
                        min="0"
                        step="0.000001"
                        value={formData.manual_rate}
                        onChange={(e) => setFormData({ ...formData, manual_rate: e.target.value })}
                        placeholder={td("currenciesPage.ratePlaceholder")}
                        required={!selectedItem}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {td("currenciesPage.manualRateHint")}
                  </p>
                </>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseForm}>{tc("cancel")}</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? td("currenciesPage.saving") : tc("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CurrencyClassifierDialog
        open={isClassifierOpen}
        onOpenChange={setIsClassifierOpen}
      />

      <CurrencyRatesDialog
        open={isRatesOpen}
        onOpenChange={setIsRatesOpen}
        currency={selectedCurrencyForRates}
      />
    </div>
  )
}
