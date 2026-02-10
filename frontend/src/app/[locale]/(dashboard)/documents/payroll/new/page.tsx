"use client";

import { useTranslations } from "next-intl";
import { PayrollForm } from "@/components/documents/payroll-form";

export default function NewPayrollPage() {
    const t = useTranslations("documents");

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <div className="border-b shrink-0 p-4">
                <h1 className="text-xl font-bold">{t("newPayroll")}</h1>
            </div>
            <PayrollForm mode="create" />
        </div>
    );
}
