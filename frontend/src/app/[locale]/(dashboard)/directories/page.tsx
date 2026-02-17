"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PiUsersBold,
  PiWarehouseBold,
  PiCurrencyDollarBold,
  PiHandshakeBold,
  PiPackageBold,
  PiTagBold,
  PiBankBold,
  PiArrowsClockwiseBold,
} from "react-icons/pi";

export default function DirectoriesPage() {
  const t = useTranslations("directories");
  const router = useRouter();

  const directories = [
    {
      name: t("items"),
      icon: PiPackageBold,
      path: "/directories/items",
      description: t("itemsDesc"),
    },
    {
      name: t("counterparties"),
      icon: PiHandshakeBold,
      path: "/directories/counterparties",
      description: t("counterpartiesDesc"),
    },
    {
      name: t("warehouses"),
      icon: PiWarehouseBold,
      path: "/directories/warehouses",
      description: t("warehousesDesc"),
    },
    {
      name: t("currencies"),
      icon: PiCurrencyDollarBold,
      path: "/directories/currencies",
      description: t("currenciesDesc"),
    },
    {
      name: t("bankAccounts"),
      icon: PiBankBold,
      path: "/directories/bank-accounts",
      description: t("bankAccountsDesc"),
    },
    {
      name: t("bankExchangeSettings"),
      icon: PiArrowsClockwiseBold,
      path: "/directories/bank-exchange-settings",
      description: t("bankExchangeSettingsDesc"),
    },
    {
      name: t("categories"),
      icon: PiTagBold,
      path: "/directories/categories",
      description: t("categoriesDesc"),
    },
    {
      name: t("contacts"),
      icon: PiUsersBold,
      path: "/directories/contacts",
      description: t("contactsDesc"),
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("manageReferenceData")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {directories.map((dir) => (
          <Card
            key={dir.path}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push(dir.path)}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <dir.icon className="h-5 w-5" />
                {dir.name}
              </CardTitle>
              <CardDescription>{dir.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                {t("open")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
