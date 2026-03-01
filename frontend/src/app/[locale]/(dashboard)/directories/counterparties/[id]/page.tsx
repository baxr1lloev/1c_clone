"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import api from "@/lib/api";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { LinkableCell } from "@/components/ui/linkable-cell";
import { CopyLinkButton } from "@/components/ui/copy-link-button";
import { Loader2 } from "lucide-react";

interface Counterparty {
  id: number;
  name: string;
  inn: string;
  type: string;
  email: string;
  phone: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  extra_fields?: Record<string, string | number | boolean>;
}

interface BalanceDetail {
  contract_id: number;
  contract_number: string;
  currency: string;
  amount: number;
}

interface RelatedDocument {
  id: number;
  type: string;
  number: string;
  date: string;
  total?: number;
  amount?: number;
}

interface CounterpartyBalanceResponse {
  total_balance: number;
  balances: BalanceDetail[];
}

interface CounterpartyDocumentsResponse {
  documents: RelatedDocument[];
}

type LinkableDocumentType =
  | "sales-document"
  | "purchase-document"
  | "payment-document"
  | "transfer-document";

function normalizeCounterpartyType(
  type: unknown,
): "customer" | "supplier" | "agent" | "other" {
  const value = String(type ?? "").toLowerCase();
  if (value === "customer" || value === "supplier" || value === "agent") {
    return value;
  }
  return "other";
}

function mapRelatedDocumentType(type: unknown): LinkableDocumentType | null {
  const value = String(type ?? "").toLowerCase();
  if (value === "sales") return "sales-document";
  if (value === "purchase") return "purchase-document";
  if (value === "payment") return "payment-document";
  if (value === "transfer") return "transfer-document";
  return null;
}

