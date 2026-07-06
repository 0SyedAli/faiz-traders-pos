import { DashboardLayout } from "@/components/DashboardLayout";

export default function Page() {
  return (
    <DashboardLayout title="Inventory">
      <div className="page-header">
        <div>
          <h2>Inventory</h2>
          <p>Shop aur godown wise stock, low stock, out of stock aur stock movements.</p>
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
