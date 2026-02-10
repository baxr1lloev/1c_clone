'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  PiCaretLeftBold,
  PiCaretRightBold,
  PiSquaresFourBold,
  PiCaretDownBold,
  PiCalculatorBold,
  PiGearBold,
  PiMagnifyingGlassBold
} from 'react-icons/pi';
import { useState, Fragment } from 'react';
import { navigationConfig, NavItem } from '@/config/navigation';
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { useRouter } from 'next/navigation';
import { FavoritesPanel } from '@/components/layout/favorites-panel';

export function Sidebar() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['directories', 'documents']);
  const [searchOpen, setSearchOpen] = useState(false);

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const isActive = (href: string) => {
    const localePath = pathname.replace(/^\/(en|ru|uz)/, '');
    return localePath === href || localePath.startsWith(href + '/');
  };

  const NavItemRenderer = ({ item, depth = 0 }: { item: NavItem, depth?: number }) => {
    const Icon = item.icon || PiSquaresFourBold;
    const isExpanded = expandedGroups.includes(item.href); // Abuse expandedGroups for nested too or verify
    const hasChildren = item.children && item.children.length > 0;

    // Sub-item rendering logic
    const [subExpanded, setSubExpanded] = useState(false);

    if (sidebarCollapsed && depth === 0) {
      return (
        <Link href={item.href} title={item.title}>
          <Button
            variant={isActive(item.href) ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
          >
            <Icon className="h-4 w-4" />
          </Button>
        </Link>
      )
    }

    if (hasChildren && !sidebarCollapsed) {
      return (
        <div className="space-y-1">
          <Button
            variant={isActive(item.href) ? 'secondary' : 'ghost'}
            className={cn("w-full justify-between h-9 text-sm", depth > 0 && "pl-8")}
            onClick={() => setSubExpanded(!subExpanded)}
          >
            <span className="flex items-center gap-3">
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.title}</span>
            </span>
            <PiCaretDownBold className={cn("h-3 w-3 transition-transform", subExpanded && "rotate-180")} />
          </Button>

          {subExpanded && (
            <div className="space-y-1 border-l ml-3.5 pl-3">
              {item.children?.map(child => (
                <NavItemRenderer key={child.href} item={child} depth={depth + 1} />
              ))}
            </div>
          )}
        </div>
      )
    }

    return (
      <Link href={item.href}>
        <Button
          variant={isActive(item.href) ? 'secondary' : 'ghost'}
          className={cn("w-full justify-start gap-3 h-9 text-sm", depth > 0 && "pl-8 text-muted-foreground")}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {/* If sidebar collapsed, we rely on the parent logic usually, but here checking just in case */}
          {!sidebarCollapsed && <span className="truncate">{item.title}</span>}
        </Button>
      </Link>
    );
  }

  return (
    <>
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen border-r bg-card transition-all duration-300 flex flex-col',
          sidebarCollapsed ? 'w-16' : 'w-64'
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4 shrink-0">
          {!sidebarCollapsed && (
            <Link href="/" className="flex items-center gap-2">
              <PiCalculatorBold className="h-6 w-6 text-primary" />
              <span className="font-semibold text-lg">1C ERP</span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className={cn(sidebarCollapsed && 'mx-auto')}
          >
            {sidebarCollapsed ? <PiCaretRightBold /> : <PiCaretLeftBold />}
          </Button>
        </div>

        <div className="p-2 border-b">
          <Button
            variant="outline"
            className={cn("w-full justify-start gap-2", sidebarCollapsed && "justify-center px-0")}
            onClick={() => setSearchOpen(true)}
          >
            <PiMagnifyingGlassBold className="h-4 w-4" />
            {!sidebarCollapsed && <span className="text-muted-foreground text-xs">All Functions... (Ctrl+K)</span>}
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-4 p-2">
            {navigationConfig.map((group) => {
              const GroupIcon = group.icon;
              const isExpanded = expandedGroups.includes(group.id);

              return (
                <div key={group.id} className="space-y-1">
                  {!sidebarCollapsed ? (
                    <>
                      <Button
                        variant="ghost"
                        className="w-full justify-between px-2 h-8 text-muted-foreground hover:text-foreground"
                        onClick={() => toggleGroup(group.id)}
                      >
                        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                          <GroupIcon className="h-3 w-3" />
                          {group.title}
                        </span>
                        {isExpanded ? <PiCaretDownBold className="h-3 w-3" /> : <PiCaretRightBold className="h-3 w-3" />}
                      </Button>

                      {isExpanded && (
                        <div className="space-y-0.5 mt-1">
                          {group.items.map(item => (
                            <NavItemRenderer key={item.href} item={item} />
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <div className="p-2" title={group.title}>
                        <GroupIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      {group.items.map(item => (
                        <NavItemRenderer key={item.href} item={item} />
                      ))}
                      <Separator className="w-8" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>

        <div className="p-2 border-t">
          <Link href="/settings">
            <Button variant="ghost" className={cn("w-full justify-start gap-3", sidebarCollapsed && "justify-center")}>
              <PiGearBold className="h-4 w-4" />
              {!sidebarCollapsed && <span>Settings</span>}
            </Button>
          </Link>
        </div>
      </aside>

      {/* All Functions Command Dialog - Mounted check to prevent hydration mismatch */}
      {searchOpen && (
        <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
          <CommandInput placeholder="Type a command or search (e.g. 'Контрагент', 'НДС')..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {navigationConfig.map(group => (
              <CommandGroup key={group.id} heading={group.title}>
                {group.items.map(item => (
                  <Fragment key={item.href}>
                    <CommandItem
                      value={`${item.title} ${item.keywords?.join(' ') || ''}`}
                      onSelect={() => {
                        router.push(item.href);
                        setSearchOpen(false);
                      }}
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                      {item.keywords && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({item.keywords[0]})
                        </span>
                      )}
                    </CommandItem>
                    {item.children?.map(child => (
                      <CommandItem
                        key={child.href}
                        value={`${child.title} ${item.title}`}
                        onSelect={() => {
                          router.push(child.href);
                          setSearchOpen(false);
                        }}
                        keywords={[item.title]}
                        className="pl-8"
                      >
                        <child.icon className="mr-2 h-4 w-4" />
                        <span>{child.title}</span>
                      </CommandItem>
                    ))}
                  </Fragment>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </CommandDialog>
      )}
    </>
  );
}
