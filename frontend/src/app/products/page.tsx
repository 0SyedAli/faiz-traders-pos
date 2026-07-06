import { DashboardLayout } from "@/components/DashboardLayout";

export default function Page() {
  return (
    <DashboardLayout title="Products">
      <div className="page-header">
        <div>
          <h2>Products</h2>
          <p>Pipe, fitting, tap, mixer, valve, sanitary ware aur variants manage karne ke liye.</p>
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
