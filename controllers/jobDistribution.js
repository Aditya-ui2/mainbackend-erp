const { RecruitmentPosition, Client } = require('../models/sequelizeModels');
const { Op } = require('sequelize');

// =============================================
// HELPER: Build Google Jobs JSON-LD
// =============================================
function buildGoogleJobsJsonLd(position, clientName, baseUrl) {
    return {
        "@context": "https://schema.org/",
        "@type": "JobPosting",
        "title": position.title,
        "description": position.description || position.title,
        "datePosted": position.postedDate || position.createdAt || new Date().toISOString(),
        "validThrough": position.deadline || undefined,
        "employmentType": mapEmploymentType(position.type),
        "hiringOrganization": {
            "@type": "Organization",
            "name": clientName || "Mabicons",
            "sameAs": "https://www.mabicons.com"
        },
        "jobLocation": {
            "@type": "Place",
            "address": {
                "@type": "PostalAddress",
                "addressLocality": position.location || "Remote",
                "addressCountry": "IN"
            }
        },
        "baseSalary": position.salary ? {
            "@type": "MonetaryAmount",
            "currency": "INR",
            "value": { "@type": "QuantitativeValue", "value": position.salary }
        } : undefined,
        "experienceRequirements": position.experience || undefined,
        "url": `${baseUrl}/api/public/jobs/${position.id}`,
    };
}

function mapEmploymentType(type) {
    const map = { 'Full-time': 'FULL_TIME', 'Part-time': 'PART_TIME', 'Contract': 'CONTRACTOR', 'Internship': 'INTERN' };
    return map[type] || 'FULL_TIME';
}

// =============================================
// HELPER: Build XML feed entry for a single job
// =============================================
function buildJobXmlEntry(position, clientName, baseUrl) {
    const escXml = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return `  <job>
    <title><![CDATA[${position.title || ''}]]></title>
    <date><![CDATA[${position.postedDate || position.createdAt || new Date().toISOString()}]]></date>
    <referencenumber><![CDATA[${position.id}]]></referencenumber>
    <url><![CDATA[${baseUrl}/api/public/jobs/${position.id}]]></url>
    <company><![CDATA[${clientName || 'Mabicons'}]]></company>
    <city><![CDATA[${position.location || 'Remote'}]]></city>
    <country><![CDATA[IN]]></country>
    <description><![CDATA[${position.description || position.title || ''}]]></description>
    <salary><![CDATA[${position.salary || ''}]]></salary>
    <jobtype><![CDATA[${position.type || 'Full-time'}]]></jobtype>
    <experience><![CDATA[${position.experience || ''}]]></experience>
    <skills><![CDATA[${Array.isArray(position.skills) ? position.skills.join(', ') : ''}]]></skills>
    <category><![CDATA[IT Jobs]]></category>
  </job>`;
}

