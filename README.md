# Hotel OMS - Backend Service

High-performance, multi-tenant backend API for the Hotel Order Management System (OMS). Built with Node.js, Express, MongoDB (Mongoose), Socket.io, and Firebase Admin SDK.

---

## 📚 Documentation Quick Links

* 🏗️ **[System Architecture Guide](file:///Users/sumitraj/Documents/HotelOms/backend/ARCHITECTURE.md)** — Architectural patterns, request execution lifecycle, concurrency control, idempotency layer, and security boundaries.
* 🗄️ **[Database Design Specifications](file:///Users/sumitraj/Documents/HotelOms/backend/DATABASE_DESIGN.md)** — Comprehensive ER diagrams, collection schemas, data types, compound indexes, and relationship specs.
* 📑 **[API Endpoint Specs](file:///Users/sumitraj/Documents/HotelOms/backend/API_DOCS/README.md)** — Detailed API documentation for all endpoints.

---

## 🛠️ Features

* **Multi-Tenant Branch Architecture**: Native branch isolation with role-based and permission-based access control.
* **Hybrid Authentication**: Dual support for Firebase Social Auth / ID Tokens and local JWTs.
* **Concurrent Inventory Safety**: Database transactions and atomic conditional updates prevent overselling inventory.
* **Financial Calculations Engine**: Precise integer-cent arithmetic (`MathUtils`) eliminates JavaScript floating-point errors.
* **Idempotency Protection**: SHA-256 request fingerprinting prevents double-charging and duplicate transactions on network retries.
* **Realtime Kitchen & Order Sync**: Socket.io channels with membership-verified room isolation.
* **SaaS Gating & Limits**: Automatic plan feature gating and resource quotas (dishes, tables, staff).

---

## 🚀 Getting Started

### Prerequisites

* **Node.js**: v18.0.0 or higher
* **MongoDB**: v6.0 or higher (replica set required for Mongo transactions)
* **npm**: v9.0.0 or higher

### Environment Configuration

Create a `.env` file in the `backend/` root directory (see `.env.example`):

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/hotel_oms
JWT_SECRET=your_jwt_secret_key_here

# Firebase Configuration (Optional)
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Web Push Notifications (Optional)
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:admin@example.com
```

### Installation & Execution

```bash
# 1. Install dependencies
npm install

# 2. Run seed script for initial roles/plans
npm run seed

# 3. Start development server (nodemon)
npm run dev

# 4. Start production server
npm start
```

---

## 🧪 Testing

The test suite runs on Node's native test runner (`node --test`), providing rapid execution without external test framework overhead.

```bash
# Run all unit and integration tests
npm test
```

Current Test Status: **40/40 tests passing**

---

## 📁 Repository Structure

```
backend/
├── API_DOCS/             # Detailed API endpoint reference docs
├── ARCHITECTURE.md       # Technical architecture audit & system guide
├── DATABASE_DESIGN.md    # ER diagrams and database schema reference
├── README.md             # Main project readme
├── src/
│   ├── app.js            # Express application setup & middleware assembly
│   ├── server.js         # HTTP server boot & database connection
│   ├── config/           # Database, env, socket, and CORS configurations
│   ├── controllers/      # Route logic grouped by domain
│   ├── middleware/       # Auth, branch scope, permissions, rate-limiters
│   ├── models/           # Mongoose schemas (core, finance, users, etc.)
│   ├── routes/           # Express router declarations
│   ├── seed/             # Database seeder scripts
│   └── utils/            # Shared business helpers (math, idempotency, etc.)
└── test/                 # Test suites for Node test runner
```

---

## 🛡️ Security & Auditing

* **Tenant Security**: All data access requires valid branch memberships enforced via `branchScope.js`.
* **Platform Security**: Platform-admin features require explicit platform administrator validation.
* **Audit Logs**: Forensics logging tracks HTTP request IDs, IP addresses, user agents, and mutation metadata in `ActivityLog`.
