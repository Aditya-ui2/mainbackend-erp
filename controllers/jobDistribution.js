const { RecruitmentPosition, Client } = require('../models/sequelizeModels');
const axios = require('axios');

/**
 * Build Google Jobs JSON-LD structured data for a position.
 * This can be embedded on a public page to get indexed by Google Jobs.
 */
function buildGoogleJobsJsonLd(position, clientName) {
    return {
        "@context": "https://schema.org/",
        "@type": "JobPosting",
        "title": position.title,
        "description": position.description || position.title,
        "datePosted": position.postedDate || new Date().toISOString(),
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
                "addressLocality": position.location || "Remote"
            }
        },
        "baseSalary": position.salary ? {
            "@type": "MonetaryAmount",
            "currency": "INR",
            "value": {
                "@type": "QuantitativeValue",
                "value": position.salary
            }
        } : undefined,
        "skills": Array.isArray(position.skills) ? position.skills.join(', ') : '',
        "experienceRequirements": position.experience || undefined,
    };
}

function mapEmploymentType(type) {
    const map = {
        'Full-time': 'FULL_TIME',
        'Part-time': 'PART_TIME',
        'Contract': 'CONTRACTOR',
        'Internship': 'INTERN'
    };
    return map[type] || 'FULL_TIME';
}

/**
 * Post job to Arbeitnow (free job board API)
 * Docs: https://documenter.getpostman.com/view/18545278/UVsEVpHJ
 */
async function postToArbeitnow(position, clientName) {
    try {
        const payload = {
            company_name: clientName || 'Mabicons',
            title: position.title,
            description: position.description || position.title,
            remote: position.location?.toLowerCase().includes('remote'),
            location: position.location || 'India',
            tags: Array.isArray(position.skills) ? position.skills.slice(0, 5) : [],
            job_types: [position.type || 'Full-time'],
            url: `https://www.mabicons.com/careers/${position.id}`,
        };

        const response = await axios.post('https://www.arbeitnow.com/api/job-board-api', payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000,
        });
        return { success: true, platform: 'arbeitnow', data: response.data };
    } catch (error) {
        return { success: false, platform: 'arbeitnow', error: error.message };
    }
}

/**
 * Post to Jooble (free aggregator XML feed endpoint)
 */
async function postToJooble(position, clientName) {
    try {
        const payload = {
            title: position.title,
            location: position.location || 'India',
            company: clientName || 'Mabicons',
            description: position.description || position.title,
            salary: position.salary || '',
            source: 'https://www.mabicons.com',
            url: `https://www.mabicons.com/careers/${position.id}`,
            type: position.type || 'Full-time',
        };

        // Jooble partner API
        const apiKey = process.env.JOOBLE_API_KEY;
        if (!apiKey) {
            return { success: false, platform: 'jooble', error: 'JOOBLE_API_KEY not configured' };
        }
        const response = await axios.post(`https://jooble.org/api/${apiKey}`, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000,
        });
        return { success: true, platform: 'jooble', data: response.data };
    } catch (error) {
        return { success: false, platform: 'jooble', error: error.message };
    }
}

/**
 * Post to Adzuna (free job aggregator)
 */
async function postToAdzuna(position, clientName) {
    try {
        const apiKey = process.env.ADZUNA_API_KEY;
        const appId = process.env.ADZUNA_APP_ID;
        if (!apiKey || !appId) {
            return { success: false, platform: 'adzuna', error: 'ADZUNA_API_KEY or ADZUNA_APP_ID not configured' };
        }

        const payload = {
            title: position.title,
            description: position.description || position.title,
            location: position.location || 'India',
            company: clientName || 'Mabicons',
            salary_min: position.salary || '',
            category: 'it-jobs',
            contract_type: position.type === 'Full-time' ? 'permanent' : 'contract',
            redirect_url: `https://www.mabicons.com/careers/${position.id}`,
        };

        const response = await axios.post(
            `https://api.adzuna.com/v1/api/jobs/in/post?app_id=${encodeURIComponent(appId)}&app_key=${encodeURIComponent(apiKey)}`,
            payload,
            { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
        );
        return { success: true, platform: 'adzuna', data: response.data };
    } catch (error) {
        return { success: false, platform: 'adzuna', error: error.message };
    }
}

/**
 * Generate a shareable LinkedIn job post URL
 */
function generateLinkedInShareUrl(position) {
    const text = `We're hiring: ${position.title} at ${position.location || 'our company'}! Apply now.`;
    const url = `https://www.mabicons.com/careers/${position.id}`;
    return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`;
}

/**
 * Generate Indeed XML feed data for a job
 */
function generateIndeedFeedEntry(position, clientName) {
    return {
        title: position.title,
        date: position.postedDate || new Date().toISOString(),
        referencenumber: position.id,
        url: `https://www.mabicons.com/careers/${position.id}`,
        company: clientName || 'Mabicons',
        city: position.location || 'Remote',
        country: 'IN',
        description: position.description || position.title,
        salary: position.salary || '',
        jobtype: position.type || 'Full-time',
        experience: position.experience || '',
    };
}

/**
 * Main controller: Distribute a job to selected platforms
 */
const distributeJobToPlatforms = async (req, res) => {
    try {
        const { id } = req.params;
        const { platforms } = req.body;

        if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
            return res.status(400).json({ error: 'Please select at least one platform' });
        }

        // Fetch position with client details
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
                    const jsonLd = buildGoogleJobsJsonLd(position, clientName);
                    results.push({
                        success: true,
                        platform: 'google_jobs',
                        data: { jsonLd, message: 'JSON-LD structured data generated. Embed on public careers page for Google indexing.' }
                    });
                    break;
                }
                case 'mabicons_website': {
                    // Internal — position is already in DB and accessible via API
                    results.push({
                        success: true,
                        platform: 'mabicons_website',
                        data: { url: `https://www.mabicons.com/careers/${position.id}`, message: 'Job listed on Mabicons careers page' }
                    });
                    break;
                }
                case 'linkedin': {
                    const shareUrl = generateLinkedInShareUrl(position);
                    results.push({
                        success: true,
                        platform: 'linkedin',
                        data: { shareUrl, message: 'LinkedIn share URL generated' }
                    });
                    break;
                }
                case 'indeed': {
                    const feedEntry = generateIndeedFeedEntry(position, clientName);
                    results.push({
                        success: true,
                        platform: 'indeed',
                        data: { feedEntry, message: 'Indeed XML feed entry generated. Add to /api/jobs-feed.xml for Indeed to crawl.' }
                    });
                    break;
                }
                case 'jooble': {
                    const joobleResult = await postToJooble(position, clientName);
                    results.push(joobleResult);
                    break;
                }
                case 'adzuna': {
                    const adzunaResult = await postToAdzuna(position, clientName);
                    results.push(adzunaResult);
                    break;
                }
                default:
                    results.push({ success: false, platform, error: 'Unknown platform' });
            }
        }

        // Store distribution results on the position
        await position.update({
            distributedPlatforms: platforms,
            distributionResults: results,
            lastDistributedAt: new Date()
        });

        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        return res.json({
            message: `Distributed to ${successCount} platform(s)${failCount > 0 ? `, ${failCount} failed` : ''}`,
            results
        });
    } catch (error) {
        console.error('Job distribution error:', error);
        return res.status(500).json({ error: 'Failed to distribute job to platforms' });
    }
};

module.exports = { distributeJobToPlatforms };
