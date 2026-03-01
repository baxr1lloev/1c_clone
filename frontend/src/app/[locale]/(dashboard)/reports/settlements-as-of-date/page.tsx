"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import api from "@/lib/api"
import type { Counterparty, PaginatedResponse } from "@/types"

const buttonClassName = "h-9 rounded-sm border border-[#bcbcbc] bg-white px-4 text-sm text-black hover:bg-[#f3f3f3]"

type SettlementRow = {
  counterparty_id: number
  counterparty_name: string
  phone?: string
  currency?: string
  amount?: number
}

export default function SettlementsAsOfDatePage() {
  const router = useRouter()
  const [selectedCounterpartyRowId, setSelectedCounterpartyRowId] = useState<number | null>(null)
  const [dateFrom, setDateFrom] = useState("2026-02-28")
  const [dateTo, setDateTo] = useState("2026-02-28")
  const [counterpartyId, setCounterpartyId] = useState("")
  const [reportType, setReportType] = useState("Сальдовая")

  const { data: counterparties = [] } = useQuery({
    queryKey: ["counterparties"],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Counterparty>>("/directories/counterparties/")
      return response.results
    },
  })

  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ["settlements-as-of-date", dateTo, counterpartyId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (dateTo) params.append("date", dateTo)
      if (counterpartyId) params.append("counterparty", counterpartyId)
      return api.get(`/reports/settlements-as-of-date/?${params.toString()}`)
    },
  })

  const rows = useMemo(() => {
    const source = Array.isArray(report?.counterparties) ? report.counterparties : []
    const counterpartyMap = new Map(counterparties.map((item) => [item.id, item]))

    return source.map((entry: SettlementRow) => {
      const currentCounterparty = counterpartyMap.get(entry.counterparty_id)
      return {
        counterparty_id: entry.counterparty_id,
        counterparty_name: entry.counterparty_name,
        phone: currentCounterparty?.phone || "",
        currency: entry.currency || "USD",
        amount: Number(entry.amount) || 0,
      }
    })
  }, [counterparties, report])

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#e9e9e9] px-1 py-1 text-[#3e3e3e]">
      <div className="mx-auto h-[calc(100vh-4.6rem)] w-full overflow-hidden border border-[#c9c9c9] bg-[#efefef] shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between border-b border-[#d2d2d2] px-2 py-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button type="button" className="h-7 w-7 border border-[#bcbcbc] bg-white text-sm">←</button>
              <button type="button" className="h-7 w-7 border border-[#bcbcbc] bg-white text-sm">→</button>
            </div>
            <span className="text-2xl leading-none text-[#c3c3c3]">☆</span>
            <h1 className="text-[18px] font-medium text-black">Отчет по поставщикам</h1>
          </div>
          <div className="flex items-center gap-3 text-lg text-[#777]"><span>⎙</span><span>🔗</span><span>⋮</span><span>×</span></div>
        </div>

        <div className="space-y-3 border-b border-[#d7d7d7] px-2 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" className={buttonClassName} onClick={() => refetch()}>Сформировать</Button>
            <span className="text-sm">Период с:</span>
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-9 w-[150px] rounded-none border border-[#bcbcbc] bg-white text-sm shadow-none focus-visible:ring-0" />
            <span className="text-sm">по:</span>
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-9 w-[150px] rounded-none border border-[#bcbcbc] bg-white text-sm shadow-none focus-visible:ring-0" />
            {["Сальдовая", "Оборотно-сальдовая"].map((value) => (
              <button key={value} type="button" className={`h-9 border px-3 text-sm ${reportType === value ? "border-[#76b46f] bg-[#eef9ee] text-[#198f38]" : "border-[#bcbcbc] bg-white"}`} onClick={() => setReportType(value)}>{value}</button>
            ))}
          </div>

          <div className="grid grid-cols-[110px_360px] items-center gap-2">
            <span className="text-sm">Контрагент:</span>
            <select value={counterpartyId} onChange={(event) => setCounterpartyId(event.target.value)} className="h-9 rounded-none border border-[#bcbcbc] bg-white px-2 text-sm">
              <option value=""> </option>
              {counterparties.map((counterparty) => <option key={counterparty.id} value={String(counterparty.id)}>{counterparty.name}</option>)}
            </select>
          </div>
        </div>

        <div className="h-[calc(100%-118px)] overflow-auto px-2 py-3">
          <div className="mb-2 text-[15px] text-black">
            ООО &quot;XUSHNUR SHOHNUR OMAD OPTOVIY BAZA&quot;
          </div>
          <div className="mb-4 text-center text-[15px] font-semibold text-black">
            Сальдовая ведомость по поставщикам на 28.02.2026
          </div>

          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#f3f3f3]">
                <th className="border border-[#bdbdbd] px-3 py-2 text-left font-normal">Контрагент</th>
                <th className="border border-[#bdbdbd] px-3 py-2 text-left font-normal">Телефон</th>
                <th className="border border-[#bdbdbd] px-3 py-2 text-right font-normal">UZB</th>
                <th className="border border-[#bdbdbd] px-3 py-2 text-right font-normal">USD</th>
                <th className="border border-[#bdbdbd] px-3 py-2 text-right font-normal">RUB</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="border border-[#bdbdbd] px-3 py-8 text-center">Загрузка...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="border border-[#bdbdbd] px-3 py-8 text-center">Нет данных за выбранный период</td></tr>
              ) : (
                rows.map((row: { counterparty_id: number; counterparty_name: string; phone?: string; currency?: string; amount: number }) => {
                  const uzb = row.currency === "UZS" || row.currency === "UZB" ? row.amount : 0
                  const usd = row.currency === "USD" ? row.amount : 0
                  const rub = row.currency === "RUB" ? row.amount : 0
                  const valueClassName = "text-right " + (row.amount < 0 ? "text-[#bf0000]" : "text-black")
                  const selectedClassName =
                    selectedCounterpartyRowId === row.counterparty_id ? "bg-[#f8efba]" : ""

                  return (
                    <tr
                      key={row.counterparty_id}
                      className="bg-white hover:bg-[#fbf7da]"
                      onClick={() => setSelectedCounterpartyRowId(row.counterparty_id)}
                      onDoubleClick={() =>
                        router.push(`/directories/counterparties/${row.counterparty_id}`)
                      }
                    >
                      <td className={`border border-[#bdbdbd] px-3 py-2 ${selectedClassName}`}>
                        <span className="text-[#2e56a6]">{row.counterparty_name}</span>
                      </td>
                      <td className={`border border-[#bdbdbd] px-3 py-2 ${selectedClassName}`}>{row.phone || ""}</td>
                      <td className={`border border-[#bdbdbd] px-3 py-2 ${valueClassName} ${selectedClassName}`}>{uzb === 0 ? "" : uzb.toFixed(2)}</td>
                      <td className={`border border-[#bdbdbd] px-3 py-2 ${valueClassName} ${selectedClassName}`}>{usd === 0 ? "" : usd.toFixed(2)}</td>
                      <td className={`border border-[#bdbdbd] px-3 py-2 ${valueClassName} ${selectedClassName}`}>{rub === 0 ? "" : rub.toFixed(2)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
