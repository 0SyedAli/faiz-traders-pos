import { DashboardLayout } from "@/components/DashboardLayout";

export default function Page() {
  return (
    <DashboardLayout title="Suppliers">
      <div className="page-header">
        <div>
          <h2>Suppliers</h2>
          <p>Supplier payable, payments aur ledger.</p>
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
