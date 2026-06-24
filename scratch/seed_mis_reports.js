const { DailyReport } = require('../models/sequelizeModels');

async function seedReports() {
    const today = new Date().toISOString().split('T')[0];
    const members = [
        { id: '13b9f804-91ea-4d5a-afc0-8a9da6e27e0f', name: 'Jyoti Vermaa' },
        { id: '3abdae88-7f78-42a5-a802-295b259e16d6', name: 'lakhan' },
        { id: '28e15eed-8297-440a-b8cd-976be26bc048', name: 'Ashwin (Manager)' }
    ];

    for (const m of members) {
        await DailyReport.upsert({
            memberId: m.id,
            memberName: m.name,
            department: 'HR Recruitment',
            date: today,
            summary: `Automated report for ${m.name} for testing. Working on active job openings.`,
            callsCount: Math.floor(Math.random() * 40) + 10,
            profilesVisited: Math.floor(Math.random() * 80) + 20,
            profilesShared: Math.floor(Math.random() * 10) + 2,
            candidatesContacted: Math.floor(Math.random() * 20) + 5,
            interviewsArranged: Math.floor(Math.random() * 5),
            mood: 'Great',
            checkInTime: '09:00',
            checkOutTime: '18:00',
            workHours: 9.0
        });
    }
    console.log('✅ Seeded 3 reports for today');
    process.exit(0);
}

seedReports().catch(err => {
    console.error(err);
    process.exit(1);
});
