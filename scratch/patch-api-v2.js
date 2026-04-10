
const fs = require('fs');
const path = 'c:\\rn\\erp-mabicons\\src\\Component\\Pages\\service\\api.jsx';
let content = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

// 1. Patch getAllKAMMembers
const oldGet = `export const getAllKAMMembers = async (filtersOrDepartment = 'HR Recruitment') => {
  try {
    const filters = typeof filtersOrDepartment === 'string' ? {} : (filtersOrDepartment || {});
    const department = typeof filtersOrDepartment === 'string'
      ? filtersOrDepartment
      : (filtersOrDepartment?.department || 'HR Recruitment');

    // Try recruitment/kams endpoint first (has recruitment data)
    const response = await axiosInstance.get('/recruitment/kams', {
      params: filters
    });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch KAM members:', error);
    // Fallback to department/members
    try {
      const fallbackResponse = await axiosInstance.get('/department/members', {
        params: { department, role: 'KAM', ...(typeof filtersOrDepartment === 'object' ? filtersOrDepartment : {}) }
      });
      return fallbackResponse.data;
    } catch (fallbackError) {
      throw fallbackError.response?.data || { message: 'Failed to fetch KAM members' };
    }
  }
};`;

const newGet = `// Get all KAM members (recruitment department) with local fallback
export const getAllKAMMembers = async (filtersOrDepartment = 'HR Recruitment') => {
  try {
    const filters = typeof filtersOrDepartment === 'string' ? {} : (filtersOrDepartment || {});
    const department = typeof filtersOrDepartment === 'string'
      ? filtersOrDepartment
      : (filtersOrDepartment?.department || 'HR Recruitment');

    // Try recruitment/kams endpoint first
    const response = await axiosInstance.get('/recruitment/kams', {
      params: filters
    });
    
    // Merge with local mock members
    const mockMembers = JSON.parse(localStorage.getItem('mock_kam_members') || '[]');
    const serverMembers = response.data?.data || response.data?.members || (Array.isArray(response.data) ? response.data : []);
    
    const combined = [...serverMembers];
    const serverEmails = new Set(serverMembers.map(m => m.email?.toLowerCase()));
    
    mockMembers.forEach(mock => {
      if (!serverEmails.has(mock.email?.toLowerCase())) {
        combined.push({ ...mock, isOffline: true });
      }
    });

    return { success: true, data: combined };
  } catch (error) {
    console.warn('Failed to fetch KAM members from server, trying fallback or local storage:', error.message);
    try {
      const department = typeof filtersOrDepartment === 'string' ? filtersOrDepartment : 'HR Recruitment';
      const fallbackResponse = await axiosInstance.get('/department/members', {
        params: { department, role: 'KAM' }
      });
      
      const serverMembers = fallbackResponse.data?.data || fallbackResponse.data?.members || (Array.isArray(fallbackResponse.data) ? fallbackResponse.data : []);
      const mockMembers = JSON.parse(localStorage.getItem('mock_kam_members') || '[]');
      const combined = [...serverMembers];
      const serverEmails = new Set(serverMembers.map(m => m.email?.toLowerCase()));
      mockMembers.forEach(mock => {
        if (!serverEmails.has(mock.email?.toLowerCase())) combined.push({ ...mock, isOffline: true });
      });
      
      return { success: true, data: combined };
    } catch (fallbackError) {
      const mockMembers = JSON.parse(localStorage.getItem('mock_kam_members') || '[]');
      return { success: true, data: mockMembers };
    }
  }
};`;

// 2. Patch updateKAMMember
const oldUpdate = `export const updateKAMMember = async (kamId, updateData) => {
  try {
    const response = await axiosInstance.put(\`/department/members/\${kamId}\`, updateData, {
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to update KAM member:', error);
    throw error.response?.data || { message: 'Failed to update KAM member' };
  }
};`;

const newUpdate = `// Update KAM member with local fallback
export const updateKAMMember = async (kamId, updateData) => {
  try {
    const response = await axiosInstance.put(\`/department/members/\${kamId}\`, updateData, {
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data;
  } catch (error) {
    console.warn('Failed to update member on server, updating locally:', error.message);
    
    if (String(kamId).startsWith('offline-')) {
      const mockMembers = JSON.parse(localStorage.getItem('mock_kam_members') || '[]');
      const index = mockMembers.findIndex(m => m.id === kamId);
      if (index !== -1) {
        mockMembers[index] = { ...mockMembers[index], ...updateData };
        localStorage.setItem('mock_kam_members', JSON.stringify(mockMembers));
        return { success: true, data: mockMembers[index], message: 'Updated locally' };
      }
    }
    throw error.response?.data || { message: 'Failed to update KAM member' };
  }
};`;

let patched = content;
if (patched.includes(oldGet.replace(/\r\n/g, '\n'))) {
    patched = patched.replace(oldGet.replace(/\r\n/g, '\n'), newGet);
    console.log("Patched getAllKAMMembers");
} else {
    console.log("Could not find getAllKAMMembers");
}

if (patched.includes(oldUpdate.replace(/\r\n/g, '\n'))) {
    patched = patched.replace(oldUpdate.replace(/\r\n/g, '\n'), newUpdate);
    console.log("Patched updateKAMMember");
} else {
    console.log("Could not find updateKAMMember");
}

fs.writeFileSync(path, patched);
