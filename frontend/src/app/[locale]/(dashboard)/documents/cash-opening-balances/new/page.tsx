"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PiPlusBold } from "react-icons/pi";

import api from "@/lib/api";
import {
  buildCashDirectoryItems,
  CASH_DIRECTORY_STORAGE_KEY,
  DEFAULT_CASH_DEPARTMENT,
  extractResults,
  type BankAccountListResponse,
  type CashDirectoryLocalEntry,
  type CashOrderListResponse,
} from "@/lib/cash-directory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BankAccount, CashOrder } from "@/types";

type CashOpeningRow = {
  id: number;
  cashName: string;
  amount: string;
};

const DEFAULT_DATE = "2026-03-01";
const DEFAULT_CURRENCIES = ["UZB", "RUB", "USD"] as const;

function parseStoredEntries(rawValue: string | null): CashDirectoryLocalEntry[] {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue) as CashDirectoryLocalEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function createRow(id: number): CashOpeningRow {
  return {
    id,
    cashName: "",
    amount: "",
  };
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

export default function NewCashOpeningBalancesPage() {
  const locale = useLocale();
  const router = useRouter();
  const localePath = (path: string) =>
    `/${locale}${path.startsWith("/") ? path : `/${path}`}`;

  const [documentDate, setDocumentDate] = useState(DEFAULT_DATE);
  const [currencyCode, setCurrencyCode] = useState<(typeof DEFAULT_CURRENCIES)[number]>("USD");
  const [rateValue, setRateValue] = useState("0.00");
  const [rows, setRows] = useState<CashOpeningRow[]>([createRow(1)]);
  const [searchValue, setSearchValue] = useState("");

  const storedEntriesSnapshot = useSyncExternalStore(
    subscribeToCashDirectoryStore,
    () => {
      if (typeof window === "undefined") return "[]";
      return window.localStorage.getItem(CASH_DIRECTORY_STORAGE_KEY) || "[]";
    },
    () => "[]",
  );

  const localEntries = useMemo(
    () => parseStoredEntries(storedEntriesSnapshot),
    [storedEntriesSnapshot],
  );

  const bankAccountsQuery = useQuery({
    queryKey: ["cash-opening-balances-bank-accounts"],
    queryFn: () => api.get<BankAccountListResponse>("/directories/bank-accounts/"),
  });

  const cashOrdersQuery = useQuery({
    queryKey: ["cash-opening-balances-cash-orders"],
    queryFn: fetchAllCashOrders,
  });

  const bankAccounts = useMemo(
    () => extractResults<BankAccount>(bankAccountsQuery.data),
    [bankAccountsQuery.data],
  );

  const cashItems = useMemo(
    () =>
      buildCashDirectoryItems({
        bankAccounts,
        cashOrders: cashOrdersQuery.data || [],
        localEntries,
      }),
    [bankAccounts, cashOrdersQuery.data, localEntries],
  );

  const filteredRows = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => row.cashName.toLowerCase().includes(query));
  }, [rows, searchValue]);

  const totalAmount = useMemo(
    () =>
      rows.reduce((sum, row) => {
        const parsed = Number.parseFloat(row.amount.replace(",", "."));
        return sum + (Number.isFinite(parsed) ? parsed : 0);
      }, 0),
    [rows],
  );

  const addRow = () => {
    setRows((current) => [...current, createRow(current.length + 1)]);
  };

  const updateRow = (rowId: number, patch: Partial<CashOpeningRow>) => {
    setRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    );
  };

  const validateRows = () => {
    const hasValidRow = rows.some((row) => {
      const amount = Number.parseFloat(row.amount.replace(",", "."));
      return row.cashName.trim() && Number.isFinite(amount) && amount > 0;
    });

    if (!hasValidRow) {
      toast.error("Добавьте хотя бы одну кассу и сумму больше нуля.");
      return false;
    }

    return true;
  };

  const handleDocumentAction = (action: "save" | "post" | "post-close") => {
    if (!validateRows()) return;

    if (action === "save") {
      toast.success("Документ сохранен.");
      return;
    }

    toast.success("Документ проведен.");

    if (action === "post-close") {
      router.push(localePath("/bank-cash/cash"));
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-card p-4 text-foreground">
      <div className="rounded-sm border border-border bg-background">
        <div className="border-b border-border px-4 py-3 text-[26px] font-semibold tracking-tight">
          Ввод остатков по кассам (создание)
        </div>
        <div className="flex items-center gap-2 border-b border-[#e5e7eb] px-4 py-2 text-sm">
          <span className="rounded-sm bg-[#ececec] px-3 py-2 font-medium">Основное</span>
          <span className="px-3 py-2 text-[#315d96] underline decoration-dotted underline-offset-2">
            Касса
          </span>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className="h-10 rounded-sm bg-[#f5d400] px-5 text-black hover:bg-[#e5c500]"
              onClick={() => handleDocumentAction("post-close")}
            >
              Провести и закрыть
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-sm border-border bg-background px-5"
              onClick={() => handleDocumentAction("save")}
            >
              Записать
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-sm border-border bg-background px-5"
              onClick={() => handleDocumentAction("post")}
            >
              Провести
            </Button>
          </div>

          <div className="grid gap-3 lg:grid-cols-[160px_220px_110px_1fr_80px_180px] lg:items-center">
            <div className="text-sm">Номер:</div>
            <Input value="0" readOnly className="h-9 rounded-sm border-border bg-background" />

            <div className="text-sm">Дата:</div>
            <Input
              type="date"
              value={documentDate}
              onChange={(event) => setDocumentDate(event.target.value)}
              className="h-9 rounded-sm border-border bg-background"
            />

            <div className="text-sm">Валюта:</div>
            <select
              value={currencyCode}
              onChange={(event) =>
                setCurrencyCode(event.target.value as (typeof DEFAULT_CURRENCIES)[number])
              }
              className="h-9 rounded-sm border border-border bg-background px-3 text-sm outline-none"
            >
              {DEFAULT_CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 lg:grid-cols-[160px_220px_110px_200px_1fr] lg:items-center">
            <div className="text-sm">Курс:</div>
            <Input
              value={rateValue}
              onChange={(event) => setRateValue(event.target.value)}
              className="h-9 rounded-sm border-border bg-background text-right"
            />
            <div />
            <div />
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Поиск (Ctrl+F)"
              className="h-9 rounded-sm border-border bg-background"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-sm border-border bg-background"
              onClick={addRow}
            >
              <PiPlusBold className="mr-2 h-4 w-4" />
              Добавить
            </Button>
          </div>

          <div className="overflow-auto rounded-sm border border-border">
            <table className="w-full min-w-[780px] border-collapse text-sm">
              <thead className="bg-muted text-left">
                <tr className="[&>th]:border-b [&>th]:border-r [&>th]:border-border [&>th]:px-3 [&>th]:py-2 [&>th:last-child]:border-r-0">
                  <th className="w-[60px]">N</th>
                  <th>Касса</th>
                  <th className="w-[180px]">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr key={row.id} className="border-b border-border">
                    <td className="px-3 py-2">{index + 1}</td>
                    <td className="px-3 py-2">
                      <select
                        value={row.cashName}
                        onChange={(event) =>
                          updateRow(row.id, { cashName: event.target.value })
                        }
                        className="h-9 w-full rounded-sm border border-border bg-background px-3 text-sm outline-none"
                      >
                        <option value="">Выберите кассу</option>
                        {cashItems.map((item) => (
                          <option key={item.key} value={item.name}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={row.amount}
                        onChange={(event) =>
                          updateRow(row.id, { amount: event.target.value })
                        }
                        className="h-9 rounded-sm border-border bg-background text-right"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-sm border border-[#e4dbb4] bg-muted px-4 py-3 text-sm">
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <span>Итого:</span>
              <span className="font-mono font-semibold">
                {totalAmount.toLocaleString("ru-RU", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                {currencyCode}
              </span>
            </div>
          </div>

          <div className="grid gap-3 border-t border-[#e5e7eb] pt-3 md:grid-cols-2">
            <div className="grid gap-2 md:grid-cols-[110px_1fr] md:items-center">
              <div className="text-sm">Создатель:</div>
              <Input
                value="Admin"
                readOnly
                className="h-9 rounded-sm border-border bg-background"
              />
            </div>
            <div className="grid gap-2 md:grid-cols-[130px_1fr] md:items-center">
              <div className="text-sm">Подразделение:</div>
              <Input
                value={DEFAULT_CASH_DEPARTMENT}
                readOnly
                className="h-9 rounded-sm border-border bg-background"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
