"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import type { Item, PaginatedResponse } from "@/types";

type StockReportRow = {
  item_id: number;
  item_name: string;
  item_sku?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  quantity?: number;
  amount?: number;
};

type WarehouseGroup = {
  key: string;
  warehouseName: string;
  items: Array<StockReportRow & { unit: string }>;
  totalQuantity: number;
};

function formatNumber(value: number, digits = 0) {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export default function WarehouseMaterialsReportPage() {
  const router = useRouter();
  const locale = useLocale();
  const localePath = (path: string) =>
    `/${locale}${path.startsWith("/") ? path : `/${path}`}`;

  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [dateFrom, setDateFrom] = useState("2026-03-01");
  const [dateTo, setDateTo] = useState("2026-03-01");
  const [warehouseId, setWarehouseId] = useState("");
  const [itemId, setItemId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [reportType, setReportType] = useState("Сальдовая");
  const [metricType, setMetricType] = useState("Кол-во");
  const [packType, setPackType] = useState("Без упаковки");
  const [negativeOnly, setNegativeOnly] = useState(false);
  const [bySuppliers, setBySuppliers] = useState(false);

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", "warehouse-materials"],
    queryFn: async () => {
      const response = await api.get("/directories/warehouses/");
      return Array.isArray(response) ? response : (response?.results ?? []);
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["items", "warehouse-materials"],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Item>>("/directories/items/");
      return response.results;
    },
  });

  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ["warehouse-materials", dateTo, warehouseId, itemId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateTo) params.append("date", dateTo);
      if (warehouseId) params.append("warehouse", warehouseId);
      if (itemId) params.append("item", itemId);
      return api.get(`/reports/stock-as-of-date/?${params.toString()}`);
    },
  });

  const groupedRows = useMemo<WarehouseGroup[]>(() => {
    const itemUnitMap = new Map<number, string>();
    items.forEach((item) => {
      itemUnitMap.set(item.id, item.unit || item.base_unit || "-");
    });

    const source = Array.isArray(report?.items) ? report.items : [];
    const groups = new Map<string, WarehouseGroup>();

    source.forEach((entry: StockReportRow) => {
      const quantity = Number(entry.quantity || 0);
      const key = String(entry.warehouse_id || 0);
      const current = groups.get(key) || {
        key,
        warehouseName: entry.warehouse_name || "Без склада",
        items: [],
        totalQuantity: 0,
      };

      const withUnit = {
        ...entry,
        quantity,
        amount: Number(entry.amount || 0),
        unit: itemUnitMap.get(entry.item_id) || "-",
      };

      if (!negativeOnly || quantity < 0) {
        current.items.push(withUnit);
        current.totalQuantity += quantity;
      }

      groups.set(key, current);
    });

    return Array.from(groups.values())
      .filter((group) => group.items.length > 0)
      .sort((left, right) => left.warehouseName.localeCompare(right.warehouseName, "ru"));
  }, [items, negativeOnly, report]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background px-1 py-1 text-foreground">
      <div className="mx-auto h-[calc(100vh-4.6rem)] w-full overflow-hidden border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-2 py-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button type="button" className="h-7 w-7 border border-border bg-background text-sm">
                ←
              </button>
              <button type="button" className="h-7 w-7 border border-border bg-background text-sm">
                →
              </button>
            </div>
            <span className="text-2xl leading-none text-muted-foreground">☆</span>
            <h1 className="text-[18px] font-medium text-foreground">Материальный отчет общий</h1>
          </div>
          <div className="flex items-center gap-3 text-lg text-muted-foreground">
            <span>⎙</span>
            <span>🔗</span>
            <span>⋮</span>
            <span>×</span>
          </div>
        </div>

        <div className="space-y-3 border-b border-[#d7d7d7] px-2 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              className="h-9 rounded-sm border border-border bg-background px-4 text-sm text-foreground hover:bg-muted"
              onClick={() => refetch()}
            >
              Сформировать
            </Button>

            <span className="text-sm">Вид отчета:</span>
            {["Сальдовая", "Оборотно-сальдовая"].map((value) => (
              <button
                key={value}
                type="button"
                className={`h-9 border px-3 text-sm ${
                  reportType === value
                    ? "border-[#76b46f] bg-emerald-50 dark:bg-emerald-950 text-[#198f38]"
                    : "border-border bg-background"
                }`}
                onClick={() => setReportType(value)}
              >
                {value}
              </button>
            ))}

            {["Кол-во", "Сумма"].map((value) => (
              <button
                key={value}
                type="button"
                className={`h-9 border px-3 text-sm ${
                  metricType === value
                    ? "border-[#76b46f] bg-emerald-50 dark:bg-emerald-950 text-[#198f38]"
                    : "border-border bg-background"
                }`}
                onClick={() => setMetricType(value)}
              >
                {value}
              </button>
            ))}

            {["Без упаковки", "С упаковки"].map((value) => (
              <button
                key={value}
                type="button"
                className={`h-9 border px-3 text-sm ${
                  packType === value
                    ? "border-[#76b46f] bg-emerald-50 dark:bg-emerald-950 text-[#198f38]"
                    : "border-border bg-background"
                }`}
                onClick={() => setPackType(value)}
              >
                {value}
              </button>
            ))}

            <span className="ml-4 text-sm">Период с:</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="h-9 w-[150px] rounded-none border border-border bg-background text-sm shadow-none focus-visible:ring-0"
            />
            <span className="text-sm">по:</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="h-9 w-[150px] rounded-none border border-border bg-background text-sm shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="grid grid-cols-[80px_230px_110px_230px_130px_110px_150px] items-center gap-2">
            <span className="text-sm">Склад:</span>
            <select
              value={warehouseId}
              onChange={(event) => setWarehouseId(event.target.value)}
              className="h-9 rounded-none border border-border bg-background px-2 text-sm"
            >
              <option value=""> </option>
              {warehouses.map((warehouse: { id: number; name: string }) => (
                <option key={warehouse.id} value={String(warehouse.id)}>
                  {warehouse.name}
                </option>
              ))}
            </select>

            <span className="text-sm">Номенклатура:</span>
            <select
              value={itemId}
              onChange={(event) => setItemId(event.target.value)}
              className="h-9 rounded-none border border-border bg-background px-2 text-sm"
            >
              <option value=""> </option>
              {items.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.name}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 text-sm">
              <span>Отрицательное:</span>
              <input
                type="checkbox"
                checked={negativeOnly}
                onChange={(event) => setNegativeOnly(event.target.checked)}
                className="h-4 w-4"
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <span>По поставщикам:</span>
              <input
                type="checkbox"
                checked={bySuppliers}
                onChange={(event) => setBySuppliers(event.target.checked)}
                className="h-4 w-4"
              />
            </label>

            <span className="text-sm">Валюта:</span>
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className="h-9 rounded-none border border-border bg-background px-2 text-sm"
            >
              <option value="USD">USD</option>
              <option value="UZS">UZS</option>
              <option value="RUB">RUB</option>
            </select>
          </div>
        </div>

        <div className="h-[calc(100%-120px)] overflow-auto px-2 py-3">
          <div className="mb-4 text-center text-[15px] font-semibold text-foreground">
            Материальный отчет за ... - 1 марта 2026 г.
          </div>

          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="w-9 border border-[#bdbdbd] px-2 py-2" />
                <th className="w-14 border border-[#bdbdbd] px-3 py-2 text-right font-normal">№</th>
                <th className="border border-[#bdbdbd] px-3 py-2 text-left font-normal">Наименование</th>
                <th className="border border-[#bdbdbd] px-3 py-2 text-left font-normal">Код в справочнике</th>
                <th className="border border-[#bdbdbd] px-3 py-2 text-left font-normal">Ед. изм.</th>
                <th className="border border-[#bdbdbd] px-3 py-2 text-right font-normal">Сальдо на конец периода</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="border border-[#bdbdbd] px-3 py-8 text-center">
                    Загрузка...
                  </td>
                </tr>
              ) : groupedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="border border-[#bdbdbd] px-3 py-8 text-center">
                    Нет данных за выбранный период
                  </td>
                </tr>
              ) : (
                groupedRows.map((group) => {
                  const isCollapsed = Boolean(collapsedGroups[group.key]);

                  return (
                    <Fragment key={group.key}>
                      <tr className="bg-[#fff200]">
                        <td className="border border-[#bdbdbd] px-2 py-1 text-center">
                          <button
                            type="button"
                            className="inline-flex h-5 w-5 items-center justify-center border border-border bg-background text-xs"
                            onClick={() =>
                              setCollapsedGroups((current) => ({
                                ...current,
                                [group.key]: !current[group.key],
                              }))
                            }
                          >
                            {isCollapsed ? "+" : "−"}
                          </button>
                        </td>
                        <td className="border border-[#bdbdbd] px-3 py-2 text-right font-semibold" colSpan={2}>
                          {group.warehouseName}
                        </td>
                        <td className="border border-[#bdbdbd] px-3 py-2" />
                        <td className="border border-[#bdbdbd] px-3 py-2" />
                        <td className="border border-[#bdbdbd] px-3 py-2 text-right font-semibold text-[#2d55b0]">
                          {formatNumber(group.totalQuantity, metricType === "Сумма" ? 2 : 3)}
                        </td>
                      </tr>

                      {!isCollapsed &&
                        group.items.map((row, index) => {
                          const rowKey = `${group.key}-${row.item_id}`;
                          const rowClassName =
                            selectedRowKey === rowKey ? "bg-accent" : "bg-background";

                          return (
                            <tr
                              key={rowKey}
                              className={`hover:bg-muted/50 hover:bg-muted/80 ${rowClassName}`}
                              onClick={() => setSelectedRowKey(rowKey)}
                              onDoubleClick={() =>
                                router.push(localePath(`/directories/items/${row.item_id}`))
                              }
                            >
                              <td className="border border-[#bdbdbd] px-2 py-2 text-center text-muted-foreground">
                                •
                              </td>
                              <td className="border border-[#bdbdbd] px-3 py-2 text-right">
                                {index + 1}
                              </td>
                              <td className="border border-[#bdbdbd] px-3 py-2 text-[#2e56a6]">
                                {row.item_name}
                              </td>
                              <td className="border border-[#bdbdbd] px-3 py-2">
                                {row.item_sku || row.item_id}
                              </td>
                              <td className="border border-[#bdbdbd] px-3 py-2">
                                {row.unit}
                              </td>
                              <td className="border border-[#bdbdbd] px-3 py-2 text-right">
                                {formatNumber(Number(row.quantity || 0), metricType === "Сумма" ? 2 : 3)}
                              </td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })
              )}

              {groupedRows.length > 0 && (
                <tr className="bg-card font-semibold">
                  <td className="border border-[#bdbdbd] px-2 py-2" />
                  <td className="border border-[#bdbdbd] px-3 py-2" colSpan={4}>
                    Итого
                  </td>
                  <td className="border border-[#bdbdbd] px-3 py-2 text-right text-[#2d55b0]">
                    {formatNumber(
                      groupedRows.reduce((sum, group) => sum + group.totalQuantity, 0),
                      metricType === "Сумма" ? 2 : 3,
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
