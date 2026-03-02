"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import api from "@/lib/api"
import type { Counterparty, PaginatedResponse } from "@/types"

const DIRECTORY_COUNTERPARTY_GROUPS_STORAGE_KEY = "directory-counterparty-groups"
const DEFAULT_GROUPS = ["Учредители", "Прочие", "Поставщики", "Покупатели"]
const buttonClassName = "h-9 rounded-sm border border-border bg-background px-4 text-sm text-foreground hover:bg-muted"

function getStoredGroups() {
  if (typeof window === "undefined") {
    return DEFAULT_GROUPS
  }
  try {
    const rawValue = window.localStorage.getItem(DIRECTORY_COUNTERPARTY_GROUPS_STORAGE_KEY)
    if (!rawValue) {
      return DEFAULT_GROUPS
    }
    const parsedValue = JSON.parse(rawValue)
    if (!Array.isArray(parsedValue)) {
      return DEFAULT_GROUPS
    }
    const cleaned = parsedValue.map((entry) => String(entry || "").trim()).filter(Boolean)
    return cleaned.length > 0 ? cleaned : DEFAULT_GROUPS
  } catch {
    return DEFAULT_GROUPS
  }
}

function getTypeGroupName(type: unknown) {
  const normalized = String(type ?? "").toLowerCase()
  if (normalized === "supplier") return "Поставщики"
  if (normalized === "customer") return "Покупатели"
  if (normalized === "agent") return "Прочие"
  return "Прочие"
}

export default function CounterpartiesPage() {
  const router = useRouter()
  const [searchValue, setSearchValue] = useState("")
  const [groupSearchValue, setGroupSearchValue] = useState("")
  const [selectedGroup, setSelectedGroup] = useState<string>("Контрагенты")
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const customGroups = getStoredGroups()
  const treeGroups = ["Контрагенты", ...customGroups].filter((groupName) =>
    groupSearchValue.trim().length === 0
      ? true
      : groupName.toLowerCase().includes(groupSearchValue.trim().toLowerCase()),
  )

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ["counterparties"],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Counterparty>>("/directories/counterparties/")
      return response.results
    },
  })

  const filteredData = useMemo(() => {
    const query = searchValue.trim().toLowerCase()
    return data.filter((item) => {
      const matchesGroup = selectedGroup === "Контрагенты" || getTypeGroupName(item.type) === selectedGroup
      const matchesSearch =
        query.length === 0 ||
        item.name.toLowerCase().includes(query) ||
        String(item.phone || "").toLowerCase().includes(query) ||
        String(item.address || "").toLowerCase().includes(query)
      return matchesGroup && matchesSearch
    })
  }, [data, searchValue, selectedGroup])

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background px-1 py-1 text-foreground">
      <div className="mx-auto h-[calc(100vh-4.6rem)] w-full overflow-hidden border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-2 py-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button type="button" className="h-7 w-7 border border-border bg-background text-sm">←</button>
              <button type="button" className="h-7 w-7 border border-border bg-background text-sm">→</button>
            </div>
            <span className="text-2xl leading-none text-muted-foreground">☆</span>
            <h1 className="text-[18px] font-medium text-foreground">Контрагенты</h1>
          </div>
          <div className="flex items-center gap-4 text-lg text-muted-foreground"><span>◌</span><span>⋮</span><span>×</span></div>
        </div>

        <div className="flex items-center gap-2 border-b border-border px-2 py-2">
          <Button type="button" className={buttonClassName} onClick={() => router.push("/directories/counterparties/new")}>Создать</Button>
          <Button type="button" className={buttonClassName} onClick={() => router.push("/directories/counterparties/new?group=1")}>Создать группу</Button>
          <button type="button" className="h-9 w-9 border border-border bg-background text-primary" onClick={() => refetch()}>⟳</button>
          <div className="ml-auto flex items-center gap-2">
            <Input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="Поиск (Ctrl+F)" className="h-9 w-[250px] rounded-none border border-border bg-background text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
            <Button type="button" className={buttonClassName}>Еще</Button>
          </div>
        </div>

        <div className="grid h-[calc(100%-98px)] grid-cols-[150px_1fr]">
          <div className="border-r border-border bg-[#f2f2f2]">
            <div className="space-y-2 border-b border-border px-2 py-2">
              <Input
                value={groupSearchValue}
                onChange={(event) => setGroupSearchValue(event.target.value)}
                placeholder="Поиск (Ctrl+F)"
                className="h-8 rounded-none border border-border bg-background text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <div className="text-sm">Наименование ↑</div>
            </div>
            <div className="h-full overflow-auto px-1 py-1">
              {treeGroups.map((groupName) => (
                <button
                  key={groupName}
                  type="button"
                  className={`flex w-full items-center gap-2 px-2 py-1 text-left text-sm ${selectedGroup === groupName ? "bg-[#f8df7b] outline outline-1 outline-[#d7b100]" : "hover:bg-[#f8f8f8]"}`}
                  onClick={() => setSelectedGroup(groupName)}
                >
                  <span className="text-amber-600 dark:text-amber-500">{groupName === "Контрагенты" ? "⊕" : "📁"}</span>
                  <span>{groupName}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="border border-border px-3 py-2 text-left font-normal">Наименование</th>
                  <th className="border border-border px-3 py-2 text-left font-normal">Код</th>
                  <th className="border border-border px-3 py-2 text-left font-normal">Адрес</th>
                  <th className="border border-border px-3 py-2 text-left font-normal">Телефон</th>
                  <th className="border border-border px-3 py-2 text-left font-normal">Отправить уведомление telegram</th>
                  <th className="border border-border px-3 py-2 text-left font-normal">Telegram chat ID</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="border border-border px-3 py-8 text-center">Загрузка...</td></tr>
                ) : filteredData.length === 0 ? (
                  <tr><td colSpan={6} className="border border-border px-3 py-8 text-center">Нет данных</td></tr>
                ) : (
                  filteredData.map((item, index) => (
                    <tr
                      key={item.id}
                      className={selectedId === item.id ? "bg-accent" : "bg-background hover:bg-muted/50 hover:bg-muted/80"}
                      onClick={() => setSelectedId(item.id)}
                      onDoubleClick={() => router.push(`/directories/counterparties/${item.id}`)}
                    >
                      <td className="border border-border px-3 py-2">
                        <span className="mr-2 text-blue-600 dark:text-blue-400">▭</span>
                        {item.name}
                      </td>
                      <td className="border border-border px-3 py-2">{item.id || index + 1}</td>
                      <td className="border border-border px-3 py-2">{item.address || ""}</td>
                      <td className="border border-border px-3 py-2">{item.phone || ""}</td>
                      <td className="border border-border px-3 py-2">Нет</td>
                      <td className="border border-border px-3 py-2">0</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
