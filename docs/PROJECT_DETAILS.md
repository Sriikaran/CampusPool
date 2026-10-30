# CampusLoop — Technical Project Documentation

## 1. Project Overview & Background

College campuses are dynamic communities where students frequently acquire textbooks, calculators, lab instruments, electronic components, and drafting tools that they only need for a single semester or academic year. Once the semester concludes, these valuable educational resources often sit idle in dorm rooms, while junior students are forced to purchase identical items at retail prices.

Existing commercial classifieds and e-commerce platforms do not address campus-specific dynamics:
- They impose shipping fees and multi-day delivery delays for individuals situated within walking distance of each other.
- They charge commission or processing fees on peer-to-peer exchanges.
- They introduce unnecessary friction for simple lending or semester-long borrowing arrangements.

**CampusLoop** is designed specifically to solve this problem as a campus-focused peer-to-peer exchange network. It provides a lightweight digital bulletin board and request coordination system where students can discover, sell, lend, borrow, or exchange academic essentials.

---

## 2. Core Philosophy: Offline Campus Exchange

CampusLoop is **not** an e-commerce platform.

It intentionally omits:
- Payment gateways, digital wallets, or credit card processing.
- Checkout carts and escrow systems.
- Shipping, courier tracking, or home delivery logistics.

Instead, CampusLoop acts as a matchmaker. When a student discovers an essential item, they submit a digital request explaining their need. When the item owner accepts the request:
1. Contact information (college email and phone number) is safely exchanged between the two parties.
2. The students independently contact each other via call, text, or email.
3. They agree upon a convenient, safe meeting point on campus (e.g., college library, canteen, department lobby).
4. Handover and offline settlement occur directly between the students.

---

## 3. System Architecture & Components

CampusLoop is architected as a decoupled, containerized client-server system:

```
┌────────────────────────────────────────────────────────┐
│                      Client Browser                    │
│   Vanilla JS (app.js), Semantic HTML5, Modern CSS3     │
└───────────────────────────▲────────────────────────────┘
                            │ REST API (JSON) / HTTP
┌───────────────────────────▼────────────────────────────┐
│                  Express.js Web Server                 │
│   - Static Asset Middleware (public/)                  │
│   - API Routers (/api/items, /api/requests)            │
│   - Contact Privacy & Sanitization Filters             │
│   - Centralized Error Handling (Validation, CastError) │
└───────────────────────────▲────────────────────────────┘
                            │ Mongoose ODM
┌───────────────────────────▼────────────────────────────┐
│                      MongoDB 7.0                       │
│   - Database: campusloop                               │
│   - Collections: items, exchangerequests               │
│   - Volume: campusloop-data (Persistent Storage)       │
└────────────────────────────────────────────────────────┘
```

### Component Responsibilities:

- **Frontend (`public/`)**:
  - `index.html`: Responsive, accessible single-page layout featuring Hero, Statistics Strip, Marketplace Grid with category/type filters, Item Listing form, and modular modal dialogs for request submissions and request management.
  - `styles.css`: Custom CSS styling utilizing CSS variables, responsive CSS Grid / Flexbox layouts, and status-coded badge indicators.
  - `app.js`: Lightweight asynchronous client that interfaces with the Express REST API via native `fetch`, handles debounced search queries, dialog triggers, and dynamic status updates.

- **Backend (`src/`)**:
  - `server.js`: Initializes Express, mounts static directories, connects to MongoDB via Mongoose, exposes system health (`/api/health`) and real-time statistics (`/api/stats`), and provides centralized error-handling.
  - `routes/itemRoutes.js`: Handles listing retrieval, full-text regex search, category filtering, listing creation, updates, and cascading deletion.
  - `routes/requestRoutes.js`: Enforces the exchange request lifecycle, contact privacy filters, and atomic state transitions.

- **Data Layer (`src/models/`)**:
  - `Item.js`: Schema defining listed campus items, categorized by type (`Sell`, `Borrow`, `Exchange`) and status (`Available`, `Reserved`, `Unavailable`, `Completed`).
  - `ExchangeRequest.js`: Schema tracking requests submitted by students, associated with items, and updated through statuses (`Pending`, `Accepted`, `Declined`, `Completed`, `Returned`).

---

## 4. Data Models & Schemas

### 4.1 Item Schema (`items` collection)

| Field | Type | Required | Constraints / Enums | Description |
|---|---|---|---|---|
| `title` | String | Yes | Trimmed, max 80 chars | Name of item |
| `description` | String | Yes | Trimmed, max 600 chars | Item description & condition details |
| `category` | String | Yes | `Books`, `Electronics`, `Calculators`, `Lab Equipment`, `Other` | Item classification |
| `listingType` | String | Yes | `Sell`, `Borrow`, `Exchange` | Transaction intention |
| `condition` | String | Yes | `New`, `Like New`, `Good`, `Fair` (Default: `Good`) | Physical wear level |
| `price` | Number | No | Min 0, Default 0 | Price in ₹ (0 for free or exchange) |
| `ownerName` | String | Yes | Trimmed, max 60 chars | Listing student's name |
| `ownerEmail` | String | Yes | Trimmed, lowercase | Registered campus email |
| `ownerPhone` | String | Yes | Trimmed, max 25 chars | Private contact phone |
| `status` | String | Yes | `Available`, `Reserved`, `Unavailable`, `Completed` | Listing lifecycle state |
| `createdAt` / `updatedAt` | Date | Auto | Timestamps enabled | Document creation & update timestamps |

### 4.2 ExchangeRequest Schema (`exchangerequests` collection)

