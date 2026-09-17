import { notFound } from "next/navigation";

import { CompanyProfilePage } from "@/components/company-profile-page";
import { getCompanies, getCompanyProfile } from "@/lib/company-profile";

export async function generateStaticParams() {
  return (await getCompanies()).map(({ slug }) => ({ slug }));
}

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await getCompanyProfile(slug);

  if (!profile) {
    notFound();
  }

  return <CompanyProfilePage profile={profile} />;
}