// =============================================
// PUBLIC: XML Job Feed (for Indeed, Jooble, Adzuna crawlers)
// GET /api/public/jobs-feed.xml
// =============================================
const getPublicJobsFeedXml = async (req, res) => {
    try {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const positions = await RecruitmentPosition.findAll({
            where: { status: 'Open' },
            include: [{ model: Client, as: 'client', attributes: ['id', 'companyName', 'name'] }],
            order: [['postedDate', 'DESC']],
        });

        const jobEntries = positions.map(pos => {
            const clientName = pos.client?.companyName || pos.client?.name || 'Mabicons';
            return buildJobXmlEntry(pos, clientName, baseUrl);
        }).join('\n');

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<source>
  <publisher>Mabicons</publisher>
  <publisherurl>https://www.mabicons.com</publisherurl>
  <lastBuildDate>${new Date().toISOString()}</lastBuildDate>
${jobEntries}
</source>`;

        res.set('Content-Type', 'application/xml');
        return res.send(xml);
    } catch (error) {
        console.error('Error generating job feed:', error);
        return res.status(500).json({ error: 'Failed to generate job feed' });
    }
};

// =============================================
// PUBLIC: Single Job Page with JSON-LD (for Google Jobs)
// GET /api/public/jobs/:id
// =============================================
const getPublicJobPage = async (req, res) => {
    try {
        const { id } = req.params;
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const position = await RecruitmentPosition.findByPk(id, {
            include: [{ model: Client, as: 'client', attributes: ['id', 'companyName', 'name'] }],
        });

        if (!position || position.status !== 'Open') {
            return res.status(404).json({ error: 'Job not found or no longer open' });
        }

        const clientName = position.client?.companyName || position.client?.name || 'Mabicons';
        const jsonLd = buildGoogleJobsJsonLd(position, clientName, baseUrl);
        const skills = Array.isArray(position.skills) ? position.skills : [];

        // Return HTML page with embedded JSON-LD for Google Jobs indexing
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${position.title} - Mabicons Careers</title>
  <meta name="description" content="${(position.description || position.title).substring(0, 160)}">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a2e; }
    h1 { color: #1B4DA0; } .meta { color: #666; margin: 8px 0; } .badge { display: inline-block; background: #e8f0fe; color: #1B4DA0; padding: 4px 12px; border-radius: 20px; font-size: 13px; margin: 4px 4px 4px 0; }
    .section { margin: 24px 0; } .section h2 { font-size: 18px; color: #333; border-bottom: 2px solid #1B4DA0; padding-bottom: 8px; }
    .apply-btn { display: inline-block; background: #1B4DA0; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 16px; }
  </style>
</head>
<body>
  <img src="https://www.mabicons.com/logo.png" alt="Mabicons" style="height:40px;margin-bottom:20px;" onerror="this.style.display='none'">
  <h1>${position.title}</h1>
  <p class="meta">📍 ${position.location || 'Remote'} &nbsp;|&nbsp; 💼 ${position.type || 'Full-time'} &nbsp;|&nbsp; 🏢 ${clientName}</p>
  ${position.salary ? `<p class="meta">💰 ${position.salary}</p>` : ''}
  ${position.experience ? `<p class="meta">📋 Experience: ${position.experience}</p>` : ''}
  <p class="meta">📅 Posted: ${position.postedDate ? new Date(position.postedDate).toLocaleDateString() : 'Recently'}</p>
  ${position.deadline ? `<p class="meta">⏰ Deadline: ${new Date(position.deadline).toLocaleDateString()}</p>` : ''}
  
  <div class="section">
    <h2>Description</h2>
    <p>${position.description || 'No description available.'}</p>
  </div>
  
  ${skills.length > 0 ? `<div class="section"><h2>Skills Required</h2><div>${skills.map(s => `<span class="badge">${s}</span>`).join('')}</div></div>` : ''}
  
  <div class="section">
    <p><strong>Openings:</strong> ${position.openings || 1} &nbsp;|&nbsp; <strong>Priority:</strong> ${position.priority || 'Medium'}</p>
  </div>
  
  <a href="mailto:hr@mabicons.com?subject=Application for ${encodeURIComponent(position.title)}" class="apply-btn">Apply Now</a>
  <p style="margin-top:40px;color:#999;font-size:12px;">&copy; ${new Date().getFullYear()} Mabicons Digital Solutions</p>
</body>
</html>`;

        res.set('Content-Type', 'text/html');
        return res.send(html);
    } catch (error) {
        console.error('Error generating job page:', error);
        return res.status(500).json({ error: 'Failed to load job page' });
    }
};

// =============================================
// PUBLIC: JSON list of all open jobs (API for frontend careers page)
// GET /api/public/jobs
// =============================================
const getPublicJobsList = async (req, res) => {
    try {
        const positions = await RecruitmentPosition.findAll({
            where: { status: 'Open' },
            attributes: ['id', 'title', 'description', 'location', 'type', 'salary', 'experience', 'skills', 'openings', 'priority', 'postedDate', 'deadline'],
            include: [{ model: Client, as: 'client', attributes: ['companyName', 'name'] }],
            order: [['postedDate', 'DESC']],
        });

        const jobs = positions.map(pos => ({
            id: pos.id,
            title: pos.title,
            description: pos.description,
            location: pos.location,
            type: pos.type,
            salary: pos.salary,
            experience: pos.experience,
            skills: pos.skills,
            openings: pos.openings,
            priority: pos.priority,
            postedDate: pos.postedDate,
            deadline: pos.deadline,
            company: pos.client?.companyName || pos.client?.name || 'Mabicons',
        }));

        return res.json({ count: jobs.length, jobs });
    } catch (error) {
        console.error('Error fetching public jobs:', error);
        return res.status(500).json({ error: 'Failed to fetch jobs' });
    }
};

