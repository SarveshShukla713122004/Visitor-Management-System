import mongoose from 'mongoose';
import User from './models/User.js';
import VisitorRequest from './models/VisitorRequest.js';
import Blacklist from './models/Blacklist.js';
import AuditLog from './models/AuditLog.js';
import Notification from './models/Notification.js';

export const seedData = async () => {
  try {
    console.log('Seeding fresh MECON Ranchi 4-Role VMS Data...');

    // Clear existing collections
    await User.deleteMany({});
    await Blacklist.deleteMany({});
    await VisitorRequest.deleteMany({});
    await Notification.deleteMany({});
    await AuditLog.deleteMany({});

    // 1. Create Core Users (Admin, 3 HODs, 4 Employees, 1 Security Officer)
    const admin = await User.create({
      name: 'Dr. Alok Nath (GM Security)',
      email: 'admin@mecon.co.in',
      password: 'Password123',
      role: 'Admin',
      department: 'Corporate IT & Security',
      phone: '+91 94311 01001',
      employeeId: 'MEC-ADM-01',
      avatarColor: '#f43f5e',
    });

    const security = await User.create({
      name: 'Inspector Vikram Singh',
      email: 'security@mecon.co.in',
      password: 'Password123',
      role: 'Security',
      department: 'Main Gate clearance',
      phone: '+91 94311 02001',
      employeeId: 'MEC-SEC-01',
      avatarColor: '#f59e0b',
    });

    // HODs
    const hodMetallurgy = await User.create({
      name: 'Dr. S. K. Roy (HOD Metallurgy)',
      email: 'hod.metallurgy@mecon.co.in',
      password: 'Password123',
      role: 'HOD',
      department: 'Metallurgy & Steel Process',
      phone: '+91 94311 03000',
      employeeId: 'MEC-HOD-101',
      avatarColor: '#8b5cf6',
    });

    const hodCivil = await User.create({
      name: 'Er. A. K. Verma (HOD Civil)',
      email: 'hod.civil@mecon.co.in',
      password: 'Password123',
      role: 'HOD',
      department: 'Civil & Structural Engineering',
      phone: '+91 94311 03001',
      employeeId: 'MEC-HOD-102',
      avatarColor: '#06b6d4',
    });

    const hodDesign = await User.create({
      name: 'Smt. R. Sen (HOD Design)',
      email: 'hod.design@mecon.co.in',
      password: 'Password123',
      role: 'HOD',
      department: 'Design & Engineering Wing',
      phone: '+91 94311 03002',
      employeeId: 'MEC-HOD-103',
      avatarColor: '#ec4899',
    });

    // Set HOD delegate demo
    hodMetallurgy.delegateHOD = hodCivil._id;
    await hodMetallurgy.save();

    // Employees
    const emp1 = await User.create({
      name: 'Rajesh Sharma (Chief Engineer)',
      email: 'employee@mecon.co.in',
      password: 'Password123',
      role: 'Employee',
      department: 'Metallurgy & Steel Process',
      phone: '+91 94311 04001',
      employeeId: 'MEC-EMP-201',
      avatarColor: '#3b82f6',
    });

    const emp2 = await User.create({
      name: 'Sunita Rao (AGM Design)',
      email: 'sunita.rao@mecon.co.in',
      password: 'Password123',
      role: 'Employee',
      department: 'Design & Engineering Wing',
      phone: '+91 94311 04002',
      employeeId: 'MEC-EMP-202',
      avatarColor: '#10b981',
    });

    const emp3 = await User.create({
      name: 'Amitabh Sen (Sr. Manager Civil)',
      email: 'amitabh.sen@mecon.co.in',
      password: 'Password123',
      role: 'Employee',
      department: 'Civil & Structural Engineering',
      phone: '+91 94311 04003',
      employeeId: 'MEC-EMP-203',
      avatarColor: '#f97316',
    });

    const emp4 = await User.create({
      name: 'Priya Swaminathan (DGM Metallurgy)',
      email: 'priya.s@mecon.co.in',
      password: 'Password123',
      role: 'Employee',
      department: 'Metallurgy & Steel Process',
      phone: '+91 94311 04004',
      employeeId: 'MEC-EMP-204',
      avatarColor: '#14b8a6',
    });

    // 2. Blacklist Entries
    await Blacklist.create({
      name: 'Rameshwar Mahato',
      phone: '9835011111',
      aadhaar: '111122223333',
      reason: 'Unauthorized photo capture in restricted metallurgy lab',
      severity: 'High',
      addedBy: admin._id,
    });

    await Blacklist.create({
      name: 'Suresh Kumar',
      phone: '9835022222',
      aadhaar: '444455556666',
      reason: 'Safety policy violation during heavy equipment unloading',
      severity: 'Medium',
      addedBy: admin._id,
    });

    // 3. Visitor Requests (Active Workflow)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Request 1: Pending HOD Approval
    const req1 = await VisitorRequest.create({
      visitorName: 'Deepak Saxena',
      company: 'Tata Steel Jamshedpur',
      purpose: 'Vendor/Contractor Meeting',
      phone: '9876511111',
      aadhaar: '456789012345',
      department: 'Metallurgy & Steel Process',
      submittedBy: emp1._id,
      hodAssigned: hodMetallurgy._id,
      status: 'Pending',
      requestType: 'single-visit',
      visitDate: today,
      history: [{
        action: 'Request Submitted',
        performedBy: emp1._id,
        performedByName: emp1.name,
        performedByRole: 'Employee',
        note: 'Submitted request for technical discussion on steel grade specifications',
      }],
    });

    await Notification.create({
      recipient: hodMetallurgy._id,
      type: 'new_request',
      title: 'New Visitor Request — Deepak Saxena',
      body: `${emp1.name} submitted a visitor request for Deepak Saxena (Tata Steel Jamshedpur).`,
      relatedRequest: req1._id,
    });

    // Request 2: HOD Approved (In Security Queue)
    const req2 = await VisitorRequest.create({
      visitorName: 'Priyanka Banerjee',
      company: 'SAIL Bokaro Steel',
      purpose: 'Client Visit',
      phone: '9876522222',
      aadhaar: '987654321012',
      department: 'Design & Engineering Wing',
      submittedBy: emp2._id,
      hodAssigned: hodDesign._id,
      status: 'HOD Approved',
      gatePassId: 'PASS-MEC-881',
      gatePassExpiry: new Date(today.getTime() + 86400000),
      requestType: 'single-visit',
      visitDate: today,
      history: [
        { action: 'Request Submitted', performedBy: emp2._id, performedByName: emp2.name, performedByRole: 'Employee' },
        { action: 'HOD Approved', performedBy: hodDesign._id, performedByName: hodDesign.name, performedByRole: 'HOD', note: 'Approved for campus access' },
      ],
    });

    // Request 3: Currently Checked-In
    await VisitorRequest.create({
      visitorName: 'Rohan Deshmukh',
      company: 'L&T Heavy Engineering',
      purpose: 'Official/Government Visit',
      phone: '9876533333',
      aadhaar: '123456789012',
      department: 'Civil & Structural Engineering',
      submittedBy: emp3._id,
      hodAssigned: hodCivil._id,
      status: 'Checked-In',
      gatePassGenerated: true,
      gatePassId: 'PASS-MEC-742',
      checkInTime: new Date(now.getTime() - 2 * 3600000),
      checkedInBy: security._id,
      requestType: 'single-visit',
      visitDate: today,
      history: [
        { action: 'Request Submitted', performedBy: emp3._id, performedByName: emp3.name, performedByRole: 'Employee' },
        { action: 'HOD Approved', performedBy: hodCivil._id, performedByName: hodCivil.name, performedByRole: 'HOD' },
        { action: 'Checked-In', performedBy: security._id, performedByName: security.name, performedByRole: 'Security', note: 'Physical ID verified' },
      ],
    });

    // Request 4: HOD Rejected
    await VisitorRequest.create({
      visitorName: 'Karan Malhotra',
      company: 'Apex Supplies Pvt Ltd',
      purpose: 'Delivery',
      phone: '9876544444',
      aadhaar: '555566667777',
      department: 'Metallurgy & Steel Process',
      submittedBy: emp4._id,
      hodAssigned: hodMetallurgy._id,
      status: 'HOD Rejected',
      rejectionReason: 'Vendor clearance not pre-verified with procurement desk.',
      requestType: 'single-visit',
      visitDate: today,
      history: [
        { action: 'Request Submitted', performedBy: emp4._id, performedByName: emp4.name, performedByRole: 'Employee' },
        { action: 'HOD Rejected', performedBy: hodMetallurgy._id, performedByName: hodMetallurgy.name, performedByRole: 'HOD', note: 'Vendor clearance not pre-verified with procurement desk.' },
      ],
    });

    // 4. Generate 14-day historical data for analytics
    const employeesList = [emp1, emp2, emp3, emp4];
    const hodsList = [hodMetallurgy, hodCivil, hodDesign];
    const purposes = [
      'Vendor/Contractor Meeting', 'Client Visit', 'Interview',
      'Official/Government Visit', 'Delivery', 'Other'
    ];

    for (let i = 13; i >= 0; i--) {
      const pastDay = new Date(today);
      pastDay.setDate(pastDay.getDate() - i);
      const dailyCount = Math.floor(Math.random() * 12) + 8; // 8-20 visitors per day

      for (let c = 0; c < dailyCount; c++) {
        const emp = employeesList[c % employeesList.length];
        const hod = hodsList[c % hodsList.length];
        const cIn = new Date(pastDay.getTime() + (8 + (c % 8)) * 3600000);
        const cOut = new Date(cIn.getTime() + (1 + (c % 3)) * 3600000);

        await VisitorRequest.create({
          visitorName: `Historical Visitor ${i}-${c}`,
          company: `Partner Org ${c}`,
          purpose: purposes[c % purposes.length],
          phone: `98000${i}${c}111`.slice(0, 10),
          aadhaar: `1111222233${i}${c}`.slice(0, 12),
          department: emp.department,
          submittedBy: emp._id,
          hodAssigned: hod._id,
          status: 'Checked-Out',
          gatePassGenerated: true,
          gatePassId: `HIST-PASS-${i}-${c}`,
          checkInTime: cIn,
          checkOutTime: cOut,
          checkedInBy: security._id,
          checkedOutBy: security._id,
          createdAt: pastDay,
          updatedAt: cOut,
          history: [
            { action: 'Request Submitted', performedBy: emp._id, performedByName: emp.name, performedByRole: 'Employee', timestamp: pastDay },
            { action: 'HOD Approved', performedBy: hod._id, performedByName: hod.name, performedByRole: 'HOD', timestamp: new Date(pastDay.getTime() + 1800000) },
            { action: 'Checked-In', performedBy: security._id, performedByName: security.name, performedByRole: 'Security', timestamp: cIn },
            { action: 'Checked-Out', performedBy: security._id, performedByName: security.name, performedByRole: 'Security', timestamp: cOut },
          ],
        });
      }
    }

    console.log('Successfully seeded 4-Role MECON VMS dataset!');
  } catch (err) {
    console.error('Seed error:', err.message);
  }
};
