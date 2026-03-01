"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import api from "@/lib/api";
import type { PaginatedResponse, Warehouse, WarehouseType } from "@/types";

type WarehouseEditorProps = {
  mode: "create" | "edit";
  warehouseId?: number;
  initialData?: Warehouse | null;
  initialCode?: string;
};

type CounterpartyOption = {
  id: number;
  name: string;
};

type WarehouseBalanceRow = {
  id?: number;
  item?: number;
  item_id?: number;
  item_name?: string;
  quantity?: number | string;
  amount?: number | string;
};

type WarehouseUiMeta = {
  department: string;
  counterpartyId: number | null;
  counterpartyName: string;
};

type WarehouseUiMetaRecord = Record<string, WarehouseUiMeta>;

type WarehouseFormState = {
  code: string;
  name: string;
  type: WarehouseType;
  address: string;
  is_active: boolean;
};

const STORAGE_KEY = "warehouse_directory_meta_v1";
const EMPTY_WAREHOUSE_META: WarehouseUiMetaRecord = {};
const EMPTY_WAREHOUSE_META_SNAPSHOT = "{}";
const DEFAULT_DEPARTMENT = "Оптовая торговля (общая)";

const DEFAULT_WAREHOUSE_UI_META: WarehouseUiMeta = {
  department: DEFAULT_DEPARTMENT,
  counterpartyId: null,
  counterpartyName: "",
};

const departmentOptions = [
  "Оптовая торговля (общая)",
  "Розничная торговля",
  "Производство",
];

function parseWarehouseMeta(rawValue: string | null): WarehouseUiMetaRecord {
  if (!rawValue) return EMPTY_WAREHOUSE_META;

  try {
    const parsed = JSON.parse(rawValue) as WarehouseUiMetaRecord;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : EMPTY_WAREHOUSE_META;
  } catch {
    return EMPTY_WAREHOUSE_META;
  }
}

function readWarehouseMeta(): WarehouseUiMetaRecord {
  if (typeof window === "undefined") return EMPTY_WAREHOUSE_META;
  return parseWarehouseMeta(window.localStorage.getItem(STORAGE_KEY));
}

function readWarehouseMetaSnapshot(): string {
  if (typeof window === "undefined") return EMPTY_WAREHOUSE_META_SNAPSHOT;
  return window.localStorage.getItem(STORAGE_KEY) || EMPTY_WAREHOUSE_META_SNAPSHOT;
}

function writeWarehouseMeta(meta: WarehouseUiMetaRecord) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  window.dispatchEvent(new Event("warehouse-meta-change"));
}

function subscribeWarehouseMeta(onChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = () => onChange();
  window.addEventListener("storage", handler);
  window.addEventListener("warehouse-meta-change", handler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("warehouse-meta-change", handler);
  };
}

