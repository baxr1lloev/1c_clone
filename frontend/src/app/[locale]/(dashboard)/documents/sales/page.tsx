"use client";

import { useMemo, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PiTrashBold } from "react-icons/pi";

import api from "@/lib/api";
import { mapApiError } from "@/lib/error-mapper";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

type ListResponse<T> = { results?: T[] } | T[];

interface DirectoryItem {
  id: number;
  name: string;
  sku?: string;
  item_type?: "GOODS" | "SERVICE";
  type?: "goods" | "service";
  unit?: string;
  base_unit?: string;
  sale_price?: string | number;
  selling_price?: string | number;
}

interface WarehouseOption {
  id: number;
  name: string;
}

interface CounterpartyOption {
  id: number;
  name: string;
}

interface ContractOption {
  id: number;
  number: string;
  counterparty: number;
}

interface CurrencyOption {
  id: number;
  code: string;
  name: string;
  is_base?: boolean;
}

interface WorkspaceLine {
  key: string;
  item: number;
  itemName: string;
  itemType: "GOODS" | "SERVICE";
  unit: string;
  quantity: number;
  price: number;
}

interface SettlementInfo {
  debt_now?: number;
}

interface StockPredictItem {
  item_id: number;
  item_name: string;
  is_negative: boolean;
}

interface StockPredictResponse {
  items?: StockPredictItem[];
}

interface UiMessage {
  id: string;
  text: string;
  type: "warning" | "error" | "info";
}

interface SalesCreateResponse {
  id: number;
  number?: string;
}

interface CashCreateResponse {
  id: number;
}

function normalizeListResponse<T>(response: ListResponse<T> | undefined): T[] {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  return response.results || [];
}

function toNumber(value: string | number | undefined | null, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatAmount(value: number): string {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function extractErrorMessages(error: unknown): string[] {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (!data || typeof data !== "object") return [];

  const unknownData = data as Record<string, unknown>;
  const messages: string[] = [];

  if (typeof unknownData.error === "string" && unknownData.error.trim()) {
    messages.push(unknownData.error.trim());
  }

  const validationErrors = unknownData.validation_errors;
  if (Array.isArray(validationErrors)) {
    for (const item of validationErrors) {
      if (typeof item === "string" && item.trim()) {
        messages.push(item.trim());
      }
    }
  }

  for (const [key, value] of Object.entries(unknownData)) {
    if (key === "error" || key === "validation_errors") continue;
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === "string" && entry.trim()) {
          messages.push(entry.trim());
        }
      }
    } else if (typeof value === "string" && value.trim()) {
      messages.push(value.trim());
    }
  }

  return Array.from(new Set(messages));
}

