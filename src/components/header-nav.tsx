"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ModeToggle } from "@/components/mode-toggle";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const routes = [
  { href: "/", label: "Home" },
  { href: "/email", label: "Email" },
  { href: "/academic", label: "Academic" },
];

export function HeaderNav() {
  const pathname = usePathname();
  const isMobile = useIsMobile();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 md:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-xs font-semibold tracking-tight md:text-sm"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-[0.65rem] font-bold text-primary">
            AI
          </span>
          <span className="text-foreground">
            TOEFL Writing Dev&nbsp;
            <span className="hidden text-muted-foreground md:inline">
              Playground
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-3 md:gap-4">
          <NavigationMenu viewport={isMobile}>
            <NavigationMenuList className="flex-wrap">
              {routes.map((route) => {
                const active =
                  route.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(route.href);

                return (
                  <NavigationMenuItem key={route.href}>
                    <NavigationMenuLink
                      asChild
                      data-active={active}
                      className={cn(
                        navigationMenuTriggerStyle(),
                        active
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                    >
                      <Link href={route.href}>{route.label}</Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                );
              })}
            </NavigationMenuList>
          </NavigationMenu>

          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
