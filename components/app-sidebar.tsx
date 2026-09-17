"use client"

import { usePathname } from "next/navigation"

import {
  BuildingIcon,
  SearchIcon,
  SquarePenIcon,
  UserRoundIcon,
} from "lucide-react"

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
} from "@/components/ui/sidebar"
import { ModeToggle } from "@/components/mode-toggle"

const navigation = [
  { label: "New chat", icon: SquarePenIcon },
  { label: "Spotlight", icon: SearchIcon },
  { label: "People", icon: UserRoundIcon },
  { label: "Companies", icon: BuildingIcon },
]

export function AppSidebar({
  companies,
}: {
  companies: Array<{ name: string; slug: string; logo: string | null }>;
}) {
  const pathname = usePathname()
  const companyNavigation = companies.map((company) => ({
    name: company.name,
    href: `/company/${company.slug}`,
    logo: company.logo,
  }))

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="p-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2.5 pl-3 pr-1 pb-2 pt-2">
              <SidebarMenuButton className="h-auto flex-1 gap-2.5 p-0 hover:bg-transparent" render={<a href="#top" />} size="lg">
                <img alt="Autumn" className="size-5" src="/autumn-base.svg" />
                <span className="font-sans text-[18px] leading-6.75 font-normal">Autumn</span>
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
              {navigation.slice(0, 2).map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton render={<a href={`#${item.label.toLowerCase()}`} />} tooltip={item.label} className="gap-3.5">
                    <item.icon className="size-3.5!" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground -ml-1 tracking-wide">ENRICH</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.slice(2).map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton render={<a href={`#${item.label.toLowerCase()}`} />} tooltip={item.label} className="gap-3.5">
                    <item.icon className="size-3.5!" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground -ml-1 tracking-wide">
            COMPANIES
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {companyNavigation.map((company) => (
                <SidebarMenuItem key={company.name}>
                  <SidebarMenuButton
                    className="gap-3.5"
                    isActive={pathname === company.href}
                    render={<a href={company.href} />}
                    tooltip={company.name}
                  >
                    <img
                      alt=""
                      aria-hidden="true"
                      className="size-4 rounded-sm object-cover"
                      src={company.logo ?? "/autumn-base.svg"}
                    />
                    <span>{company.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
