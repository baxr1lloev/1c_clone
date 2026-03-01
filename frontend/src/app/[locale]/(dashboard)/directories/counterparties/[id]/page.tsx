"use client"

import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import api from "@/lib/api"
import { Counterparty } from "@/types"
import { CounterpartyForm } from "@/components/directories/counterparty-form"

export default function CounterpartyDetailPage() {
  const params = useParams()
  const id = String(params.id)

  const { data, isLoading, error } = useQuery({
    queryKey: ["counterparty", id],
    queryFn: async () => api.get<Counterparty>(`/directories/counterparties/${id}/`),
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
        Контрагент не найден
      </div>
    )
  }

  return <CounterpartyForm mode="edit" initialData={data} />
}
