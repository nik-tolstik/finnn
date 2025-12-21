import { AccountBalanceChart } from "@/modules/analytics/components/AccountBalanceChart";

export default function AccountDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div>
      <h1 className="mb-4 text-3xl font-bold">Account Details</h1>
      <div className="mt-8">
        <AccountBalanceChart data={[]} />
      </div>
    </div>
  );
}

