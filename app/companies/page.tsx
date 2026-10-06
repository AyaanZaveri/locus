import { SidebarTrigger } from "@/components/ui/sidebar";
import { CompaniesDirectory } from "@/components/companies-directory";
import { getCompanyDirectory } from "@/lib/company-profile";

export default async function CompaniesPage() {
  const companies = await getCompanyDirectory();

  return (
    <main
      id="top"
      className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 pb-20 pt-6 sm:px-6 md:px-8 md:pt-7"
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
  );
}
