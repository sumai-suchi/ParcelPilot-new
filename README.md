<div align="center">

# 📦 ParcelPilot
### Enterprise-Grade Logistics Orchestrator & Parcel Lifecycle Engine

[![Node.js Version](https://img.shields.io/badge/Node.js-v22.x-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5.2-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-7.9-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Stripe](https://img.shields.io/badge/Stripe-API_v22-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://stripe.com/)
[![Deployed on Vercel](https://img.shields.io/badge/Vercel-Production_Live-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://parcelpilot-two.vercel.app/)
[![Code Style: Biome](https://img.shields.io/badge/Code_Style-Biome_Fast-60A5FA?style=for-the-badge&logo=biome&logoColor=white)](https://biomejs.dev/)

<br />

**[🌐 Live API Base URL](https://parcelpilot-two.vercel.app)** • **[📑 API Documentation](#-api-reference--quickstart)** • **[🏗️ System Architecture](#️-system-architecture)** • **[🚀 Getting Started](#-getting-started)**

</div>

---

## 🌟 Executive Summary

**ParcelPilot** is a production-grade, multi-tier courier and logistics management platform engineered to power regional and nationwide delivery networks. Built using an asynchronous, event-driven architecture, ParcelPilot models complex real-world parcel operations through a deterministic **Finite State Machine (FSM)**, robust **Role-Based Access Control (RBAC)** across 5 operational tiers, automated **Hub-and-Spoke line-haul transfers**, and real-time **Stripe financial settlement**.

Whether handling thousands of daily doorstep deliveries, dispatching inter-hub transit bags, or calculating dynamic weight/distance pricing matrices, ParcelPilot delivers enterprise-grade scalability, auditability, and fault tolerance.

---

## 🚀 Key Technical Highlights

* **Deterministic Parcel State Machine**: Enforces strict transitions from pickup to proof-of-delivery (`POD`), preventing invalid operations and race conditions.
* **Immutable Audit Trail**: Every status change, delivery attempt, hub transfer, and payment update is stamped with GPS coordinates, timestamps, and operator IDs.
* **Granular Role-Based Access Control (RBAC)**: Secure authorization across 5 distinct personas: `ADMIN`, `OPERATIONS_MANAGER`, `HUB_MANAGER`, `COURIER`, and `CUSTOMER`.
* **Integrated Financial Engine**: Real Stripe payment processing via PaymentIntents, automated idempotency, multi-currency conversion (`USD` / `BDT`), Cash-On-Delivery (`COD`) reconciliations, and cryptographic webhook signature verification.
* **Topological Logistics Routing**: Real-time hub check-in/check-out scanning, bag manifest grouping, zone assignments, and line-haul vehicle tracking.
* **Optimized Serverless Architecture**: Bundled with `esbuild` for instant cold-starts and deployed as a high-availability serverless function on Vercel Node.js 22 runtime.

---

## 🏗️ System Architecture

### High-Level Domain Flow

```mermaid
flowchart TD
    Customer(["👤 Customer"]) -->|Books Parcel| API["⚡ ParcelPilot API Gateway (Express 5 + TypeScript)"]
    API --> Auth["🔐 JWT & RBAC Middleware"]
    
    subgraph "Core Business Services"
        AdminSvc["👑 Admin Governance & Analytics"]
        ShipmentSvc["📦 Parcel State Machine"]
        HubSvc["🏢 Hub & Line-Haul Routing"]
        RiderSvc["🛵 Courier Operations & POD"]
        PaymentSvc["💳 Stripe Payment & Reconciliation"]
    end
    
    Auth --> AdminSvc
    Auth --> ShipmentSvc
    Auth --> HubSvc
    Auth --> RiderSvc
    Auth --> PaymentSvc
    
    ShipmentSvc -->|ORM Queries| Prisma["🔷 Prisma ORM 7"]
    HubSvc --> Prisma
    AdminSvc --> Prisma
    RiderSvc --> Prisma
    PaymentSvc --> Prisma
    
    PaymentSvc -->|Cryptographic API| Stripe["💳 Stripe Cloud"]
    Prisma --> DB[("🐘 PostgreSQL Distributed Database")]
```

---

## 🔄 Deterministic Parcel Lifecycle (Finite State Machine)

ParcelPilot enforces state integrity throughout the delivery lifecycle. Parcels can only transition through authorized paths:

```mermaid
stateDiagram-v2
    [*] --> PENDING_APPROVAL: Customer Creates Booking
    PENDING_APPROVAL --> COURIER_ASSIGNED: OM / Hub Assigns Pickup Rider
    COURIER_ASSIGNED --> PICKED_UP: Courier Scans Parcel at Doorstep
    PICKED_UP --> AT_ORIGIN_HUB: Courier Inbounds at Local Hub
    AT_ORIGIN_HUB --> IN_TRANSIT: Hub Manager Dispatches Transfer
    IN_TRANSIT --> AT_DESTINATION_HUB: Destination Hub Receives & Unpacks
    AT_DESTINATION_HUB --> OUT_FOR_DELIVERY: Assigned to Final-Mile Courier
    
    OUT_FOR_DELIVERY --> DELIVERED: OTP Verified & Payment Collected
    OUT_FOR_DELIVERY --> DELIVERY_FAILED: Customer Unavailable / Wrong Address
    
    DELIVERY_FAILED --> RESCHEDULED: Next Attempt Slotted
    RESCHEDULED --> OUT_FOR_DELIVERY: Re-dispatched
    
    DELIVERY_FAILED --> RETURN_INITIATED: Max Retries Exceeded
    RETURN_INITIATED --> RETURN_IN_TRANSIT: Routed back to Origin Hub
    RETURN_IN_TRANSIT --> RETURNED: Handed Back to Merchant
    
    DELIVERED --> [*]
    RETURNED --> [*]
```

---

## 👥 Multi-Tier Persona & Permission Matrix

ParcelPilot implements strict principle-of-least-privilege security across 5 core roles:

| Role | Key Permissions & Responsibilities |
| :--- | :--- |
| **👑 ADMIN** | Platform oversight, system settings, global revenue analytics, workforce onboarding, hub/zone infrastructure CRUD, dynamic pricing rule configuration. |
| **📋 OPERATIONS MANAGER** | Regional shipment triage, fleet dispatch, inter-hub line-haul scheduling, rider workload rebalancing, operational exception resolution. |
| **🏢 HUB MANAGER** | Inbound rider parcel check-in, transfer bag manifest creation, line-haul dispatch/receive, destination sortation, delivery route allocation. |
| **🛵 COURIER (RIDER)** | Pickup task completion, doorstep delivery execution, Cash-On-Delivery collection, OTP/PIN validation, digital proof of delivery capture. |
| **👤 CUSTOMER** | Instant parcel booking, live shipment tracking, dynamic pricing quotation, Stripe card payment, delivery history review. |

---

## 💳 Stripe Payment & Reconciliation Pipeline

ParcelPilot eliminates payment leakage with a zero-trust financial workflow:

1. **PaymentIntent Generation**: Secure server-side calculation against weight-based pricing rules (`POST /api/v1/payment/create-payment-intent/:shipmentId`).
2. **Client-Side Confirmation**: Frontend/Mobile client collects card token using Stripe Elements or Apple Pay / Google Pay.
3. **Synchronous Verification**: Server validates Stripe intent state and transitions payment to `PAID` (`POST /api/v1/payment/confirm/:shipmentId`).
4. **Cryptographic Webhook Ingestion**: Webhooks (`POST /api/v1/payment/webhook`) verify `stripe-signature` via raw buffer payloads to handle out-of-band updates and refunds reliably.

---

## 📑 API Reference & Quickstart

### Base URLs:
- **Production**: `https://parcelpilot-two.vercel.app`
- **Local Dev**: `http://localhost:5000`

### 1. Public & Authentication Endpoints
```http
POST /api/v1/auth/register          # Register new customer
POST /api/v1/auth/login             # Authenticate & retrieve JWT
POST /api/v1/auth/refresh-token     # Rotate JWT session tokens
GET  /api/v1/auth/me                # Get authenticated profile
```

### 2. Admin Governance & Platform Operations
```http
GET    /api/v1/admin/dashboard/overview     # Real-time KPIs, revenue & parcel status counts
GET    /api/v1/admin/users                  # Manage workforce (filter by role/status)
POST   /api/v1/admin/users                  # Onboard Hub Manager, Ops Manager, Courier
PATCH  /api/v1/admin/users/:id              # Update staff role or status (ACTIVE/SUSPENDED)
GET    /api/v1/admin/zones                  # List logistics operational zones
POST   /api/v1/admin/zones                  # Create geographic delivery zone
GET    /api/v1/admin/hubs                   # Manage regional sorting hubs
POST   /api/v1/admin/hubs                   # Provision new sorting hub
GET    /api/v1/admin/pricing                # View dynamic weight pricing rules
POST   /api/v1/admin/pricing                # Create pricing rule (base charge, per kg rate)
GET    /api/v1/admin/analytics/revenue      # Revenue breakdown by provider (Stripe/COD)
GET    /api/v1/admin/analytics/performance  # Delivery success rate vs failed attempts
GET    /api/v1/admin/reports/hub-volume     # Hub throughput (inbound, outbound, transfers)
```

### 3. Courier / Rider Delivery Execution
```http
GET    /api/v1/courier/dashboard            # Rider today's task overview & stats
GET    /api/v1/courier/tasks                # Assigned pickups and deliveries
PATCH  /api/v1/courier/shipments/:id/pickup # Complete doorstep pickup
PATCH  /api/v1/courier/shipments/:id/deliver# Complete delivery (with COD or Stripe confirmation)
POST   /api/v1/courier/shipments/:id/attempt# Record failed delivery attempt with reason
```

### 4. Stripe Financial Processing
```http
POST   /api/v1/payment/create-payment-intent/:shipmentId  # Initialize real Stripe payment
POST   /api/v1/payment/confirm/:shipmentId               # Confirm and finalize payment
GET    /api/v1/payment/status/:shipmentId                # Inspect transaction status
POST   /api/v1/payment/webhook                           # Secure Stripe webhook receiver
```

---

## 💻 Tech Stack & Engineering Decisions

| Category | Technology | Rationale |
| :--- | :--- | :--- |
| **Language** | **TypeScript 5.9** | Strict type safety, self-documenting code, zero `any` leaks across domain entities. |
| **Runtime** | **Node.js 22 (ESM)** | Native ES Modules, high performance asynchronous I/O, modern standard library. |
| **Framework** | **Express 5.2** | Clean middleware architecture, battle-tested HTTP routing, native async error handling. |
| **Database & ORM** | **PostgreSQL + Prisma 7** | Strongly typed relational schema, declarative migrations, automated query optimization. |
| **Payments** | **Stripe Official SDK** | PCI-DSS compliant digital transactions, automated webhook signature verification. |
| **Bundler** | **esbuild** | Ultra-fast bundling (under 10ms) yielding a clean single-file serverless artifact (`api/index.js`). |
| **Deployment** | **Vercel Serverless** | Scalable edge delivery, global CDN, auto-scaling compute with near-zero latency. |
| **Lint & Format** | **Biome** | Modern, Rust-powered linter and formatter replacing ESLint/Prettier for 20x faster checks. |

---

## 🛠️ Getting Started (Local Development)

### Prerequisites
- **Node.js**: `v20.x` or `v22.x`
- **PostgreSQL**: `v14+` or cloud instance (Supabase, Neon, AWS RDS)
- **Stripe Account**: Free developer test keys from [dashboard.stripe.com](https://dashboard.stripe.com)

### 1. Clone & Install
```bash
git clone https://github.com/sumai-suchi/ParcelPilot.git
cd ParcelPilot
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://user:password@localhost:5432/parcelpilot?schema=public"

# JWT Secrets
JWT_ACCESS_SECRET="your_jwt_access_secret_key"
JWT_ACCESS_EXPIRES_IN="7d"
JWT_REFRESH_SECRET="your_jwt_refresh_secret_key"
JWT_REFRESH_EXPIRES_IN="30d"

# Stripe Payment Gateway
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_CURRENCY="usd"

# Platform Defaults
FRONTEND_URL="http://localhost:3000"
```

### 3. Database Migration & Seeding
```bash
# Push schema migrations to PostgreSQL
npx prisma db push

# Generate Prisma Client
npx prisma generate

# Seed sample hubs, zones, users, and pricing rules
npm run seed
```

### 4. Run the Application
```bash
# Start local development server with hot-reload
npm run dev

# Format and lint codebase
npm run format:check
npm run lint:check

# Production build
npm run build
```

---

## 🧪 Testing with Postman & Sample Credentials

When you run `npm run seed`, the database is populated with sample accounts for all roles:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Super Admin** | `superadmin@gmail.com` | `Super@admin12345` |
| **Operations Manager**| `ops@parcelpilot.com` | `Ops@123456` |
| **Hub Manager** | `hubmgr@parcelpilot.com` | `Hub@123456` |
| **Courier Rider** | `courier@parcelpilot.com` | `Rider@123456` |
| **Customer** | `customer@parcelpilot.com`| `Customer@123456` |

---

## 📈 Scalability & Future Roadmap

- [x] Full Courier Delivery FSM & Lifecycle Auditing
- [x] Stripe Real Payment Processing & Webhooks
- [x] Enterprise Admin Dashboard & Operational Reports
- [x] Zero-Config Vercel Serverless Production Deployment
- [ ] Redis-backed real-time courier geo-tracking & route optimization
- [ ] Automated SMS / WhatsApp delivery notification triggers via Twilio
- [ ] Barcode / QR Code mobile scanning integration with React Native

---

## 👩‍💻 Author & Contact

**Sumaiya Suchi**  
Full-Stack & Backend Software Engineer  
* Passionate about building robust distributed systems, scalable APIs, and real-time logistics architectures.
* GitHub: [@sumai-suchi](https://github.com/sumai-suchi)
* Project Live URL: [https://parcelpilot-two.vercel.app](https://parcelpilot-two.vercel.app)

---

<div align="center">
  <sub>Engineered with precision for modern logistics. Built with Node.js, Express, Prisma, and PostgreSQL.</sub>
</div>