| Field | Type | Required | Constraints / Enums | Description |
|---|---|---|---|---|
| `item` | ObjectId | Yes | Reference to `Item` | Target item document ID |
| `requesterName` | String | Yes | Trimmed, max 60 chars | Requesting student's name |
| `requesterEmail` | String | Yes | Trimmed, lowercase | Requesting student's campus email |
| `requesterPhone` | String | Yes | Trimmed, max 25 chars | Private contact phone |
| `message` | String | No | Trimmed, max 300 chars | Optional note explaining need |
| `status` | String | Yes | `Pending`, `Accepted`, `Declined`, `Completed`, `Returned` | Request state |
| `createdAt` / `updatedAt` | Date | Auto | Timestamps enabled | Audit timestamps |

---

## 5. Request Lifecycle & Contact Privacy

CampusLoop implements privacy-by-design to prevent unsolicited contact and spam:

```
[Student Lists Item]
       │
       ▼ (status: Available, phone hidden from marketplace)
[Student Requests Item]
       │
       ▼ (status: Pending, requester contact hidden from owner)
[Owner Reviews Request in 'Requests Received']
       ├──▶ Decline ──▶ [status: Declined, contact remains hidden, item Available]
       └──▶ Accept
              │
              ▼ (Atomic concurrency gate verifies item is Available)
       [Request: Accepted | Item: Reserved]
              │
              ▼ (Mutual Contact Exchange Panel unlocked)
       [Students Contact Directly & Meet Offline on Campus]
              │
              ├──▶ Borrowed Item Handed Back ──▶ Mark as Returned (Item: Available)
              └──▶ Sale/Exchange Finished ─────▶ Mark as Completed (Listing closed)
```

### Privacy Rules Matrix:

| View Mode | Request Status | Owner Phone Visible? | Requester Phone/Email Visible? |
|---|---|---|---|
| Marketplace Listing | Any | **No** (filtered out in query projection) | N/A |
| Requester: "My Requests" | `Pending` | **No** | Yes (own details) |
| Requester: "My Requests" | `Declined` | **No** | Yes (own details) |
| Requester: "My Requests" | `Accepted` | **Yes** (via contact card) | Yes (own details) |
| Requester: "My Requests" | `Completed` | **Yes** (via contact card) | Yes (own details) |
| Owner: "Requests Received" | `Pending` | Yes (own details) | **No** (`"Protected until accepted"`) |
| Owner: "Requests Received" | `Declined` | Yes (own details) | **No** (`"Protected until accepted"`) |
| Owner: "Requests Received" | `Accepted` | Yes (own details) | **Yes** (via contact card) |
| Owner: "Requests Received" | `Completed` | Yes (own details) | **Yes** (via contact card) |

---

## 6. Complete REST API Specifications

### Items API (`/api/items`)
- `GET /api/items`: List all available items. Supports optional query parameters `search` (regex on title/description), `category`, and `type`. Excludes private owner phone numbers.
- `GET /api/items/:id`: Fetch full details of an item by ObjectId. Excludes private owner phone numbers.
- `POST /api/items`: Create a listing with title, description, category, listingType, condition, price, ownerName, ownerEmail, and ownerPhone.
- `PUT /api/items/:id` & `PATCH /api/items/:id`: Update item details.
- `DELETE /api/items/:id`: Delete an item and automatically cascade deletion to associated exchange requests.

### Requests API (`/api/requests`)
- `POST /api/requests`: Submit request with `itemId`, `requesterName`, `requesterEmail`, `requesterPhone`, and optional `message`.
- `GET /api/requests?email=`: Retrieve requests submitted by a student ("My Requests").
- `GET /api/requests/received?email=`: Retrieve requests received by a listing owner ("Requests Received"), grouped by item.
- `PATCH /api/requests/:id/accept`: Atomically accepts a pending request, reserves the item, and reveals contact details.
- `PATCH /api/requests/:id/decline`: Declines a request and keeps contact details protected.
- `PATCH /api/requests/:id/complete`: Marks an accepted request and its item as completed.
- `PATCH /api/requests/:id/return`: Marks a borrowed item as returned, restoring the item status to `Available`.
- `DELETE /api/requests/:id`: Deletes a request record.

### Utility API
- `GET /api/health`: Returns server status and MongoDB connection state (`connected` / `disconnected`).
- `GET /api/stats`: Returns live counts of available items and active categories.

---

## 7. Containerization & Deployment

CampusLoop utilizes multi-stage container orchestration:
- **`Dockerfile`**: Builds from official `node:22-alpine` image, executes `npm install --omit=dev`, packages source code, and runs as an unprivileged container exposing port 5000.
- **`docker-compose.yml`**:
  - Service `mongo`: Runs official `mongo:7` with healthchecks (`mongosh --quiet --eval "db.adminCommand('ping').ok"`). Persists data via named volume `campusloop-data`.
  - Service `app`: Depends on `mongo` with `condition: service_healthy`, binding host port `5000:5000`.

---

## 8. Current Limitations & Future Roadmap

### Current Limitations:
1. **Email-Based Identification**: CampusLoop utilizes campus email verification without password authentication, designed for assignment MVP simplicity.
2. **Category Icon Graphics**: Uses semantic emojis and SVGs rather than binary image uploads.

### Planned Enhancements:
1. **Institutional Single Sign-On (SSO)**: Integration with OAuth2/SAML campus identity providers.
2. **Item Image Uploads**: Cloud object storage (e.g., S3/GCS) with client-side image compression.
3. **Campus Meeting Spot Suggestions**: Predefined campus safety zones (e.g., Main Quad, Central Library Desk).
