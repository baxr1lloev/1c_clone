"use client";

import { useTranslations } from "next-intl";
import { OperationForm } from "@/components/accounting/operation-form";

export default function NewOperationPage() {
    const t = useTranslations("accounting");

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <div className="border-b shrink-0 p-4">
                <h1 className="text-xl font-bold">{t("newOperation")}</h1>
            </div>
            <OperationForm mode="create" />
        </div>
    );
}
