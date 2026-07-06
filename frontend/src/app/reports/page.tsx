import { DashboardLayout } from "@/components/DashboardLayout";

export default function Page() {
  return (
    <DashboardLayout title="Reports">
      <div className="page-header">
        <div>
          <h2>Reports</h2>
          <p>Daily/monthly sales, profit/loss, khata, supplier payable aur stock valuation.</p>
        </div>
      </div>

      <div className="card">
        <p className="placeholder">
          Ye page scaffold ready hai. Iske backend models/API foundation zip me
          included hain. Next step me is page ka complete form, table aur API integration add karenge.
        </p>
      </div>
    </DashboardLayout>
  );
}
