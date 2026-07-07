# My Store POS ERP Backend

Admin-only backend for sanitary POS + mini ERP.

## Setup

```bash
cd backend
npm install
copy .env.example .env
npm run seed
npm run dev
```

API health check:

```txt
http://localhost:5001/health
```

Default admin after seed:

```txt
Email: admin@mystore.com
Password: admin123456
```

## Current APIs

```txt
POST /api/auth/login
GET  /api/auth/me

GET/POST/PUT/DELETE /api/master/brands
GET/POST/PUT/DELETE /api/master/categories
GET/POST/PUT/DELETE /api/master/units
GET/POST/PUT/DELETE /api/master/sizes
GET/POST/PUT/DELETE /api/master/warehouses

GET/POST /api/products
GET/POST /api/products/variants
GET/PUT  /api/products/variants/:id

GET  /api/inventory/stocks
POST /api/inventory/adjust-stock
GET  /api/inventory/low-stock
GET  /api/inventory/out-of-stock
GET  /api/inventory/movements

GET/POST /api/customers
GET /api/customers/:id/ledger
POST /api/customers/:id/receive-payment

GET /api/dashboard

GET/POST /api/expenses
GET/POST /api/expenses/categories
```


## Inventory Transfer APIs

```txt
POST /api/inventory/transfer
GET  /api/inventory/transfers
GET  /api/inventory/valuation
```


## Supplier APIs

```txt
GET/POST /api/suppliers
GET/PUT/DELETE /api/suppliers/:id
GET /api/suppliers/:id/ledger
POST /api/suppliers/:id/pay
```

## Purchase APIs

```txt
GET/POST /api/purchases
GET /api/purchases/:id
```


## Settings APIs

```txt
GET /api/settings
PUT /api/settings
```

## Reports APIs

```txt
GET /api/reports/summary
GET /api/reports/expenses-by-category
GET /api/reports/top-stock
GET /api/reports/stock-movements
```


## Customer APIs

```txt
GET/POST /api/customers
GET /api/customers/summary
GET/PUT/DELETE /api/customers/:id
GET /api/customers/:id/ledger
POST /api/customers/:id/receive-payment
POST /api/customers/:id/adjustment
```


## Sales APIs

```txt
GET /api/sales/pos-products?warehouseId=...&q=...
GET /api/sales
POST /api/sales
GET /api/sales/:id
```
