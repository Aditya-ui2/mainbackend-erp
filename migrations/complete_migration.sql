-- ================================================================
-- MABICONS ERP - COMPLETE DATABASE MIGRATION SCRIPT
-- Safe to run multiple times (idempotent)
-- ================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- AUTHENTICATION TABLES
-- ================================================================

-- SuperAdmin Table
CREATE TABLE IF NOT EXISTS super_admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    "companyName" VARCHAR(255) NOT NULL,
    "resetPasswordToken" VARCHAR(255),
    "resetPasswordExpires" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_super_admins_email ON super_admins(email);

-- Admin Table
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    "resetPasswordToken" VARCHAR(255),
    "resetPasswordExpires" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);

-- TeamLeader Table
CREATE TABLE IF NOT EXISTS team_leaders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    password VARCHAR(255) NOT NULL,
    department VARCHAR(50) DEFAULT 'Both' CHECK (department IN ('HR Operations', 'HR Recruitment', 'Both')),
    "adminId" UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    "resetPasswordToken" VARCHAR(255),
    "resetPasswordExpires" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_team_leaders_email ON team_leaders(email);
CREATE INDEX IF NOT EXISTS idx_team_leaders_adminId ON team_leaders("adminId");
CREATE INDEX IF NOT EXISTS idx_team_leaders_department ON team_leaders(department);

-- Employee Table
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    "resetPasswordToken" VARCHAR(255),
    "resetPasswordExpires" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);

-- Employee-TeamLeader Junction Table
CREATE TABLE IF NOT EXISTS employee_team_leaders (
    id SERIAL PRIMARY KEY,
    "employeeId" UUID REFERENCES employees(id) ON DELETE CASCADE,
    "teamLeaderId" UUID REFERENCES team_leaders(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("employeeId", "teamLeaderId")
);

CREATE INDEX IF NOT EXISTS idx_etl_employeeId ON employee_team_leaders("employeeId");
CREATE INDEX IF NOT EXISTS idx_etl_teamLeaderId ON employee_team_leaders("teamLeaderId");

-- ================================================================
-- DEPARTMENT TEAM TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS "DepartmentTeams" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(100) DEFAULT 'Team Member',
    department VARCHAR(100) NOT NULL CHECK (department IN ('HR Operations', 'HR Recruitment', 'Operations', 'KAM Operations', 'HR', 'Management', 'CRM', 'Finance', 'Sales', 'IT', 'BD', 'Marketing')),
    "managerId" UUID REFERENCES "DepartmentTeams"(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'On Leave')),
    avatar VARCHAR(255),
    skills JSONB DEFAULT '[]',
    "joinDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "tasksCompleted" INTEGER DEFAULT 0,
    "tasksAssigned" INTEGER DEFAULT 0,
    "avgResponseTime" FLOAT DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dept_teams_email ON "DepartmentTeams"(email);
CREATE INDEX IF NOT EXISTS idx_dept_teams_department ON "DepartmentTeams"(department);
CREATE INDEX IF NOT EXISTS idx_dept_teams_managerId ON "DepartmentTeams"("managerId");
CREATE INDEX IF NOT EXISTS idx_dept_teams_status ON "DepartmentTeams"(status);

