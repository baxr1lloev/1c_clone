"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PiArrowClockwiseBold,
  PiBankBold,
  PiCoinsBold,
  PiPlusBold,
} from "react-icons/pi";

import api from "@/lib/api";
import {
  buildCashDirectoryItems,
  CASH_DIRECTORY_STORAGE_KEY,
  DEFAULT_CASH_DEPARTMENT,
  extractResults,
  getCashDirectoryKindLabel,
  type BankAccountListResponse,
  type CashDirectoryKind,
  type CashDirectoryLocalEntry,
  type CashOrderListResponse,
} from "@/lib/cash-directory";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { BankAccount, CashOrder } from "@/types";

type CashFilter = "all" | CashDirectoryKind;

type CashDraft = {
  code: number;
  name: string;
  department: string;
  kind: CashDirectoryKind;
};

const OPERATION_OPTIONS = [
  {
    id: "opening-balances",
    label: "Ввод остатков по кассам",
    href: "/documents/cash-opening-balances/new",
  },
  {
    id: "incoming-order",
    label: "Приходный кассовый ордер",
    href: "/documents/cash-orders/new?type=incoming",
  },
  {
    id: "outgoing-order",
    label: "Расходный кассовый ордер",
    href: "/documents/cash-orders/new?type=outgoing",
  },
  {
    id: "cashless",
    label: "Безналичные операции",
    href: "/documents/payments",
  },
] as const;

function createEmptyDraft(code: number, kind: CashDirectoryKind): CashDraft {
  return {
    code,
    name: "",
    department: DEFAULT_CASH_DEPARTMENT,
    kind,
  };
}

function parseStoredEntries(rawValue: string | null): CashDirectoryLocalEntry[] {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue) as CashDirectoryLocalEntry[];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((entry) => {
      if (!entry || typeof entry !== "object") return false;
      if (typeof entry.id !== "number") return false;
      if (typeof entry.name !== "string") return false;
      if (entry.kind !== "cash" && entry.kind !== "bank") return false;
      return true;
    });
  } catch {
    return [];
  }
}

function getNextCode(codes: number[]): number {
  const maxCode = codes.reduce(
    (currentMax, code) => (Number.isFinite(code) ? Math.max(currentMax, code) : currentMax),
    0,
  );
  return maxCode + 1;
}

function subscribeToCashDirectoryStore() {
  return () => undefined;
}

async function fetchAllCashOrders(): Promise<CashOrder[]> {
  const all: CashOrder[] = [];
  let page = 1;
  let hasNext = true;
  const maxPages = 100;

  while (hasNext && page <= maxPages) {
    const response = await api.get<CashOrderListResponse>(
      `/documents/cash-orders/?page=${page}`,
    );
    const pageItems = extractResults<CashOrder>(response);

    if (Array.isArray(response)) {
      all.push(...pageItems);
      break;
    }

    all.push(...pageItems);
    hasNext = Boolean(response.next);
    page += 1;
  }

  return all;
}

