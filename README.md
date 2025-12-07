# HR Management System

A comprehensive Role-Based Authentication & Appraisal Management System built with Next.js, MongoDB, and NextAuth.js.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: MongoDB (local) with Mongoose
- **Authentication**: NextAuth.js with credentials provider
- **Password Security**: bcrypt for password hashing
- **Validation**: Zod for input validation

## Features

### Role-Based Access Control
- **Super Admin**: Can create/update/delete HR users and Managers, view all reports
- **HR**: Can manage employees, create appraisal cycles, define competencies, manage cycle status
- **Manager**: Can view team members, fill manager reviews, view team history
- **Employee**: Can submit self-assessments, view own appraisals and final ratings

### Appraisal Cycle Management
- Create appraisal cycles with custom competencies
- Manage cycle status (Draft → Open for Self Review → Open for Manager Review → Closed)
- Define competencies per cycle (rating or text type)
- Status enforcement (employees can only submit during self review phase, managers during manager review phase)

### Employee Management
- Create and manage employees
- Assign managers to employees
- Activate/deactivate employees

### Appraisal Flow
1. **Self Review**: Employees fill self-assessment when cycle is open
2. **Manager Review**: Managers review team members after self-reviews are submitted
3. **View Results**: Employees can view final ratings once cycle is closed

### Reporting
- Filter reports by cycle, manager, or employee
- View detailed appraisal reports
- Export capabilities (ready for extension)

## Prerequisites

- Node.js 18+ installed
- MongoDB installed and running locally (or MongoDB Atlas connection string)
- npm or yarn package manager

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/hr-management

# NextAuth Secret (generate a random string)
NEXTAUTH_SECRET=your-secret-key-here-change-in-production
NEXTAUTH_URL=http://localhost:3000
```

**Note**: Generate a secure random string for `NEXTAUTH_SECRET`. You can use:
```bash
openssl rand -base64 32
```

### 3. Start MongoDB

Make sure MongoDB is running locally:

```bash
# On Windows
mongod

# On macOS/Linux
sudo systemctl start mongod
# or
mongod --dbpath /path/to/data
```

### 4. Seed the Database

Run the seed script to create default users and sample data:

```bash
npm run seed
```

This will create:
- Super Admin user
- HR user
- Manager user
- 2 Employee users
- Sample appraisal cycle

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Default Login Credentials

After running the seed script, you can login with:

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@company.com | password123 |
| HR | hr@company.com | password123 |
| Manager | manager@company.com | password123 |
| Employee 1 | employee1@company.com | password123 |
| Employee 2 | employee2@company.com | password123 |

**⚠️ Important**: Change these passwords in production!

## Project Structure

```
hr-management-system/
├── app/
│   ├── (auth)/              # Authentication pages
│   │   └── login/
│   ├── (dashboard)/         # Dashboard pages (protected)
│   │   ├── admin/           # Super Admin pages
│   │   ├── hr/              # HR pages
│   │   ├── manager/        # Manager pages
│   │   └── employee/        # Employee pages
│   ├── api/                 # API routes
│   │   ├── auth/            # NextAuth routes
│   │   ├── users/           # User management
│   │   ├── employees/       # Employee management
│   │   ├── cycles/          # Appraisal cycle management
│   │   ├── reviews/         # Review management
│   │   └── reports/         # Reporting
│   └── layout.tsx           # Root layout
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── admin/               # Admin components
│   ├── hr/                  # HR components
│   ├── manager/             # Manager components
│   ├── employee/            # Employee components
│   └── reports/             # Report components
├── lib/
│   ├── models/              # MongoDB models
│   ├── mongodb.ts           # MongoDB connection
│   └── auth.ts              # Auth utilities
├── scripts/
│   └── seed.ts              # Database seed script
├── types/
│   └── index.ts             # TypeScript types
└── middleware.ts            # Route protection middleware
```

## API Routes

### Authentication
- `POST /api/auth/signin` - Sign in
- `POST /api/auth/signout` - Sign out

### Users (Super Admin only)
- `GET /api/users` - List all HR and Manager users
- `POST /api/users` - Create new user
- `PUT /api/users` - Update user
- `DELETE /api/users` - Delete user

### Employees (HR/Admin only)
- `GET /api/employees` - List all employees
- `POST /api/employees` - Create new employee
- `PUT /api/employees` - Update employee
- `DELETE /api/employees` - Delete employee
- `GET /api/employees/team` - Get team members (Manager only)

### Appraisal Cycles (HR/Admin only)
- `GET /api/cycles` - List all cycles
- `POST /api/cycles` - Create new cycle
- `PUT /api/cycles` - Update cycle
- `DELETE /api/cycles` - Delete cycle
- `GET /api/cycles/active` - Get active cycles

### Reviews
- `GET /api/reviews/self` - Get self reviews (Employee)
- `POST /api/reviews/self` - Create/update self review (Employee)
- `GET /api/reviews/manager` - Get manager reviews (Manager)
- `POST /api/reviews/manager` - Create/update manager review (Manager)

### Reports (HR/Admin only)
- `GET /api/reports` - Get reports with filters

## Security Features

- **Password Hashing**: All passwords are hashed using bcrypt
- **Role-Based Access Control**: Enforced on both frontend and backend
- **Route Protection**: Middleware protects all dashboard routes
- **Input Validation**: Zod schemas validate all API inputs
- **Data Isolation**: Employees can only see their own data, managers only their team's data

## Development

### Build for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## Troubleshooting

### MongoDB Connection Issues

If you're having trouble connecting to MongoDB:

1. Ensure MongoDB is running: `mongod`
2. Check your `MONGODB_URI` in `.env.local`
3. For MongoDB Atlas, use the connection string from your cluster

### Authentication Issues

If login is not working:

1. Ensure `NEXTAUTH_SECRET` is set in `.env.local`
2. Clear browser cookies and try again
3. Check that users exist in the database (run seed script)

### Port Already in Use

If port 3000 is already in use:

```bash
# Use a different port
PORT=3001 npm run dev
```

## Future Enhancements

- Email notifications for appraisal cycle status changes
- Export reports to PDF/Excel
- Advanced analytics and dashboards
- Multi-language support
- File uploads for supporting documents
- Performance improvement suggestions based on historical data

## License

This project is created for educational/demonstration purposes.

## Support

For issues or questions, please check the code comments or create an issue in the repository.
