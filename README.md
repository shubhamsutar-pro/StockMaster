# StockMaster - Inventory Management System

A modern, full-stack inventory management system for managing stock across multiple warehouses.

## Features

- **Dashboard** - Overview with key metrics and low stock alerts
- **Products Management** - CRUD operations for products
- **Warehouses Management** - Manage warehouse locations
- **Stock Tracking** - Real-time stock levels per warehouse
- **Receipts** - Incoming stock management
- **Deliveries** - Outgoing stock management
- **Transfers** - Internal warehouse transfers
- **Stock Adjustments** - Manual stock corrections
- **Movement History** - Complete audit trail

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS + Shadcn UI (Poppins font)
- **Backend**: Lovable Cloud (Supabase)
- **Database**: PostgreSQL with Row Level Security

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run the development server**:
   ```bash
   npm run dev
   ```

3. **Access the app**: Open http://localhost:8080

4. **Sign up/Login**: Create an account at `/auth`

## Backend Logic

Stock updates are handled by backend edge functions located in `supabase/functions/`:

- **complete-receipt** - Increases stock when receipts are marked Completed
- **complete-delivery** - Decreases stock (validates availability) when deliveries are Completed
- **complete-transfer** - Moves stock between warehouses when transfers are Completed
- **create-adjustment** - Sets stock to new quantity and logs the change

All operations create movement records for full audit trail.

## Database Schema

- `products` - Product catalog
- `warehouses` - Warehouse locations
- `stock` - Current stock levels (product + warehouse)
- `receipts` - Incoming stock orders
- `delivery_orders` - Outgoing stock orders
- `transfers` - Inter-warehouse movements
- `stock_adjustments` - Manual corrections
- `movements` - Complete movement ledger

## Development Notes

- Email confirmation is auto-enabled for faster testing
- RLS policies ensure authenticated access only
- Backend functions prevent negative stock