export default function CashDirectoryPage() {
  const tc = useTranslations("common");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const localePath = (path: string) =>
    `/${locale}${path.startsWith("/") ? path : `/${path}`}`;

  const [searchValue, setSearchValue] = useState("");
  const [filter, setFilter] = useState<CashFilter>("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedOperationId, setSelectedOperationId] = useState<
    (typeof OPERATION_OPTIONS)[number]["id"]
  >(OPERATION_OPTIONS[0].id);
  const [localEntriesOverride, setLocalEntriesOverride] = useState<
    CashDirectoryLocalEntry[] | null
  >(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [draft, setDraft] = useState<CashDraft>(() => createEmptyDraft(1, "cash"));

  const storedEntriesSnapshot = useSyncExternalStore(
    subscribeToCashDirectoryStore,
    () => {
      if (typeof window === "undefined") return "[]";
      return window.localStorage.getItem(CASH_DIRECTORY_STORAGE_KEY) || "[]";
    },
    () => "[]",
  );

  const storedEntries = useMemo(
    () => parseStoredEntries(storedEntriesSnapshot),
    [storedEntriesSnapshot],
  );

  const localEntries = localEntriesOverride ?? storedEntries;

  const bankAccountsQuery = useQuery({
    queryKey: ["cash-directory-bank-accounts"],
    queryFn: () => api.get<BankAccountListResponse>("/directories/bank-accounts/"),
  });

  const cashOrdersQuery = useQuery({
    queryKey: ["cash-directory-cash-orders"],
    queryFn: fetchAllCashOrders,
  });

  const bankAccounts = useMemo(
    () => extractResults<BankAccount>(bankAccountsQuery.data),
    [bankAccountsQuery.data],
  );

  const cashOrders = useMemo(() => cashOrdersQuery.data || [], [cashOrdersQuery.data]);

  const items = useMemo(
    () =>
      buildCashDirectoryItems({
        bankAccounts,
        cashOrders,
        localEntries,
      }),
    [bankAccounts, cashOrders, localEntries],
  );

  const filteredItems = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    return items.filter((item) => {
      if (filter !== "all" && item.kind !== filter) return false;
      if (!query) return true;

      return [
        item.name,
        item.department,
        item.code,
        getCashDirectoryKindLabel(item.kind),
      ].some((value) => String(value).toLowerCase().includes(query));
    });
  }, [filter, items, searchValue]);

  const effectiveSelectedKey = useMemo(() => {
    const hasSelection = filteredItems.some((item) => item.key === selectedKey);
    if (hasSelection) return selectedKey;
    return filteredItems[0]?.key ?? null;
  }, [filteredItems, selectedKey]);

  const selectedItem = useMemo(
    () => filteredItems.find((item) => item.key === effectiveSelectedKey) || null,
    [effectiveSelectedKey, filteredItems],
  );

  const selectedOperation =
    OPERATION_OPTIONS.find((option) => option.id === selectedOperationId) ||
    OPERATION_OPTIONS[0];

  const isRefreshing = bankAccountsQuery.isFetching || cashOrdersQuery.isFetching;

  const saveLocalEntries = (entries: CashDirectoryLocalEntry[]) => {
    setLocalEntriesOverride(entries);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CASH_DIRECTORY_STORAGE_KEY, JSON.stringify(entries));
  };

  const openCreateDialog = (kind: CashDirectoryKind = "cash") => {
    const nextCode = getNextCode(items.map((item) => item.code));
    setDraft(createEmptyDraft(nextCode, kind));
    setIsCreateOpen(true);
  };

  const handleSaveDraft = (closeAfterSave: boolean) => {
    const name = draft.name.trim();
    if (!name) {
      toast.error("Введите наименование кассы или банка.");
      return;
    }

    const nextEntry: CashDirectoryLocalEntry = {
      id: draft.code,
      name,
      department: draft.department.trim() || DEFAULT_CASH_DEPARTMENT,
      kind: draft.kind,
    };

    const nextEntries = [...localEntries, nextEntry];
    saveLocalEntries(nextEntries);
    toast.success("Касса сохранена.");

    if (closeAfterSave) {
      setIsCreateOpen(false);
      return;
    }

    const nextCode = getNextCode(
      buildCashDirectoryItems({
        bankAccounts,
        cashOrders,
        localEntries: nextEntries,
      }).map((item) => item.code),
    );
    setDraft(createEmptyDraft(nextCode, draft.kind));
  };

  const handleRefresh = async () => {
    await Promise.all([bankAccountsQuery.refetch(), cashOrdersQuery.refetch()]);
    toast.success("Список касс обновлен.");
  };

  const openOperation = (href: string) => {
    router.push(localePath(href));
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#efefef] p-4 text-foreground">
      <div className="rounded-sm border border-[#bfc4cc] bg-background">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="text-[26px] font-semibold tracking-tight">{tNav("cashDirectory")}</div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-sm border-border bg-background"
              onClick={() => openCreateDialog("cash")}
            >
              <PiPlusBold className="mr-2 h-4 w-4" />
              {tc("create")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-sm border-border bg-background"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <PiArrowClockwiseBold
                className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")}
              />
              {tc("refresh")}
            </Button>
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Поиск (Ctrl+F)"
              className="h-9 w-[260px] rounded-sm border-border"
            />
          </div>
        </div>

        <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {([
                ["all", "Все"],
                ["cash", "Касса"],
                ["bank", "Банк"],
              ] as Array<[CashFilter, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={cn(
                    "h-8 rounded-sm border px-3 text-xs",
                    filter === value
                      ? "border-accent bg-accent font-semibold text-accent-foreground"
                      : "border-border bg-background text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="overflow-auto rounded-sm border border-border">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead className="bg-muted text-left">
                  <tr className="[&>th]:border-b [&>th]:border-r [&>th]:border-border [&>th]:px-3 [&>th]:py-2 [&>th:last-child]:border-r-0">
                    <th className="w-[36px] px-2" />
                    <th>Наименование</th>
                    <th className="w-[90px]">Код</th>
                    <th>Подразделение</th>
                    <th className="w-[120px]">Вид</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-8 text-center text-sm text-muted-foreground"
                      >
                        Ничего не найдено.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
                      <tr
                        key={item.key}
                        onClick={() => setSelectedKey(item.key)}
                        className={cn(
                          "cursor-pointer border-b border-border hover:bg-muted",
                          selectedItem?.key === item.key && "bg-accent",
                        )}
                      >
                        <td className="px-2 py-2 text-center text-xs text-[#4c87b5]">
                          {item.kind === "bank" ? (
                            <PiBankBold className="inline h-4 w-4" />
                          ) : (
                            <PiCoinsBold className="inline h-4 w-4" />
                          )}
                        </td>
                        <td className="px-3 py-2">{item.name}</td>
                        <td className="px-3 py-2 font-mono">{item.code}</td>
                        <td className="px-3 py-2">{item.department}</td>
                        <td className="px-3 py-2">{getCashDirectoryKindLabel(item.kind)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between rounded-sm border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
              <span>Записей: {filteredItems.length}</span>
              <span>
                {selectedItem
                  ? `${getCashDirectoryKindLabel(selectedItem.kind)}: ${selectedItem.name}`
                  : "Ничего не выбрано"}
              </span>
            </div>
          </div>

          <div className="rounded-sm border border-border bg-background">
            <div className="border-b border-border px-4 py-3 text-lg font-semibold">
              Операции
            </div>
            <div className="space-y-1 p-3">
              {OPERATION_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedOperationId(option.id)}
                  onDoubleClick={() => openOperation(option.href)}
                  className={cn(
                    "block w-full rounded-sm border px-3 py-2 text-left text-base",
                    selectedOperation.id === option.id
                      ? "border-[#6b7280] border-dashed bg-[#f7f7f7] font-medium"
                      : "border-transparent bg-transparent hover:bg-muted/50",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="border-t border-border px-3 py-3">
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-sm border-border bg-background"
                onClick={() => openOperation(selectedOperation.href)}
              >
                Открыть
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent
          showCloseButton
          className="gap-0 rounded-sm border-[#bababa] bg-[#f7f7f7] p-0 sm:max-w-[640px]"
        >
          <div className="border-b border-border px-5 py-4">
            <DialogHeader className="space-y-0 text-left">
              <DialogTitle className="text-[22px] font-semibold">
                Касса (создание)
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="space-y-5 px-5 py-5">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                className="h-10 rounded-sm bg-[#f5d400] px-5 text-black hover:bg-[#e5c500]"
                onClick={() => handleSaveDraft(true)}
              >
                {tc("saveAndClose")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-sm border-border bg-background px-5"
                onClick={() => handleSaveDraft(false)}
              >
                {tc("save")}
              </Button>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-2 md:grid-cols-[80px_90px_72px_1fr] md:items-center">
                <div className="text-sm">Код:</div>
                <Input
                  value={String(draft.code)}
                  readOnly
                  className="h-9 rounded-sm border-border bg-background text-center"
                />
                <div className="text-sm">Вид:</div>
                <div className="flex items-center gap-1 rounded-sm border border-border bg-background p-1">
                  {([
                    ["cash", "Касса"],
                    ["bank", "Банк"],
                  ] as Array<[CashDirectoryKind, string]>).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDraft((current) => ({ ...current, kind: value }))}
                      className={cn(
                        "h-8 rounded-sm px-4 text-sm",
                        draft.kind === value
                          ? "bg-accent font-semibold text-accent-foreground"
                          : "bg-transparent text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-[120px_1fr] md:items-center">
                <div className="text-sm">Наименование:</div>
                <Input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  className="h-9 rounded-sm border-border bg-background"
                />
              </div>

              <div className="grid gap-2 md:grid-cols-[120px_1fr] md:items-center">
                <div className="text-sm">Подразделение:</div>
                <Input
                  value={draft.department}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      department: event.target.value,
                    }))
                  }
                  className="h-9 rounded-sm border-border bg-background"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-border bg-[#f7f7f7] px-5 py-4" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