-- ================================================================
-- CLIENT TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS clients (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    "contactNumber" VARCHAR(20),
    password VARCHAR(255) NOT NULL,
    "companyName" VARCHAR(255) NOT NULL,
    "corporateAddress" TEXT,
    "gstNumber" VARCHAR(50),
    "panNumber" VARCHAR(50),
    "cinNumber" VARCHAR(50),
    "numberOfCompanies" INTEGER,
    "spocName" VARCHAR(255),
    "spocContact" VARCHAR(20),
    website VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    "pinCode" VARCHAR(10),
    "ownerName" VARCHAR(255),
    "ownerEmail" VARCHAR(255),
    "agreementType" VARCHAR(100),
    "agreementEffectiveDate" DATE,
    "feeAmount" VARCHAR(50),
    "paymentTerms" VARCHAR(100),
    "shopsLicense" VARCHAR(50),
    "factoryLicense" VARCHAR(50),
    "msmeRegistered" VARCHAR(50),
    "totalEmployees" VARCHAR(50),
    "payrollCycle" VARCHAR(50),
    "pfApplicable" VARCHAR(10),
    "esicApplicable" VARCHAR(10),
    "leadSource" VARCHAR(100),
    "onboardingNotes" TEXT,
    "assignKAM" VARCHAR(255),
    industry VARCHAR(100),
    stage VARCHAR(50) DEFAULT 'Lead Stage' CHECK (stage IN ('Onboarding Complete', 'Finalize', 'Lead Stage')),
    probability INTEGER DEFAULT 25,
    "ownerDirectorDetails" JSONB DEFAULT '[]',
    "authorizedSignatory" JSONB DEFAULT '{}',
    documents JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'Requested' CHECK (status IN ('Accepted', 'Requested', 'Rejected', 'Active', 'Inactive')),
    "teamLeaderId" UUID REFERENCES team_leaders(id) ON DELETE SET NULL,
    "resetPasswordToken" VARCHAR(255),
    "resetPasswordExpires" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_teamLeaderId ON clients("teamLeaderId");
CREATE INDEX IF NOT EXISTS idx_clients_stage ON clients(stage);

-- ================================================================
-- TASK TABLES
-- ================================================================

-- RequestTask Table
CREATE TABLE IF NOT EXISTS requested_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    "clientId" VARCHAR(255) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    category VARCHAR(50) DEFAULT 'Deadline' CHECK (category IN ('Frequency', 'Deadline')),
    frequency VARCHAR(100),
    "dueDate" TIMESTAMP,
    priority VARCHAR(50) DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
    status VARCHAR(50) DEFAULT 'Requested' CHECK (status IN ('Accepted', 'Requested', 'Rejected')),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_requested_tasks_clientId ON requested_tasks("clientId");
CREATE INDEX IF NOT EXISTS idx_requested_tasks_status ON requested_tasks(status);

-- Task Table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Work in Progress', 'Review', 'Pending', 'Resolved')),
    category VARCHAR(50) DEFAULT 'Deadline' CHECK (category IN ('Frequency', 'Deadline')),
    "clientId" VARCHAR(255) REFERENCES clients(id) ON DELETE SET NULL,
    "assignedToType" VARCHAR(50) CHECK ("assignedToType" IN ('Employee', 'TeamLeader')),
    "assignedToId" UUID,
    "dueDate" TIMESTAMP,
    frequency VARCHAR(100),
    priority VARCHAR(50) DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
    "parentTaskId" UUID REFERENCES tasks(id) ON DELETE SET NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_clientId ON tasks("clientId");
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignedToId ON tasks("assignedToId");
CREATE INDEX IF NOT EXISTS idx_tasks_dueDate ON tasks("dueDate");
CREATE INDEX IF NOT EXISTS idx_tasks_parentTaskId ON tasks("parentTaskId");

-- RecurringTask Table
CREATE TABLE IF NOT EXISTS recurring_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    "clientId" VARCHAR(255) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    frequency VARCHAR(100) NOT NULL,
    "assignedToType" VARCHAR(50) CHECK ("assignedToType" IN ('Employee', 'TeamLeader')),
    "assignedToId" UUID,
    priority VARCHAR(50) DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
    active BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recurring_tasks_clientId ON recurring_tasks("clientId");
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_active ON recurring_tasks(active);

-- ================================================================
-- NOTIFICATION & MESSAGE TABLES
-- ================================================================

-- Notification Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "userType" VARCHAR(50) NOT NULL CHECK ("userType" IN ('Admin', 'TeamLeader', 'Employee', 'Client', 'DepartmentTeam')),
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'unread' CHECK (status IN ('read', 'unread')),
    "readAt" TIMESTAMP,
    type VARCHAR(50) DEFAULT 'message' CHECK (type IN ('alert', 'message', 'system')),
    priority VARCHAR(50) DEFAULT 'low' CHECK (priority IN ('high', 'medium', 'low')),
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_userId ON notifications("userId");
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

-- Message Table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "senderId" UUID NOT NULL,
    "senderType" VARCHAR(50) NOT NULL CHECK ("senderType" IN ('TeamLeader', 'Client')),
    "receiverId" UUID NOT NULL,
    "receiverType" VARCHAR(50) NOT NULL CHECK ("receiverType" IN ('TeamLeader', 'Client')),
    content TEXT,
    document JSONB,
    "messageType" VARCHAR(50) DEFAULT 'text' CHECK ("messageType" IN ('text', 'document')),
    read BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_senderId ON messages("senderId");
CREATE INDEX IF NOT EXISTS idx_messages_receiverId ON messages("receiverId");
CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(read);

-- ================================================================
-- RECRUITMENT TABLES
-- ================================================================

-- RecruitmentPosition Table
CREATE TABLE IF NOT EXISTS recruitment_positions (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'Full-time' CHECK (type IN ('Full-time', 'Part-time', 'Contract', 'Internship')),
    salary VARCHAR(100),
    "assignedToId" VARCHAR(255),
    "assignedToName" VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Open' CHECK (status IN ('Open', 'Closed', 'Hold')),
    priority VARCHAR(50) DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    openings INTEGER DEFAULT 1,
    filled INTEGER DEFAULT 0,
    skills JSONB DEFAULT '[]',
    experience VARCHAR(100),
    "clientId" VARCHAR(255) REFERENCES clients(id) ON DELETE SET NULL,
    "teamLeaderId" UUID REFERENCES team_leaders(id) ON DELETE SET NULL,
    "departmentTeamId" UUID REFERENCES "DepartmentTeams"(id) ON DELETE SET NULL,
    "postedByUserId" VARCHAR(255),
    "postedByUserType" VARCHAR(50),
    "postedByName" VARCHAR(255),
    "postedByEmail" VARCHAR(255),
    "postedDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deadline DATE,
    "postPlatforms" JSONB DEFAULT '[]',
    "distributedPlatforms" JSONB DEFAULT '[]',
    "distributionResults" JSONB DEFAULT '[]',
    "lastDistributedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recruitment_positions_clientId ON recruitment_positions("clientId");
CREATE INDEX IF NOT EXISTS idx_recruitment_positions_status ON recruitment_positions(status);
CREATE INDEX IF NOT EXISTS idx_recruitment_positions_teamLeaderId ON recruitment_positions("teamLeaderId");

-- Candidate Table
CREATE TABLE IF NOT EXISTS candidates (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    "positionId" VARCHAR(255) REFERENCES recruitment_positions(id) ON DELETE SET NULL,
    "clientId" VARCHAR(255) REFERENCES clients(id) ON DELETE SET NULL,
    "cvUrl" VARCHAR(255),
    "cvFileName" VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Shared', 'Shortlisted', 'Interview', 'Selected', 'Rejected', 'OnHold')),
    stage VARCHAR(100) DEFAULT 'Screening' CHECK (stage IN ('Screening', 'Phone Interview', 'Technical Round', 'HR Round', 'Client Interview', 'Offer Sent', 'Joined', 'Rejected')),
    "pipelineStatus" VARCHAR(50) DEFAULT 'pending' CHECK ("pipelineStatus" IN ('pending', 'hold', 'approved', 'rejected')),
    location VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    rating FLOAT DEFAULT 0,
    "noticePeriod" VARCHAR(50),
    "rejectionReason" VARCHAR(255),
    source VARCHAR(100),
    "sharedAt" TIMESTAMP,
    "shortlistedAt" TIMESTAMP,
    "interviewDate" TIMESTAMP,
    notes TEXT,
    skills JSONB DEFAULT '[]',
    experience VARCHAR(100),
    password VARCHAR(255),
    username VARCHAR(255) UNIQUE,
    "rawPassword" VARCHAR(255),
    "sharePointId" VARCHAR(255),
    "resumeId" UUID,
    "firebaseUid" VARCHAR(255),
    "kycDocuments" JSONB DEFAULT '{}',
    "addedById" VARCHAR(255),
    "addedByType" VARCHAR(50) CHECK ("addedByType" IN ('Employee', 'TeamLeader', 'DepartmentTeam')),
    "currentSalary" VARCHAR(50),
    "expectedSalary" VARCHAR(50),
    "offeredCTC" VARCHAR(50),
    "offerDate" DATE,
    "offerExpiryDate" DATE,
    "joiningDate" DATE,
    "joiningStatus" VARCHAR(50) DEFAULT 'Pending',
    "negotiationNotes" TEXT,
    "offerStatus" VARCHAR(50) DEFAULT 'Draft',
    "offerLetterUrl" VARCHAR(255),
    "offerLetterFileName" VARCHAR(255),
    "bgvStatus" VARCHAR(50) DEFAULT 'Not Started',
    "skillMatch" INTEGER DEFAULT 0,
    "experienceMatch" INTEGER DEFAULT 0,
    "teamLeaderId" UUID REFERENCES team_leaders(id) ON DELETE SET NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);
CREATE INDEX IF NOT EXISTS idx_candidates_positionId ON candidates("positionId");
CREATE INDEX IF NOT EXISTS idx_candidates_clientId ON candidates("clientId");
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);

-- OfferTemplate Table
CREATE TABLE IF NOT EXISTS offer_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "clientId" VARCHAR(255) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    "templateUrl" VARCHAR(255) NOT NULL,
    "templateFileName" VARCHAR(255) NOT NULL,
    "fieldMap" JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'Active',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_offer_templates_clientId ON offer_templates("clientId");
CREATE INDEX IF NOT EXISTS idx_offer_templates_status ON offer_templates(status);

-- ================================================================
-- INTERVIEW TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS interviews (
    id VARCHAR(255) PRIMARY KEY,
    "candidateId" VARCHAR(255) NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    "positionId" VARCHAR(255) NOT NULL REFERENCES recruitment_positions(id) ON DELETE CASCADE,
    "clientId" VARCHAR(255) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    "interviewType" VARCHAR(100) NOT NULL CHECK ("interviewType" IN ('HR Round', 'Technical Round', 'Client Interview', 'Phone Screening', 'Final Round')),
    "interviewDate" TIMESTAMP NOT NULL,
    "startTime" VARCHAR(10) NOT NULL,
    duration INTEGER DEFAULT 45,
    "meetingType" VARCHAR(50) NOT NULL DEFAULT 'Video' CHECK ("meetingType" IN ('Video', 'In-Person', 'Phone')),
    "meetingLink" VARCHAR(255),
    "meetingToken" VARCHAR(255) UNIQUE,
    "meetingPassword" VARCHAR(255),
    "interviewerId" VARCHAR(255),
    "interviewerType" VARCHAR(50) CHECK ("interviewerType" IN ('TeamLeader', 'DepartmentTeam', 'Client')),
    "interviewerName" VARCHAR(255),
    "interviewerEmail" VARCHAR(255),
    "interviewerRole" VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Rescheduled', 'No Show')),
    evaluation JSONB,
    "emailSentToCandidate" BOOLEAN DEFAULT false,
    "emailSentAt" TIMESTAMP,
    "reminderSent" BOOLEAN DEFAULT false,
    "rescheduledFrom" TIMESTAMP,
    "rescheduleReason" TEXT,
    notes TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interviews_candidateId ON interviews("candidateId");
CREATE INDEX IF NOT EXISTS idx_interviews_positionId ON interviews("positionId");
CREATE INDEX IF NOT EXISTS idx_interviews_clientId ON interviews("clientId");
CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status);
CREATE INDEX IF NOT EXISTS idx_interviews_interviewDate ON interviews("interviewDate");

-- ================================================================
-- WORK AGREEMENT & HANDOVER TABLES
-- ================================================================

-- WorkAgreement Table
CREATE TABLE IF NOT EXISTS work_agreements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "clientId" VARCHAR(255) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    "allowedScopes" JSONB NOT NULL DEFAULT '[]',
    "maxTasks" INTEGER,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Expired', 'Terminated')),
    notes TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_work_agreements_clientId ON work_agreements("clientId");
CREATE INDEX IF NOT EXISTS idx_work_agreements_status ON work_agreements(status);

-- WorkHandover Table
CREATE TABLE IF NOT EXISTS work_handovers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "fromUserId" UUID NOT NULL,
    "toUserId" UUID NOT NULL,
    reason TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "clientIds" JSONB NOT NULL DEFAULT '[]',
    notes TEXT,
    status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'Cancelled')),
    "createdBy" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_work_handovers_fromUserId ON work_handovers("fromUserId");
