"use client";

import { useTranslations } from "next-intl";
import { ProductionForm } from "@/components/documents/production-form";

export default function NewProductionPage() {
    const t = useTranslations("documents");

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <div className="border-b px-6 py-4">
                <h1 className="text-2xl font-bold tracking-tight">New Production Document</h1>
            </div>
            <ProductionForm mode="create" />
        </div>
    );
}
