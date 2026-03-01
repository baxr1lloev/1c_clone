"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import api from "@/lib/api"
import { Counterparty, CounterpartyType } from "@/types"
import { mapApiError } from "@/lib/error-mapper"

interface CounterpartyFormProps {
  initialData?: Counterparty
  mode: "create" | "edit"
}

type CounterpartyFormData = Omit<
  Counterparty,
  "id" | "tenant" | "created_at" | "updated_at" | "contacts"
>

const DIRECTORY_COUNTERPARTY_GROUPS_STORAGE_KEY = "directory-counterparty-groups"
const DEFAULT_GROUPS = ["Учредители", "Прочие", "Поставщики", "Покупатели"]

const defaultFormData: CounterpartyFormData = {
  name: "",
  inn: "",
  type: "customer",
  address: "",
  phone: "",
  email: "",
  is_active: true,
}

const fieldClassName =
  "h-9 rounded-none border border-[#bcbcbc] bg-white px-2 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"

const toolbarButtonClassName =
  "h-10 rounded-sm border border-[#9b8e00] bg-[#f4d000] px-5 text-sm font-medium text-black hover:bg-[#ffe04d]"

const secondaryButtonClassName =
  "h-10 rounded-sm border border-[#bcbcbc] bg-white px-5 text-sm font-medium text-black hover:bg-[#f3f3f3]"

function getStoredGroups(): string[] {
  if (typeof window === "undefined") {
    return DEFAULT_GROUPS
  }

  try {
    const rawValue = window.localStorage.getItem(
      DIRECTORY_COUNTERPARTY_GROUPS_STORAGE_KEY,
    )
    if (!rawValue) {
      return DEFAULT_GROUPS
    }

    const parsedValue = JSON.parse(rawValue)
    if (!Array.isArray(parsedValue)) {
      return DEFAULT_GROUPS
    }

    const cleaned = parsedValue
      .map((entry) => String(entry || "").trim())
      .filter(Boolean)

    return cleaned.length > 0 ? cleaned : DEFAULT_GROUPS
  } catch {
    return DEFAULT_GROUPS
  }
}

function persistGroups(groups: string[]) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(
    DIRECTORY_COUNTERPARTY_GROUPS_STORAGE_KEY,
    JSON.stringify(groups),
  )
}

function normalizeCounterpartyType(type: unknown): CounterpartyType {
  const value = String(type ?? "").toLowerCase()
  if (value === "customer" || value === "supplier" || value === "agent") {
    return value
  }
  return "other"
}

function getDefaultGroupByType(type: CounterpartyType): string {
  if (type === "supplier") {
    return DEFAULT_GROUPS[2]
  }
  if (type === "customer") {
    return DEFAULT_GROUPS[3]
  }
  return DEFAULT_GROUPS[1]
}

