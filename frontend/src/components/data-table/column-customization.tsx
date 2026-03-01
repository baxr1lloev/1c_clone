import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PiGearBold, PiEyeBold, PiEyeSlashBold } from "react-icons/pi";
import { ColumnDef } from "@tanstack/react-table";

interface ColumnCustomizationProps {
  columns: ColumnDef<any>[];
  columnVisibility: Record<string, boolean>;
  onColumnVisibilityChange: (visibility: Record<string, boolean>) => void;
  tableName: string; // For localStorage key
}

export function ColumnCustomization({
  columns,
  columnVisibility,
  onColumnVisibilityChange,
  tableName,
}: ColumnCustomizationProps) {
  const tc = useTranslations("common");
  // Load saved preferences from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`column_visibility_${tableName}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        onColumnVisibilityChange(parsed);
      } catch (e) {
        console.error("Failed to parse column visibility:", e);
      }
    }
  }, [tableName]);

  // Save preferences to localStorage
  useEffect(() => {
    localStorage.setItem(
      `column_visibility_${tableName}`,
      JSON.stringify(columnVisibility),
    );
  }, [columnVisibility, tableName]);

  const toggleColumn = (columnId: string) => {
    onColumnVisibilityChange({
      ...columnVisibility,
      [columnId]: !columnVisibility[columnId],
    });
  };

  const resetToDefaults = () => {
    const defaultVisibility: Record<string, boolean> = {};
    columns.forEach((col: any) => {
      if (col.accessorKey) {
        defaultVisibility[col.accessorKey] = true;
      }
    });
    onColumnVisibilityChange(defaultVisibility);
  };

  const visibleCount = Object.values(columnVisibility).filter(
    (v) => v !== false,
  ).length;
  const totalCount = columns.filter((col: any) => col.accessorKey).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
          <PiGearBold className="mr-1.5 h-3.5 w-3.5" />
          {tc("columns")} ({visibleCount}/{totalCount})
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{tc("columns")}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={resetToDefaults}
          >
            {tc("clear")}
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[300px] overflow-y-auto">
          {columns.map((column: any) => {
            if (!column.accessorKey) return null;

            const columnId = column.accessorKey;
            const isVisible = columnVisibility[columnId] !== false;
            const header =
              typeof column.header === "string" ? column.header : columnId;

            return (
              <DropdownMenuCheckboxItem
                key={columnId}
                className="capitalize"
                checked={isVisible}
                onCheckedChange={() => toggleColumn(columnId)}
              >
                {isVisible ? (
                  <PiEyeBold className="mr-2 h-3.5 w-3.5" />
                ) : (
                  <PiEyeSlashBold className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                )}
                {header}
              </DropdownMenuCheckboxItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
