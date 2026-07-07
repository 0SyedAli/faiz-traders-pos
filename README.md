# My Store POS + Mini ERP

Admin-only POS + mini ERP starter code for sanitary business.

## Includes

```txt
backend/  Node.js + Express + TypeScript + MongoDB + Mongoose
frontend/ Next.js dashboard skeleton
```

## First Run

### 1. Backend

```bash
cd backend
npm install
copy .env.example .env
npm run seed
npm run dev
```

Backend runs on:

```txt
http://localhost:5001
```

### 2. Frontend

Open new terminal:

```bash
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

Frontend runs on:

```txt
http://localhost:3000
```

## Default Admin

```txt
Email: admin@mystore.com
Password: admin123456
```

## Business Defaults Included

```txt
Brands: Steelex, Pak Arab, Aerofit, Other
Sizes: 1/2, 3/4, 1, 1.25, 1.5, 2, 3, 4, 5, 6
Warehouses: Main Shop, Godown 1
Units: Piece, Box, Dozen, Feet, Meter, Bundle, Carton, Set, Length
Expense Categories: Rent, Electricity, Salary, Transport, Loading / Unloading, Repairs, Tea / Food, Internet, Miscellaneous
Default Customer: Walk-in Customer
```

## Current Build Status

Done:

```txt
Admin login backend
Default seed data
Master data APIs
Product and variant models/APIs
Warehouse-wise stock
Manual stock adjustment
Stock movements
Customer/plumber khata model
Customer payment API
Expense APIs
Dashboard stats API
Next.js dashboard skeleton
```

Next:

```txt
Complete product UI form
Inventory UI
POS cart API + UI
Purchase API
Plumber khata sale flow
Sales return flow
PDF invoice
Reports
```


## Update v2

Products UI completed:

```txt
Create/edit/delete product
Create/edit/delete product variant
Search variants by name/SKU/barcode/brand/size/category
Pipe 20ft preset
Fitting preset
Retail, wholesale, plumber, dealer price fields
Size, brand, category, unit dropdowns
```

Backend product APIs completed:

```txt
GET/POST/PUT/DELETE /api/products
GET/POST/PUT/DELETE /api/products/variants
```


## Update v3

Inventory + godown system completed:

```txt
Opening stock / exact stock adjustment
Warehouse-wise stock list
Search stock by item/SKU/brand/size/warehouse
Low stock and out of stock indicators
Inventory valuation by purchase and retail value
Godown to shop stock transfer
Multi-item stock transfer
Recent transfer history
Stock movement history with filters
```

Backend added:

```txt
StockTransfer model
POST /api/inventory/transfer
GET  /api/inventory/transfers
GET  /api/inventory/valuation
```

Note: Inventory transfer API is local MongoDB friendly and does not require a replica set transaction setup.


## Update v4

Purchase + supplier module completed:

```txt
Supplier CRUD
Supplier opening payable balance
Supplier payable ledger
Supplier payment entry
Purchase create
Purchase history
Multi-item purchase
Purchase stock auto-increase in selected warehouse/godown
Supplier payable auto-update
Supplier ledger auto-update
Stock movement auto-create for purchases
```

Backend added:

```txt
backend/src/modules/suppliers/supplier.routes.ts
backend/src/modules/purchases/purchase.routes.ts
```

Frontend updated:

```txt
frontend/src/app/suppliers/page.tsx
frontend/src/app/purchases/page.tsx
```


## Update v5

Expenses, reports, and settings pages completed:

```txt
Expense CRUD
Expense category CRUD
Expense date/category filters
Reports summary cards
Expenses by category report
Inventory value report
Low/out stock report
Stock movement report
Business settings update
Brands/categories/sizes/units quick management
Warehouses/godowns quick management
```

Backend added:

```txt
backend/src/modules/settings/settings.routes.ts
backend/src/modules/reports/report.routes.ts
```

Frontend completed:

```txt
frontend/src/app/expenses/page.tsx
frontend/src/app/reports/page.tsx
frontend/src/app/settings/page.tsx
```


## Update v6

Customers / plumbers khata module completed:

```txt
Customer/plumber/contractor/dealer CRUD
Customer search and type filter
Opening balance support
Customer ledger
Receive payment
Manual debit/credit adjustment
Customer balance summary
Total khata/udhaar dashboard cards
Delete safety for walk-in, balance, and sales history
```

Backend updated:

```txt
backend/src/modules/customers/customer.routes.ts
```

Frontend completed:

```txt
frontend/src/app/customers/page.tsx
```


## Update v7

POS sales module completed:

```txt
POS product search by warehouse/shop
Search by name/SKU/barcode
Add to cart
Quantity, price, line discount
Bill discount
Walk-in sale
Plumber/dealer/wholesale sale type pricing
Cash/bank/easypaisa/jazzcash/mixed payment
Credit/khata sale for non-walk-in customers
Stock auto-decrease
Customer ledger auto-update for due/khata
Today sales list
Last invoice summary
```

Backend added:

```txt
backend/src/modules/sales/sale.routes.ts
```

Frontend completed:

```txt
frontend/src/app/pos/page.tsx
```


## Update v8

Sales returns / plumber leftover return module completed:

```txt
Select sale invoice
View returnable items
Prevent return quantity greater than sold/remaining
Return resellable items to stock
Mark returned items as damaged
Stock movement for returns/damaged returns
Adjust plumber/customer khata balance
Cash/no-refund return options
Return history
Sidebar link for Sales Returns
```

Backend added:

```txt
backend/src/models/SalesReturn.ts
backend/src/modules/salesReturns/salesReturn.routes.ts
```

Frontend added:

```txt
frontend/src/app/sales-returns/page.tsx
```
