// scratch/test_kpi_details.js

const dbConnect = require('../db/db');
const { getDashboardKpiDetails } = require('../controllers/superAdmin');

const runTest = async () => {
    try {
        console.log("Connecting to Database...");
        await dbConnect();
        console.log("Database connected. Running KPI tests...");

        const kpiTypes = [
            'total_monthly_billing',
            'total_yearly_revenue',
            'total_revenue',
            'operations_billing',
            'recruitment_billing',
            'sales_revenue',
            'office_rent',
            'salary_payout',
            'net_profit'
        ];

        for (const type of kpiTypes) {
            console.log(`\n=================== Testing KPI Type: ${type} ===================`);
            const mockReq = {
                query: { type }
            };
            let responseData = null;
            const mockRes = {
                status: function(code) {
                    this.statusCode = code;
                    return this;
                },
                json: function(data) {
                    responseData = data;
                    return this;
                }
            };

            await getDashboardKpiDetails(mockReq, mockRes);
            console.log("Status Code:", mockRes.statusCode || 200);
            if (responseData && responseData.success) {
                console.log(`Success: true, Count of records: ${responseData.data ? responseData.data.length : 0}`);
                if (responseData.data && responseData.data.length > 0) {
                    console.log("First record preview:", responseData.data[0]);
                }
            } else {
                console.log("Failure response:", responseData);
            }
        }

        console.log("\nAll tests completed. Exiting...");
        process.exit(0);
    } catch (e) {
        console.error("Test execution failed:", e);
        process.exit(1);
    }
};

runTest();
