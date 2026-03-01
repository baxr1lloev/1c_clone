"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import api from "@/lib/api"
import { Item, ItemType, ItemUnit } from "@/types"

interface ItemFormProps {
  initialData?: Item
  mode: "create" | "edit"
}

type ItemPackageFormData = {
  id?: number
  row_key: string
  name: string
  coefficient: number
  is_default: boolean
}

type ItemFormData = {
  sku: string
  name: string
  type: ItemType
  base_unit: string
  purchase_price: number
  sale_price: number
  category: string
  units: ItemPackageFormData[]
}

const CATEGORY_NONE = "__none__"
const BASE_UNITS = ["шт", "м3", "м2", "кг", "т", "л", "м", "пач"]
const ITEM_KINDS = ["PILOMATERIL OBREZNOY", "Материал", "Товар", "Полуфабрикат"]
const MAKERS = ["ООО PKP ALMIS", "OOO LESTEXSNAB PLUS", "Belarus Les", "Baraka Les"]
const DISPLAY_TYPES = ["Продукция", "Материал", "ОС", "Товар", "Услуга / Работа"]
const fieldClassName = "h-9 rounded-none border border-[#bcbcbc] bg-white px-2 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
const toolbarButtonClassName = "h-10 rounded-sm border border-[#9b8e00] bg-[#f4d000] px-5 text-sm font-medium text-black hover:bg-[#ffe04d]"
const secondaryButtonClassName = "h-10 rounded-sm border border-[#bcbcbc] bg-white px-5 text-sm font-medium text-black hover:bg-[#f3f3f3]"

function normalizeBaseUnit(value: string | undefined): string {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (!normalized) {
    return "шт"
  }
  if (normalized === "pcs" || normalized === "шт") return "шт"
  if (normalized === "m3" || normalized === "м3") return "м3"
  if (normalized === "m2" || normalized === "м2") return "м2"
  if (normalized === "kg" || normalized === "кг") return "кг"
  if (normalized === "t" || normalized === "т") return "т"
  if (normalized === "l" || normalized === "л") return "л"
  if (normalized === "m" || normalized === "м") return "м"
  if (normalized === "pack" || normalized === "пач") return "пач"
  return value ?? "шт"
}

function normalizePackages(source: (ItemUnit | ItemPackageFormData)[] | undefined) {
  if (!source?.length) {
    return [{ row_key: "new-1", name: "", coefficient: 0, is_default: true }]
  }
  return source.map((pkg, index) => ({
    id: pkg.id,
    row_key: pkg.id ? `existing-${pkg.id}` : `loaded-${index + 1}`,
    name: normalizeBaseUnit(String(pkg.name ?? "")),
    coefficient: Number(pkg.coefficient) || 0,
    is_default: Boolean((pkg as ItemPackageFormData).is_default ?? index === 0),
  }))
}

function getInitialFormData(initialData?: Item): ItemFormData {
  if (!initialData) {
    return {
      sku: "",
      name: "",
      type: "goods",
      base_unit: "шт",
      purchase_price: 0,
      sale_price: 0,
      category: CATEGORY_NONE,
      units: normalizePackages(undefined),
    }
  }
  return {
    sku: initialData.sku ?? "",
    name: initialData.name ?? "",
    type: String(initialData.item_type ?? initialData.type ?? "").toLowerCase().includes("service") ? "service" : "goods",
    base_unit: normalizeBaseUnit(initialData.base_unit ?? initialData.unit ?? "шт"),
    purchase_price: Number(initialData.purchase_price) || 0,
    sale_price: Number((initialData as Item & { selling_price?: number }).selling_price) || Number(initialData.sale_price) || 0,
    category: initialData.category == null ? CATEGORY_NONE : String(initialData.category),
    units: normalizePackages(initialData.units ?? initialData.packages),
  }
}

function getInitialDisplayType(initialData?: Item): string {
  return String(initialData?.item_type ?? "").toLowerCase().includes("service")
    ? "Услуга / Работа"
    : "Материал"
}

function getInitialItemKind(initialData?: Item): string {
  return String(initialData?.item_type ?? "").toLowerCase().includes("service")
    ? ITEM_KINDS[2]
    : ITEM_KINDS[0]
}

function getInitialManufacturer(initialData?: Item): string {
  const name = String(initialData?.name ?? "").toLowerCase()
  if (name.includes("almis")) {
    return MAKERS[0]
  }
  if (name.includes("les") || name.includes("snab")) {
    return MAKERS[1]
  }
  return MAKERS[0]
}