export default function CounterpartyDetailPage() {
  const params = useParams();
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tFields = useTranslations("fields");
  const tDirectories = useTranslations("directories");
  const tDetail = useTranslations("directories.counterpartyDetail");
  const id = parseInt(params.id as string);

  const { data: counterparty, isLoading } = useQuery<Counterparty>({
    queryKey: ["counterparty", id],
    queryFn: () => api.get<Counterparty>(`/api/counterparties/${id}/`),
  });

  const { data: balanceData } = useQuery<CounterpartyBalanceResponse>({
    queryKey: ["counterparty", id, "balance"],
    queryFn: () =>
      api.get<CounterpartyBalanceResponse>(
        `/api/counterparties/${id}/balance/`,
      ),
  });

  const { data: documentsData } = useQuery<CounterpartyDocumentsResponse>({
    queryKey: ["counterparty", id, "documents"],
    queryFn: () =>
      api.get<CounterpartyDocumentsResponse>(
        `/api/counterparties/${id}/documents/`,
      ),
  });

  const breadcrumbs = [
    { label: tNav("main"), href: "/" },
    { label: tNav("directories"), href: "/directories" },
    { label: tNav("counterparties"), href: "/directories/counterparties" },
    { label: counterparty?.name || tDetail("counterpartyFallback", { id }) },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const balanceColumns: ColumnDef<BalanceDetail>[] = [
    {
      accessorKey: "contract_number",
      header: tFields("contract"),
    },
    {
      accessorKey: "currency",
      header: tFields("currency"),
    },
    {
      accessorKey: "amount",
      header: tDetail("columns.balance"),
      cell: ({ row }) => {
        const amount = Number(row.original.amount || 0);
        const isDebt = amount > 0;
        return (
          <span className={isDebt ? "text-green-600" : "text-red-600"}>
            ${amount.toFixed(2)}
          </span>
        );
      },
    },
  ];

  const documentColumns: ColumnDef<RelatedDocument>[] = [
    {
      accessorKey: "date",
      header: tCommon("date"),
    },
    {
      accessorKey: "type",
      header: tFields("type"),
      cell: ({ row }) => (
        <Badge variant="outline">
          {tDirectories(
            `counterpartiesPage.filters.${normalizeCounterpartyType(row.original.type)}`,
          )}
        </Badge>
      ),
    },
    {
      accessorKey: "number",
      header: tCommon("number"),
      cell: ({ row }) => {
        const linkType = mapRelatedDocumentType(row.original.type);
        if (!linkType) {
          return <span className="font-medium">{row.original.number}</span>;
        }
        return (
          <LinkableCell
            id={row.original.id}
            type={linkType}
            label={row.original.number}
          />
        );
      },
    },
    {
      accessorKey: "total",
      header: tCommon("amount"),
      cell: ({ row }) => {
        const amount = Number(row.original.total || row.original.amount || 0);
        return `$${amount.toFixed(2)}`;
      },
    },
  ];

  const totalBalance = balanceData?.total_balance || 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Breadcrumbs segments={breadcrumbs} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{counterparty?.name}</h1>
          <p className="text-muted-foreground">
            {tFields("inn")}: {counterparty?.inn}
          </p>
        </div>
        <div className="flex gap-2">
          <CopyLinkButton entityType="counterparty" entityId={id} />
          <Badge variant={counterparty?.is_active ? "default" : "secondary"}>
            {counterparty?.is_active
              ? tDetail("status.active")
              : tDetail("status.inactive")}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tDetail("settlementBalance")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            <span
              className={
                totalBalance > 0
                  ? "text-green-600"
                  : totalBalance < 0
                    ? "text-red-600"
                    : ""
              }
            >
              ${totalBalance.toFixed(2)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {totalBalance > 0
              ? tDetail("balanceState.customerOwesUs")
              : totalBalance < 0
                ? tDetail("balanceState.weOweCustomer")
                : tDetail("balanceState.noDebt")}
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="details" className="w-full">
        <TabsList>
          <TabsTrigger value="details">{tDetail("tabs.details")}</TabsTrigger>
          <TabsTrigger value="balance">{tDetail("tabs.balance")}</TabsTrigger>
          <TabsTrigger value="documents">
            {tDetail("tabs.documents")}
          </TabsTrigger>
          <TabsTrigger value="audit">{tDetail("tabs.audit")}</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{tDetail("counterpartyInformation")}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {tCommon("name")}
                </p>
                <p className="font-medium">{counterparty?.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {tFields("inn")}
                </p>
                <p className="font-medium">{counterparty?.inn}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {tFields("type")}
                </p>
                <p className="font-medium">
                  {tDirectories(
                    `counterpartiesPage.filters.${normalizeCounterpartyType(counterparty?.type)}`,
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {tFields("email")}
                </p>
                <p className="font-medium">{counterparty?.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {tFields("phone")}
                </p>
                <p className="font-medium">{counterparty?.phone}</p>
              </div>
              {counterparty?.extra_fields &&
                Object.keys(counterparty.extra_fields).length > 0 && (
                  <div className="col-span-2 pt-4 mt-2 border-t">
                    <h4 className="text-sm font-semibold mb-3">
                      {tDetail("additionalAttributes", {
                        defaultValue: "Дополнительные реквизиты",
                      })}
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(counterparty.extra_fields).map(
                        ([key, value]) => (
                          <div key={key}>
                            <p className="text-sm text-muted-foreground">
                              {key}
                            </p>
                            <p className="font-medium">{String(value)}</p>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance">
          <Card>
            <CardHeader>
              <CardTitle>{tDetail("balanceByContract")}</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={balanceColumns}
                data={balanceData?.balances || []}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>{tDetail("relatedDocuments")}</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={documentColumns}
                data={documentsData?.documents || []}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>{tDetail("auditTrail")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {tDetail("audit.created")}
                  </p>
                  <p className="font-medium">{counterparty?.created_at}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {tDetail("audit.lastModified")}
                  </p>
                  <p className="font-medium">{counterparty?.updated_at}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
