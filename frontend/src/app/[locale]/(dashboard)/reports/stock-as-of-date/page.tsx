"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import type { Item, PaginatedResponse } from "@/types";

const buttonClassName =
  "h-9 rounded-sm border border-[#bcbcbc] bg-background px-4 text-sm text-black hover:bg-[#f3f3f3]";

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
  warehouseId?: number;
  warehouseName: string;
  items: Array<StockReportRow & { unit: string }>;
  totalQuantity: number;
  totalAmount: number;
};

function formatNumber(value: number, fractionDigits = 1) {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export default function StockAsOfDatePage() {
  const router = useRouter();
  const locale = useLocale();
  const localePath = (path: string) =>
    `/${locale}${path.startsWith("/") ? path : `/${path}`}`;

  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [dateFrom, setDateFrom] = useState("2026-02-28");
  const [dateTo, setDateTo] = useState("2026-02-28");
  const [warehouseId, setWarehouseId] = useState("");
  const [itemId, setItemId] = useState("");
  const [manufacturerName, setManufacturerName] = useState("");
  const [itemKindName, setItemKindName] = useState("");
  const [mode, setMode] = useState("Детализированная");
  const [stockMode, setStockMode] = useState("Сред.!");

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", "stock-report"],
    queryFn: async () => {
      const response = await api.get("/directories/warehouses/");
      return Array.isArray(response) ? response : (response?.results ?? []);
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["items", "stock-report"],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Item>>("/directories/items/");
      return response.results;
    },
  });

  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ["stock-as-of-date", dateTo, warehouseId, itemId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateTo) params.append("date", dateTo);
      if (warehouseId) params.append("warehouse", warehouseId);
      if (itemId) params.append("item", itemId);
      return api.get(`/reports/stock-as-of-date/?${params.toString()}`);
    },
  });

  const rows = useMemo<StockReportRow[]>(() => {
    const source = Array.isArray(report?.items) ? report.items : [];
    return source.map((entry: StockReportRow) => ({
      item_id: entry.item_id,
      item_name: entry.item_name,
      item_sku: entry.item_sku,
      warehouse_id: entry.warehouse_id,
      warehouse_name: entry.warehouse_name,
      quantity: Number(entry.quantity) || 0,
      amount: Number(entry.amount) || 0,
    }));
  }, [report]);

  const groupedRows = useMemo<WarehouseGroup[]>(() => {
    const itemUnitMap = new Map<number, string>();
    items.forEach((item) => {
      const unitLabel = item.unit || item.base_unit || "-";
      itemUnitMap.set(item.id, unitLabel);
    });

    const groups = new Map<string, WarehouseGroup>();

    rows.forEach((row) => {
      const key = String(row.warehouse_id || 0);
      const warehouseName = row.warehouse_name || "Без склада";
      const current = groups.get(key) || {
        key,
        warehouseId: row.warehouse_id,
        warehouseName,
        items: [],
        totalQuantity: 0,
        totalAmount: 0,
      };

      current.items.push({
        ...row,
        unit: itemUnitMap.get(row.item_id) || "-",
      });
      current.totalQuantity += Number(row.quantity || 0);
      current.totalAmount += Number(row.amount || 0);
      groups.set(key, current);
    });

    return Array.from(groups.values()).sort((left, right) =>
      left.warehouseName.localeCompare(right.warehouseName, "ru"),
    );
  }, [items, rows]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#e9e9e9] px-1 py-1 text-[#3e3e3e]">
      <div className="mx-auto h-[calc(100vh-4.6rem)] w-full overflow-hidden border border-[#c9c9c9] bg-[#efefef] shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between border-b border-[#d2d2d2] px-2 py-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button type="button" className="h-7 w-7 border border-[#bcbcbc] bg-background text-sm">
                ←
              </button>
              <button type="button" className="h-7 w-7 border border-[#bcbcbc] bg-background text-sm">
                →
              </button>
            </div>
            <span className="text-2xl leading-none text-[#c3c3c3]">☆</span>
            <h1 className="text-[18px] font-medium text-black">Материальный отчет</h1>
          </div>
          <div className="flex items-center gap-3 text-lg text-[#777]">
            <span>⎙</span>
            <span>🔗</span>
            <span>⋮</span>
            <span>×</span>
          </div>
        </div>

        <div className="space-y-3 border-b border-[#d7d7d7] px-2 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" className={buttonClassName} onClick={() => refetch()}>
              Сформировать
            </Button>
            <span className="text-sm">Период с:</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="h-9 w-[150px] rounded-none border border-[#bcbcbc] bg-background text-sm shadow-none focus-visible:ring-0"
            />
            <span className="text-sm">по:</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="h-9 w-[150px] rounded-none border border-[#bcbcbc] bg-background text-sm shadow-none focus-visible:ring-0"
            />
            {["Сплошная", "По партии", "Детализированная", "Сравнительный"].map((value) => (
              <button
                key={value}
                type="button"
                className={`h-9 border px-3 text-sm ${
                  mode === value
                    ? "border-[#76b46f] bg-emerald-50 dark:bg-emerald-950 text-[#198f38]"
                    : "border-[#bcbcbc] bg-background"
                }`}
                onClick={() => setMode(value)}
              >
                {value}
              </button>
            ))}
            <span className="ml-2 text-sm">Запас:</span>
            {["Мин.!", "Сред.!"].map((value) => (
              <button
                key={value}
                type="button"
                className={`h-9 border px-3 text-sm ${
                  stockMode === value
                    ? "border-[#d1c100] bg-[#fff4ae] text-[#8e7800]"
                    : "border-[#bcbcbc] bg-background"
                }`}
                onClick={() => setStockMode(value)}
              >
                {value}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-[110px_340px_110px_340px_110px_1fr] items-center gap-2">
            <span className="text-sm">Поставщик:</span>
            <Input
              value=""
              readOnly
              className="h-9 rounded-none border border-[#bcbcbc] bg-background text-sm shadow-none focus-visible:ring-0"
            />
            <span className="text-sm">Вид товара:</span>
            <Input
              value={itemKindName}
              onChange={(event) => setItemKindName(event.target.value)}
              className="h-9 rounded-none border border-[#bcbcbc] bg-background text-sm shadow-none focus-visible:ring-0"
            />
            <span className="text-sm">Движение:</span>
            <label className="flex h-9 items-center">
              <input type="checkbox" className="h-4 w-4" />
            </label>
          </div>

          <div className="grid grid-cols-[110px_340px_110px_340px_110px_1fr] items-center gap-2">
            <span className="text-sm">Партия:</span>
            <Input
              value=""
              readOnly
              className="h-9 rounded-none border border-[#bcbcbc] bg-background text-sm shadow-none focus-visible:ring-0"
            />
            <span className="text-sm">Номенклатура:</span>
            <select
              value={itemId}
              onChange={(event) => setItemId(event.target.value)}
              className="h-9 rounded-none border border-[#bcbcbc] bg-background px-2 text-sm"
            >
              <option value=""> </option>
              {items.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.name}
                </option>
              ))}
            </select>
            <span className="text-sm">Тип товара:</span>
            <Input
              value=""
              readOnly
              className="h-9 rounded-none border border-[#bcbcbc] bg-background text-sm shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="grid grid-cols-[110px_340px_110px_340px_110px_1fr] items-center gap-2">
            <span className="text-sm">Склад:</span>
            <select
              value={warehouseId}
              onChange={(event) => setWarehouseId(event.target.value)}
              className="h-9 rounded-none border border-[#bcbcbc] bg-background px-2 text-sm"
            >
              <option value=""> </option>
              {warehouses.map((warehouse: { id: number; name: string }) => (
                <option key={warehouse.id} value={String(warehouse.id)}>
                  {warehouse.name}
                </option>
              ))}
            </select>
            <span className="text-sm">Валюта:</span>
            <Input
              value="USD"
              readOnly
              className="h-9 rounded-none border border-[#bcbcbc] bg-[#f6f6f6] text-sm shadow-none focus-visible:ring-0"
            />
            <span className="text-sm">Производитель:</span>
            <Input
              value={manufacturerName}
              onChange={(event) => setManufacturerName(event.target.value)}
              className="h-9 rounded-none border border-[#bcbcbc] bg-background text-sm shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="h-[calc(100%-132px)] overflow-auto px-2 py-3">
          <div className="mb-4 text-center text-[15px] font-semibold text-black">
            Оборотно-сальдовая ведомость по товарам за 28 февраля 2026 г.
          </div>

          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#f3f3f3]">
                <th className="w-9 border border-[#bdbdbd] px-2 py-2" />
                <th className="border border-[#bdbdbd] px-3 py-2 text-left font-normal">Товар</th>
                <th className="border border-[#bdbdbd] px-3 py-2 text-left font-normal">Артикул</th>
                <th className="border border-[#bdbdbd] px-3 py-2 text-left font-normal">Ед. изм</th>
                <th className="border border-[#bdbdbd] px-3 py-2 text-right font-normal">Начальный остаток</th>
                <th className="border border-[#bdbdbd] px-3 py-2 text-right font-normal">Приход</th>
                <th className="border border-[#bdbdbd] px-3 py-2 text-right font-normal">Списание</th>
                <th className="border border-[#bdbdbd] px-3 py-2 text-right font-normal">Конечный остаток</th>
                <th className="border border-[#bdbdbd] px-3 py-2 text-right font-normal">Сумма USD</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="border border-[#bdbdbd] px-3 py-8 text-center">
                    Загрузка...
                  </td>
                </tr>
              ) : groupedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="border border-[#bdbdbd] px-3 py-8 text-center">
                    Нет данных за выбранный период
                  </td>
                </tr>
              ) : (
                groupedRows.map((group) => {
                  const isCollapsed = Boolean(collapsedGroups[group.key]);

                  return (
                    <Fragment key={`group-${group.key}`}>
                      <tr key={`group-${group.key}`} className="bg-[#fff7b8] font-semibold">
                        <td className="border border-[#bdbdbd] px-2 py-1 text-center">
                          <button
                            type="button"
                            className="inline-flex h-5 w-5 items-center justify-center border border-[#ababab] bg-background text-xs"
                            onClick={() => toggleGroup(group.key)}
                          >
                            {isCollapsed ? "+" : "−"}
                          </button>
                        </td>
                        <td className="border border-[#bdbdbd] px-3 py-2 text-left text-[#2c2c2c]">
                          {group.warehouseName}
                        </td>
                        <td className="border border-[#bdbdbd] px-3 py-2" />
                        <td className="border border-[#bdbdbd] px-3 py-2" />
                        <td className="border border-[#bdbdbd] px-3 py-2 text-right">0,0</td>
                        <td className="border border-[#bdbdbd] px-3 py-2 text-right">
                          {formatNumber(group.totalQuantity)}
                        </td>
                        <td className="border border-[#bdbdbd] px-3 py-2 text-right">0,0</td>
                        <td className="border border-[#bdbdbd] px-3 py-2 text-right text-[#a50000]">
                          {formatNumber(group.totalQuantity)}
                        </td>
                        <td className="border border-[#bdbdbd] px-3 py-2 text-right">
                          {formatNumber(group.totalAmount, 2)}
                        </td>
                      </tr>

                      {!isCollapsed &&
                        group.items.map((row) => {
                          const rowKey = `${group.key}-${row.item_id}`;
                          const selectedClassName =
                            selectedRowKey === rowKey ? "bg-[#f8efba]" : "";

                          return (
                            <tr
                              key={rowKey}
                              className="bg-background hover:bg-[#fbf7da]"
                              onClick={() => setSelectedRowKey(rowKey)}
                              onDoubleClick={() =>
                                router.push(localePath(`/directories/items/${row.item_id}`))
                              }
                            >
                              <td className={`border border-[#bdbdbd] px-2 py-2 text-center ${selectedClassName}`}>
                                <span className="text-[#838383]">•</span>
                              </td>
                              <td className={`border border-[#bdbdbd] px-3 py-2 ${selectedClassName}`}>
                                <span className="cursor-default text-[#2e56a6]">{row.item_name}</span>
                              </td>
                              <td className={`border border-[#bdbdbd] px-3 py-2 ${selectedClassName}`}>
                                {row.item_sku || row.item_id}
                              </td>
                              <td className={`border border-[#bdbdbd] px-3 py-2 ${selectedClassName}`}>
                                {row.unit}
                              </td>
                              <td className={`border border-[#bdbdbd] px-3 py-2 text-right ${selectedClassName}`}>
                                0,0
                              </td>
                              <td className={`border border-[#bdbdbd] px-3 py-2 text-right ${selectedClassName}`}>
                                {formatNumber(Number(row.quantity || 0))}
                              </td>
                              <td className={`border border-[#bdbdbd] px-3 py-2 text-right ${selectedClassName}`}>
                                0,0
                              </td>
                              <td className={`border border-[#bdbdbd] px-3 py-2 text-right text-[#a50000] ${selectedClassName}`}>
                                {formatNumber(Number(row.quantity || 0))}
                              </td>
                              <td className={`border border-[#bdbdbd] px-3 py-2 text-right ${selectedClassName}`}>
                                {formatNumber(Number(row.amount || 0), 2)}
                              </td>
                            </tr>
                          );
                        })}
                    </Fragment>
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
