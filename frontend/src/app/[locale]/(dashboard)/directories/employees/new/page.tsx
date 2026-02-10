"use client";

import { useTranslations } from "next-intl";
import { EmployeeForm } from "@/components/directories/employee-form";

export default function NewEmployeePage() {
    const t = useTranslations("directories");

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <div className="border-b shrink-0 p-4">
                <h1 className="text-xl font-bold">{t("newEmployee")}</h1>
            </div>
            <EmployeeForm mode="create" />
        </div>
    );
}
