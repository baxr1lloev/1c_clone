"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ColumnDef } from "@tanstack/react-table"
import { Plus, Trash2, Edit, RefreshCw, Download, Globe, History } from "lucide-react"

import { api } from "@/lib/api"
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
import { Switch } from "@/components/ui/switch"
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
}

export default function CurrenciesPage() {
  const t = useTranslations("Common")
  const queryClient = useQueryClient()

  // State
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Currency | null>(null)

  const [isClassifierOpen, setIsClassifierOpen] = useState(false)
  const [isRatesOpen, setIsRatesOpen] = useState(false)
  const [selectedCurrencyForRates, setSelectedCurrencyForRates] = useState<Currency | null>(null)

  const [formData, setFormData] = useState<CurrencyFormData>({
    code: "",
    name: "",
    symbol: "",
    rate_source: "MANUAL"
  })

  // Queries
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["currencies"],
    queryFn: async () => {
      const res = await api.get<Currency[]>("/directories/currencies/")
      return res
    }
  })

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (data: CurrencyFormData) => {
      if (selectedItem) {
        return api.patch(`/directories/currencies/${selectedItem.id}/`, data)
      }
      return api.post("/directories/currencies/", data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currencies"] })
      setIsFormOpen(false)
      toast.success(selectedItem ? "Currency updated" : "Currency created")
      handleCloseForm()
    },
    onError: (error) => {
      toast.error("Failed to save currency")
      console.error(error)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/directories/currencies/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currencies"] })
      setIsDeleteOpen(false)
      toast.success("Currency deleted")
    },
    onError: (error) => {
      toast.error("Failed to delete currency")
    }
  })

  const updateRatesMutation = useMutation({
    mutationFn: async () => api.post("/directories/currencies/update_rates/"),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["currencies"] })
      toast.success(`Rates updated from internet (${res.data.updated} currencies updated)`)
    },
    onError: () => toast.error("Failed to update rates")
  })

  // Handlers
  const handleOpenCreate = () => {
    setSelectedItem(null)
    setFormData({ code: "", name: "", symbol: "", rate_source: "MANUAL" })
    setIsFormOpen(true)
  }

  const handleOpenEdit = (item: Currency) => {
    setSelectedItem(item)
    setFormData({
      code: item.code,
      name: item.name,
      symbol: item.symbol,
      rate_source: item.rate_source
    })
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setSelectedItem(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate(formData)
  }

  const handleOpenRates = (currency: Currency) => {
    setSelectedCurrencyForRates(currency)
    setIsRatesOpen(true)
  }

  // Columns
  const columns: ColumnDef<Currency>[] = [
    {
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => <span className="font-bold">{row.original.code}</span>
    },
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "symbol",
      header: "Symbol",
    },
    {
      accessorKey: "rate_source",
      header: "Rate Source",
      cell: ({ row }) => {
        const source = row.original.rate_source
        return (
          <span className={`text-xs px-2 py-1 rounded-full ${source === 'CBR' ? 'bg-blue-100 text-blue-800' :
            source === 'MARKUP' ? 'bg-orange-100 text-orange-800' :
              'bg-gray-100 text-gray-800'
            }`}>
            {source}
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
                <span className="sr-only">Open menu</span>
                <Edit className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleOpenEdit(item)}>
                <Edit className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleOpenRates(item)}>
                <History className="mr-2 h-4 w-4" /> Rates History
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSelectedItem(item); setIsDeleteOpen(true) }} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" /> Delete
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
      label: "Add Currency",
      icon: <Plus className="w-4 h-4" />,
      onClick: handleOpenCreate,
      variant: "default",
      shortcut: "Insert"
    },
    {
      label: "Add from Classifier",
      icon: <Globe className="w-4 h-4" />,
      onClick: () => setIsClassifierOpen(true),
      variant: "secondary",
    },
    {
      label: "Download Rates",
      icon: <Download className="w-4 h-4" />,
      onClick: () => updateRatesMutation.mutate(),
      variant: "secondary",
      disabled: updateRatesMutation.isPending
    }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Currencies</h1>
        <p className="text-muted-foreground">Manage transaction currencies and exchange rates.</p>
      </div>

      <DataTable
        columns={columns}
        data={data || []}
        isLoading={isLoading}
        searchColumn="name"
        searchPlaceholder="Search currencies..."
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
            <DialogTitle>{selectedItem ? "Edit Currency" : "Add Currency"}</DialogTitle>
            <DialogDescription>{selectedItem ? "Update currency details" : "Add a new currency manually"}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Code</Label>
                  <Input id="code" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} placeholder="USD" maxLength={3} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="symbol">Symbol</Label>
                  <Input id="symbol" value={formData.symbol} onChange={(e) => setFormData({ ...formData, symbol: e.target.value })} placeholder="$" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="US Dollar" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rate_source">Rate Source</Label>
                <select
                  id="rate_source"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={formData.rate_source}
                  onChange={(e) => setFormData({ ...formData, rate_source: e.target.value as any })}
                >
                  <option value="MANUAL">Manual Input</option>
                  <option value="CBR">Internet (CBR/CBU)</option>
                  <option value="MARKUP">Markup</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseForm}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Saving..." : "Save"}</Button>
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
