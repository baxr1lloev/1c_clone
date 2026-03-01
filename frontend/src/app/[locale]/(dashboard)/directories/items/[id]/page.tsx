"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { LinkableCell } from "@/components/ui/linkable-cell";
import { CopyLinkButton } from "@/components/ui/copy-link-button";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ItemPriceDialog } from "@/components/directories/item-price-dialog";

interface Item {
  id: number;
  name: string;
  sku: string;
  item_type: string;
  category: number;
  base_unit: string;
  purchase_price: number;
  sale_price: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  packages?: ItemPackage[];
  units?: ItemPackage[];
  extra_fields?: Record<string, string | number | boolean>;
}

interface ItemPackage {
  id: number;
  name: string;
  coefficient: number;
  is_default?: boolean;
}

interface StockBalance {
  warehouse_id: number;
  warehouse_name: string;
  quantity: number;
  amount: number;
}

interface RelatedDocument {
  id: number;
  type: string;
  number: string;
  date: string;
  total: number;
}

type LinkableDocumentType =
  | "sales-document"
  | "purchase-document"
  | "payment-document"
  | "transfer-document";

interface ItemPrice {
  id: number;
  date: string;
  price_type_display: string;
  price: number;
  currency_code: string;
}

const toFiniteNumber = (value: unknown): number | null => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatNumber = (
  value: unknown,
  digits: number,
  fallback = "-",
): string => {
  const numeric = toFiniteNumber(value);
  return numeric === null ? fallback : numeric.toFixed(digits);
};

const formatMoney = (value: unknown): string => {
  return `$${formatNumber(value, 2, "0.00")}`;
};

const toLinkableDocumentType = (type: string): LinkableDocumentType => {
  const normalized = type.toLowerCase();
  if (normalized.includes("purchase")) return "purchase-document";
  if (normalized.includes("payment")) return "payment-document";
  if (normalized.includes("transfer")) return "transfer-document";
  return "sales-document";
};

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = parseInt(params.id as string);

  const { data: item, isLoading } = useQuery<Item>({
    queryKey: ["item", id],
    queryFn: () => api.get(`/directories/items/${id}/`),
  });

  const { data: balancesData } = useQuery<{ balances: StockBalance[] }>({
    queryKey: ["item", id, "balances"],
    queryFn: () => api.get(`/directories/items/${id}/balances/`),
  });

  const { data: documentsData } = useQuery<{ documents: RelatedDocument[] }>({
    queryKey: ["item", id, "documents"],
    queryFn: () => api.get(`/directories/items/${id}/documents/`),
  });

  const { data: pricesData } = useQuery<{ results: ItemPrice[] }>({
    queryKey: ["item", id, "prices"],
    queryFn: () => api.get(`/registers/item-prices/?item=${id}`),
  });

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: "Directories", href: "/directories" },
    { label: "Items", href: "/directories/items" },
    { label: item?.name || `Item #${id}` },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const balanceColumns: ColumnDef<StockBalance>[] = [
    {
      accessorKey: "warehouse_name",
      header: "Warehouse",
      cell: ({ row }) => (
        <LinkableCell
          id={row.original.warehouse_id}
          type="warehouse"
          label={row.original.warehouse_name}
        />
      ),
    },
    {
      accessorKey: "quantity",
      header: "Quantity",
      cell: ({ row }) => formatNumber(row.original.quantity, 3, "0.000"),
    },
    {
      accessorKey: "amount",
      header: "Value",
      cell: ({ row }) => formatMoney(row.original.amount),
    },
  ];

  const documentColumns: ColumnDef<RelatedDocument>[] = [
    {
      accessorKey: "date",
      header: "Date",
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => <Badge variant="outline">{row.original.type}</Badge>,
    },
    {
      accessorKey: "number",
      header: "Number",
      cell: ({ row }) => (
        <LinkableCell
          id={row.original.id}
          type={toLinkableDocumentType(row.original.type)}
          label={row.original.number}
        />
      ),
    },
    {
      accessorKey: "total",
      header: "Total",
      cell: ({ row }) => formatMoney(row.original.total),
    },
  ];

  const priceColumns: ColumnDef<ItemPrice>[] = [
    {
      accessorKey: "date",
      header: "Effective Date",
      cell: ({ row }) => format(new Date(row.original.date), "dd.MM.yyyy"),
    },
    {
      accessorKey: "price_type_display",
      header: "Type",
    },
    {
      accessorKey: "price",
      header: "Price",
      cell: ({ row }) =>
        `${formatNumber(row.original.price, 2, "0.00")} ${row.original.currency_code}`,
    },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Breadcrumbs segments={breadcrumbs} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{item?.name}</h1>
          <p className="text-muted-foreground">SKU: {item?.sku}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/directories/items/${id}/edit`)}
          >
            Edit
          </Button>
          <CopyLinkButton entityType="item" entityId={id} />
          <Badge variant={item?.is_active ? "default" : "secondary"}>
            {item?.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="prices">Price History</TabsTrigger>
          <TabsTrigger value="balances">Stock Balances</TabsTrigger>
          <TabsTrigger value="documents">Related Documents</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Item Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{item?.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">SKU</p>
                <p className="font-medium">{item?.sku}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <p className="font-medium">{item?.item_type}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Base Unit</p>
                <p className="font-medium">{item?.base_unit}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Packaging</p>
                {(() => {
                  const units = item?.units || item?.packages || [];
                  if (!units.length) return <p className="font-medium">-</p>;
                  return (
                    <div className="space-y-1">
                      {units.map((unit) => (
                        <p key={unit.id} className="font-medium">
                          {unit.name} = {unit.coefficient} {item?.base_unit}
                          {unit.is_default ? " (default)" : ""}
                        </p>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Purchase Price</p>
                <p className="font-medium">
                  {formatMoney(item?.purchase_price)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sale Price</p>
                <p className="font-medium">{formatMoney(item?.sale_price)}</p>
              </div>
              {item?.extra_fields &&
                Object.keys(item.extra_fields).length > 0 && (
                  <div className="col-span-2 pt-4 mt-2 border-t">
                    <h4 className="text-sm font-semibold mb-3">
                      Дополнительные реквизиты (Additional Attributes)
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(item.extra_fields).map(([key, value]) => (
                        <div key={key}>
                          <p className="text-sm text-muted-foreground">{key}</p>
                          <p className="font-medium">{String(value)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prices">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Price History (Srez Poslednix)</CardTitle>
              <ItemPriceDialog itemId={id} />
            </CardHeader>
            <CardContent>
              <DataTable
                columns={priceColumns}
                data={pricesData?.results || []}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balances">
          <Card>
            <CardHeader>
              <CardTitle>Stock Balances by Warehouse</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={balanceColumns}
                data={balancesData?.balances || []}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Related Documents</CardTitle>
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
              <CardTitle>Audit Trail</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">{item?.created_at}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Modified</p>
                  <p className="font-medium">{item?.updated_at}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