function formatNumber(value: number, digits = 3) {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function WarehouseEditor({
  initialData,
  initialCode,
  mode,
  warehouseId,
}: WarehouseEditorProps) {
  const router = useRouter();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const localePath = (path: string) =>
    `/${locale}${path.startsWith("/") ? path : `/${path}`}`;

  const [saveMode, setSaveMode] = useState<"stay" | "close">("stay");
  const [selectedBalanceId, setSelectedBalanceId] = useState<number | null>(null);
  const [formData, setFormData] = useState<WarehouseFormState>({
    code: initialCode || String(initialData?.id || 0),
    name: initialData?.name || "",
    type: initialData?.warehouse_type || "PHYSICAL",
    address: initialData?.address || "",
    is_active: initialData?.is_active ?? true,
  });
  const warehouseMetaSnapshot = useSyncExternalStore(
    subscribeWarehouseMeta,
    readWarehouseMetaSnapshot,
    () => EMPTY_WAREHOUSE_META_SNAPSHOT,
  );
  const warehouseMetaStore = useMemo(
    () => parseWarehouseMeta(warehouseMetaSnapshot),
    [warehouseMetaSnapshot],
  );
  const metaKey = String(warehouseId || initialData?.id || "");
  const storedUiMeta = warehouseMetaStore[metaKey] || DEFAULT_WAREHOUSE_UI_META;
  const [uiMetaDraft, setUiMetaDraft] = useState<WarehouseUiMeta | null>(null);
  const uiMeta = uiMetaDraft || storedUiMeta;

  const { data: counterparties = [] } = useQuery({
    queryKey: ["warehouse-form-counterparties"],
    queryFn: async () => {
      try {
        const response =
          await api.get<PaginatedResponse<CounterpartyOption>>("/directories/counterparties/");
        return response.results || [];
      } catch {
        return [];
      }
    },
  });

  const { data: balances = [], isLoading: isBalancesLoading } = useQuery({
    queryKey: ["warehouse-balances", warehouseId],
    queryFn: async () => {
      if (!warehouseId) return [];
      try {
        const response = (await api.get(
          `/registers/stock-balances/?warehouse=${warehouseId}`,
        )) as { results?: WarehouseBalanceRow[] } | WarehouseBalanceRow[];
        return Array.isArray(response) ? response : response.results || [];
      } catch {
        return [];
      }
    },
    enabled: mode === "edit" && Boolean(warehouseId),
  });

  const totalQuantity = useMemo(
    () =>
      balances.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
    [balances],
  );

  const persistMeta = (id: number) => {
    const nextMeta = {
      ...readWarehouseMeta(),
      [String(id)]: uiMeta,
    };
    writeWarehouseMeta(nextMeta);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: formData.name.trim(),
        warehouse_type: formData.type,
        address: formData.address || "",
        is_active: formData.is_active,
      };

      if (mode === "edit" && warehouseId) {
        return api.put(`/directories/warehouses/${warehouseId}/`, payload) as Promise<Warehouse>;
      }

      return api.post("/directories/warehouses/", payload) as Promise<Warehouse>;
    },
    onSuccess: (savedWarehouse) => {
      persistMeta(savedWarehouse.id);
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse", savedWarehouse.id] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-balances", savedWarehouse.id] });
      toast.success(mode === "create" ? "Склад создан" : "Склад обновлен");

      if (saveMode === "close") {
        router.push(localePath("/directories/warehouses"));
        return;
      }

      if (mode === "create") {
        router.replace(localePath(`/directories/warehouses/${savedWarehouse.id}`));
        return;
      }

      setFormData({
        code: String(savedWarehouse.id || 0),
        name: savedWarehouse.name || "",
        type: savedWarehouse.warehouse_type || "PHYSICAL",
        address: savedWarehouse.address || "",
        is_active: savedWarehouse.is_active ?? true,
      });
    },
    onError: () => {
      toast.error("Не удалось сохранить склад");
    },
  });

  const title = mode === "create"
    ? "Склад (создание)"
    : `${formData.name || initialData?.name || "Склад"} (Склад)`;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#e9e9e9] px-1 py-1 text-[#3e3e3e]">
      <div className="mx-auto h-[calc(100vh-4.6rem)] w-full overflow-hidden border border-[#c9c9c9] bg-[#efefef] shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between border-b border-[#d2d2d2] px-2 py-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="h-7 w-7 border border-[#bcbcbc] bg-white text-sm"
                onClick={() => router.push(localePath("/directories/warehouses"))}
              >
                ←
              </button>
              <button type="button" className="h-7 w-7 border border-[#bcbcbc] bg-white text-sm">
                →
              </button>
            </div>
            <span className="text-2xl leading-none text-[#c3c3c3]">☆</span>
            <h1 className="text-[18px] font-medium text-black">{title}</h1>
          </div>
          <div className="flex items-center gap-3 text-lg text-[#777]">
            <span>🔗</span>
            <span>⋮</span>
            <span>▢</span>
            <span>×</span>
          </div>
        </div>

        <div className="border-b border-[#d4d4d4] px-3 py-3">
          <div className="mb-4 flex items-center gap-3">
            <button
              type="button"
              className="h-10 rounded-sm border border-[#b99800] bg-[#f5d90a] px-5 text-sm font-medium text-black hover:bg-[#f0d000]"
              onClick={() => {
                setSaveMode("close");
                saveMutation.mutate();
              }}
              disabled={saveMutation.isPending || !formData.name.trim()}
            >
              Записать и закрыть
            </button>
            <button
              type="button"
              className="h-10 rounded-sm border border-[#bcbcbc] bg-white px-5 text-sm text-black hover:bg-[#f3f3f3]"
              onClick={() => {
                setSaveMode("stay");
                saveMutation.mutate();
              }}
              disabled={saveMutation.isPending || !formData.name.trim()}
            >
              {saveMutation.isPending ? "Сохранение..." : "Записать"}
            </button>
            <div className="ml-auto">
              <button
                type="button"
                className="h-10 rounded-sm border border-[#bcbcbc] bg-white px-4 text-sm text-black hover:bg-[#f3f3f3]"
              >
                Еще ▾
              </button>
            </div>
          </div>

          <div className="grid grid-cols-[190px_1fr_190px_1fr] items-center gap-x-4 gap-y-3">
            <label className="text-sm">Код:</label>
            <input
              value={formData.code}
              onChange={(event) =>
                setFormData((current) => ({ ...current, code: event.target.value }))
              }
              className="h-11 rounded-none border border-[#bcbcbc] bg-[#f8f8f8] px-3 text-sm"
            />

            <label className="text-sm">Наименование:</label>
            <input
              value={formData.name}
              onChange={(event) =>
                setFormData((current) => ({ ...current, name: event.target.value }))
              }
              className="h-11 rounded-none border border-[#e0bd00] bg-white px-3 text-sm shadow-[inset_0_0_0_1px_#f5dd55]"
            />

            <label className="text-sm">Подразделение:</label>
            <select
              value={uiMeta.department}
                onChange={(event) =>
                setUiMetaDraft({ ...uiMeta, department: event.target.value })
              }
              className="h-11 rounded-none border border-[#bcbcbc] bg-white px-3 text-sm"
            >
              {departmentOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <label className="text-sm">Контрагент:</label>
            <select
              value={uiMeta.counterpartyId ? String(uiMeta.counterpartyId) : ""}
              onChange={(event) => {
                const nextId = event.target.value ? Number(event.target.value) : null;
                const selectedCounterparty = counterparties.find(
                  (item) => item.id === nextId,
                );

                setUiMetaDraft({
                  ...uiMeta,
                  counterpartyId: nextId,
                  counterpartyName: selectedCounterparty?.name || "",
                });
              }}
              className="h-11 rounded-none border border-[#bcbcbc] bg-white px-3 text-sm"
            >
              <option value=""> </option>
              {counterparties.map((counterparty) => (
                <option key={counterparty.id} value={String(counterparty.id)}>
                  {counterparty.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="h-[calc(100%-194px)] overflow-auto px-3 py-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium text-black">Остатки на складе</div>
            <div className="text-xs text-[#666]">
              Всего позиций: {balances.length} | Остаток: {formatNumber(totalQuantity)}
            </div>
          </div>

          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#f3f3f3]">
                <th className="w-14 border border-[#bdbdbd] px-3 py-2 text-left font-normal">№</th>
                <th className="border border-[#bdbdbd] px-3 py-2 text-left font-normal">Товар</th>
                <th className="w-[180px] border border-[#bdbdbd] px-3 py-2 text-right font-normal">Количество</th>
                <th className="w-[180px] border border-[#bdbdbd] px-3 py-2 text-right font-normal">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {mode === "create" ? (
                <tr>
                  <td colSpan={4} className="border border-[#bdbdbd] px-3 py-10 text-center text-[#666]">
                    После создания склада здесь будут отображаться остатки.
                  </td>
                </tr>
              ) : isBalancesLoading ? (
                <tr>
                  <td colSpan={4} className="border border-[#bdbdbd] px-3 py-10 text-center text-[#666]">
                    Загрузка...
                  </td>
                </tr>
              ) : balances.length === 0 ? (
                <tr>
                  <td colSpan={4} className="border border-[#bdbdbd] px-3 py-10 text-center text-[#666]">
                    На складе пока нет остатков.
                  </td>
                </tr>
              ) : (
                balances.map((row, index) => {
                  const itemId = Number(row.item_id || row.item || 0);
                  const isSelected = selectedBalanceId === itemId;

                  return (
                    <tr
                      key={`${itemId}-${index}`}
                      className={isSelected ? "bg-[#f8efba]" : "bg-white hover:bg-[#fbf7da]"}
                      onClick={() => setSelectedBalanceId(itemId)}
                      onDoubleClick={() => {
                        if (itemId) {
                          router.push(localePath(`/directories/items/${itemId}`));
                        }
                      }}
                    >
                      <td className="border border-[#bdbdbd] px-3 py-2">{index + 1}</td>
                      <td className="border border-[#bdbdbd] px-3 py-2 text-[#2e56a6]">
                        {row.item_name || `Товар #${itemId}`}
                      </td>
                      <td className="border border-[#bdbdbd] px-3 py-2 text-right">
                        {formatNumber(Number(row.quantity || 0))}
                      </td>
                      <td className="border border-[#bdbdbd] px-3 py-2 text-right">
                        {formatNumber(Number(row.amount || 0), 2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