CREATE INDEX IF NOT EXISTS idx_work_handovers_toUserId ON work_handovers("toUserId");
CREATE INDEX IF NOT EXISTS idx_work_handovers_status ON work_handovers(status);

-- ================================================================
-- RESUME BANK TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS "ResumeBanks" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "sharePointId" VARCHAR(255) NOT NULL UNIQUE,
    "driveId" VARCHAR(255) NOT NULL,
    "s3Key" VARCHAR(255),
    "fileName" VARCHAR(255) NOT NULL,
    "fileType" VARCHAR(10) NOT NULL CHECK ("fileType" IN ('pdf', 'doc', 'docx')),
    "fileSize" INTEGER,
    "roleType" VARCHAR(100) NOT NULL,
    "subRole" VARCHAR(100),
    "candidateName" VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    experience VARCHAR(100),
    skills JSONB DEFAULT '[]',
    "currentCompany" VARCHAR(255),
    "currentLocation" VARCHAR(255),
    "preferredLocation" VARCHAR(255),
    "currentSalary" VARCHAR(50),
    "expectedSalary" VARCHAR(50),
    "noticePeriod" VARCHAR(50),
    "webUrl" VARCHAR(255),
    "downloadUrl" VARCHAR(255),
    "folderPath" VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Available' CHECK (status IN ('Available', 'Shortlisted', 'Contacted', 'Interview Scheduled', 'Hired', 'Rejected', 'Not Interested')),
    "lastContactedAt" TIMESTAMP,
    "contactNotes" TEXT,
    "assignedToId" UUID,
    "assignedPositionId" UUID,
    "lastSyncedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "sharePointCreatedAt" TIMESTAMP,
    "sharePointModifiedAt" TIMESTAMP,
    "sharePointCreatedBy" VARCHAR(255),
    tags JSONB DEFAULT '[]',
    rating INTEGER,
    "isStarred" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_resume_banks_roleType ON "ResumeBanks"("roleType");
