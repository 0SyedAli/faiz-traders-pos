import { DashboardLayout } from "@/components/DashboardLayout";

export default function PosPage() {
  return (
    <DashboardLayout title="POS Sale">
      <div className="page-header">
        <div>
          <h2>POS Sale</h2>
          <p>Walk-in sale, plumber khata sale, barcode search aur invoice flow.</p>
        </div>
      </div>

      <div className="pos-layout">
        <div className="card">
          <h3>Product Search</h3>
          <input className="input" placeholder="Search by name, SKU, barcode, size, brand" />
          <p className="placeholder">
            Example: elbow 1 steelex, pipe 2, tee 3/4, pak arab socket
          </p>
        </div>

        <div className="card">
          <h3>Cart</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4}>No item added yet.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3>Payment</h3>
          <div className="form-group">
            <label>Customer</label>
            <select className="select">
              <option>Walk-in Customer</option>
              <option>Plumber / Khata Customer</option>
            </select>
          </div>

          <div className="form-group">
            <label>Payment Method</label>
            <select className="select">
              <option>Cash</option>
              <option>Credit / Khata</option>
              <option>Bank</option>
              <option>JazzCash</option>
              <option>EasyPaisa</option>
            </select>
          </div>

          <button className="btn" style={{ width: "100%" }}>Save Sale</button>
        </div>
      </div>
    </DashboardLayout>
  );
}