export default function SalesDocumentsPage() {
  const queryClient = useQueryClient();

  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [counterpartyId, setCounterpartyId] = useState<number | null>(null);
  const [contractId, setContractId] = useState<number | null>(null);
  const [currencyId, setCurrencyId] = useState<number | null>(null);
  const [workDate, setWorkDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [cashDesk, setCashDesk] = useState<string>("Main Cash Desk");
  const [priceType, setPriceType] = useState<string>("Оптовая");
  const [catalogMode, setCatalogMode] = useState<"goods" | "service">("goods");
  const [searchValue, setSearchValue] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [rateValue, setRateValue] = useState<string>("1.00");
  const [printWarehouse, setPrintWarehouse] = useState<boolean>(false);
  const [printSlip, setPrintSlip] = useState<boolean>(false);
  const [isPaymentMarked, setIsPaymentMarked] = useState<boolean>(true);
  const [lines, setLines] = useState<WorkspaceLine[]>([]);
  const [customMessages, setCustomMessages] = useState<UiMessage[]>([]);

  const { data: warehousesRaw = [] } = useQuery<ListResponse<WarehouseOption>>({
    queryKey: ["sales-pos-warehouses"],
    queryFn: () => api.get<ListResponse<WarehouseOption>>("/directories/warehouses/"),
    initialData: [],
  });
  const warehouses = useMemo(
    () => normalizeListResponse(warehousesRaw),
    [warehousesRaw],
  );

  const { data: counterpartiesRaw = [] } = useQuery<ListResponse<CounterpartyOption>>({
    queryKey: ["sales-pos-counterparties"],
    queryFn: () =>
      api.get<ListResponse<CounterpartyOption>>("/directories/counterparties/"),
    initialData: [],
  });
  const counterparties = useMemo(
    () => normalizeListResponse(counterpartiesRaw),
    [counterpartiesRaw],
  );

  const { data: contractsRaw = [] } = useQuery<ListResponse<ContractOption>>({
    queryKey: ["sales-pos-contracts"],
    queryFn: () => api.get<ListResponse<ContractOption>>("/directories/contracts/"),
    initialData: [],
  });
  const contracts = useMemo(
    () => normalizeListResponse(contractsRaw),
    [contractsRaw],
  );

  const { data: currenciesRaw = [] } = useQuery<ListResponse<CurrencyOption>>({
    queryKey: ["sales-pos-currencies"],
    queryFn: () => api.get<ListResponse<CurrencyOption>>("/directories/currencies/"),
    initialData: [],
  });
  const currencies = useMemo(
    () => normalizeListResponse(currenciesRaw),
    [currenciesRaw],
  );

  const { data: itemsRaw = [] } = useQuery<ListResponse<DirectoryItem>>({
    queryKey: ["sales-pos-items"],
    queryFn: () => api.get<ListResponse<DirectoryItem>>("/directories/items/"),
    initialData: [],
  });
  const items = useMemo(() => normalizeListResponse(itemsRaw), [itemsRaw]);

  const defaultWarehouseId = warehouses[0]?.id ?? null;
  const effectiveWarehouseId = warehouseId ?? defaultWarehouseId;

  const defaultCounterpartyId = counterparties[0]?.id ?? null;
  const effectiveCounterpartyId = counterpartyId ?? defaultCounterpartyId;

  const defaultCurrencyId = useMemo(() => {
    if (currencies.length === 0) return null;
    const usd = currencies.find(
      (currency) => String(currency.code || "").toUpperCase() === "USD",
    );
    return (usd || currencies[0]).id;
  }, [currencies]);
  const effectiveCurrencyId = currencyId ?? defaultCurrencyId;

  const contractsForCounterparty = useMemo(() => {
    if (!effectiveCounterpartyId) return contracts;
    return contracts.filter(
      (contract) => Number(contract.counterparty) === effectiveCounterpartyId,
    );
  }, [contracts, effectiveCounterpartyId]);

  const effectiveContractId = useMemo(() => {
    if (contractsForCounterparty.length === 0) return null;
    if (
      contractId &&
      contractsForCounterparty.some((contract) => contract.id === contractId)
    ) {
      return contractId;
    }
    return contractsForCounterparty[0].id;
  }, [contractId, contractsForCounterparty]);

  const selectedCurrency = useMemo(
    () => currencies.find((currency) => currency.id === effectiveCurrencyId) || null,
    [currencies, effectiveCurrencyId],
  );
  const selectedCurrencyCode = selectedCurrency?.code || "USD";

  const counterpartyMap = useMemo(() => {
    const map = new Map<number, CounterpartyOption>();
    for (const counterparty of counterparties) {
      map.set(counterparty.id, counterparty);
    }
    return map;
  }, [counterparties]);

  const filteredCatalogItems = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    return items
      .filter((item) => {
        const type =
          item.item_type ||
          (item.type === "service" ? "SERVICE" : "GOODS");
        return catalogMode === "goods" ? type === "GOODS" : type === "SERVICE";
      })
      .filter((item) => {
        if (!normalizedSearch) return true;
        return (
          String(item.name || "").toLowerCase().includes(normalizedSearch) ||
          String(item.sku || "").toLowerCase().includes(normalizedSearch)
        );
      });
  }, [catalogMode, items, searchValue]);

  const totalAmount = useMemo(
    () =>
      lines.reduce(
        (sum, line) => sum + Number(line.quantity || 0) * Number(line.price || 0),
        0,
      ),
    [lines],
  );
  const totalQuantity = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0),
    [lines],
  );

  const goodsLinesForPrediction = useMemo(
    () =>
      lines
        .filter((line) => line.itemType === "GOODS")
        .map((line) => ({
          item: line.item,
          quantity: Number(line.quantity || 0),
        }))
        .filter((line) => line.item && line.quantity > 0),
    [lines],
  );

  const { data: settlementInfo } = useQuery<SettlementInfo | null>({
    queryKey: [
      "sales-pos-settlement-info",
      effectiveCounterpartyId,
      effectiveContractId,
      effectiveCurrencyId,
      totalAmount,
    ],
    queryFn: async () => {
      if (!effectiveCounterpartyId) return null;
      try {
        return await api.get<SettlementInfo>(
          "/registers/operational/settlement-info/",
          {
            params: {
              counterparty: effectiveCounterpartyId,
              ...(effectiveContractId ? { contract: effectiveContractId } : {}),
              ...(effectiveCurrencyId ? { currency: effectiveCurrencyId } : {}),
            },
          },
        );
      } catch {
        return null;
      }
    },
    enabled: Boolean(effectiveCounterpartyId),
  });

  const { data: stockPrediction } = useQuery<StockPredictResponse>({
    queryKey: [
      "sales-pos-stock-predict",
      effectiveWarehouseId,
      goodsLinesForPrediction,
      catalogMode,
    ],
    queryFn: async () => {
      if (!effectiveWarehouseId || goodsLinesForPrediction.length === 0) {
        return { items: [] };
      }
      try {
        return await api.post<StockPredictResponse>(
          "/registers/operational/stock-predict/",
          {
            warehouse: effectiveWarehouseId,
            lines: goodsLinesForPrediction,
            operation: "OUT",
          },
        );
      } catch {
        return { items: [] };
      }
    },
    enabled: Boolean(effectiveWarehouseId && goodsLinesForPrediction.length),
  });

  const stockWarningMessages = useMemo<UiMessage[]>(() => {
    const warnings = (stockPrediction?.items || []).filter(
      (item) => item.is_negative,
    );
    return warnings.map((warning) => ({
      id: `stock-${warning.item_id}`,
      type: "warning",
      text: `Вы выбрали количество больше чем в остатке: ${warning.item_name}`,
    }));
  }, [stockPrediction]);

  const allMessages = useMemo(() => {
    const merged = [...customMessages, ...stockWarningMessages];
    const unique = new Map<string, UiMessage>();
    for (const message of merged) {
      unique.set(message.id, message);
    }
    return Array.from(unique.values()).slice(-8);
  }, [customMessages, stockWarningMessages]);

  const addMessage = (message: UiMessage) => {
    setCustomMessages((prev) => {
      const next = [...prev.filter((entry) => entry.id !== message.id), message];
      return next.slice(-8);
    });
  };

  const clearMessages = () => {
    setCustomMessages([]);
  };

  const addCatalogItemToLines = (item: DirectoryItem) => {
    const itemType: "GOODS" | "SERVICE" =
      item.item_type || (item.type === "service" ? "SERVICE" : "GOODS");
    const defaultPrice = toNumber(item.sale_price ?? item.selling_price, 0);
    const unit = item.base_unit || item.unit || "шт";

    setLines((prev) => {
      const index = prev.findIndex((line) => line.item === item.id);
      if (index >= 0) {
        const next = [...prev];
        next[index] = {
          ...next[index],
          quantity: Number(next[index].quantity || 0) + 1,
        };
        return next;
      }
      return [
        ...prev,
        {
          key: `${item.id}-${Date.now()}`,
          item: item.id,
          itemName: item.name,
          itemType,
          unit,
          quantity: 1,
          price: defaultPrice,
        },
      ];
    });
  };

  const updateLine = (
    index: number,
    field: "quantity" | "price",
    rawValue: string,
  ) => {
    const numericValue = toNumber(rawValue, 0);
    setLines((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: numericValue < 0 ? 0 : numericValue,
      };
      return next;
    });
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  };

  const createSalesPayload = () => ({
    date: `${workDate}T00:00:00`,
    comment: note,
    counterparty: effectiveCounterpartyId,
    contract: effectiveContractId,
    warehouse: effectiveWarehouseId,
    currency: effectiveCurrencyId,
    lines: lines.map((line) => ({
      item: line.item,
      quantity: Number(line.quantity || 0),
      package: null,
      coefficient: 1,
      price: Number(line.price || 0),
      discount: 0,
      vat_rate: 0,
    })),
  });

  const validateBeforeSubmit = (): boolean => {
    if (!effectiveWarehouseId) {
      toast.error("Выберите склад.");
      addMessage({
        id: "validate-warehouse",
        type: "warning",
        text: "Не выбран склад.",
      });
      return false;
    }
    if (!effectiveCounterpartyId) {
      toast.error("Выберите покупателя.");
      addMessage({
        id: "validate-counterparty",
        type: "warning",
        text: "Не выбран покупатель.",
      });
      return false;
    }
    if (!effectiveContractId) {
      toast.error("Выберите договор.");
      addMessage({
        id: "validate-contract",
        type: "warning",
        text: "Не выбран договор.",
      });
      return false;
    }
    if (!effectiveCurrencyId) {
      toast.error("Выберите валюту.");
      addMessage({
        id: "validate-currency",
        type: "warning",
        text: "Не выбрана валюта.",
      });
      return false;
    }
    if (lines.length === 0) {
      toast.error("Добавьте хотя бы одну позицию.");
      addMessage({
        id: "validate-lines",
        type: "warning",
        text: "Документ пустой: не выбраны товары/услуги.",
      });
      return false;
    }
    if (lines.some((line) => Number(line.quantity || 0) <= 0)) {
      toast.error("Количество в строках должно быть больше 0.");
      addMessage({
        id: "validate-qty",
        type: "warning",
        text: "Есть строка с нулевым количеством.",
      });
      return false;
    }
    if (lines.some((line) => Number(line.price || 0) < 0)) {
      toast.error("Цена не может быть отрицательной.");
      addMessage({
        id: "validate-price",
        type: "warning",
        text: "Есть строка с отрицательной ценой.",
      });
      return false;
    }
    return true;
  };

  const runSalesWorkflow = async (withCashOrder: boolean) => {
    if (!validateBeforeSubmit()) return;

    clearMessages();

    try {
      const sales = await api.post<SalesCreateResponse>(
        "/documents/sales/",
        createSalesPayload(),
      );
      await api.post(`/documents/sales/${sales.id}/post/`);

      if (withCashOrder && isPaymentMarked) {
        const cashOrder = await api.post<CashCreateResponse>("/documents/cash-orders/", {
          date: `${workDate}T00:00:00`,
          order_type: "incoming",
          counterparty: effectiveCounterpartyId,
          counterparty_name:
            counterpartyMap.get(Number(effectiveCounterpartyId || 0))?.name || "Покупатель",
          amount: totalAmount,
          currency: effectiveCurrencyId,
          cash_desk: cashDesk || "Main Cash Desk",
          purpose: `Оплата по реализации ${sales.number || `#${sales.id}`}`,
          basis: sales.number || `Реализация #${sales.id}`,
          comment: note,
        });
        await api.post(`/documents/cash-orders/${cashOrder.id}/post/`);
      }

      queryClient.invalidateQueries({ queryKey: ["sales-documents"] });
      queryClient.invalidateQueries({ queryKey: ["cash-orders"] });

      toast.success(
        withCashOrder && isPaymentMarked
          ? "Реализация и кассовый ордер успешно проведены."
          : "Реализация успешно проведена.",
      );

      addMessage({
        id: `success-${Date.now()}`,
        type: "info",
        text:
          withCashOrder && isPaymentMarked
            ? "Операция завершена: реализация + наличная оплата."
            : "Операция завершена: реализация проведена.",
      });

      setLines([]);
      setNote("");
      setSearchValue("");
    } catch (error) {
      const { title, description } = mapApiError(error);
      toast.error(title, { description });

      const details = extractErrorMessages(error);
      if (details.length === 0) {
        addMessage({
          id: `error-${Date.now()}`,
          type: "error",
          text: title,
        });
      } else {
        for (const detail of details) {
          addMessage({
            id: `error-${detail}`,
            type: "error",
            text: detail,
          });
        }
      }
    }
  };

  const acceptInvoiceMutation = useMutation({
    mutationFn: async () => runSalesWorkflow(false),
  });

  const cashMutation = useMutation({
    mutationFn: async () => runSalesWorkflow(true),
  });

  const isBusy = acceptInvoiceMutation.isPending || cashMutation.isPending;

  useHotkeys(
    "f12",
    (event) => {
      event.preventDefault();
      if (!isBusy) acceptInvoiceMutation.mutate();
    },
    { enableOnFormTags: true },
    [
      isBusy,
      lines,
      effectiveWarehouseId,
      effectiveCounterpartyId,
      effectiveContractId,
      effectiveCurrencyId,
    ],
  );

  useHotkeys(
    "f6",
    (event) => {
      event.preventDefault();
      if (!isBusy) cashMutation.mutate();
    },
    { enableOnFormTags: true },
    [
      isBusy,
      lines,
      effectiveWarehouseId,
      effectiveCounterpartyId,
      effectiveContractId,
      effectiveCurrencyId,
      isPaymentMarked,
    ],
  );

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-background">
      <div className="h-full border border-border bg-white dark:bg-zinc-950 flex flex-col">
        <div className="px-3 py-2 border-b bg-muted/30 text-sm font-semibold tracking-wide">
          РЕАЛИЗАЦИЯ
        </div>

        <div className="grid grid-cols-12 gap-0 flex-1 min-h-0">
          <div className="col-span-5 border-r border-border min-h-0 flex flex-col">
            <div className="p-2 border-b space-y-2">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <label className="text-xs text-muted-foreground">Склад:</label>
                  <select
                    className="h-8 w-full border rounded px-2 text-sm bg-background"
                    value={effectiveWarehouseId || ""}
                    onChange={(event) =>
                      setWarehouseId(event.target.value ? Number(event.target.value) : null)
                    }
                  >
                    <option value="">Выберите склад</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-4">
                  <label className="text-xs text-muted-foreground">Касса:</label>
                  <Input
                    value={cashDesk}
                    onChange={(event) => setCashDesk(event.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="col-span-3">
                  <label className="text-xs text-muted-foreground">Тип цен:</label>
                  <Input
                    value={priceType}
                    onChange={(event) => setPriceType(event.target.value)}
                    className="h-8"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={catalogMode === "goods" ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => setCatalogMode("goods")}
                >
                  Товар
                </Button>
                <Button
                  size="sm"
                  variant={catalogMode === "service" ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => setCatalogMode("service")}
                >
                  Услуга
                </Button>
                <Input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  className="h-7 text-xs"
                  placeholder="Поиск (Ctrl+F)"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-muted/60 border-b">
                  <tr>
                    <th className="text-left font-medium px-2 py-1 w-10">N</th>
                    {catalogMode === "goods" && (
                      <th className="text-left font-medium px-2 py-1">Склад</th>
                    )}
                    <th className="text-left font-medium px-2 py-1">Товар</th>
                    <th className="text-left font-medium px-2 py-1">Ед.изм</th>
                    <th className="text-right font-medium px-2 py-1">Цена</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCatalogItems.map((item, index) => {
                    const rowPrice = toNumber(item.sale_price ?? item.selling_price);
                    return (
                      <tr
                        key={item.id}
                        className="border-b hover:bg-yellow-50 dark:hover:bg-zinc-900 cursor-pointer"
                        onDoubleClick={() => addCatalogItemToLines(item)}
                        onClick={() => addCatalogItemToLines(item)}
                      >
                        <td className="px-2 py-1">{index + 1}</td>
                        {catalogMode === "goods" && (
                          <td className="px-2 py-1">
                            {effectiveWarehouseId ? "Текущий" : "-"}
                          </td>
                        )}
                        <td className="px-2 py-1">{item.name}</td>
                        <td className="px-2 py-1">{item.base_unit || item.unit || "-"}</td>
                        <td className="px-2 py-1 text-right">{formatAmount(rowPrice)}</td>
                      </tr>
                    );
                  })}
                  {filteredCatalogItems.length === 0 && (
                    <tr>
                      <td
                        colSpan={catalogMode === "goods" ? 5 : 4}
                        className="px-2 py-4 text-center text-muted-foreground"
                      >
                        Номенклатура не найдена
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="col-span-7 min-h-0 flex flex-col">
            <div className="p-2 border-b">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <label className="text-xs text-muted-foreground">Контрагент:</label>
                  <select
                    className="h-8 w-full border rounded px-2 text-sm bg-background"
                    value={effectiveCounterpartyId || ""}
                    onChange={(event) =>
                      setCounterpartyId(
                        event.target.value ? Number(event.target.value) : null,
                      )
                    }
                  >
                    <option value="">Выберите покупателя</option>
                    {counterparties.map((counterparty) => (
                      <option key={counterparty.id} value={counterparty.id}>
                        {counterparty.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-4">
                  <label className="text-xs text-muted-foreground">Договор:</label>
                  <select
                    className="h-8 w-full border rounded px-2 text-sm bg-background"
                    value={effectiveContractId || ""}
                    onChange={(event) =>
                      setContractId(event.target.value ? Number(event.target.value) : null)
                    }
                  >
                    <option value="">Выберите договор</option>
                    {contractsForCounterparty.map((contract) => (
                      <option key={contract.id} value={contract.id}>
                        {contract.number}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="text-xs text-muted-foreground">Дата запроса:</label>
                  <Input
                    type="date"
                    value={workDate}
                    onChange={(event) => setWorkDate(event.target.value)}
                    className="h-8"
                  />
                </div>
              </div>
            </div>

            <div className="p-2 border-b">
              <table className="w-full text-xs border">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="text-left px-2 py-1 w-10">N</th>
                    <th className="text-left px-2 py-1">Валюта</th>
                    <th className="text-right px-2 py-1">Долг</th>
                    <th className="text-right px-2 py-1">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-yellow-50 dark:bg-zinc-900">
                    <td className="px-2 py-1">1</td>
                    <td className="px-2 py-1">
                      <select
                        className="h-7 border rounded px-2 text-xs bg-background"
                        value={effectiveCurrencyId || ""}
                        onChange={(event) =>
                          setCurrencyId(event.target.value ? Number(event.target.value) : null)
                        }
                      >
                        <option value="">-</option>
                        {currencies.map((currency) => (
                          <option key={currency.id} value={currency.id}>
                            {currency.code}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1 text-right">
                      {formatAmount(toNumber(settlementInfo?.debt_now))}
                    </td>
                    <td className="px-2 py-1 text-right">{formatAmount(totalAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-muted/60 border-b">
                  <tr>
                    <th className="text-left px-2 py-1 w-10">N</th>
                    <th className="text-left px-2 py-1">Товар</th>
                    <th className="text-left px-2 py-1">Ед.изм</th>
                    <th className="text-right px-2 py-1 w-28">Количество</th>
                    <th className="text-right px-2 py-1 w-28">Цена</th>
                    <th className="text-right px-2 py-1 w-28">Сумма</th>
                    <th className="text-left px-2 py-1 w-24">Валюта</th>
                    <th className="text-center px-2 py-1 w-12">Д</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => {
                    const amount = Number(line.quantity || 0) * Number(line.price || 0);
                    return (
                      <tr key={line.key} className="border-b hover:bg-yellow-50 dark:hover:bg-zinc-900">
                        <td className="px-2 py-1">{index + 1}</td>
                        <td className="px-2 py-1">{line.itemName}</td>
                        <td className="px-2 py-1">{line.unit}</td>
                        <td className="px-2 py-1">
                          <Input
                            type="number"
                            min="0"
                            step="0.001"
                            value={line.quantity}
                            onChange={(event) =>
                              updateLine(index, "quantity", event.target.value)
                            }
                            className="h-7 text-xs text-right"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.price}
                            onChange={(event) =>
                              updateLine(index, "price", event.target.value)
                            }
                            className="h-7 text-xs text-right"
                          />
                        </td>
                        <td className="px-2 py-1 text-right font-mono">
                          {formatAmount(amount)}
                        </td>
                        <td className="px-2 py-1">{selectedCurrencyCode}</td>
                        <td className="px-2 py-1 text-center">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive"
                            onClick={() => removeLine(index)}
                          >
                            <PiTrashBold className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-2 py-4 text-center text-muted-foreground">
                        Выберите товар или услугу слева
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t px-2 py-2 flex items-center justify-end gap-8 bg-muted/20">
              <div className="text-right">
                <div className="text-[11px] text-muted-foreground">Количество</div>
                <div className="font-mono">{formatAmount(totalQuantity)}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-muted-foreground">Итого</div>
                <div className="font-mono text-2xl leading-none">{formatAmount(totalAmount)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t p-2 space-y-2">
          <div>
            <label className="text-xs text-muted-foreground">Примечание:</label>
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="h-8"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <Checkbox
                  checked={printWarehouse}
                  onCheckedChange={(checked) => setPrintWarehouse(Boolean(checked))}
                />
                Печать складу
              </label>
              <label className="inline-flex items-center gap-2">
                <Checkbox
                  checked={printSlip}
                  onCheckedChange={(checked) => setPrintSlip(Boolean(checked))}
                />
                Печать
              </label>
              <label className="inline-flex items-center gap-2 text-emerald-600">
                <Checkbox
                  checked={isPaymentMarked}
                  onCheckedChange={(checked) => setIsPaymentMarked(Boolean(checked))}
                />
                Оплата
              </label>
              <span className="text-xs text-muted-foreground">Курс:</span>
              <Input
                value={rateValue}
                onChange={(event) => setRateValue(event.target.value)}
                className="h-8 w-24 text-right"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="lg"
                className="min-w-[220px] text-2xl"
                disabled={isBusy}
                onClick={() => acceptInvoiceMutation.mutate()}
              >
                {isBusy && acceptInvoiceMutation.isPending
                  ? "Обработка..."
                  : "Принять счет (F12)"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className={cn(
                  "min-w-[220px] text-2xl",
                  isPaymentMarked && "border-emerald-600 text-emerald-700",
                )}
                disabled={isBusy}
                onClick={() => cashMutation.mutate()}
              >
                {isBusy && cashMutation.isPending
                  ? "Обработка..."
                  : "Наличные (F6)"}
              </Button>
            </div>
          </div>
        </div>

        <div className="border-t min-h-8 bg-muted/10">
          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground border-b">
            Сообщения:
          </div>
          <div className="max-h-24 overflow-auto">
            {allMessages.length === 0 && (
              <div className="px-2 py-1 text-xs text-muted-foreground">-</div>
            )}
            {allMessages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "px-2 py-1 text-xs border-b",
                  message.type === "warning" && "bg-yellow-100/70 text-yellow-900",
                  message.type === "error" && "bg-red-100/70 text-red-900",
                  message.type === "info" && "bg-emerald-100/70 text-emerald-900",
                )}
              >
                - {message.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
