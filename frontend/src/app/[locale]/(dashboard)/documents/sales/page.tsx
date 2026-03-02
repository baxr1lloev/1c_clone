"use client";

import { useEffect, useMemo, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PiCaretDownBold,
  PiCheckBold,
  PiMagnifyingGlassBold,
  PiPlusBold,
  PiTrashBold,
} from "react-icons/pi";

import api from "@/lib/api";
import { mapApiError } from "@/lib/error-mapper";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  inn?: string;
  type?: "CUSTOMER" | "SUPPLIER" | "AGENT";
  phone?: string;
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
  basePrice: number;
  quantity: number;
  price: number;
  isManualPrice: boolean;
}

interface PriceTypeOption {
  id: string;
  code: number;
  name: string;
  currencyId: number | null;
  percent: number;
}

interface PriceTypeDraft {
  name: string;
  currencyId: string;
  percent: string;
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

interface ItemCategoryOption {
  id: number;
  name: string;
  code?: string;
}

interface CounterpartyGroupOption {
  id: string;
  name: string;
  type: CounterpartyOption["type"] | null;
}

interface CounterpartyDraft {
  name: string;
  inn: string;
  type: "CUSTOMER" | "SUPPLIER" | "AGENT";
  phone: string;
  groupId: string | null;
}

interface SalesItemDraft {
  name: string;
  sku: string;
  unit: string;
  itemType: "GOODS" | "SERVICE";
  categoryId: number | null;
  sellingPrice: string;
}

const PRICE_TYPE_STORAGE_KEY = "sales-pos-price-types";
const COUNTERPARTY_GROUPS_STORAGE_KEY = "sales-pos-counterparty-groups";
const COUNTERPARTY_GROUP_ASSIGNMENTS_STORAGE_KEY = "sales-pos-counterparty-group-assignments";
const DEFAULT_COUNTERPARTY_GROUPS: CounterpartyGroupOption[] = [
  { id: "sales-cp-suppliers", name: "Поставщики", type: "SUPPLIER" },
  { id: "sales-cp-customers", name: "Покупатели", type: "CUSTOMER" },
  { id: "sales-cp-other", name: "Прочие", type: "AGENT" },
];
const DEFAULT_PRICE_TYPE_ID = "wholesale";
const DEFAULT_PRICE_TYPES: PriceTypeOption[] = [
  {
    id: "base",
    code: 1,
    name: "Базовая цена",
    currencyId: null,
    percent: 0,
  },
  {
    id: DEFAULT_PRICE_TYPE_ID,
    code: 3,
    name: "Оптовая",
    currencyId: null,
    percent: 0,
  },
  {
    id: "retail",
    code: 2,
    name: "Розничная цена",
    currencyId: null,
    percent: 10,
  },
];

function normalizeListResponse<T>(response: ListResponse<T> | undefined): T[] {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  return response.results || [];
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatAmount(value: number): string {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getDefaultPriceTypes(): PriceTypeOption[] {
  return DEFAULT_PRICE_TYPES.map((priceType) => ({ ...priceType }));
}

function sanitizePriceTypes(value: unknown): PriceTypeOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const raw = item as Record<string, unknown>;
      const name = String(raw.name ?? "").trim();
      if (!name) {
        return null;
      }

      const rawCurrencyId = raw.currencyId;

      return {
        id: String(raw.id ?? `custom-${index + 1}`),
        code: toNumber(raw.code, index + 1),
        name,
        currencyId:
          rawCurrencyId === null ||
          rawCurrencyId === undefined ||
          rawCurrencyId === ""
            ? null
            : toNumber(rawCurrencyId, 0) || null,
        percent: toNumber(raw.percent, 0),
      };
    })
    .filter((item): item is PriceTypeOption => Boolean(item))
    .sort((left, right) => left.code - right.code);
}

