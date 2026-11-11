# CarChain

A blockchain-based vehicle marketplace built to eliminate fraud through digital passports and transparent vehicle history.

> **Status:** Phase 1 Complete — Authentication & Core Infrastructure

---

## Quick Start

### Prerequisites

- Node.js v18+ (detected: v24.16.0)
- npm 11+ (detected: v11.13.0)
- MongoDB 8.3 (installed at `C:\Program Files\MongoDB\Server\8.3\bin\`)

### 1. Start MongoDB

MongoDB is installed but not on your PATH. Start it manually:

```powershell
# Option A: Use the MongoDB service (if installed as a Windows service)
Start-Service MongoDB

# Option B: Start manually (create data dir first)
New-Item -ItemType Directory -Force -Path "C:\data\db"
& "C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe" --dbpath "C:\data\db"
```

Or install MongoDB Compass (GUI) for easy management.

### 2. Install Backend Dependencies

```powershell
cd backend
npm install
```

### 3. Configure Environment

```powershell
# backend/.env is already created with defaults:
# MONGODB_URI=mongodb://localhost:27017/carchain
# JWT_SECRET=carchain_dev_secret_key_replace_in_production_2024
# PORT=5000
```

### 4. Seed the Database (optional but recommended)

```powershell
cd backend
node utils/seed.js
```

This creates test accounts:
| Role      | Email                  | Password    |
|-----------|------------------------|-------------|
| Admin     | admin@carchain.dev     | Admin123!   |
| Buyer     | buyer@carchain.dev     | Buyer123!   |
| Seller    | seller@carchain.dev    | Seller123!  |
| Garage    | garage@carchain.dev    | Garage123!  |

### 5. Start the Backend

```powershell
cd backend
npm run dev      # Development (auto-restart with nodemon)
# OR
npm start        # Production
```

Backend runs at: `http://localhost:5000`

### 6. Open the Frontend

Open `frontend/index.html` directly in your browser, or use a local server:

```powershell
# Using VS Code Live Server (recommended)
# Right-click frontend/index.html → Open with Live Server

# Or use npx serve:
npx serve frontend -p 3000
```

---

## Project Structure

```
CarChain/
├── frontend/
│   ├── index.html              # Landing page
│   ├── css/
│   │   ├── global.css          # Design system & shared styles
│   │   ├── landing.css         # Landing page styles
│   │   ├── auth.css            # Login/Register styles
│   │   └── dashboard.css       # Dashboard shared styles
│   ├── js/
│   │   ├── api.js              # API client (all backend calls)
│   │   └── utils.js            # UI utilities (Toast, FormHelper, etc.)
│   └── pages/
│       ├── login.html
│       ├── register.html
│       ├── marketplace.html
│       ├── dashboard.html      # Role-adaptive user dashboard
│       └── admin-dashboard.html
├── backend/
│   ├── server.js               # Express entry point
│   ├── config/
│   │   └── database.js         # MongoDB connection
│   ├── models/
│   │   ├── User.js
│   │   ├── Vehicle.js
│   │   ├── Listing.js
│   │   ├── MaintenanceRecord.js
│   │   ├── InspectionCertificate.js
│   │   └── Transaction.js
│   ├── controllers/
│   │   ├── authController.js
│   │   └── adminController.js
│   ├── middleware/
│   │   ├── auth.js             # JWT protect + authorize
│   │   ├── validate.js         # express-validator middleware
│   │   └── errorHandler.js     # Global error handler
│   ├── routes/
│   │   ├── auth.js
│   │   └── admin.js
│   └── utils/
│       ├── asyncHandler.js
│       ├── tokenUtils.js
│       ├── validators.js
│       └── seed.js
└── blockchain/
    └── contracts/              # Solidity placeholders (Phase 4)
        ├── VehicleRegistry.sol
        └── CarChainEscrow.sol
```

---

## API Endpoints

### Authentication & Admin
| Method | Endpoint                        | Access    | Description                  |
|--------|---------------------------------|-----------|------------------------------|
| GET    | /api/health                     | Public    | Server health check          |
| POST   | /api/auth/register              | Public    | Register new user            |
| POST   | /api/auth/login                 | Public    | Login, receive JWT           |
| GET    | /api/auth/me                    | Protected | Get current user profile     |
| PUT    | /api/auth/profile               | Protected | Update profile               |
| PUT    | /api/auth/change-password       | Protected | Change password              |
| GET    | /api/admin/stats                | Admin     | Platform statistics          |
| GET    | /api/admin/users                | Admin     | List all users (paginated)   |
| PUT    | /api/admin/users/:id/approve    | Admin     | Approve garage/inspector     |
| PUT    | /api/admin/users/:id/reject     | Admin     | Reject application           |
| PUT    | /api/admin/users/:id/toggle-active | Admin  | Activate/deactivate account  |

### Vehicles & Digital Passports (Phase 2)
| Method | Endpoint                        | Access         | Description                            |
|--------|---------------------------------|----------------|----------------------------------------|
| POST   | /api/vehicles                   | Seller / Admin | Register vehicle & create passport     |
| GET    | /api/vehicles/user/my-vehicles  | Protected      | List seller's registered vehicles      |
| GET    | /api/vehicles/:id               | Public         | Get vehicle specs by ID                |
| GET    | /api/vehicles/:id/passport      | Public         | Get complete digital passport timeline |
| GET    | /api/vehicles/vin/:vin          | Public         | Lookup digital passport by VIN         |
| POST   | /api/vehicles/upload-image      | Protected      | Upload vehicle image (Multer)          |

### Maintenance & Inspections (Phase 3)
| Method | Endpoint                             | Access            | Description                                  |
|--------|--------------------------------------|-------------------|----------------------------------------------|
| POST   | /api/maintenance                     | Approved Garage   | Log certified maintenance & update odometer  |
| GET    | /api/maintenance/user/my-records     | Garage / Admin    | Get all records logged by current garage     |
| GET    | /api/maintenance/vehicle/:vehicleId  | Public            | Get maintenance history for vehicle          |
| GET    | /api/maintenance/:id                 | Public            | Get single maintenance record details        |
| POST   | /api/inspections                     | Approved Inspector| Issue technical inspection certificate       |
| GET    | /api/inspections/user/my-inspections | Inspector / Admin | Get all certificates issued by inspector     |
| GET    | /api/inspections/vehicle/:vehicleId  | Public            | Get inspection history for vehicle           |
| GET    | /api/inspections/:id                 | Public            | Get single certificate with 12-pt checklist  |

---

## Development Roadmap

### ✅ Phase 1 — Foundation (Complete)
- Project structure & clean architecture
- MongoDB models (Users, Vehicles, Listings, MaintenanceRecords, InspectionCertificates, Transactions)
- Express API with security middleware & input validation
- JWT authentication & role-based authorization (Buyer, Seller, Garage, Inspector, Admin)
- Landing page, Login, Registration, Adaptive Dashboard, Admin Dashboard

### ✅ Phase 2 — Vehicle Marketplace & Digital Passport (Complete)
- Vehicle registration API & Digital Passport generation
- Marketplace API (filtering by bodyType, fuelType, transmission, price, year, mileage; keyword search, sorting)
- Vehicle card marketplace page (`marketplace.html`) with dynamic filters & pagination
- Detailed vehicle page (`vehicle-details.html`) with specs, photo gallery, seller card, and simulated purchase flow
- Digital Vehicle Passport page (`passport.html`) with VIN lookup, verification badge, and chronological history timeline
- Seller Studio dashboard (`seller-dashboard.html`) with vehicle registration modal and listing manager
- Seeded diverse inventory of demo vehicles and verified records

### ✅ Phase 3 — Certified Records & Inspection Management (Complete)
- Certified Garage maintenance logging API with anti-rollback fraud prevention
- Certified Inspector 12-point technical safety inspection & certificate issuance API
- Garage Dashboard (`garage-dashboard.html`) with live service logging modal and records table
- Inspector Dashboard (`inspector-dashboard.html`) with interactive 12-point checklist modal and certificate history
- Digital Passport dynamic updates: maintenance entries and inspection checklist badges automatically populate into the timeline
- Strict role authorization: only administrator-approved garages and inspectors can write verified records

### 🔜 Phase 4 — Simulated Purchase & Blockchain Integration
- Simulated purchase and escrow state transitions
- Solidity contracts (VehicleRegistry ERC-721 and CarChainEscrow)
- MetaMask wallet connect integration
- Immutable on-chain record hashing

---

## Security Notes

- Passwords are hashed with bcrypt (12 rounds)
- JWT tokens expire in 7 days
- Rate limiting: 200 req/15min globally, 20 req/15min on auth routes
- Helmet.js security headers
- Input validation on both client and server
- Admin accounts cannot be registered via public API
- Garage/Inspector accounts require admin approval
- Blockchain records (Phase 4) will be immutable on-chain
