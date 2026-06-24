
const fs = require('fs');
const path = 'c:\\rn\\erp-mabicons\\src\\Component\\Pages\\service\\api.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Patch createKAMMember
const oldCreate = `export const createKAMMember = async (kamData) => {
  try {
    const response = await axiosInstance.post('/department/members', {
      name: kamData.name,
      email: kamData.email,
      phone: kamData.phone,
      password: kamData.password || 'Mabicons@123',
      department: kamData.department || 'HR Recruitment',
      role: kamData.role || 'KAM - Recruitment',
      supervisorId: kamData.supervisorId,
      skills: kamData.skills,
      targets: kamData.targets
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to create KAM member:', error);
    throw error.response?.data || { message: 'Failed to create KAM member' };
  }
};`;

const newCreate = `// Create new KAM member (uses /department/members) with local fallback
export const createKAMMember = async (kamData) => {
  const payload = {
    name: kamData.name,
    email: kamData.email,
    phone: kamData.phone,
    password: kamData.password || 'Mabicons@123',
    department: kamData.department || 'HR Recruitment',
    role: kamData.role || 'KAM - Recruitment',
    supervisorId: kamData.supervisorId,
    skills: kamData.skills,
    targets: kamData.targets
  };

  try {
    const response = await axiosInstance.post('/department/members', payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data;
  } catch (error) {
    console.warn('Failed to add member to server, saving locally for now:', error.message);
    
    // Save to local storage mock list
    const mockMembers = JSON.parse(localStorage.getItem('mock_kam_members') || '[]');
    const newMock = {
      id: "offline-" + Date.now(),
      ...payload,
      status: 'Active',
      stats: { activePositions: 0, candidatesPipeline: 0, interviewsScheduled: 0, offersExtended: 0, thisWeekHires: 0 },
      isOffline: true,
      createdAt: new Date().toISOString()
    };
    
    mockMembers.push(newMock);
    localStorage.setItem('mock_kam_members', JSON.stringify(mockMembers));
    
    return { 
      success: true, 
      data: newMock, 
      message: 'Member added locally (Server unreachable)' 
    };
  }
};`;

// Flexible replace (ignoring \r and small space diffs)
const normalize = (s) => s.replace(/\r/g, '').trim();
const normalizedContent = normalize(content);
const normalizedOld = normalize(oldCreate);

if (normalizedContent.includes(normalizedOld)) {
    // Find the original block in the actual content to preserve line endings
    // This is tricky, let's just do a direct string replace first
    // If that fails, we'll try something else
    const directReplace = content.replace(oldCreate, newCreate);
    if (directReplace !== content) {
        fs.writeFileSync(path, directReplace);
        console.log("Successfully patched createKAMMember");
    } else {
        // Try with normalized newlines
        const lfContent = content.replace(/\r\n/g, '\n');
        const lfOld = oldCreate.replace(/\r\n/g, '\n');
        const lfNew = newCreate.replace(/\r\n/g, '\n');
        
        if (lfContent.includes(lfOld)) {
            const patched = lfContent.replace(lfOld, lfNew);
            fs.writeFileSync(path, patched);
            console.log("Successfully patched createKAMMember (LF normalized)");
        } else {
            console.log("Could not find createKAMMember block even with LF normalization");
        }
    }
} else {
    console.log("Normalized search failed");
}