function applyPriceType(basePrice: number, percent: number): number {
  const nextValue = basePrice * (1 + percent / 100);
  return Math.max(0, Math.round(nextValue * 100) / 100);
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
  const [priceTypes, setPriceTypes] = useState<PriceTypeOption[]>(() =>
    getDefaultPriceTypes(),
  );
  const [selectedPriceTypeId, setSelectedPriceTypeId] = useState<string>(
    DEFAULT_PRICE_TYPE_ID,
  );
  const [isPriceTypePopoverOpen, setIsPriceTypePopoverOpen] = useState<boolean>(false);
  const [isPriceTypeListOpen, setIsPriceTypeListOpen] = useState<boolean>(false);
  const [isPriceTypeCreateOpen, setIsPriceTypeCreateOpen] = useState<boolean>(false);
  const [priceTypeSearch, setPriceTypeSearch] = useState<string>("");
  const [priceTypeListSearch, setPriceTypeListSearch] = useState<string>("");
  const [priceTypeListSelectionId, setPriceTypeListSelectionId] = useState<string>(
    DEFAULT_PRICE_TYPE_ID,
  );
  const [priceTypeDraft, setPriceTypeDraft] = useState<PriceTypeDraft>({
    name: "",
    currencyId: "",
    percent: "0",
  });
  const [hasHydratedPriceTypes, setHasHydratedPriceTypes] = useState<boolean>(false);
  const [hasHydratedCounterpartyUi, setHasHydratedCounterpartyUi] = useState<boolean>(false);
  const [catalogMode, setCatalogMode] = useState<"goods" | "service">("goods");
  const [searchValue, setSearchValue] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [rateValue, setRateValue] = useState<string>("1.00");
  const [printWarehouse, setPrintWarehouse] = useState<boolean>(false);
  const [printSlip, setPrintSlip] = useState<boolean>(false);
  const [isPaymentMarked, setIsPaymentMarked] = useState<boolean>(true);
  const [lines, setLines] = useState<WorkspaceLine[]>([]);
  const [customMessages, setCustomMessages] = useState<UiMessage[]>([]);
  const [isCounterpartyListOpen, setIsCounterpartyListOpen] = useState<boolean>(false);
  const [isCounterpartyCreateOpen, setIsCounterpartyCreateOpen] = useState<boolean>(false);
  const [counterpartyCreateMode, setCounterpartyCreateMode] = useState<"item" | "group">("item");
  const [counterpartySearch, setCounterpartySearch] = useState<string>("");
  const [counterpartyListSelectionId, setCounterpartyListSelectionId] = useState<number | null>(null);
  const [counterpartyGroups, setCounterpartyGroups] = useState<CounterpartyGroupOption[]>(DEFAULT_COUNTERPARTY_GROUPS);
  const [counterpartyGroupAssignments, setCounterpartyGroupAssignments] = useState<Record<number, string>>({});
  const [counterpartyDraft, setCounterpartyDraft] = useState<CounterpartyDraft>({
    name: "",
    inn: "",
    type: "CUSTOMER",
    phone: "",
    groupId: "sales-cp-customers",
  });
  const [isItemCreateOpen, setIsItemCreateOpen] = useState<boolean>(false);
  const [itemCreateMode, setItemCreateMode] = useState<"item" | "group">("item");
  const [itemDraft, setItemDraft] = useState<SalesItemDraft>({
    name: "",
    sku: "",
    unit: "шт",
    itemType: "GOODS",
    categoryId: null,
    sellingPrice: "0",
  });

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

  const { data: categoriesRaw = [] } = useQuery<ListResponse<ItemCategoryOption>>({
    queryKey: ["sales-pos-categories"],
    queryFn: () => api.get<ListResponse<ItemCategoryOption>>("/directories/categories/"),
    initialData: [],
  });
  const categories = useMemo(() => normalizeListResponse(categoriesRaw), [categoriesRaw]);

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
  const selectedPriceType = useMemo(
    () =>
      priceTypes.find((priceType) => priceType.id === selectedPriceTypeId) ||
      priceTypes[0] ||
      null,
    [priceTypes, selectedPriceTypeId],
  );

  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(PRICE_TYPE_STORAGE_KEY);
      const parsedValue = storedValue ? JSON.parse(storedValue) : null;
      const nextPriceTypes = sanitizePriceTypes(parsedValue);
      if (nextPriceTypes.length > 0) {
        setPriceTypes(nextPriceTypes);
      }
    } catch {
      // Fall back to the built-in defaults if local storage is unavailable or invalid.
    } finally {
      setHasHydratedPriceTypes(true);
    }
  }, []);

  useEffect(() => {
    if (!hasHydratedPriceTypes) {
      return;
    }

    window.localStorage.setItem(PRICE_TYPE_STORAGE_KEY, JSON.stringify(priceTypes));
  }, [hasHydratedPriceTypes, priceTypes]);

  useEffect(() => {
    try {
      const storedGroups = window.localStorage.getItem(COUNTERPARTY_GROUPS_STORAGE_KEY);
      const parsedGroups = storedGroups ? JSON.parse(storedGroups) : null;
      if (Array.isArray(parsedGroups) && parsedGroups.length > 0) {
        const nextGroups = parsedGroups
          .map((item, index) => {
            if (!item || typeof item !== "object") {
              return null;
            }

            const raw = item as Record<string, unknown>;
            const name = String(raw.name ?? "").trim();
            if (!name) {
              return null;
            }

            const type = raw.type;
            return {
              id: String(raw.id ?? `sales-cp-group-${index + 1}`),
              name,
              type:
                type === "CUSTOMER" || type === "SUPPLIER" || type === "AGENT"
                  ? type
                  : null,
            } satisfies CounterpartyGroupOption;
          })
          .filter(Boolean) as CounterpartyGroupOption[];

        if (nextGroups.length > 0) {
          setCounterpartyGroups(nextGroups);
        }
      }

      const storedAssignments = window.localStorage.getItem(
        COUNTERPARTY_GROUP_ASSIGNMENTS_STORAGE_KEY,
      );
      const parsedAssignments = storedAssignments
        ? JSON.parse(storedAssignments)
        : null;
      if (
        parsedAssignments &&
        typeof parsedAssignments === "object" &&
        !Array.isArray(parsedAssignments)
      ) {
        const nextAssignments: Record<number, string> = {};
        for (const [key, value] of Object.entries(
          parsedAssignments as Record<string, unknown>,
        )) {
          const numericKey = Number(key);
          if (!Number.isFinite(numericKey) || typeof value !== "string") {
            continue;
          }
          nextAssignments[numericKey] = value;
        }
        setCounterpartyGroupAssignments(nextAssignments);
      }
    } catch {
      // Ignore invalid saved UI state.
    } finally {
      setHasHydratedCounterpartyUi(true);
    }
  }, []);

  useEffect(() => {
    if (!hasHydratedCounterpartyUi) {
      return;
    }

    window.localStorage.setItem(
      COUNTERPARTY_GROUPS_STORAGE_KEY,
      JSON.stringify(counterpartyGroups),
    );
  }, [counterpartyGroups, hasHydratedCounterpartyUi]);

  useEffect(() => {
    if (!hasHydratedCounterpartyUi) {
      return;
    }

    window.localStorage.setItem(
      COUNTERPARTY_GROUP_ASSIGNMENTS_STORAGE_KEY,
      JSON.stringify(counterpartyGroupAssignments),
    );
  }, [counterpartyGroupAssignments, hasHydratedCounterpartyUi]);

  useEffect(() => {
    if (priceTypes.length === 0) {
      return;
    }

    if (!priceTypes.some((priceType) => priceType.id === selectedPriceTypeId)) {
      setSelectedPriceTypeId(priceTypes[0].id);
    }
  }, [priceTypes, selectedPriceTypeId]);

  const counterpartyMap = useMemo(() => {
    const map = new Map<number, CounterpartyOption>();
    for (const counterparty of counterparties) {
      map.set(counterparty.id, counterparty);
    }
    return map;
  }, [counterparties]);

  const filteredCounterparties = useMemo(() => {
    const normalizedSearch = counterpartySearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return counterparties;
    }

    return counterparties.filter((counterparty) =>
      `${counterparty.name || ""} ${counterparty.inn || ""} ${counterparty.phone || ""}`
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [counterparties, counterpartySearch]);

  const groupedCounterparties = useMemo(
    () =>
      counterpartyGroups
        .map((group) => ({
          group,
          items: filteredCounterparties.filter((counterparty) => {
            const assignedGroupId =
              counterpartyGroupAssignments[counterparty.id] ||
              counterpartyGroups.find((entry) => entry.type === counterparty.type)?.id ||
              DEFAULT_COUNTERPARTY_GROUPS[0].id;
            return assignedGroupId === group.id;
          }),
        }))
        .filter((section) => section.items.length > 0 || !counterpartySearch.trim()),
    [counterpartyGroupAssignments, counterpartyGroups, counterpartySearch, filteredCounterparties],
  );

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
  const filteredPriceTypes = useMemo(() => {
    const normalizedSearch = priceTypeSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return priceTypes;
    }

    return priceTypes.filter((priceType) => {
      const searchSource = `${priceType.name} ${priceType.code} ${priceType.percent}`
        .toLowerCase()
        .trim();
      return searchSource.includes(normalizedSearch);
    });
  }, [priceTypeSearch, priceTypes]);
  const listedPriceTypes = useMemo(() => {
    const normalizedSearch = priceTypeListSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return priceTypes;
    }

    return priceTypes.filter((priceType) => {
      const searchSource = `${priceType.name} ${priceType.code} ${priceType.percent}`
        .toLowerCase()
        .trim();
      return searchSource.includes(normalizedSearch);
    });
  }, [priceTypeListSearch, priceTypes]);

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

  const handleSelectPriceType = (nextPriceType: PriceTypeOption) => {
    setSelectedPriceTypeId(nextPriceType.id);
    setPriceTypeListSelectionId(nextPriceType.id);
    setIsPriceTypePopoverOpen(false);
    setIsPriceTypeListOpen(false);
    setPriceTypeSearch("");
    setPriceTypeListSearch("");

    if (nextPriceType.currencyId) {
      setCurrencyId(nextPriceType.currencyId);
    }

    setLines((prev) =>
      prev.map((line) =>
        line.isManualPrice
          ? line
          : {
              ...line,
              price: applyPriceType(line.basePrice, nextPriceType.percent),
            },
      ),
    );
  };

  const openCreatePriceTypeDialog = () => {
    setPriceTypeDraft({
      name: priceTypeSearch.trim(),
      currencyId: selectedPriceType?.currencyId
        ? String(selectedPriceType.currencyId)
        : effectiveCurrencyId
          ? String(effectiveCurrencyId)
          : "",
      percent: "0",
    });
    setIsPriceTypePopoverOpen(false);
    setIsPriceTypeListOpen(false);
    setIsPriceTypeCreateOpen(true);
  };

  const openPriceTypeList = () => {
    setPriceTypeListSelectionId(selectedPriceType?.id || DEFAULT_PRICE_TYPE_ID);
    setPriceTypeListSearch("");
    setIsPriceTypePopoverOpen(false);
    setIsPriceTypeListOpen(true);
  };

  const savePriceType = () => {
    const name = priceTypeDraft.name.trim();
    if (!name) {
      toast.error("Введите наименование типа цен.");
      return;
    }

    const normalizedPercent = priceTypeDraft.percent.replace(",", ".");
    const percent = Number(normalizedPercent);
    if (!Number.isFinite(percent)) {
      toast.error("Введите корректный процент наценки.");
      return;
    }

    if (percent < -100) {
      toast.error("Процент не может быть меньше -100.");
      return;
    }

    const nextCode =
      priceTypes.reduce(
        (maxValue, priceType) => Math.max(maxValue, Number(priceType.code) || 0),
        0,
      ) + 1;

    const nextPriceType: PriceTypeOption = {
      id: `custom-${Date.now()}`,
      code: nextCode,
      name,
      currencyId: priceTypeDraft.currencyId
        ? Number(priceTypeDraft.currencyId)
        : null,
      percent,
    };

    setPriceTypes((prev) => [...prev, nextPriceType].sort((left, right) => left.code - right.code));
    setIsPriceTypeCreateOpen(false);
    handleSelectPriceType(nextPriceType);
    toast.success("Тип цен создан.");
  };

  const confirmPriceTypeFromList = () => {
    const nextPriceType = priceTypes.find(
      (priceType) => priceType.id === priceTypeListSelectionId,
    );
    if (!nextPriceType) {
      return;
    }

    handleSelectPriceType(nextPriceType);
  };

  const addCatalogItemToLines = (item: DirectoryItem) => {
    const itemType: "GOODS" | "SERVICE" =
      item.item_type || (item.type === "service" ? "SERVICE" : "GOODS");
    const basePrice = toNumber(item.sale_price ?? item.selling_price, 0);
    const defaultPrice = applyPriceType(basePrice, selectedPriceType?.percent ?? 0);
    const unit = item.base_unit || item.unit || "шт";

    setLines((prev) => {
      const index = prev.findIndex((line) => line.item === item.id);
      if (index >= 0) {
        const next = [...prev];
        next[index] = {
          ...next[index],
          basePrice: next[index].basePrice || basePrice,
          quantity: Number(next[index].quantity || 0) + 1,
          price: next[index].isManualPrice ? next[index].price : defaultPrice,
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
          basePrice,
          quantity: 1,
          price: defaultPrice,
          isManualPrice: false,
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
        ...(field === "price" ? { isManualPrice: true } : {}),
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

  const openCounterpartyListDialog = () => {
    setCounterpartyListSelectionId(effectiveCounterpartyId);
    setCounterpartySearch("");
    setIsCounterpartyListOpen(true);
  };

  const openCounterpartyCreateDialog = (mode: "item" | "group") => {
    setCounterpartyCreateMode(mode);
    setCounterpartyDraft({
      name: "",
      inn: "",
      type: mode === "item" ? "CUSTOMER" : "AGENT",
      phone: "",
      groupId:
        mode === "item"
          ? "sales-cp-customers"
          : "sales-cp-other",
    });
    setIsCounterpartyCreateOpen(true);
  };

  const openSalesItemCreateDialog = (mode: "item" | "group") => {
    setItemCreateMode(mode);
    setItemDraft({
      name: searchValue.trim(),
      sku: `ITEM-${String(items.length + 1).padStart(6, "0")}`,
      unit: "шт",
      itemType: catalogMode === "service" ? "SERVICE" : "GOODS",
      categoryId: null,
      sellingPrice: "0",
    });
    setIsItemCreateOpen(true);
  };

  const createCounterpartyMutation = useMutation({
    mutationFn: async () => {
      const trimmedName = counterpartyDraft.name.trim();
      if (!trimmedName) {
        throw new Error("Введите наименование контрагента");
      }

      if (counterpartyCreateMode === "group") {
        return {
          mode: "group" as const,
          group: {
            id: `sales-cp-custom-${counterpartyGroups.length + 1}`,
            name: trimmedName,
            type: counterpartyDraft.type,
          },
        };
      }

      const createdCounterparty = await api.post<CounterpartyOption>("/directories/counterparties/", {
        name: trimmedName,
        inn: counterpartyDraft.inn.trim() || String(counterparties.length + 1),
        type: counterpartyDraft.type,
        phone: counterpartyDraft.phone.trim(),
        email: "",
        address: "",
      });

      return {
        mode: "item" as const,
        counterparty: createdCounterparty,
      };
    },
    onSuccess: (result) => {
      if (result.mode === "group") {
        setCounterpartyGroups((prev) => [...prev, result.group]);
        setCounterpartyCreateMode("item");
        setCounterpartyDraft({
          name: "",
          inn: "",
          type: "CUSTOMER",
          phone: "",
          groupId: "sales-cp-customers",
        });
        setIsCounterpartyCreateOpen(false);
        toast.success("Группа контрагентов создана.");
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["sales-pos-counterparties"] });
      if (result.counterparty?.id) {
        setCounterpartyId(result.counterparty.id);
        setCounterpartyGroupAssignments((prev) => ({
          ...prev,
          [result.counterparty.id]:
            counterpartyDraft.groupId ||
            counterpartyGroups.find((group) => group.type === counterpartyDraft.type)?.id ||
            DEFAULT_COUNTERPARTY_GROUPS[0].id,
        }));
      }
      setCounterpartyCreateMode("item");
      setCounterpartyDraft({
        name: "",
        inn: "",
        type: "CUSTOMER",
        phone: "",
        groupId: "sales-cp-customers",
      });
      setIsCounterpartyCreateOpen(false);
      toast.success("Контрагент создан.");
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(error.message);
        return;
      }
      const { title, description } = mapApiError(error);
      toast.error(title, { description });
    },
  });

  const createSalesItemMutation = useMutation({
    mutationFn: async () => {
      const trimmedName = itemDraft.name.trim();
      if (!trimmedName) {
        throw new Error("Введите наименование номенклатуры");
      }

      if (itemCreateMode === "group") {
        return api.post<ItemCategoryOption>("/directories/categories/", {
          name: trimmedName,
          code: itemDraft.sku.trim(),
          parent: itemDraft.categoryId,
        });
      }

      return api.post<DirectoryItem>("/directories/items/", {
        name: trimmedName,
        sku: itemDraft.sku.trim(),
        item_type: itemDraft.itemType,
        unit: itemDraft.unit.trim() || "шт",
        purchase_price: 0,
        selling_price: Number(itemDraft.sellingPrice || 0),
        category: itemDraft.categoryId,
      });
    },
    onSuccess: () => {
      if (itemCreateMode === "group") {
        queryClient.invalidateQueries({ queryKey: ["sales-pos-categories"] });
        toast.success("Группа номенклатуры создана.");
      } else {
        queryClient.invalidateQueries({ queryKey: ["sales-pos-items"] });
        toast.success("Номенклатура создана.");
      }
      setItemCreateMode("item");
      setItemDraft({
        name: "",
        sku: "",
        unit: "шт",
        itemType: "GOODS",
        categoryId: null,
        sellingPrice: "0",
      });
      setIsItemCreateOpen(false);
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(error.message);
        return;
      }
      const { title, description } = mapApiError(error);
      toast.error(title, { description });
    },
  });

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
      <div className="h-full border border-border bg-background dark:bg-zinc-950 flex flex-col">
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
                  <div className="flex items-stretch gap-1">
                    <Popover
                      open={isPriceTypePopoverOpen}
                      onOpenChange={setIsPriceTypePopoverOpen}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex h-8 min-w-0 flex-1 items-center justify-between rounded-md border bg-background px-2 text-sm shadow-xs"
                        >
                          <span className="truncate text-left">
                            {selectedPriceType?.name || "Выберите тип цен"}
                          </span>
                          <PiCaretDownBold className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        className="w-[360px] space-y-3 p-0"
                        sideOffset={6}
                      >
                        <div className="border-b px-3 py-3">
                          <div className="relative">
                            <PiMagnifyingGlassBold className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={priceTypeSearch}
                              onChange={(event) => setPriceTypeSearch(event.target.value)}
                              className="h-9 pl-8"
                              placeholder="Введите строку для поиска"
                            />
                          </div>
                          <div className="mt-3 space-y-1 text-sm">
                            <button
                              type="button"
                              className="text-left text-primary underline-offset-4 hover:underline"
                              onClick={openPriceTypeList}
                            >
                              Показать все для выбора
                            </button>
                            <button
                              type="button"
                              className="flex items-center gap-1 text-left text-primary underline-offset-4 hover:underline"
                              onClick={openCreatePriceTypeDialog}
                            >
                              <PiPlusBold className="h-4 w-4" />
                              <span>(создать) для добавления</span>
                            </button>
                          </div>
                        </div>

                        <div className="max-h-48 space-y-1 overflow-auto px-3">
                          {filteredPriceTypes.length > 0 ? (
                            filteredPriceTypes.map((priceType) => {
                              const currencyCode =
                                currencies.find(
                                  (currency) => currency.id === priceType.currencyId,
                                )?.code || "Авто";

                              return (
                                <button
                                  key={priceType.id}
                                  type="button"
                                  className={cn(
                                    "flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-accent",
                                    priceType.id === selectedPriceType?.id && "bg-accent",
                                  )}
                                  onClick={() => handleSelectPriceType(priceType)}
                                >
                                  <span className="truncate">{priceType.name}</span>
                                  <span className="ml-3 shrink-0 text-xs text-muted-foreground">
                                    {currencyCode} / {formatAmount(priceType.percent)}%
                                  </span>
                                </button>
                              );
                            })
                          ) : (
                            <div className="rounded-md border border-dashed px-3 py-4 text-xs text-muted-foreground">
                              Совпадений не найдено. Используйте «Показать все» или создайте
                              новый тип цен.
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between border-t px-3 py-3">
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto px-0"
                            onClick={openPriceTypeList}
                          >
                            Показать все
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            onClick={openCreatePriceTypeDialog}
                          >
                            <PiPlusBold className="h-4 w-4" />
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={openCreatePriceTypeDialog}
                      title="Создать тип цен"
                    >
                      <PiPlusBold className="h-4 w-4" />
                    </Button>
                  </div>
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
                    const rowPrice = applyPriceType(
                      toNumber(item.sale_price ?? item.selling_price),
                      selectedPriceType?.percent ?? 0,
                    );
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
                  <div className="grid grid-cols-[minmax(0,1fr)_32px_32px] gap-1">
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
                    <Button type="button" variant="outline" size="icon-sm" onClick={openCounterpartyListDialog}>
                      <PiCaretDownBold className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" size="icon-sm" onClick={() => openCounterpartyCreateDialog("item")}>
                      <PiPlusBold className="h-4 w-4" />
                    </Button>
                  </div>
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

      <Dialog open={isCounterpartyListOpen} onOpenChange={setIsCounterpartyListOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Контрагенты</DialogTitle>
            <DialogDescription>Выберите контрагента, создайте нового или создайте группу.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => {
                  if (!counterpartyListSelectionId) return;
                  setCounterpartyId(counterpartyListSelectionId);
                  setIsCounterpartyListOpen(false);
                }}
                disabled={!counterpartyListSelectionId}
              >
                Выбрать
              </Button>
              <Button type="button" variant="outline" onClick={() => openCounterpartyCreateDialog("item")}>
                Создать
              </Button>
              <Button type="button" variant="outline" onClick={() => openCounterpartyCreateDialog("group")}>
                Создать группу
              </Button>
              <div className="relative flex-1">
                <PiMagnifyingGlassBold className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={counterpartySearch} onChange={(event) => setCounterpartySearch(event.target.value)} className="pl-8" placeholder="Поиск (Ctrl+F)" />
              </div>
            </div>
            <div className="max-h-[360px] overflow-auto rounded border">
              {groupedCounterparties.map((section) => (
                <div key={section.group.id}>
                  <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium">{section.group.name}</div>
                  {section.items.map((counterparty) => (
                    <button
                      key={counterparty.id}
                      type="button"
                      className={cn(
                        "grid w-full grid-cols-[minmax(0,1fr)_140px_120px] items-center border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent",
                        counterpartyListSelectionId === counterparty.id && "bg-yellow-50 dark:bg-yellow-950/30",
                      )}
                      onClick={() => setCounterpartyListSelectionId(counterparty.id)}
                      onDoubleClick={() => {
                        setCounterpartyId(counterparty.id);
                        setIsCounterpartyListOpen(false);
                      }}
                    >
                      <span className="truncate">{counterparty.name}</span>
                      <span className="font-mono text-xs">{counterparty.inn || "-"}</span>
                      <span className="truncate text-xs text-muted-foreground">{counterparty.phone || "-"}</span>
                    </button>
                  ))}
                </div>
              ))}
              {groupedCounterparties.length === 0 && (
                <div className="px-3 py-8 text-center text-sm text-muted-foreground">Контрагенты не найдены.</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCounterpartyCreateOpen} onOpenChange={setIsCounterpartyCreateOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{counterpartyCreateMode === "group" ? "Контрагенты (создание группы)" : "Контрагенты (создание)"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                className="bg-yellow-400 text-black hover:bg-yellow-300"
                onClick={() => createCounterpartyMutation.mutate()}
                disabled={createCounterpartyMutation.isPending}
              >
                Записать и закрыть
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => createCounterpartyMutation.mutate()}
                disabled={createCounterpartyMutation.isPending}
              >
                Записать
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
              <label className="text-sm">Код:</label>
              <Input value={String(counterparties.length + counterpartyGroups.length + 1)} readOnly />
              <label className="text-sm">Наименование:</label>
              <Input value={counterpartyDraft.name} onChange={(event) => setCounterpartyDraft((prev) => ({ ...prev, name: event.target.value }))} />
              <label className="text-sm">ИНН:</label>
              <Input value={counterpartyDraft.inn} onChange={(event) => setCounterpartyDraft((prev) => ({ ...prev, inn: event.target.value }))} />
              <label className="text-sm">Тип:</label>
              <select className="h-9 rounded-md border bg-background px-3 text-sm" value={counterpartyDraft.type} onChange={(event) => setCounterpartyDraft((prev) => ({ ...prev, type: event.target.value as CounterpartyDraft["type"] }))}>
                <option value="CUSTOMER">Покупатель</option>
                <option value="SUPPLIER">Поставщик</option>
                <option value="AGENT">Прочие</option>
              </select>
              <label className="text-sm">Телефон:</label>
              <Input value={counterpartyDraft.phone} onChange={(event) => setCounterpartyDraft((prev) => ({ ...prev, phone: event.target.value }))} />
              <label className="text-sm">Родитель:</label>
              <select className="h-9 rounded-md border bg-background px-3 text-sm" value={counterpartyDraft.groupId || ""} onChange={(event) => setCounterpartyDraft((prev) => ({ ...prev, groupId: event.target.value || null }))}>
                <option value="">Без группы</option>
                {counterpartyGroups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isItemCreateOpen} onOpenChange={setIsItemCreateOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{itemCreateMode === "group" ? "Номенклатура (создание группы)" : "Номенклатура (создание)"}</DialogTitle>
            <DialogDescription>
              {itemCreateMode === "group" ? "Создание группы номенклатуры через каталог категорий." : "Созданная номенклатура сразу появится в каталоге."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                className="bg-yellow-400 text-black hover:bg-yellow-300"
                onClick={() => createSalesItemMutation.mutate()}
                disabled={createSalesItemMutation.isPending}
              >
                Записать и закрыть
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => createSalesItemMutation.mutate()}
                disabled={createSalesItemMutation.isPending}
              >
                Записать
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center">
              <label className="text-sm">Код/Артикул:</label>
              <Input value={itemDraft.sku} onChange={(event) => setItemDraft((prev) => ({ ...prev, sku: event.target.value }))} />
              <label className="text-sm">Наименование:</label>
              <Input value={itemDraft.name} onChange={(event) => setItemDraft((prev) => ({ ...prev, name: event.target.value }))} />
              <label className="text-sm">Тип:</label>
              <select className="h-9 rounded-md border bg-background px-3 text-sm" value={itemDraft.itemType} onChange={(event) => setItemDraft((prev) => ({ ...prev, itemType: event.target.value as SalesItemDraft["itemType"] }))}>
                <option value="GOODS">Товар</option>
                <option value="SERVICE">Услуга</option>
              </select>
              <label className="text-sm">Ед. изм:</label>
              <Input value={itemDraft.unit} onChange={(event) => setItemDraft((prev) => ({ ...prev, unit: event.target.value }))} />
              <label className="text-sm">Родитель:</label>
              <select className="h-9 rounded-md border bg-background px-3 text-sm" value={itemDraft.categoryId || ""} onChange={(event) => setItemDraft((prev) => ({ ...prev, categoryId: event.target.value ? Number(event.target.value) : null }))}>
                <option value="">Без группы</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              {itemCreateMode === "item" && (
                <>
                  <label className="text-sm">Цена продажи:</label>
                  <Input value={itemDraft.sellingPrice} onChange={(event) => setItemDraft((prev) => ({ ...prev, sellingPrice: event.target.value }))} />
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPriceTypeListOpen} onOpenChange={setIsPriceTypeListOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Типы цен</DialogTitle>
            <DialogDescription>
              Выберите тип цен для документа или создайте новый.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Button type="button" onClick={confirmPriceTypeFromList}>
                Выбрать
              </Button>
              <Button type="button" variant="outline" onClick={openCreatePriceTypeDialog}>
                Создать
              </Button>
              <div className="relative flex-1">
                <PiMagnifyingGlassBold className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => openSalesItemCreateDialog("item")}
                >
                  Создать
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => openSalesItemCreateDialog("group")}
                >
                  Создать группу
                </Button>
                <Input
                  value={priceTypeListSearch}
                  onChange={(event) => setPriceTypeListSearch(event.target.value)}
                  className="pl-8"
                  placeholder="Поиск (Ctrl+F)"
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-md border">
              <div className="grid grid-cols-[minmax(0,1fr)_80px_100px_120px] border-b bg-muted/40 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span>Наименование</span>
                <span>Код</span>
                <span>%</span>
                <span>Валюта</span>
              </div>
              <div className="max-h-[320px] overflow-auto">
                {listedPriceTypes.length > 0 ? (
                  listedPriceTypes.map((priceType) => {
                    const currencyCode =
                      currencies.find((currency) => currency.id === priceType.currencyId)
                        ?.code || "Авто";

                    return (
                      <button
                        key={priceType.id}
                        type="button"
                        className={cn(
                          "grid w-full grid-cols-[minmax(0,1fr)_80px_100px_120px] items-center border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent",
                          priceType.id === priceTypeListSelectionId &&
                            "bg-yellow-50 dark:bg-yellow-950/30",
                        )}
                        onClick={() => setPriceTypeListSelectionId(priceType.id)}
                        onDoubleClick={() => handleSelectPriceType(priceType)}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <PiCheckBold
                            className={cn(
                              "h-4 w-4 shrink-0 text-primary",
                              priceType.id === selectedPriceType?.id
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          <span className="truncate">{priceType.name}</span>
                        </span>
                        <span>{priceType.code}</span>
                        <span>{formatAmount(priceType.percent)}%</span>
                        <span>{currencyCode}</span>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-3 py-10 text-center text-sm text-muted-foreground">
                    Ничего не найдено.
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsPriceTypeListOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPriceTypeCreateOpen} onOpenChange={setIsPriceTypeCreateOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Типы цен (создание)</DialogTitle>
            <DialogDescription>
              Новый тип цен сохраняется локально и сразу доступен для выбора.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)] sm:items-center">
            <label className="text-sm text-muted-foreground">Код:</label>
            <Input
              value={
                priceTypes.reduce(
                  (maxValue, priceType) => Math.max(maxValue, Number(priceType.code) || 0),
                  0,
                ) + 1
              }
              readOnly
            />

            <label className="text-sm text-muted-foreground">Наименование:</label>
            <Input
              value={priceTypeDraft.name}
              onChange={(event) =>
                setPriceTypeDraft((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              placeholder="Например, Мелкий опт"
            />

            <label className="text-sm text-muted-foreground">Валюта:</label>
            <select
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={priceTypeDraft.currencyId}
              onChange={(event) =>
                setPriceTypeDraft((prev) => ({
                  ...prev,
                  currencyId: event.target.value,
                }))
              }
            >
              <option value="">Авто (как в документе)</option>
              {currencies.map((currency) => (
                <option key={currency.id} value={currency.id}>
                  {currency.code} - {currency.name}
                </option>
              ))}
            </select>

            <label className="text-sm text-muted-foreground">%:</label>
            <Input
              value={priceTypeDraft.percent}
              onChange={(event) =>
                setPriceTypeDraft((prev) => ({
                  ...prev,
                  percent: event.target.value,
                }))
              }
              placeholder="0"
            />
          </div>

          <DialogFooter>
            <Button type="button" onClick={savePriceType}>
              Записать и закрыть
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPriceTypeCreateOpen(false)}
            >
              Отмена
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
