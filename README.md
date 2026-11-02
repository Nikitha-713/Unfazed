# Unfazed – Therapist Practice Management SaaS

**Unfazed** is a web-based SaaS platform designed to help therapists in India manage their private practice through a single digital platform.

The platform brings together client management, appointment scheduling, clinical documentation, payments, communication and subscription management.

## Project Overview

Unfazed aims to simplify the day-to-day operations of therapists by providing a centralized dashboard and a branded client portal.

Therapists can manage their practice, while clients can access relevant services through their therapist's personalized page.

## Key Features

### 1. Therapist Dashboard
- Centralized dashboard for therapists.
- Manage clients and appointments.
- Access clinical notes.
- View business analytics.

### 2. Client Portal
- Personalized therapist pages.
- Client information and appointment access.
- Communication with therapists.

### 3. Client Management
- Add, view, update and manage client details.
- Maintain client records.
- Organize client information.

### 4. Appointment Management
- Schedule therapy appointments.
- View upcoming appointments.
- Update appointment status.
- Manage appointment records.

### 5. Clinical Notes
- Create and manage clinical notes.
- Support private and shared note visibility.
- Store notes securely in the database.

### 6. Payment Management
- Payment order creation using Razorpay.
- Payment signature verification.
- Payment transaction records.
- INR currency support.

### 7. Subscription and Entitlement Management
- Free, Professional and Premium plans.
- Plan-based feature access.
- Configurable usage limits.
- Feature restrictions based on subscription.

### 8. Communication
- Therapist-client messaging.
- Message storage.
- Real-time communication support using Socket.IO.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React.js |
| Styling | CSS |
| Backend | Node.js |
| API Framework | Express.js |
| Database | MongoDB Atlas |
| ODM | Mongoose |
| Authentication | JWT |
| Password Security | bcryptjs |
| Real-time Communication | Socket.IO |
| Payment Integration | Razorpay |
| Development Environment | Visual Studio Code |
| Version Control | Git and GitHub |

## Project Architecture

```text
                 UNFAZED PLATFORM
                        |
          +-------------+-------------+
          |                           |
    React Frontend              Client Portal
          |                           |
          +-------------+-------------+
                        |
                  REST APIs
                        |
               Node.js + Express
                        |
          +-------------+-------------+
          |             |             |
       Auth API     Workspace API  Socket.IO
          |             |             |
          +-------------+-------------+
                        |
                  MongoDB Atlas
                        |
          +-------------+-------------+
          |             |             |
       Therapists     Clients      Appointments
          |             |             |
       Payments     Clinical Notes  Messages
                        |
                 Subscription Data
```

## Project Folder Structure

```text
unfazed/
│
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── .env.example
│
├── backend/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── server.js
│   ├── package.json
│   └── .env.example
│
├── .gitignore
└── README.md
```

*Note: Adjust this example to match the actual project folder structure.*

## Installation and Setup

### Prerequisites

Install the following before running the project:

- Node.js
- npm
- MongoDB Atlas account
- Git
- Visual Studio Code

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR-USERNAME/unfazed.git
```

```bash
cd unfazed
```

### 2. Setup Backend

```bash
cd backend
npm install
```

Create a `.env` file inside the backend folder:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secure_random_secret
FRONTEND_URL=http://localhost:5173

RAZORPAY_KEY_ID=your_razorpay_test_key_id
RAZORPAY_KEY_SECRET=your_razorpay_test_key_secret
```

Use your own credentials locally. Never upload `.env` to GitHub.

Start the backend:

```bash
node server.js
```

Backend runs at:

```text
http://localhost:5000
```

Health check:

```text
http://localhost:5000/api/health
```

### 3. Setup Frontend

Open another terminal:

```bash
cd frontend
npm install
```

Create a frontend `.env` file if your application is configured to use Vite environment variables:

```env
VITE_API_URL=http://localhost:5000/api
```

Start the frontend:

```bash
npm run dev
```

Frontend runs at:

```text
http://localhost:5173
```

## API Overview

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Therapist registration |
| POST | `/api/auth/login` | Therapist login |
| GET | `/api/health` | Backend health check |
| GET | `/api/workspace/clients` | Get clients |
| POST | `/api/workspace/clients` | Add client |
| GET | `/api/workspace/appointments` | Get appointments |
| POST | `/api/workspace/appointments` | Create appointment |
| GET | `/api/workspace/notes` | Get clinical notes |
| POST | `/api/workspace/notes` | Create clinical note |
| GET | `/api/workspace/payments` | Get payment records |
| POST | `/api/workspace/messages` | Send message |

All workspace routes require authentication. Some routes also require an eligible subscription.

## Subscription Plans

| Feature | Free | Professional | Premium |
|---|---:|---:|---:|
| Client Management | Yes | Yes | Yes |
| Appointments | Yes | Yes | Yes |
| Clinical Notes | Yes | Yes | Yes |
| Payments | No | Yes | Yes |
| Messaging | No | Yes | Yes |
| Analytics | Basic | Advanced | Advanced |
| Clients | 10 | 100 | Unlimited |
| Notes | 20 | 500 | Unlimited |
| Monthly Price | ₹0 | ₹499 | ₹999 |

*Prices and entitlements are configured in the application and may change.*

## Deployment

The planned deployment architecture is:

- **Frontend:** Vercel
- **Backend:** Render
- **Database:** MongoDB Atlas
- **Version Control:** GitHub

Production deployment requires configuring environment variables, API URLs, CORS and authentication settings for the deployed domains.

## Security

- JWT-based authentication.
- Password hashing using bcryptjs.
- Therapist-specific data access.
- Protected API routes.
- Environment variables for sensitive credentials.
- Payment signature verification.

## Future Enhancements

- Custom therapist-branded public booking links.
- Automated appointment reminders.
- Advanced analytics and reports.
- Client self-service booking.
- Subscription payment automation.
- Expanded client portal functionality.

## Project Purpose

Unfazed is developed as an academic web development project to demonstrate the design and implementation of a full-stack SaaS application using modern web technologies.

**Note:** This project should be tested with fictional sample data. It is not intended to store or process real clinical records without appropriate security, privacy and regulatory review.

---

**Developed as a Full-Stack Web Development Project**

**Project Name:** Unfazed  
**Repository:** unfazed