function extractSizeValue(initialData?: Item): string {
  const source = `${initialData?.description ?? ""} ${initialData?.name ?? ""}`
  const match = source.match(/\d+(?:[xX*]\d+){2,4}(?:[.,]\d+)?/)
  if (!match) {
    return ""
  }
  return match[0].replace(/[xX]/g, "*")
}

export function ItemForm({ initialData, mode }: ItemFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const isGroupMode = mode === "create" && (searchParams.get("group") === "1" || searchParams.get("mode") === "group")
  const keyRef = useRef(1)
  const nextKey = () => {
    keyRef.current += 1
    return `new-${keyRef.current}`
  }

  const [topTab, setTopTab] = useState<"main" | "norm" | "work-price">("main")
  const [bottomTab, setBottomTab] = useState<"norm" | "work-price" | "barcodes">("norm")
  const [displayType, setDisplayType] = useState(getInitialDisplayType(initialData))
  const [formData, setFormData] = useState<ItemFormData>(() => getInitialFormData(initialData))
  const [weight, setWeight] = useState("0,000")
  const [article, setArticle] = useState(initialData?.sku ?? "")
  const [size, setSize] = useState(extractSizeValue(initialData))
  const [currency, setCurrency] = useState("USD")
  const [shelfLife, setShelfLife] = useState("")
  const [itemKind, setItemKind] = useState(getInitialItemKind(initialData))
  const [manufacturer, setManufacturer] = useState(getInitialManufacturer(initialData))
  const [barcode, setBarcode] = useState(initialData?.sku ?? "")
  const [minimumStock, setMinimumStock] = useState("0,00")
  const [averageStock, setAverageStock] = useState("0,00")
  const [calcMode, setCalcMode] = useState("по кол-во")

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await api.get("/directories/categories/")
      return Array.isArray(response) ? response : (response?.results ?? [])
    },
  })

  const updatePackage = (index: number, patch: Partial<ItemPackageFormData>) => {
    setFormData((current) => ({
      ...current,
      units: current.units.map((pkg, pkgIndex) => (pkgIndex === index ? { ...pkg, ...patch } : pkg)),
    }))
  }

  const updatePackageSlot = (index: number, patch: Partial<ItemPackageFormData>) => {
    setFormData((current) => {
      const nextUnits = [...current.units]
      while (nextUnits.length <= index) {
        nextUnits.push({ row_key: nextKey(), name: "", coefficient: 0, is_default: nextUnits.length === 0 })
      }
      nextUnits[index] = { ...nextUnits[index], ...patch }
      return { ...current, units: nextUnits }
    })
  }

  const addPackage = () => {
    setFormData((current) => ({
      ...current,
      units: [...current.units, { row_key: nextKey(), name: "", coefficient: 0, is_default: false }],
    }))
  }

  const saveMutation = useMutation({
    mutationFn: async (data: ItemFormData) => {
      const name = data.name.trim()
      if (!name) throw new Error("Наименование обязательно")
      if (isGroupMode) return api.post("/directories/categories/", { name })

      const categoryId = data.category === CATEGORY_NONE ? null : Number(data.category)
      const packages = data.units
        .map((pkg) => ({ name: pkg.name.trim(), coefficient: Number(pkg.coefficient) || 0, is_default: Boolean(pkg.is_default) }))
        .filter((pkg) => pkg.name || pkg.coefficient > 0)
      if (packages.length === 0) packages.push({ name: data.base_unit || "шт", coefficient: 1, is_default: true })

      const effectiveSku = article.trim() || data.sku.trim() || name

      const payload = {
        name,
        sku: effectiveSku,
        item_type: data.type === "service" ? "SERVICE" : "GOODS",
        unit: data.base_unit.trim() || "шт",
        purchase_price: Number(data.purchase_price) || 0,
        selling_price: Number(data.sale_price) || 0,
        category: categoryId == null || Number.isNaN(categoryId) ? null : categoryId,
        packages,
      }

      if (mode === "edit" && initialData) return api.put(`/directories/items/${initialData.id}/`, payload)
      return api.post("/directories/items/", payload)
    },
    onSuccess: () => {
      if (isGroupMode) {
        toast.success("Группа номенклатуры создана")
        queryClient.invalidateQueries({ queryKey: ["categories"] })
      } else {
        toast.success(mode === "edit" ? "Номенклатура сохранена" : "Номенклатура создана")
        queryClient.invalidateQueries({ queryKey: ["items"] })
        queryClient.invalidateQueries({ predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === "item" })
      }
      router.push("/directories/items")
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { details?: string } | string }; message?: string }
      const message = err?.response?.data && typeof err.response.data === "object" ? (err.response.data as { details?: string }).details : err?.response?.data || err?.message || "Ошибка сохранения"
      toast.error(typeof message === "string" ? message : "Ошибка сохранения")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => initialData ? api.delete(`/directories/items/${initialData.id}/`) : null,
    onSuccess: () => {
      toast.success("Номенклатура удалена")
      queryClient.invalidateQueries({ queryKey: ["items"] })
      router.push("/directories/items")
    },
    onError: () => toast.error("Не удалось удалить номенклатуру"),
  })

  const title = useMemo(() => {
    if (mode === "edit") return `${formData.name || "Номенклатура"} (Номенклатура)`
    return isGroupMode ? "Номенклатура (создание группы)" : "Номенклатура (создание)"
  }, [formData.name, isGroupMode, mode])

  const firstPackage = formData.units[0]
  const secondPackage = formData.units[1]

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#e9e9e9] px-3 py-2 text-[#3e3e3e]">
      <div className="mx-auto w-full max-w-[1260px] border border-[#c9c9c9] bg-[#efefef] shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between border-b border-[#d2d2d2] px-3 py-2">
          <div className="flex items-center gap-3"><div className="flex items-center gap-1"><button type="button" className="h-7 w-7 border border-[#bcbcbc] bg-white text-sm">←</button><button type="button" className="h-7 w-7 border border-[#bcbcbc] bg-white text-sm">→</button></div><span className="text-2xl leading-none text-[#c3c3c3]">☆</span><h1 className="text-[20px] font-medium text-black">{title}</h1></div>
          <div className="flex items-center gap-4 text-lg text-[#777]"><span>◌</span><span>⋮</span><span>□</span><span>×</span></div>
        </div>

        <div className="flex gap-4 border-b border-[#d8d8d8] px-3 pt-3">
          {["main:Основное", "norm:Норма", "work-price:Цена работ"].map((entry) => {
            const [id, label] = entry.split(":")
            return <button key={entry} type="button" className={`border border-b-0 px-4 py-2 text-sm ${topTab === id ? "bg-white text-black" : "bg-transparent text-[#2856a7] underline"}`} onClick={() => setTopTab(id as "main" | "norm" | "work-price")}>{label}</button>
          })}
        </div>

        <div className="px-3 py-4">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Button type="button" className={toolbarButtonClassName} onClick={() => saveMutation.mutate(formData)}>Записать и закрыть</Button>
            <Button type="button" className={secondaryButtonClassName} onClick={() => saveMutation.mutate(formData)}>Записать</Button>
            {mode === "edit" && !isGroupMode ? <Button type="button" className={secondaryButtonClassName} onClick={() => { if (confirm("Удалить номенклатуру?")) deleteMutation.mutate() }}>Удалить</Button> : null}
            <div className="ml-auto"><Button type="button" className={secondaryButtonClassName} onClick={() => router.back()}>Еще</Button></div>
          </div>

          {topTab === "main" ? <div className="space-y-4">
            <div className="grid grid-cols-[110px_90px_65px_260px_70px_1fr] items-center gap-3">
              <span>Код:</span><Input value={initialData?.id ? String(initialData.id) : "0"} readOnly className={`${fieldClassName} bg-[#f8f8f8]`} />
              <span className="text-right">Вес:</span><Input value={weight} onChange={(e) => setWeight(e.target.value)} className={`${fieldClassName} border-[#d6b200] shadow-[inset_0_0_0_1px_#f0d55a]`} />
              <span className="text-right">Тип товара:</span>
              <select value={displayType} onChange={(e) => { setDisplayType(e.target.value); setFormData((c) => ({ ...c, type: e.target.value === "Услуга / Работа" ? "service" : "goods" })) }} className={fieldClassName}>{DISPLAY_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}</select>
            </div>

            <div className="grid grid-cols-[110px_1fr_100px_1fr] items-center gap-3">
              <span>Артикул:</span><Input value={article} onChange={(e) => setArticle(e.target.value)} className={fieldClassName} />
              <span className="text-right">Размер:</span><Input value={size} onChange={(e) => setSize(e.target.value)} className={fieldClassName} />
            </div>

            <div className="grid grid-cols-[110px_1fr_90px_220px] items-center gap-3">
              <span>Наименование:</span><Input value={formData.name} onChange={(e) => setFormData((c) => ({ ...c, name: e.target.value }))} className={`${fieldClassName} border-[#d6b200] shadow-[inset_0_0_0_1px_#f0d55a]`} />
              <span className="text-right">Валюта:</span><select value={currency} onChange={(e) => setCurrency(e.target.value)} className={fieldClassName}><option value="USD">USD</option><option value="UZS">UZS</option><option value="RUB">RUB</option></select>
            </div>

            <div className="grid grid-cols-[110px_1fr_70px_170px] items-center gap-3">
              <span>Ед-изм:</span><select value={formData.base_unit} onChange={(e) => setFormData((c) => ({ ...c, base_unit: e.target.value }))} className={fieldClassName}>{BASE_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select>
              <span className="text-right">срок:</span><Input value={shelfLife} onChange={(e) => setShelfLife(e.target.value)} className={fieldClassName} />
            </div>

            <div className="grid grid-cols-[110px_1fr_170px_1fr] items-center gap-3">
              <span>Вид товара:</span><select value={itemKind} onChange={(e) => setItemKind(e.target.value)} className={fieldClassName}>{ITEM_KINDS.map((option) => <option key={option} value={option}>{option}</option>)}</select>
              <span className="text-right">Производитель:</span><select value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} className={fieldClassName}>{MAKERS.map((option) => <option key={option} value={option}>{option}</option>)}</select>
            </div>

            <div className="grid grid-cols-[110px_1fr_170px_1fr] items-center gap-3">
              <span>Штрих код:</span><Input value={barcode} onChange={(e) => setBarcode(e.target.value)} className={fieldClassName} />
              <span className="text-right">Родитель:</span><select value={formData.category} onChange={(e) => setFormData((c) => ({ ...c, category: e.target.value }))} className={fieldClassName}><option value={CATEGORY_NONE}> </option>{categories.map((category: { id: number; name: string }) => <option key={category.id} value={String(category.id)}>{category.name}</option>)}</select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><div className="text-[16px] text-[#1a9a4a]">∨ Упаковка 1-го уровня</div><div className="grid grid-cols-[1fr_90px] gap-2"><Input value={(firstPackage?.coefficient || 0).toFixed(6).replace(".", ",")} onChange={(e) => updatePackageSlot(0, { coefficient: Number(e.target.value.replace(",", ".")) || 0 })} className={fieldClassName} /><select value={firstPackage?.name || formData.base_unit} onChange={(e) => updatePackageSlot(0, { name: e.target.value })} className={fieldClassName}>{BASE_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></div></div>
              <div className="space-y-2"><div className="text-[16px] text-[#1a9a4a]">∨ Упаковка 2-го уровня</div><div className="grid grid-cols-[1fr_90px] gap-2"><Input value={(secondPackage?.coefficient || 0).toFixed(6).replace(".", ",")} onChange={(e) => updatePackageSlot(1, { coefficient: Number(e.target.value.replace(",", ".")) || 0 })} className={fieldClassName} /><select value={secondPackage?.name || formData.base_unit} onChange={(e) => updatePackageSlot(1, { name: e.target.value })} className={fieldClassName}>{BASE_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></div></div>
              <div className="space-y-2"><div className="text-[16px] text-[#1a9a4a]">∨ Метод расчета</div><div className="flex gap-1">{["по кол-во", "по уп. 1-го", "по уп. 2-го"].map((option) => <button key={option} type="button" className={`h-9 flex-1 border px-2 text-sm ${calcMode === option ? "border-[#76b46f] bg-[#eef9ee] text-[#198f38]" : "border-[#bcbcbc] bg-white"}`} onClick={() => setCalcMode(option)}>{option}</button>)}</div></div>
            </div>

            <div className="grid grid-cols-[220px_180px_260px_180px] items-center gap-3">
              <span>Товарный запас (минимум):</span><Input value={minimumStock} onChange={(e) => setMinimumStock(e.target.value)} className={fieldClassName} />
              <span className="text-right">Товарный запас (средний):</span><Input value={averageStock} onChange={(e) => setAverageStock(e.target.value)} className={fieldClassName} />
            </div>
          </div> : <div className="border border-[#cbcbcb] bg-white p-4 text-sm">{topTab === "norm" ? "Нормы доступны в нижней табличной части." : "Цены работ заполняются после сохранения номенклатуры."}</div>}

          <div className="mt-6">
            <div className="flex items-end gap-2 border-b border-[#cfcfcf]">{["norm:Норма", "work-price:Цены работ", "barcodes:Штрихкоды"].map((entry) => { const [id, label] = entry.split(":"); return <button key={entry} type="button" className={`border border-b-0 px-4 py-2 text-sm ${bottomTab === id ? "bg-white text-black" : "bg-[#efefef] text-black"}`} onClick={() => setBottomTab(id as "norm" | "work-price" | "barcodes")}>{label}</button> })}</div>
            <div className="border border-t-0 border-[#cfcfcf] bg-white p-3">
              <div className="mb-3 flex items-center gap-3"><Button type="button" className={secondaryButtonClassName} onClick={addPackage}>Добавить</Button><button type="button" className="h-9 w-9 border border-[#bcbcbc] bg-white text-[#4a84c6]">↑</button><button type="button" className="h-9 w-9 border border-[#bcbcbc] bg-white text-[#4a84c6]">↓</button><div className="ml-auto flex items-center gap-2"><Input value="" readOnly placeholder="Поиск (Ctrl+F)" className={`${fieldClassName} w-[360px] bg-[#f8f8f8]`} /><Button type="button" className={secondaryButtonClassName}>Еще</Button></div></div>
              {bottomTab === "norm" ? <div className="overflow-x-auto border border-[#cbcbcb]"><table className="min-w-full border-collapse text-sm"><thead><tr className="bg-[#f3f3f3]"><th className="border border-[#cbcbcb] px-2 py-2 text-left font-normal">N</th><th className="border border-[#cbcbcb] px-2 py-2 text-left font-normal">Номенклатура</th><th className="border border-[#cbcbcb] px-2 py-2 text-left font-normal">Код</th><th className="border border-[#cbcbcb] px-2 py-2 text-left font-normal">Единица измерения</th><th className="border border-[#cbcbcb] px-2 py-2 text-left font-normal">Количество</th><th className="border border-[#cbcbcb] px-2 py-2 text-left font-normal">Тип товара</th></tr></thead><tbody>{formData.units.map((pkg, index) => <tr key={pkg.row_key} className="bg-[#f8efba]"><td className="border border-[#cbcbcb] px-2 py-2">{index + 1}</td><td className="border border-[#cbcbcb] px-2 py-1"><Input value={pkg.name} onChange={(e) => updatePackage(index, { name: e.target.value })} className="h-8 rounded-none border-0 bg-transparent px-1 shadow-none focus-visible:ring-0" /></td><td className="border border-[#cbcbcb] px-2 py-2">{formData.sku || String(index + 1)}</td><td className="border border-[#cbcbcb] px-2 py-2">{formData.base_unit || "шт"}</td><td className="border border-[#cbcbcb] px-2 py-1"><Input value={(pkg.coefficient || 0).toFixed(4)} onChange={(e) => updatePackage(index, { coefficient: Number(e.target.value.replace(",", ".")) || 0 })} className="h-8 rounded-none border-0 bg-transparent px-1 text-right shadow-none focus-visible:ring-0" /></td><td className="border border-[#cbcbcb] px-2 py-2">{displayType}</td></tr>)}</tbody></table></div> : bottomTab === "work-price" ? <div className="grid grid-cols-[260px_180px_180px] border-t border-l border-[#cbcbcb] text-sm"><div className="border-r border-b border-[#cbcbcb] bg-[#f3f3f3] px-3 py-2">Вид работ</div><div className="border-r border-b border-[#cbcbcb] bg-[#f3f3f3] px-3 py-2">Цена</div><div className="border-b border-[#cbcbcb] bg-[#f3f3f3] px-3 py-2">Валюта</div><div className="border-r border-b border-[#cbcbcb] px-3 py-2">Основная работа</div><div className="border-r border-b border-[#cbcbcb] px-3 py-2">{Number(formData.sale_price || 0).toFixed(2)}</div><div className="border-b border-[#cbcbcb] px-3 py-2">{currency}</div></div> : <div className="grid grid-cols-[260px_220px] border-t border-l border-[#cbcbcb] text-sm"><div className="border-r border-b border-[#cbcbcb] bg-[#f3f3f3] px-3 py-2">Штрихкод</div><div className="border-b border-[#cbcbcb] bg-[#f3f3f3] px-3 py-2">Наименование</div><div className="border-r border-b border-[#cbcbcb] px-3 py-2">{barcode || "-"}</div><div className="border-b border-[#cbcbcb] px-3 py-2">{formData.name || "-"}</div></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