CREATE INDEX IF NOT EXISTS idx_resume_banks_status ON "ResumeBanks"(status);
CREATE INDEX IF NOT EXISTS idx_resume_banks_sharePointId ON "ResumeBanks"("sharePointId");

-- ================================================================
-- DEPARTMENT FEATURE TABLES
-- ================================================================

-- DepartmentTask Table
CREATE TABLE IF NOT EXISTS "DepartmentTasks" (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    department VARCHAR(100) NOT NULL CHECK (department IN ('HR Operations', 'HR Recruitment')),
    "assignedBy" VARCHAR(255) NOT NULL,
    "assignedByName" VARCHAR(255),
    "assignedTo" VARCHAR(255) NOT NULL,
    "assignedToName" VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Overdue')),
    priority VARCHAR(50) DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    "dueDate" TIMESTAMP,
    "completedAt" TIMESTAMP,
    comments JSONB DEFAULT '[]',
    "positionId" VARCHAR(255) REFERENCES recruitment_positions(id) ON DELETE SET NULL,
    "candidateId" VARCHAR(255) REFERENCES candidates(id) ON DELETE SET NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dept_tasks_status ON "DepartmentTasks"(status);
CREATE INDEX IF NOT EXISTS idx_dept_tasks_department ON "DepartmentTasks"(department);

-- ActivityLog Table
CREATE TABLE IF NOT EXISTS "ActivityLogs" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department VARCHAR(100) NOT NULL CHECK (department IN ('HR Operations', 'HR Recruitment')),
    "performedBy" VARCHAR(255) NOT NULL,
    "performedByType" VARCHAR(50) NOT NULL CHECK ("performedByType" IN ('TeamLeader', 'DepartmentTeam')),
    "performedByName" VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    "actionType" VARCHAR(50) DEFAULT 'general' CHECK ("actionType" IN ('task', 'leave', 'payroll', 'attendance', 'candidate', 'interview', 'offer', 'general')),
    description VARCHAR(255) NOT NULL,
    "relatedEntity" VARCHAR(255),
    "relatedEntityType" VARCHAR(255),
    metadata JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_department ON "ActivityLogs"(department);
CREATE INDEX IF NOT EXISTS idx_activity_logs_performedBy ON "ActivityLogs"("performedBy");

-- LeaveRequest Table
CREATE TABLE IF NOT EXISTS "LeaveRequests" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "memberId" UUID NOT NULL,
    "memberName" VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL CHECK (department IN ('HR Operations', 'HR Recruitment', 'Operations', 'KAM Operations')),
    "leaveType" VARCHAR(50) NOT NULL CHECK ("leaveType" IN ('Casual Leave', 'Sick Leave', 'Earned Leave', 'Half Day', 'Work From Home', 'Compensatory Off', 'Maternity Leave', 'Casual', 'Sick', 'Earned')),
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    "approvedBy" UUID,
    "approverName" VARCHAR(255),
    "approverComment" TEXT,
    "totalDays" FLOAT DEFAULT 1,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_memberId ON "LeaveRequests"("memberId");
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON "LeaveRequests"(status);

-- Attendance Table
CREATE TABLE IF NOT EXISTS "Attendances" (
    id VARCHAR(255) PRIMARY KEY,
    "memberId" VARCHAR(255) NOT NULL,
    "clientId" VARCHAR(255),
    "memberName" VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL CHECK (department IN ('HR Operations', 'HR Recruitment', 'HR', 'Management', 'CRM')),
    date DATE NOT NULL,
    "checkIn" TIMESTAMP,
    "checkOut" TIMESTAMP,
    status VARCHAR(50) DEFAULT 'Present' CHECK (status IN ('Present', 'Absent', 'Half Day', 'On Leave', 'WFH')),
    "workHours" FLOAT DEFAULT 0,
    notes VARCHAR(255),
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attendances_memberId ON "Attendances"("memberId");
CREATE INDEX IF NOT EXISTS idx_attendances_date ON "Attendances"(date);
CREATE INDEX IF NOT EXISTS idx_attendances_status ON "Attendances"(status);

-- DailyReport Table
CREATE TABLE IF NOT EXISTS "DailyReports" (
    id VARCHAR(255) PRIMARY KEY,
    "memberId" VARCHAR(255) NOT NULL,
    "memberName" VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL CHECK (department IN ('HR Operations', 'HR Recruitment', 'Operations', 'KAM Operations', 'HR', 'Management', 'CRM', 'Finance', 'Sales', 'IT', 'BD', 'Marketing')),
    date DATE NOT NULL,
    "checkInTime" VARCHAR(10),
    "checkOutTime" VARCHAR(10),
    "workHours" FLOAT DEFAULT 0,
    "callsCount" INTEGER DEFAULT 0,
    "profilesVisited" INTEGER DEFAULT 0,
    "profilesShared" INTEGER DEFAULT 0,
    "candidatesContacted" INTEGER DEFAULT 0,
    "interviewsArranged" INTEGER DEFAULT 0,
    summary TEXT NOT NULL,
    "tasksCompleted" JSONB DEFAULT '[]',
    "tasksPlanned" JSONB DEFAULT '[]',
    blockers TEXT,
    mood VARCHAR(50) DEFAULT 'Good' CHECK (mood IN ('Great', 'Good', 'Okay', 'Tough')),
    "headComment" TEXT,
    "headCommentBy" VARCHAR(255),
    "headCommentAt" TIMESTAMP,
    "attachmentUrl" VARCHAR(255),
    "attachmentName" VARCHAR(255),
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_daily_reports_memberId ON "DailyReports"("memberId");
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON "DailyReports"(date);

-- Announcement Table
CREATE TABLE IF NOT EXISTS "Announcements" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department VARCHAR(255) DEFAULT 'All',
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    priority VARCHAR(50) DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent', 'low', 'medium', 'high', 'urgent')),
    "targetType" VARCHAR(255) DEFAULT 'All',
    "targetValue" VARCHAR(255),
    "postedBy" UUID NOT NULL,
    "postedByName" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMP,
    pinned BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_announcements_department ON "Announcements"(department);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON "Announcements"(priority);

-- DeptDocument Table
CREATE TABLE IF NOT EXISTS "DeptDocuments" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department VARCHAR(100) NOT NULL CHECK (department IN ('HR Operations', 'HR Recruitment', 'HR', 'Management', 'CRM', 'All')),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    "fileUrl" VARCHAR(255) NOT NULL,
    "fileType" VARCHAR(50),
    "fileSize" INTEGER,
    "uploadedBy" UUID NOT NULL,
    "uploadedByName" VARCHAR(255) NOT NULL,
    category VARCHAR(50) DEFAULT 'Other' CHECK (category IN ('Policy', 'Template', 'Report', 'Training', 'Other')),
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dept_documents_department ON "DeptDocuments"(department);

-- Training Table
CREATE TABLE IF NOT EXISTS "Trainings" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "memberId" UUID NOT NULL,
    "memberName" VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL CHECK (department IN ('HR Operations', 'HR Recruitment', 'HR', 'Management', 'CRM')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) DEFAULT 'Skill Development' CHECK (category IN ('Skill Development', 'Certification', 'Workshop', 'Webinar', 'On-the-Job')),
    status VARCHAR(50) DEFAULT 'Not Started' CHECK (status IN ('Not Started', 'In Progress', 'Completed')),
    "startDate" DATE,
    "completedDate" DATE,
    "certificateUrl" VARCHAR(255),
    progress INTEGER DEFAULT 0,
    "assignedBy" UUID,
    "assignedByName" VARCHAR(255),
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Payslip Table
CREATE TABLE IF NOT EXISTS "Payslips" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "memberId" UUID NOT NULL,
    "memberName" VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL CHECK (department IN ('HR Operations', 'HR Recruitment', 'HR', 'Management', 'CRM')),
    month VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    "basicSalary" FLOAT DEFAULT 0,
    hra FLOAT DEFAULT 0,
    "otherAllowances" FLOAT DEFAULT 0,
    deductions FLOAT DEFAULT 0,
    "netSalary" FLOAT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Generated' CHECK (status IN ('Generated', 'Paid')),
    "paidDate" DATE,
    "fileUrl" VARCHAR(255),
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- DeptChat Table
CREATE TABLE IF NOT EXISTS "DeptChats" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department VARCHAR(100) NOT NULL CHECK (department IN ('HR Operations', 'HR Recruitment', 'HR', 'Management', 'CRM')),
    "senderId" UUID NOT NULL,
    "senderName" VARCHAR(255) NOT NULL,
    "senderRole" VARCHAR(255),
    message TEXT NOT NULL,
    "messageType" VARCHAR(50) DEFAULT 'text' CHECK ("messageType" IN ('text', 'file', 'image')),
    "fileUrl" VARCHAR(255),
    "replyTo" UUID,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- DepartmentNote Table
CREATE TABLE IF NOT EXISTS "DepartmentNotes" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department VARCHAR(100) NOT NULL CHECK (department IN ('HR Operations', 'HR Recruitment', 'HR', 'Management', 'CRM')),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(255) DEFAULT 'General',
    priority VARCHAR(50) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    "createdById" UUID,
    "createdByName" VARCHAR(255),
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ================================================================
-- SHAREPOINT SYNC TABLES
-- ================================================================

-- SharePoint Candidate Table
CREATE TABLE IF NOT EXISTS sharepoint_candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "sharePointId" VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    position VARCHAR(255),
    client VARCHAR(255),
    stage VARCHAR(100) DEFAULT 'Screening',
    status VARCHAR(50) DEFAULT 'Active',
    "assignedTo" VARCHAR(255),
    notes TEXT,
    "resumeUrl" VARCHAR(255),
    "cvUrl" VARCHAR(255),
    "lastSyncedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "sharePointCreatedAt" TIMESTAMP,
    "sharePointModifiedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sp_candidates_sharePointId ON sharepoint_candidates("sharePointId");
CREATE INDEX IF NOT EXISTS idx_sp_candidates_client ON sharepoint_candidates(client);
CREATE INDEX IF NOT EXISTS idx_sp_candidates_status ON sharepoint_candidates(status);

-- SharePoint Interview Table
CREATE TABLE IF NOT EXISTS sharepoint_interviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "sharePointId" VARCHAR(255) NOT NULL UNIQUE,
    "candidateName" VARCHAR(255),
    position VARCHAR(255),
    client VARCHAR(255),
    round VARCHAR(100),
    "interviewType" VARCHAR(100),
    "interviewDate" TIMESTAMP,
    "interviewTime" VARCHAR(10),
    interviewer VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Scheduled',
    "meetLink" VARCHAR(255),
    "assignedTo" VARCHAR(255),
    notes TEXT,
    "lastSyncedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "sharePointCreatedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sp_interviews_sharePointId ON sharepoint_interviews("sharePointId");
CREATE INDEX IF NOT EXISTS idx_sp_interviews_client ON sharepoint_interviews(client);
CREATE INDEX IF NOT EXISTS idx_sp_interviews_status ON sharepoint_interviews(status);

-- SharePoint Client Table
CREATE TABLE IF NOT EXISTS sharepoint_clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "sharePointId" VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    industry VARCHAR(255),
    "contactPerson" VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    location VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Active',
    "assignedKAM" VARCHAR(255),
    "openPositions" INTEGER DEFAULT 0,
    "lastSyncedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "sharePointCreatedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sp_clients_sharePointId ON sharepoint_clients("sharePointId");
CREATE INDEX IF NOT EXISTS idx_sp_clients_status ON sharepoint_clients(status);

-- SharePoint Sync Log Table
CREATE TABLE IF NOT EXISTS sharepoint_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "syncType" VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed')),
    "totalFetched" INTEGER DEFAULT 0,
    created INTEGER DEFAULT 0,
    updated INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    "errorDetails" JSONB DEFAULT '[]',
    "syncedById" UUID,
    "syncedByName" VARCHAR(255),
    "syncedByRole" VARCHAR(255),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sp_sync_logs_syncType ON sharepoint_sync_logs("syncType");
CREATE INDEX IF NOT EXISTS idx_sp_sync_logs_status ON sharepoint_sync_logs(status);

-- ================================================================
-- REGULARIZATION & OTHER TABLES
-- ================================================================

-- RegularizationRequest Table
CREATE TABLE IF NOT EXISTS "RegularizationRequests" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "memberId" UUID NOT NULL,
    "memberName" VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL CHECK (department IN ('HR Operations', 'HR Recruitment', 'HR', 'Management', 'CRM')),
    "attendanceId" UUID,
    date DATE NOT NULL,
    "requestType" VARCHAR(255) NOT NULL,
    "proposedCheckIn" TIMESTAMP,
    "proposedCheckOut" TIMESTAMP,
    reason TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    "approvedBy" UUID,
    "approverName" VARCHAR(255),
    "approverComment" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_regularization_memberId ON "RegularizationRequests"("memberId");
CREATE INDEX IF NOT EXISTS idx_regularization_status ON "RegularizationRequests"(status);

-- ================================================================
-- FINANCE TABLES
-- ================================================================

-- ClientAccount Table
CREATE TABLE IF NOT EXISTS client_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "clientId" VARCHAR(255) NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
    "companyName" VARCHAR(255) NOT NULL,
    "totalOutstanding" DECIMAL(15, 2) DEFAULT 0,
    "clearedAmount" DECIMAL(15, 2) DEFAULT 0,
    "overdueAmount" DECIMAL(15, 2) DEFAULT 0,
    "pendingInvoicesCount" INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Cleared' CHECK (status IN ('Cleared', 'Pending', 'Overdue')),
    "accountType" VARCHAR(50) DEFAULT 'Standard' CHECK ("accountType" IN ('Standard', 'Premium')),
    "lastInvoiceNumber" VARCHAR(255),
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_accounts_clientId ON client_accounts("clientId");
CREATE INDEX IF NOT EXISTS idx_client_accounts_status ON client_accounts(status);

-- Invoice Table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "invoiceNumber" VARCHAR(255) NOT NULL UNIQUE,
    "clientId" VARCHAR(255) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    "companyName" VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    "taxAmount" DECIMAL(15, 2) DEFAULT 0,
    "totalAmount" DECIMAL(15, 2) NOT NULL,
    "dueDate" DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled')),
    items JSONB DEFAULT '[]',
    notes TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_clientId ON invoices("clientId");
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_dueDate ON invoices("dueDate");

-- Expense Table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(255) NOT NULL,
    vendor VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'Paid',
    date DATE NOT NULL,
    notes TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);

-- PaymentRecord Table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "clientId" VARCHAR(255) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    "companyName" VARCHAR(255) NOT NULL,
    "invoiceId" VARCHAR(255),
    "amountReceived" DECIMAL(15, 2) NOT NULL,
    "dateReceived" DATE NOT NULL,
    "paymentMethod" VARCHAR(100) DEFAULT 'Bank Transfer',
    "transactionRef" VARCHAR(255),
    notes TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_clientId ON payments("clientId");
CREATE INDEX IF NOT EXISTS idx_payments_dateReceived ON payments("dateReceived");

-- PaymentRequest Table
CREATE TABLE IF NOT EXISTS payment_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payee VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    "dueDate" DATE NOT NULL,
    priority VARCHAR(50) DEFAULT 'Medium',
    "bankDetails" TEXT,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'Pending',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);

-- ================================================================
-- CLIENT MANAGEMENT TABLES
-- ================================================================

-- ClientReport Table
CREATE TABLE IF NOT EXISTS client_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "reportName" VARCHAR(255) NOT NULL,
    "reportNumber" VARCHAR(255) NOT NULL UNIQUE,
    "clientId" VARCHAR(255) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    "companyName" VARCHAR(255),
    size VARCHAR(50) DEFAULT '0.0 MB',
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('VERIFIED', 'PENDING', 'DRAFT')),
    "fileUrl" VARCHAR(255),
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_reports_clientId ON client_reports("clientId");
CREATE INDEX IF NOT EXISTS idx_client_reports_status ON client_reports(status);

