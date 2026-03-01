import type { BankAccount, CashOrder, PaginatedResponse } from "@/types";

export type CashDirectoryKind = "cash" | "bank";

export interface CashDirectoryLocalEntry {
  id: number;
  name: string;
  department: string;
  kind: CashDirectoryKind;
}

export interface CashDirectoryItem {
  key: string;
  code: number;
  name: string;
  department: string;
  kind: CashDirectoryKind;
  source: "bank-account" | "cash-order" | "local";
}

export type BankAccountListResponse =
  | PaginatedResponse<BankAccount>
  | BankAccount[]
  | {
      results?: BankAccount[];
      data?: BankAccount[];
      items?: BankAccount[];
      next?: string | null;
    };

export type CashOrderListResponse =
  | PaginatedResponse<CashOrder>
  | CashOrder[]
  | {
      results?: CashOrder[];
      data?: CashOrder[];
      items?: CashOrder[];
      next?: string | null;
    };

export const CASH_DIRECTORY_STORAGE_KEY = "cash-directory-entries";
export const DEFAULT_CASH_DEPARTMENT = "Оптовая торговля (общая)";

export function extractResults<T>(
  response:
    | PaginatedResponse<T>
    | T[]
    | {
        results?: T[];
        data?: T[];
        items?: T[];
      }
    | undefined,
): T[] {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  const candidate = response as {
    results?: T[];
    data?: T[];
    items?: T[];
  };
  if (Array.isArray(candidate.results)) return candidate.results;
  if (Array.isArray(candidate.data)) return candidate.data;
  if (Array.isArray(candidate.items)) return candidate.items;
  return [];
}

export function inferCashDirectoryKind(name: string): CashDirectoryKind {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return "cash";

  if (
    normalized.includes("bank") ||
    normalized.includes("банк") ||
    normalized.includes("счет") ||
    normalized.includes("счёт") ||
    /\d{8,}/.test(normalized)
  ) {
    return "bank";
  }

  return "cash";
}

export function getCashDirectoryKindLabel(kind: CashDirectoryKind): string {
  return kind === "bank" ? "Банк" : "Касса";
}

export function buildCashDirectoryItems(params: {
  bankAccounts?: BankAccount[];
  cashOrders?: CashOrder[];
  localEntries?: CashDirectoryLocalEntry[];
}): CashDirectoryItem[] {
  const deduped = new Map<string, CashDirectoryItem>();

  for (const bankAccount of params.bankAccounts || []) {
    const name =
      String(bankAccount.name || "").trim() ||
      String(bankAccount.account_number || "").trim();

    if (!name) continue;

    deduped.set(name.toLowerCase(), {
      key: `bank-${bankAccount.id}`,
      code: bankAccount.id,
      name,
      department: DEFAULT_CASH_DEPARTMENT,
      kind: "bank",
      source: "bank-account",
    });
  }

  for (const cashOrder of params.cashOrders || []) {
    const name = String(cashOrder.cash_desk || "").trim();
    if (!name) continue;

    const mapKey = name.toLowerCase();
    if (deduped.has(mapKey)) continue;

    deduped.set(mapKey, {
      key: `cash-${name}`,
      code: cashOrder.id,
      name,
      department: DEFAULT_CASH_DEPARTMENT,
      kind: inferCashDirectoryKind(name),
      source: "cash-order",
    });
  }

  for (const localEntry of params.localEntries || []) {
    const name = String(localEntry.name || "").trim();
    if (!name) continue;

    deduped.set(name.toLowerCase(), {
      key: `local-${localEntry.id}`,
      code: localEntry.id,
      name,
      department:
        String(localEntry.department || "").trim() || DEFAULT_CASH_DEPARTMENT,
      kind: localEntry.kind,
      source: "local",
    });
  }

  return Array.from(deduped.values()).sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "bank" ? -1 : 1;
    }
    return left.name.localeCompare(right.name, "ru");
  });
}