export function CounterpartyForm({
  initialData,
  mode,
}: CounterpartyFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const isGroupMode =
    mode === "create" &&
    (searchParams.get("group") === "1" || searchParams.get("mode") === "group")

  const [activeTab, setActiveTab] = useState<"main" | "supplier-prices">("main")
  const [groupOptions, setGroupOptions] = useState<string[]>(() => getStoredGroups())
  const [managerName, setManagerName] = useState(
    initialData?.contacts?.[0]?.name || "",
  )
  const [parentGroup, setParentGroup] = useState<string>(
    initialData
      ? getDefaultGroupByType(normalizeCounterpartyType(initialData.type))
      : "",
  )
  const [telegramChatId, setTelegramChatId] = useState("0")
  const [notifyTelegram, setNotifyTelegram] = useState(false)
  const [formData, setFormData] = useState<CounterpartyFormData>(
    initialData
      ? {
          name: initialData.name,
          inn: initialData.inn,
          type: normalizeCounterpartyType(initialData.type),
          address: initialData.address,
          phone: initialData.phone,
          email: initialData.email,
          is_active: initialData.is_active,
        }
      : defaultFormData,
  )

  const formTitle = useMemo(() => {
    if (mode === "edit") {
      return `${formData.name || "Контрагент"} (Контрагенты)`
    }

    return isGroupMode
      ? "Контрагенты (создание группы)"
      : "Контрагенты (создание)"
  }, [formData.name, isGroupMode, mode])

  const saveMutation = useMutation({
    mutationFn: async (data: CounterpartyFormData) => {
      const normalizedName = data.name.trim()
      if (!normalizedName) {
        throw new Error("Наименование обязательно")
      }

      if (isGroupMode) {
        const nextGroups = Array.from(
          new Set([
            ...groupOptions,
            normalizedName,
          ]),
        )

        persistGroups(nextGroups)
        setGroupOptions(nextGroups)
        return { kind: "group" as const }
      }

      const payload = {
        ...data,
        name: normalizedName,
        type: normalizeCounterpartyType(data.type).toUpperCase(),
      }

      if (mode === "edit" && initialData) {
        return api.put(`/directories/counterparties/${initialData.id}/`, payload)
      }

      return api.post("/directories/counterparties/", payload)
    },
    onSuccess: (result) => {
      if ((result as { kind?: string } | undefined)?.kind === "group") {
        toast.success("Группа контрагентов создана")
        router.push("/directories/counterparties")
        return
      }

      toast.success(mode === "edit" ? "Контрагент сохранен" : "Контрагент создан")
      queryClient.invalidateQueries({ queryKey: ["counterparties"] })
      router.push("/directories/counterparties")
    },
    onError: (err) => {
      if (err instanceof Error && !("response" in err)) {
        toast.error(err.message)
        return
      }

      const { title, description } = mapApiError(err)
      toast.error(title, { description })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!initialData) {
        return null
      }

      return api.delete(`/directories/counterparties/${initialData.id}/`)
    },
    onSuccess: () => {
      toast.success("Контрагент удален")
      queryClient.invalidateQueries({ queryKey: ["counterparties"] })
      router.push("/directories/counterparties")
    },
    onError: () => toast.error("Не удалось удалить контрагента"),
  })

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#e9e9e9] px-3 py-2 text-[#3e3e3e]">
      <div className="mx-auto w-full max-w-[1260px] border border-[#c9c9c9] bg-[#efefef] shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between border-b border-[#d2d2d2] px-3 py-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button type="button" className="h-7 w-7 border border-[#bcbcbc] bg-white text-sm">←</button>
              <button type="button" className="h-7 w-7 border border-[#bcbcbc] bg-white text-sm">→</button>
            </div>
            <span className="text-2xl leading-none text-[#c3c3c3]">☆</span>
            <h1 className="text-[20px] font-medium text-black">{formTitle}</h1>
          </div>
          <div className="flex items-center gap-4 text-lg text-[#777]">
            <span>◌</span>
            <span>⋮</span>
            <span>□</span>
            <span>×</span>
          </div>
        </div>

        <div className="flex gap-6 border-b border-[#d8d8d8] px-3 pt-3">
          <button
            type="button"
            className={`border border-b-0 px-4 py-2 text-sm ${
              activeTab === "main"
                ? "bg-white text-black"
                : "bg-transparent text-[#2856a7] underline"
            }`}
            onClick={() => setActiveTab("main")}
          >
            Основное
          </button>
          <button
            type="button"
            className={`border border-b-0 px-4 py-2 text-sm ${
              activeTab === "supplier-prices"
                ? "bg-white text-black"
                : "bg-transparent text-[#2856a7] underline"
            }`}
            onClick={() => setActiveTab("supplier-prices")}
          >
            Цены поставщиков
          </button>
        </div>

        <div className="px-3 py-4">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className={toolbarButtonClassName}
              onClick={() => saveMutation.mutate(formData)}
            >
              Записать и закрыть
            </Button>
            <Button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => saveMutation.mutate(formData)}
            >
              Записать
            </Button>
            {mode === "edit" ? (
              <Button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => {
                  if (confirm("Удалить контрагента?")) {
                    deleteMutation.mutate()
                  }
                }}
              >
                Удалить
              </Button>
            ) : null}
            <div className="ml-auto">
              <Button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => router.back()}
              >
                Еще
              </Button>
            </div>
          </div>

          {activeTab === "main" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-[180px_110px_170px_1fr] items-center gap-3">
                <span className="text-[15px]">Код:</span>
                <Input
                  value={initialData?.id ? String(initialData.id) : "0"}
                  readOnly
                  className={`${fieldClassName} w-full bg-[#f6f6f6]`}
                />
                <span className="text-[15px] text-right">ИНН/ПИНФЛ:</span>
                <Input
                  value={formData.inn}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      inn: event.target.value,
                    }))
                  }
                  className={fieldClassName}
                />
              </div>

              <div className="grid grid-cols-[180px_1fr] items-center gap-3">
                <span className="text-[15px]">Наименование:</span>
                <Input
                  value={formData.name}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className={`${fieldClassName} border-[#d6b200] shadow-[inset_0_0_0_1px_#f0d55a]`}
                />
              </div>

              <div className="grid grid-cols-[180px_1fr_44px_44px] items-center gap-3">
                <span className="text-[15px]">Менеджер:</span>
                <Input
                  value={managerName}
                  onChange={(event) => setManagerName(event.target.value)}
                  className={fieldClassName}
                />
                <button
                  type="button"
                  className="h-9 border border-[#bcbcbc] bg-white text-sm"
                >
                  ▾
                </button>
                <button
                  type="button"
                  className="h-9 border border-[#bcbcbc] bg-white text-sm"
                >
                  ⧉
                </button>
              </div>

              <div className="grid grid-cols-[180px_1fr] items-center gap-3">
                <span className="text-[15px]">Адрес:</span>
                <Input
                  value={formData.address}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      address: event.target.value,
                    }))
                  }
                  className={fieldClassName}
                />
              </div>

              <div className="grid grid-cols-[180px_1fr] items-center gap-3">
                <span className="text-[15px]">Телефон:</span>
                <Input
                  value={formData.phone}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  className={fieldClassName}
                />
              </div>

              <div className="grid grid-cols-[180px_1fr_44px_44px] items-center gap-3">
                <span className="text-[15px]">Родитель:</span>
                <select
                  value={parentGroup}
                  onChange={(event) => setParentGroup(event.target.value)}
                  className={fieldClassName}
                >
                  <option value=""> </option>
                  {groupOptions.map((groupName) => (
                    <option key={groupName} value={groupName}>
                      {groupName}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="h-9 border border-[#bcbcbc] bg-white text-sm"
                >
                  ▾
                </button>
                <button
                  type="button"
                  className="h-9 border border-[#bcbcbc] bg-white text-sm"
                >
                  ⧉
                </button>
              </div>

              <div className="grid grid-cols-[180px_1fr] items-center gap-3">
                <span className="text-[15px]">Telegram chat ID:</span>
                <Input
                  value={telegramChatId}
                  onChange={(event) => setTelegramChatId(event.target.value)}
                  className={`${fieldClassName} max-w-[540px]`}
                />
              </div>

              <div className="grid grid-cols-[180px_1fr] items-center gap-3">
                <span className="text-[15px]">Отправить уведомление telegram:</span>
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={notifyTelegram}
                    onChange={(event) => setNotifyTelegram(event.target.checked)}
                    className="h-4 w-4"
                  />
                  <span>{notifyTelegram ? "Да" : "Нет"}</span>
                </label>
              </div>

              <div className="grid grid-cols-[180px_1fr] items-center gap-3">
                <span className="text-[15px]">Тип:</span>
                <select
                  value={formData.type}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      type: event.target.value as CounterpartyType,
                    }))
                  }
                  className={`${fieldClassName} max-w-[320px]`}
                >
                  <option value="customer">Покупатель</option>
                  <option value="supplier">Поставщик</option>
                  <option value="agent">Агент</option>
                  <option value="other">Прочее</option>
                </select>
              </div>

              <div className="grid grid-cols-[180px_1fr] items-center gap-3">
                <span className="text-[15px]">E-mail:</span>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className={`${fieldClassName} max-w-[540px]`}
                />
              </div>
            </div>
          ) : (
            <div className="border border-[#cfcfcf] bg-white p-5 text-sm">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-medium text-black">Цены поставщиков</span>
                <Button
                  type="button"
                  className={secondaryButtonClassName}
                  onClick={() => setActiveTab("main")}
                >
                  Вернуться
                </Button>
              </div>
              <div className="grid grid-cols-[220px_1fr_160px] border-t border-l border-[#cbcbcb] text-sm">
                <div className="border-r border-b border-[#cbcbcb] bg-[#f6f6f6] px-3 py-2">
                  Поставщик
                </div>
                <div className="border-r border-b border-[#cbcbcb] bg-[#f6f6f6] px-3 py-2">
                  Номенклатура
                </div>
                <div className="border-b border-[#cbcbcb] bg-[#f6f6f6] px-3 py-2">
                  Цена
                </div>
                <div className="border-r border-b border-[#cbcbcb] px-3 py-2">
                  {formData.name || "-"}
                </div>
                <div className="border-r border-b border-[#cbcbcb] px-3 py-2">
                  Данные будут доступны после сохранения
                </div>
                <div className="border-b border-[#cbcbcb] px-3 py-2">0,00</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
