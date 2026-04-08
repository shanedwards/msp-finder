import { CompanyDetailView } from "./_components/company-detail-view";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="min-h-screen px-4 pb-12 pt-6">
      <div className="max-w-5xl mx-auto">
        <CompanyDetailView companyId={id} />
      </div>
    </main>
  );
}
