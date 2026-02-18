"use client";

import { usePathname, useRouter } from "next/navigation";
import { PiXBold, PiHouseBold } from "react-icons/pi";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { useAppStore } from "@/stores/app-store";
import { navigationConfig, NavItem } from "@/config/navigation";
import { useTranslations } from "next-intl";

export function TaxiTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const { tabs, addTab, removeTab } = useAppStore();
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");

  // Helper to find title in config
  const findTitle = (
    path: string,
  ): {
    title: string;
    icon?: React.ComponentType<{ className?: string }>;
    translationKey?: string;
  } => {
    if (
      path === "/" ||
      path.startsWith("/en") ||
      path.startsWith("/ru") ||
      path.startsWith("/uz")
    ) {
      if (path.replace(/^\/(en|ru|uz)/, "") === "")
        return { title: "Главная", icon: PiHouseBold, translationKey: "main" };
    }

    const cleanPath = path.replace(/^\/(en|ru|uz)/, "");

    let found: {
      title: string;
      icon?: React.ComponentType<{ className?: string }>;
      translationKey?: string;
    } | null = null;

    // Recursive search
    const search = (items: NavItem[]) => {
      for (const item of items) {
        if (item.href === cleanPath) {
          found = {
            title: item.title,
            icon: item.icon,
            translationKey: item.id,
          };
          return;
        }
        if (item.children) search(item.children);
      }
    };

    navigationConfig.forEach((g) => search(g.items));

    if (found) return found;

    // Dynamic Routes Heuristic
    if (path.includes("/new"))
      return { title: "Новый документ", translationKey: "common.newDocument" };

    // Check for IDs
    const parts = cleanPath.split("/");
    const lastPart = parts[parts.length - 1];
    if (!isNaN(Number(lastPart))) {
      // It's an ID. Try to find parent title.
      return { title: `#${lastPart}`, translationKey: `common.document` };
    }

    return { title: "Страница", translationKey: "common.page" };
  };

  // Effect: Add current page to tabs
  useEffect(() => {
    if (pathname === "/login" || pathname === "/register") return;

    const { title, icon, translationKey } = findTitle(pathname);
    const id = pathname; // Use path as unique ID for now

    addTab({
      id,
      path: pathname,
      label: title,
      icon: icon ? "icon" : undefined, // We can't persist React nodes easily, maybe need mapping
      translationKey,
    });
  }, [pathname, addTab]);

  const handleClose = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    removeTab(path);

    // If closing active tab, navigate to last remaining tab or dashboard
    if (pathname === path) {
      const newTabs = tabs.filter((t) => t.path !== path);
      if (newTabs.length > 0) {
        router.push(newTabs[newTabs.length - 1].path);
      } else {
        router.push("/");
      }
    }
  };

  const getTabLabel = (tab: {
    label: string;
    translationKey?: string;
    path?: string;
  }) => {
    if (!tab.translationKey) return tab.label;

    if (tab.translationKey.startsWith("common.")) {
      const key = tab.translationKey.replace("common.", "");
      // Handle dynamic ID suffix for documents if needed?
      // The translationKey logic for IDs above returned 'common.document'.
      // If the label was `#123`, we might want to keep the ID.
      if (key === "document" && tab.label.startsWith("#")) {
        return `${tCommon("document")} ${tab.label}`;
      }
      return tCommon(key);
    }

    // Default to nav namespace
    return tNav(tab.translationKey);
  };

  return (
    <div className="flex items-end gap-1 bg-muted/40 p-1 border-b select-none overflow-x-auto custom-scrollbar h-9 w-full">
      {/* Home Button */}
      <div
        onClick={() => router.push("/")}
        className={cn(
          "flex items-center justify-center h-7 w-7 rounded-sm cursor-pointer transition-colors text-muted-foreground hover:bg-white hover:text-black mb-0.5 ml-1",
          pathname === "/" &&
            "bg-white text-orange-600 shadow-sm ring-1 ring-black/5",
        )}
        title={tNav("main")}
      >
        <PiHouseBold className="h-4 w-4" />
      </div>

      {tabs.map((tab) => {
        const isActive = pathname === tab.path;
        // Skip Home
        if (tab.path === "/" || tab.path.replace(/^\/(en|ru|uz)/, "") === "")
          return null;

        return (
          <div
            key={tab.path}
            onClick={() => router.push(tab.path)}
            className={cn(
              "group flex items-center gap-2 px-3 h-8 text-xs font-medium cursor-pointer transition-all whitespace-nowrap min-w-30 max-w-55 -mb-px z-10 relative",
              isActive
                ? "bg-[#FFEFAD] border-[#F0B000] text-black shadow-[0_-2px_5px_rgba(0,0,0,0.05)]" // 1C Active Yellow
                : "bg-white border-transparent text-muted-foreground hover:bg-gray-50 border-gray-200 mt-1 h-7",
            )}
            onAuxClick={(e) => {
              // Middle click to close
              if (e.button === 1) handleClose(e, tab.path);
            }}
          >
            <span className="truncate flex-1">{getTabLabel(tab)}</span>

            <button
              className={cn(
                "p-0.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/10",
                isActive && "text-black/50 hover:text-black",
              )}
              onClick={(e) => handleClose(e, tab.path)}
            >
              <PiXBold className="h-3 w-3" />
            </button>
          </div>
        );
      })}

      {/* Close All Helper (Optional) */}
      {tabs.length > 5 && (
        <div className="ml-auto flex px-2 pb-1">
          <button
            className="text-[10px] text-muted-foreground hover:text-destructive font-medium"
            onClick={() => useAppStore.getState().closeAllTabs()}
          >
            Закрыть остальные
          </button>
        </div>
      )}
    </div>
  );
}
