import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from '../lib/mongodb';
import User from '../lib/models/User';
import Employee from '../lib/models/Employee';
import AppraisalCycle from '../lib/models/AppraisalCycle';

async function seed() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    // Clear existing data (optional - comment out if you want to keep existing data)
    await User.deleteMany({});
    await Employee.deleteMany({});
    await AppraisalCycle.deleteMany({});
    console.log('Cleared existing data');

    // Hash password
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Create Super Admin Employee and User
    const superAdminEmployee = await Employee.create({
      employeeId: 'ADMIN001',
      name: 'Super Admin',
      email: 'admin@company.com',
      role: 'Super Admin',
      isActive: true,
    });

    const superAdminUser = await User.create({
      email: 'admin@company.com',
      password: hashedPassword,
      role: 'super_admin',
      employeeId: superAdminEmployee._id,
      isActive: true,
    });

    // Create HR Employee and User
    const hrEmployee = await Employee.create({
      employeeId: 'HR001',
      name: 'HR Manager',
      email: 'hr@company.com',
      role: 'HR',
      isActive: true,
    });

    const hrUser = await User.create({
      email: 'hr@company.com',
      password: hashedPassword,
      role: 'hr',
      employeeId: hrEmployee._id,
      isActive: true,
    });

    // Create Manager Employee and User
    const managerEmployee = await Employee.create({
      employeeId: 'MGR001',
      name: 'John Manager',
      email: 'manager@company.com',
      role: 'Manager',
      isActive: true,
    });

    const managerUser = await User.create({
      email: 'manager@company.com',
      password: hashedPassword,
      role: 'manager',
      employeeId: managerEmployee._id,
      isActive: true,
    });

    // Create Employee 1
    const employee1 = await Employee.create({
      employeeId: 'EMP001',
      name: 'Alice Employee',
      email: 'employee1@company.com',
      role: 'Software Engineer',
      managerId: managerEmployee._id,
      isActive: true,
    });

    const employee1User = await User.create({
      email: 'employee1@company.com',
      password: hashedPassword,
      role: 'employee',
      employeeId: employee1._id,
      isActive: true,
    });

    // Create Employee 2
    const employee2 = await Employee.create({
      employeeId: 'EMP002',
      name: 'Bob Employee',
      email: 'employee2@company.com',
      role: 'Software Engineer',
      managerId: managerEmployee._id,
      isActive: true,
    });

    const employee2User = await User.create({
      email: 'employee2@company.com',
      password: hashedPassword,
      role: 'employee',
      employeeId: employee2._id,
      isActive: true,
    });

    // Create a sample appraisal cycle
    const sampleCycle = await AppraisalCycle.create({
      name: 'H1 2025',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-06-30'),
      status: 'draft',
      competencies: [
        { name: 'Communication', type: 'rating', maxRating: 5 },
        { name: 'Technical Skills', type: 'rating', maxRating: 5 },
        { name: 'Teamwork', type: 'rating', maxRating: 5 },
        { name: 'Ownership', type: 'rating', maxRating: 5 },
        { name: 'Delivery', type: 'rating', maxRating: 5 },
        { name: 'Comments', type: 'text' },
      ],
      createdBy: hrUser._id,
    });

    console.log('Seed data created successfully!');
    console.log('\nDefault Login Credentials:');
    console.log('Super Admin: admin@company.com / password123');
    console.log('HR: hr@company.com / password123');
    console.log('Manager: manager@company.com / password123');
    console.log('Employee 1: employee1@company.com / password123');
    console.log('Employee 2: employee2@company.com / password123');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seed();

