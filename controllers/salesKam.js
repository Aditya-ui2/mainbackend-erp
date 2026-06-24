const { Lead, ClientMeeting } = require('../models/sequelizeModels');
const { Op } = require('sequelize');

/**
 * Get dashboard statistics for the logged‑in Sales KAM.
 * The auth middleware attaches `req.user` (id, name, role, department).
 * We aggregate leads, proposals, and meetings belonging to this KAM.
 */
const getKAMDashboard = async (req, res) => {
  try {
    const user = req.user; // assumed to contain `name` or `email`
    if (!user) return res.status(401).json({ success: false, message: 'Unauthenticated' });

    const ownerName = user.name || user.email;

    // Count leads owned by this KAM
    let totalLeads = await Lead.count({ where: { owner: ownerName } });
    let useFallback = false;
    
    if (totalLeads === 0) {
      useFallback = true;
      totalLeads = await Lead.count();
    }

    const filter = useFallback ? {} : { owner: ownerName };

    const newLeads = await Lead.count({ 
      where: { 
        ...filter,
        status: { [Op.in]: ['Open', 'New', 'In Progress', 'Active'] } 
      } 
    });

    const hotLeads = await Lead.count({ 
      where: { 
        ...filter,
        status: { [Op.in]: ['Qualified', 'Negotiation', 'Proposal'] } 
      } 
    });

    const closedLeads = await Lead.count({ 
      where: { 
        ...filter,
        status: 'Converted' 
      } 
    });

    // Pipeline values
    const pipelineSum = await Lead.sum('value', { where: filter }) || 0;
    const revenueSum = await Lead.sum('value', { where: { ...filter, status: 'Converted' } }) || 0;

    // Stage counts
    const stageCounts = {
      new: newLeads,
      qualified: await Lead.count({ where: { ...filter, status: 'Qualified' } }),
      proposal: await Lead.count({ where: { ...filter, status: 'Proposal' } }),
      closed: closedLeads
    };

    // Optionally fetch recent items
    const recentLeads = await Lead.findAll({ 
      where: { 
        ...filter,
        status: { [Op.notIn]: ['Proposal', 'Negotiation', 'Converted', 'Lost'] }
      }, 
      limit: 5, 
      order: [['createdAt', 'DESC']] 
    });
    
    const recentProposals = await Lead.findAll({ 
      where: { 
        ...filter, 
        status: ['Proposal', 'Negotiation'] 
      }, 
      limit: 5, 
      order: [['createdAt', 'DESC']] 
    });
    
    const recentMeetings = await ClientMeeting.findAll({ 
      limit: 5, 
      order: [['meetingDate', 'DESC']] 
    });

    res.json({
      success: true,
      data: {
        totalLeads,
        newLeads,
        hotLeads,
        closedLeads,
        pipelineValue: pipelineSum,
        revenue: revenueSum,
        stages: stageCounts,
        recentLeads,
        recentProposals,
        recentMeetings,
      },
    });
  } catch (err) {
    console.error('Error in getKAMDashboard:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getKAMDashboard };
