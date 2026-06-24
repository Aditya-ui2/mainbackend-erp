const { Employee, Attendance, Payslip } = require('../models/sequelizeModels')
const { Op } = require('sequelize')

exports.getSalary = async (req, res) => {
  try {
    const { employeeId } = req.params
    if (!employeeId) return res.status(400).json({ success: false, error: 'employeeId required' })
    const slips = await Payslip.findAll({ where: { memberId: employeeId }, order: [['year', 'DESC'], ['month', 'DESC']] })
    res.json({ success: true, data: slips })
  } catch (err) {
    console.error('ERROR in getSalary:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
}

exports.updateSalary = async (req, res) => {
  try {
    const { employeeId } = req.params
    const payload = req.body
    if (!employeeId) return res.status(400).json({ success: false, error: 'employeeId required' })
    
    // Check if payslip already exists for this month/year for this employee
    let slip = null
    if (payload.id) {
      slip = await Payslip.findByPk(payload.id)
    } else if (payload.month && payload.year) {
      slip = await Payslip.findOne({
        where: {
          memberId: employeeId,
          month: payload.month,
          year: parseInt(payload.year)
        }
      })
    }

    // Also update basicSalary and other payroll profile fields in Employee model permanently
    if (
      payload.basicSalary !== undefined ||
      payload.bankAccount !== undefined ||
      payload.pfNumber !== undefined ||
      payload.uanNumber !== undefined
    ) {
      const emp = await Employee.findByPk(employeeId);
      if (emp) {
        await emp.update({
          basicSalary: payload.basicSalary !== undefined ? (parseFloat(payload.basicSalary) || 0) : emp.basicSalary,
          bankAccount: payload.bankAccount !== undefined ? payload.bankAccount : emp.bankAccount,
          pfNumber: payload.pfNumber !== undefined ? payload.pfNumber : emp.pfNumber,
          uanNumber: payload.uanNumber !== undefined ? payload.uanNumber : emp.uanNumber
        });
      }
    }

    if (slip) {
      await slip.update(payload)
      return res.json({ success: true, data: slip })
    }

    const newSlip = await Payslip.create({
      memberId: employeeId,
      memberName: payload.memberName || 'Unknown',
      department: payload.department || 'HR Operations',
      month: payload.month || 'Unknown',
      year: parseInt(payload.year) || new Date().getFullYear(),
      basicSalary: parseFloat(payload.basicSalary) || 0,
      hra: parseFloat(payload.hra) || 0,
      otherAllowances: parseFloat(payload.otherAllowances) || 0,
      deductions: parseFloat(payload.deductions) || 0,
      netSalary: parseFloat(payload.netSalary) || 0,
      status: payload.status || 'Generated'
    })
    res.status(201).json({ success: true, data: newSlip })
  } catch (err) {
    console.error('ERROR in updateSalary:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
}

exports.getAllEmployeesPayroll = async (req, res) => {
  try {
    const { month, year } = req.query; // month is 0-indexed string or integer (e.g. '5' for June)
    const targetMonth = parseInt(month);
    const targetYear = parseInt(year) || new Date().getFullYear();

    if (isNaN(targetMonth)) {
      return res.status(400).json({ success: false, error: 'month parameter is required' });
    }

    const employees = await Employee.findAll({
      order: [['name', 'ASC']]
    });

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[targetMonth];

    // Compute start and end dates of the month to query attendance
    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0);
    const daysInMonth = endDate.getDate();
    
    // Count weekend days in this month to get net working days
    let workingDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dayOfWeek = new Date(targetYear, targetMonth, d).getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
    }

    const payrollList = [];

    for (const emp of employees) {
      // 1. Get count of present days from Attendance table
      const presentCount = await Attendance.count({
        where: {
          memberId: emp.id,
          date: {
            [Op.between]: [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
          },
          status: 'Present'
        }
      });

      // 2. Get existing payslip from Payslip table
      const payslip = await Payslip.findOne({
        where: {
          memberId: emp.id,
          month: monthName,
          year: targetYear
        }
      });

      // Map base fields
      const defaultBaseSalary = 60000;
      let basicSalary = emp.basicSalary !== null && emp.basicSalary !== undefined ? parseFloat(emp.basicSalary) : defaultBaseSalary;
      let hra = 0;
      let otherAllowances = 0;
      let deductions = 0;
      let netSalary = 0;
      let status = 'Pending';
      let payslipId = null;

      if (payslip) {
        basicSalary = payslip.basicSalary || basicSalary;
        hra = payslip.hra || 0;
        otherAllowances = payslip.otherAllowances || 0;
        deductions = payslip.deductions || 0;
        netSalary = payslip.netSalary || 0;
        status = payslip.status || 'Generated';
        payslipId = payslip.id;
      } else {
        // Calculate dynamic initial net salary based on leaves (workingDays - presentCount)
        const leaves = workingDays - presentCount;
        const perDaySalary = basicSalary / (workingDays || 22);
        deductions = Math.round(perDaySalary * leaves);
        netSalary = Math.round(basicSalary - deductions);
        if (netSalary < 0) netSalary = 0;
      }

      payrollList.push({
        id: emp.id,
        name: emp.name,
        email: emp.email,
        phone: emp.phone || 'N/A',
        department: 'HR Operations',
        status: emp.status || 'Active',
        role: 'Executive',
        joinDate: emp.createdAt ? new Date(emp.createdAt).toLocaleDateString('en-IN') : 'N/A',
        
        payslipId,
        basicSalary,
        hra,
        otherAllowances,
        deductions,
        netSalary,
        payrollStatus: status, // Generated / Paid / Pending
        presentDays: presentCount,
        workingDays,
        bankAccount: emp.bankAccount || ('HDFC...' + emp.id.substring(0, 4).toUpperCase()),
        pfNumber: emp.pfNumber || ('PF' + emp.id.substring(0, 6).toUpperCase()),
        uanNumber: emp.uanNumber || ('100' + Math.floor(100000000 + Math.random() * 900000000)),
        leaveBalance: emp.leaveBalance !== null && emp.leaveBalance !== undefined ? (emp.leaveBalance + ' Days') : '12 Days'
      });
    }

    res.json({ success: true, data: payrollList });
  } catch (err) {
    console.error('Error in getAllEmployeesPayroll:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
