"use client"

import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import api from "@/lib/api"
import { Item } from "@/types"
import { ItemForm } from "@/components/directories/item-form"

export default function ItemDetailPage() {
  const params = useParams()
  const id = String(params.id)

  const { data, isLoading, error } = useQuery({
    queryKey: ["item", id],
    queryFn: async () => api.get<Item>(`/directories/items/${id}/`),
  })

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-[#e9e9e9] text-sm">
        Номенклатура не найдена
      </div>
    )
  }

  return <ItemForm mode="edit" initialData={data} />
}
