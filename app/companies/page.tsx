import Link from "next/link";
import { Asterisk } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getCompanyDirectory } from "@/lib/company-profile";
import { cn } from "@/lib/utils";

export default async function CompaniesPage() {
  const companies = await getCompanyDirectory(6);

  return (
    <main
      id="top"
      className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 pb-20 pt-5 sm:px-6 md:px-8 md:pt-6"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center gap-3">
          <SidebarTrigger
            aria-label="Open sidebar"
            className="mt-1 md:hidden"
          />
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
        </div>

        {companies.length ? (
          <div className="grid gap-x-6 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
            {companies.map((company) => (
              <Link
                key={company.slug}
                href={`/company/${company.slug}`}
                draggable={false}
                className="company-directory-card group block min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
              >
                <article>
                  <div className="relative">
                    <div className="aspect-[2/1] overflow-hidden rounded-xl bg-muted ring-1 ring-border/60">
                      {company.banner ? (
                        <img
                          src={company.banner}
                          alt=""
                          draggable={false}
                          className={cn(
                            "size-full object-cover",
                            company.bannerPosition ?? "object-center",
                          )}
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-5xl font-semibold text-muted-foreground/30">
                          {company.name.slice(0, 1)}
                        </div>
                      )}
                      <div className="company-directory-banner-overlay pointer-events-none absolute inset-0 rounded-xl bg-black/10 opacity-0" />
                    </div>
                    <div className="absolute -bottom-5 left-4 rounded-xl bg-background/30 p-1 shadow-xs ring-1 ring-border/75 backdrop-blur-sm">
                      <div className="rounded-lg bg-background/60">
                        {company.logo ? (
                          <img
                            src={company.logo}
                            alt=""
                            draggable={false}
                            className="size-11 rounded-lg object-contain ring-1 ring-border/25 sm:size-12"
                          />
                        ) : (
                          <span
                            className="flex size-11 items-center justify-center rounded-lg bg-muted text-lg font-semibold text-muted-foreground sm:size-12"
                            aria-hidden="true"
                          >
                            {company.name.slice(0, 1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="px-1 pt-8">
                    <h2 className="text-lg font-semibold tracking-tight">
                      {company.name}
                    </h2>
                    <span className="line-clamp-2 text-sm font-medium leading-relaxed text-muted-foreground">
                      {company.tagline}
                    </span>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge
                        variant="secondary"
                        className="h-4.5 px-1.5 text-[11px]"
                      >
                        {company.industry}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="h-4.5 px-1.5 text-[11px]"
                      >
                        <img
                          alt=""
                          aria-hidden="true"
                          draggable={false}
                          className="size-3 rounded-full"
                          src={`https://hatscripts.github.io/circle-flags/flags/${company.location.countryCode}.svg`}
                        />
                        {company.location.label}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="h-4.5 px-1.5 text-[11px]"
                      >
                        <Asterisk aria-hidden="true" />
                        {company.stage}
                      </Badge>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        ) : (
          <span className="block text-sm text-muted-foreground">
            No companies yet.
          </span>
        )}
      </div>
    </main>
  );
}