-- ClientMeeting Table
CREATE TABLE IF NOT EXISTS client_meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    "clientId" VARCHAR(255) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    "companyName" VARCHAR(255),
    "meetingDate" DATE NOT NULL,
    "meetingTime" VARCHAR(10) NOT NULL,
    "meetingType" VARCHAR(50) DEFAULT 'Virtual' CHECK ("meetingType" IN ('Virtual', 'In-Person')),
    platform VARCHAR(255),
    attendees INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Completed', 'Cancelled')),
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_meetings_clientId ON client_meetings("clientId");
CREATE INDEX IF NOT EXISTS idx_client_meetings_meetingDate ON client_meetings("meetingDate");

-- ClientReview Table (needs to be added)
CREATE TABLE IF NOT EXISTS client_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "clientId" VARCHAR(255) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    "reviewText" TEXT,
    "reviewedBy" VARCHAR(255),
    "reviewDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_reviews_clientId ON client_reviews("clientId");
CREATE INDEX IF NOT EXISTS idx_client_reviews_rating ON client_reviews(rating);

-- ================================================================
-- BUSINESS DEVELOPMENT TABLES
-- ================================================================

-- Lead Table
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "companyName" VARCHAR(255) NOT NULL,
    "contactPerson" VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    value FLOAT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Open' CHECK (status IN ('Open', 'New', 'Qualified', 'In Progress', 'Follow Up', 'Proposal', 'Negotiation', 'Converted', 'Lost', 'Active', 'Inactive')),
    segment VARCHAR(100) DEFAULT 'General',
    owner VARCHAR(255),
    notes TEXT,
    "lastContactDate" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(owner);

