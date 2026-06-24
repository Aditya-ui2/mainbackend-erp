const { Lead, ClientMeeting } = require('../models/sequelizeModels');

/**
 * Return leads that belong to the Sales department (or owned by Sales/KAM users).
 * The auth middleware attaches `req.user` containing role/department info.
 */
const getSalesLeads = async (req, res) => {
  try {
    const leads = await Lead.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, leads });
  } catch (err) {
    console.error('Error fetching sales leads:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getSalesMeetings = async (req, res) => {
  try {
    const meetings = await ClientMeeting.findAll({
      order: [['meetingDate', 'ASC'], ['meetingTime', 'ASC']]
    });
    res.json({ success: true, meetings });
  } catch (err) {
    console.error('Error fetching sales meetings:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getSalesLeads, getSalesMeetings };
