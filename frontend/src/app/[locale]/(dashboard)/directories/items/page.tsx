"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import api from "@/lib/api"
import type { Item, PaginatedResponse } from "@/types"

const buttonClassName =
  "h-9 rounded-sm border border-[#bcbcbc] bg-background px-4 text-sm text-black hover:bg-[#f3f3f3]"

type DirectoryRow =
  | { kind: "group"; key: string; categoryId: string; name: string; code: string }
  | { kind: "item"; key: string; item: Item }

export default function ItemsPage() {
  const router = useRouter()
  const [searchValue, setSearchValue] = useState("")
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [showOnlyActive, setShowOnlyActive] = useState(false)

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Item>>("/directories/items/")
      return response.results
    },
  })

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await api.get("/directories/categories/")
      return Array.isArray(response) ? response : (response?.results ?? [])
    },
  })

  const visibleItems = useMemo(() => {
    const query = searchValue.trim().toLowerCase()
    return items.filter((item) => {
      const matchesSearch =
        query.length === 0 ||
        item.name.toLowerCase().includes(query) ||
        String(item.sku || "").toLowerCase().includes(query)
      const matchesActive = !showOnlyActive || item.is_active !== false
      return matchesSearch && matchesActive
    })
  }, [items, searchValue, showOnlyActive])

  const rows = useMemo<DirectoryRow[]>(() => {
    const bucketByCategory = new Map<string, Item[]>()

    visibleItems.forEach((item) => {
      const key = item.category == null ? "__uncategorized__" : String(item.category)
      const bucket = bucketByCategory.get(key) ?? []
      bucket.push(item)
      bucketByCategory.set(key, bucket)
    })

    const orderedGroups = [
      ...categories.map((category: { id: number; name: string }) => ({
        id: String(category.id),
        name: category.name,
        code: String(category.id),
      })),
      {
        id: "__uncategorized__",
        name: "Без группы",
        code: "",
      },
    ]

    const result: DirectoryRow[] = []

    orderedGroups.forEach((group) => {
      const groupItems = bucketByCategory.get(group.id) ?? []
      if (groupItems.length === 0 && searchValue.trim().length > 0) {
        return
      }

      result.push({
        kind: "group",
        key: `group-${group.id}`,
        categoryId: group.id,
        name: group.name,
        code: group.code,
      })

      groupItems
        .sort((left, right) => left.name.localeCompare(right.name))
        .forEach((item) => {
          result.push({
            kind: "item",
            key: `item-${item.id}`,
            item,
          })
        })
    })

    return result
  }, [categories, searchValue, visibleItems])

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#e9e9e9] px-1 py-1 text-[#3e3e3e]">
      <div className="mx-auto h-[calc(100vh-4.6rem)] w-full overflow-hidden border border-[#c9c9c9] bg-[#efefef] shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between border-b border-[#d2d2d2] px-2 py-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button type="button" className="h-7 w-7 border border-[#bcbcbc] bg-background text-sm">←</button>
              <button type="button" className="h-7 w-7 border border-[#bcbcbc] bg-background text-sm">→</button>
            </div>
            <span className="text-2xl leading-none text-[#c3c3c3]">☆</span>
            <h1 className="text-[18px] font-medium text-black">Номенклатура</h1>
          </div>
          <div className="flex items-center gap-4 text-lg text-[#777]">
            <span>◌</span>
            <span>⋮</span>
            <span>×</span>
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-[#d9d9d9] px-2 py-2">
          <Button
            type="button"
            className={buttonClassName}
            onClick={() => router.push("/directories/items/new")}
          >
            Создать
          </Button>
          <Button
            type="button"
            className={buttonClassName}
            onClick={() => router.push("/directories/items/new?group=1")}
          >
            Создать группу
          </Button>
          <button
            type="button"
            className="h-9 w-9 border border-[#bcbcbc] bg-background text-[#4a84c6]"
            onClick={() => refetch()}
          >
            ⟳
          </button>
          <label className="ml-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showOnlyActive}
              onChange={(event) => setShowOnlyActive(event.target.checked)}
              className="h-4 w-4"
            />
            Только активные
          </label>
          <div className="ml-auto flex items-center gap-2">
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Поиск (Ctrl+F)"
              className="h-9 w-[270px] rounded-none border border-[#bcbcbc] bg-background text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <button
              type="button"
              className="h-9 w-9 border border-[#bcbcbc] bg-background text-[#4a84c6]"
            >
              🔍
            </button>
            <Button type="button" className={buttonClassName}>
              Еще
            </Button>
          </div>
        </div>

        <div className="h-[calc(100%-98px)] overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#f3f3f3]">
                <th className="border border-[#cbcbcb] px-3 py-2 text-left font-normal">Наименование</th>
                <th className="border border-[#cbcbcb] px-3 py-2 text-left font-normal">↓</th>
                <th className="border border-[#cbcbcb] px-3 py-2 text-left font-normal">Код</th>
                <th className="border border-[#cbcbcb] px-3 py-2 text-left font-normal">Единица измер...</th>
                <th className="border border-[#cbcbcb] px-3 py-2 text-left font-normal">Валюта</th>
                <th className="border border-[#cbcbcb] px-3 py-2 text-left font-normal">Артикул</th>
                <th className="border border-[#cbcbcb] px-3 py-2 text-left font-normal">Размер</th>
                <th className="border border-[#cbcbcb] px-3 py-2 text-left font-normal">Штрих код</th>
                <th className="border border-[#cbcbcb] px-3 py-2 text-left font-normal">Вид товара</th>
                <th className="border border-[#cbcbcb] px-3 py-2 text-left font-normal">Тип товара</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="border border-[#cbcbcb] px-3 py-8 text-center">
                    Загрузка...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="border border-[#cbcbcb] px-3 py-8 text-center">
                    Нет данных
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  if (row.kind === "group") {
                    return (
                      <tr
                        key={row.key}
                        className={selectedKey === row.key ? "bg-[#f8efba]" : "bg-background hover:bg-[#fbf7da]"}
                        onClick={() => setSelectedKey(row.key)}
                      >
                        <td className="border border-[#cbcbcb] px-3 py-2 font-medium">
                          <span className="mr-2 text-[#a77b00]">▸ 📁</span>
                          {row.name}
                        </td>
                        <td className="border border-[#cbcbcb] px-3 py-2" />
                        <td className="border border-[#cbcbcb] px-3 py-2">{row.code}</td>
                        <td className="border border-[#cbcbcb] px-3 py-2" />
                        <td className="border border-[#cbcbcb] px-3 py-2" />
                        <td className="border border-[#cbcbcb] px-3 py-2" />
                        <td className="border border-[#cbcbcb] px-3 py-2" />
                        <td className="border border-[#cbcbcb] px-3 py-2" />
                        <td className="border border-[#cbcbcb] px-3 py-2" />
                        <td className="border border-[#cbcbcb] px-3 py-2" />
                      </tr>
                    )
                  }

                  const item = row.item
                  const typeLabel = String(item.item_type ?? "")
                    .toLowerCase()
                    .includes("service")
                    ? "Услуга / Работа"
                    : "Материал"

                  return (
                    <tr
                      key={row.key}
                      className={selectedKey === row.key ? "bg-[#fbf3c7]" : "bg-background hover:bg-[#fbf7da]"}
                      onClick={() => setSelectedKey(row.key)}
                      onDoubleClick={() => router.push(`/directories/items/${item.id}`)}
                    >
                      <td className="border border-[#cbcbcb] px-3 py-2">
                        <span className="mr-2 text-[#6489a8]">▭</span>
                        {item.name}
                      </td>
                      <td className="border border-[#cbcbcb] px-3 py-2" />
                      <td className="border border-[#cbcbcb] px-3 py-2">{item.id}</td>
                      <td className="border border-[#cbcbcb] px-3 py-2">{item.base_unit || item.unit || "шт"}</td>
                      <td className="border border-[#cbcbcb] px-3 py-2">USD</td>
                      <td className="border border-[#cbcbcb] px-3 py-2">{item.sku || ""}</td>
                      <td className="border border-[#cbcbcb] px-3 py-2" />
                      <td className="border border-[#cbcbcb] px-3 py-2" />
                      <td className="border border-[#cbcbcb] px-3 py-2">Материал</td>
                      <td className="border border-[#cbcbcb] px-3 py-2">{typeLabel}</td>
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
