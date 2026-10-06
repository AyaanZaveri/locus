import { SidebarTrigger } from "@/components/ui/sidebar";
import { CompaniesDirectory } from "@/components/companies-directory";
import { getCompanyDirectory } from "@/lib/company-profile";
import { SoulCover } from "@/components/soul-cover";
import { getSoulCoverSeed } from "@/lib/soul-cover";

export default async function CompaniesPage() {
  const companies = await getCompanyDirectory();

  return (
    <div className="relative isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-55 [mask-image:linear-gradient(to_bottom,black,transparent)] sm:h-80 dark:h-96 dark:opacity-30 dark:sm:h-112"
      >
        <SoulCover
          seed={getSoulCoverSeed("locus-companies")}
          grainOverlay={0.2}
          variant="backdrop"
        />
        <div className="absolute inset-0 bg-linear-to-r from-background/10 to-background/90" />
      </div>
      <main
        id="top"
        className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-20 pt-6 [scrollbar-gutter:stable] sm:px-6 md:px-8 md:pt-7"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex items-center gap-3">
            <SidebarTrigger
              aria-label="Open sidebar"
              className="mt-1 md:hidden"
            />
            <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
          </div>
          <CompaniesDirectory companies={companies} />
        </div>
      </main>
    </div>
  );
}
