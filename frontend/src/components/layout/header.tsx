"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAppStore } from "@/stores/app-store";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  PiBellBold,
  PiUserBold,
  PiSignOutBold,
  PiGearBold,
  PiGlobeBold,
  PiMoonBold,
  PiSunBold,
  PiBuildingsBold,
} from "react-icons/pi";
import type { Locale } from "@/i18n/routing";

const localeNames: Record<Locale, string> = {
  en: "English",
  ru: "Русский",
  uz: "O'zbek",
};

const localeFlags: Record<Locale, string> = {
  en: "🇬🇧",
  ru: "🇷🇺",
  uz: "🇺🇿",
};

import { useTheme } from "next-themes";

// ...

export function Header() {
  const t = useTranslations("nav");
  const ta = useTranslations("auth");
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { sidebarCollapsed, locale, setLocale, currentTenant } = useAppStore();
  const { theme, setTheme } = useTheme();

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale);
    // Replace the locale in the current path
    const pathWithoutLocale = pathname.replace(/^\/(en|ru|uz)/, "");
    router.push(`/${newLocale}${pathWithoutLocale}`);
  };

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const userInitials = user
    ? `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase() ||
      "U"
    : "U";

  if (!isMounted) {
    return (
      <header
        className={cn(
          "fixed top-0 right-0 z-30 flex h-14 items-center justify-between border-b bg-card px-4 transition-all duration-300",
          "left-64", // Default state during SSR
        )}
      >
        {/* Skeleton or empty content to match server output structure if needed, 
                but returning basic header structure is safer than null to avoid layout shift */}
      </header>
    );
  }

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 flex h-14 items-center justify-between border-b bg-card px-4 transition-all duration-300",
        sidebarCollapsed ? "left-16" : "left-64",
      )}
    >
      <div className="flex items-center gap-4">
        {/* Tenant Selector */}
        {currentTenant && (
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5">
            <PiBuildingsBold className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{currentTenant.name}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Language Selector */}
        <Select
          value={locale}
          onValueChange={(v) => handleLocaleChange(v as Locale)}
        >
          <SelectTrigger className="w-[150px] h-9">
            <PiGlobeBold className="h-4 w-4 mr-2" />
            <SelectValue>
              {localeFlags[locale]} {localeNames[locale]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(localeNames).map(([key, name]) => (
              <SelectItem key={key} value={key}>
                {localeFlags[key as Locale]} {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <PiSunBold className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <PiMoonBold className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon">
          <PiBellBold className="h-4 w-4" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              {user && (
                <span className="hidden md:block text-sm">
                  {user.first_name} {user.last_name}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{user?.email || "Guest"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/profile")}>
              <PiUserBold className="mr-2 h-4 w-4" />
              {t("profile")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <PiGearBold className="mr-2 h-4 w-4" />
              {t("settings")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive">
              <PiSignOutBold className="mr-2 h-4 w-4" />
              {ta("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
