"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

import {
  BuildingIcon,
  DraftingCompassIcon,
  SearchIcon,
  SquarePenIcon,
  UserRoundIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { CompanySearch } from "@/components/company-search";
import type { CompanyNavigationItem } from "@/lib/company-profile";

const navigation = [
  // { label: "New chat", icon: SquarePenIcon },
  // { label: "People", icon: UserRoundIcon },
  { label: "Companies", icon: BuildingIcon },
];

export function AppSidebar({
  companies,
}: {
  companies: CompanyNavigationItem[];
}) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const [searchOpen, setSearchOpen] = useState(false);
  const companyNavigation = companies.map((company) => ({
    name: company.name,
    href: `/company/${company.slug}`,
    logo: company.logo,
  }));

  function openSearch() {
    if (isMobile) {
      setOpenMobile(false);
    }

    setSearchOpen(true);
  }

  return (
    <>
      <Sidebar variant="inset">
        <SidebarHeader className="p-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center gap-2.5 pl-3 pr-1 pb-2 pt-3 [[data-mobile=true]_&]:px-4 [[data-mobile=true]_&]:pb-3 [[data-mobile=true]_&]:pt-4">
                <SidebarMenuButton
                  className="h-auto flex-1 gap-2.5 -m-2"
                  render={<a href="#top" />}
                  size="lg"
                >
                  <span className="flex size-6.5 items-center justify-center rounded-md bg-emerald-500 text-white">
                    <DraftingCompassIcon
                      aria-hidden="true"
                      className="size-4 stroke-[2]"
                    />
                  </span>
                  <span className="text-xl leading-6.75 font-semibold tracking-[-0.035em]">
                    Locus
                  </span>
                </SidebarMenuButton>
                <ModeToggle />
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={openSearch}
                    tooltip="Search companies, people, and jobs"
                  >
                    <SearchIcon className="size-3.5!" />
                    <span>Explore</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {navigation.slice(0, 1).map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      render={<a href={`#${item.label.toLowerCase()}`} />}
                      tooltip={item.label}
                    >
                      <item.icon className="size-3.5!" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {/*<SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground -ml-1 tracking-wide">ENRICH</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.slice(2).map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton render={<a href={`#${item.label.toLowerCase()}`} />} tooltip={item.label}>
                    <item.icon className="size-3.5!" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>*/}
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground -ml-1 tracking-wide">
              COMPANIES
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {companyNavigation.map((company) => (
                  <SidebarMenuItem key={company.name}>
                    <SidebarMenuButton
                      isActive={pathname === company.href}
                      render={<a href={company.href} />}
                      tooltip={company.name}
                    >
                      {company.logo ? (
                        <img
                          alt=""
                          aria-hidden="true"
                          className="size-4 rounded object-cover"
                          src={company.logo}
                        />
                      ) : (
                        <BuildingIcon
                          aria-hidden="true"
                          className="size-4 text-muted-foreground"
                        />
                      )}
                      <span>{company.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <CompanySearch onOpenChange={setSearchOpen} open={searchOpen} />
    </>
  );
}