// =============================================
// AUTHENTICATED: Distribute job to selected platforms
// POST /recruitment/positions/:id/distribute
// =============================================
const distributeJobToPlatforms = async (req, res) => {
    try {
        const { id } = req.params;
        const { platforms } = req.body;

        if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
            return res.status(400).json({ error: 'Please select at least one platform' });
        }

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const position = await RecruitmentPosition.findByPk(id, {
            include: [{ model: Client, as: 'client' }]
        });

        if (!position) {
            return res.status(404).json({ error: 'Position not found' });
        }

        const clientName = position.client?.companyName || position.client?.name || 'Mabicons';
        const results = [];

        for (const platform of platforms) {
            switch (platform) {
                case 'google_jobs': {
                    // Google Jobs indexes via JSON-LD on the public job page — automatic
                    const jsonLd = buildGoogleJobsJsonLd(position, clientName, baseUrl);
                    results.push({
                        success: true,
                        platform: 'google_jobs',
                        data: {
                            jsonLd,
                            publicUrl: `${baseUrl}/api/public/jobs/${position.id}`,
                            message: 'Job page with JSON-LD is live. Google will auto-index it.'
                        }
                    });
                    break;
                }
                case 'mabicons_website': {
                    results.push({
                        success: true,
                        platform: 'mabicons_website',
                        data: {
                            publicUrl: `${baseUrl}/api/public/jobs/${position.id}`,
                            careersPage: `${baseUrl}/api/public/jobs`,
                            message: 'Job is live on public careers page'
                        }
                    });
                    break;
                }
                case 'linkedin': {
                    const jobUrl = `${baseUrl}/api/public/jobs/${position.id}`;
                    const text = `We're hiring: ${position.title} at ${position.location || 'our company'}! Apply now: ${jobUrl}`;
                    const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(jobUrl)}`;
                    results.push({
                        success: true,
                        platform: 'linkedin',
                        data: { shareUrl, message: 'LinkedIn share URL generated' }
                    });
                    break;
                }
                case 'indeed': {
                    // Indeed crawls the XML feed — job is automatically included
                    results.push({
                        success: true,
                        platform: 'indeed',
                        data: {
                            feedUrl: `${baseUrl}/api/public/jobs-feed.xml`,
                            message: 'Job included in XML feed. Submit feed URL to Indeed employer dashboard for crawling.'
                        }
                    });
                    break;
                }
                case 'jooble': {
                    // Jooble crawls XML feeds — register feed URL at jooble.org/partner/advertise
                    results.push({
                        success: true,
                        platform: 'jooble',
                        data: {
                            feedUrl: `${baseUrl}/api/public/jobs-feed.xml`,
                            partnerUrl: 'https://jooble.org/partner/advertise',
                            message: 'Job included in XML feed. Register feed URL at Jooble partner portal (one-time setup).'
                        }
                    });
                    break;
                }
                case 'adzuna': {
                    // Adzuna crawls XML feeds — register at developer.adzuna.com
                    results.push({
                        success: true,
                        platform: 'adzuna',
                        data: {
                            feedUrl: `${baseUrl}/api/public/jobs-feed.xml`,
                            partnerUrl: 'https://developer.adzuna.com/signup',
                            message: 'Job included in XML feed. Register feed URL with Adzuna (one-time setup).'
                        }
                    });
                    break;
                }
                default:
                    results.push({ success: false, platform, error: 'Unknown platform' });
            }
        }

        // Store distribution info on the position
        await position.update({
            distributedPlatforms: platforms,
            distributionResults: results,
            lastDistributedAt: new Date()
        });

        return res.json({
            message: `Job distributed to ${results.length} platform(s)`,
            feedUrl: `${baseUrl}/api/public/jobs-feed.xml`,
            jobPageUrl: `${baseUrl}/api/public/jobs/${position.id}`,
            results
        });
    } catch (error) {
        console.error('Job distribution error:', error);
        return res.status(500).json({ error: 'Failed to distribute job to platforms' });
    }
};

module.exports = {
    distributeJobToPlatforms,
    getPublicJobsFeedXml,
    getPublicJobPage,
    getPublicJobsList,
};