-- Campaign Table
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) DEFAULT 'Email Campaigns',
    "ownerName" VARCHAR(255),
    "targetReach" VARCHAR(50) DEFAULT '0',
    engagement VARCHAR(50) DEFAULT '0%',
    budget VARCHAR(50) DEFAULT '₹0',
    duration VARCHAR(100),
    roas VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Active',
    notes TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- ================================================================
-- SEEDS / INITIAL DATA
-- ================================================================

-- Seed SuperAdmin (optional - can be done through seeder script)
-- INSERT INTO super_admins (id, name, email, password, "companyName") VALUES
-- (uuid_generate_v4(), 'Super Admin', 'superadmin@mabicons.com', 'hashed_password', 'Mabicons')
-- ON CONFLICT (email) DO NOTHING;

-- ================================================================
-- FINAL INDEXES & CONSTRAINTS
-- ================================================================

-- Ensure all foreign key constraints are properly set
ALTER TABLE IF EXISTS team_leaders DROP CONSTRAINT IF EXISTS fk_team_leaders_adminId;
ALTER TABLE IF EXISTS team_leaders
    ADD CONSTRAINT fk_team_leaders_adminId FOREIGN KEY ("adminId") REFERENCES admins(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS clients DROP CONSTRAINT IF EXISTS fk_clients_teamLeaderId;
ALTER TABLE IF EXISTS clients
    ADD CONSTRAINT fk_clients_teamLeaderId FOREIGN KEY ("teamLeaderId") REFERENCES team_leaders(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS recruitment_positions DROP CONSTRAINT IF EXISTS fk_positions_clientId;
ALTER TABLE IF EXISTS recruitment_positions DROP CONSTRAINT IF EXISTS fk_positions_teamLeaderId;
ALTER TABLE IF EXISTS recruitment_positions
    ADD CONSTRAINT fk_positions_clientId FOREIGN KEY ("clientId") REFERENCES clients(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_positions_teamLeaderId FOREIGN KEY ("teamLeaderId") REFERENCES team_leaders(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS candidates DROP CONSTRAINT IF EXISTS fk_candidates_positionId;
ALTER TABLE IF EXISTS candidates DROP CONSTRAINT IF EXISTS fk_candidates_clientId;
ALTER TABLE IF EXISTS candidates
    ADD CONSTRAINT fk_candidates_positionId FOREIGN KEY ("positionId") REFERENCES recruitment_positions(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_candidates_clientId FOREIGN KEY ("clientId") REFERENCES clients(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS interviews DROP CONSTRAINT IF EXISTS fk_interviews_candidateId;
ALTER TABLE IF EXISTS interviews DROP CONSTRAINT IF EXISTS fk_interviews_positionId;
ALTER TABLE IF EXISTS interviews DROP CONSTRAINT IF EXISTS fk_interviews_clientId;
ALTER TABLE IF EXISTS interviews
    ADD CONSTRAINT fk_interviews_candidateId FOREIGN KEY ("candidateId") REFERENCES candidates(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_interviews_positionId FOREIGN KEY ("positionId") REFERENCES recruitment_positions(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_interviews_clientId FOREIGN KEY ("clientId") REFERENCES clients(id) ON DELETE CASCADE;

-- Verify schema
SELECT 'Migration complete!' AS status;