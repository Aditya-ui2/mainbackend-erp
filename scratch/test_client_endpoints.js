const { createClient, editClient } = require('../controllers/client');
const { Client } = require('../models/sequelizeModels');

async function runTests() {
    console.log('--- Starting Client Controller Tests ---');

    // 0. Negative Test: Test with an invalid email address format
    console.log('--- Running Negative Email Format Test ---');
    const invalidEmailReq = {
        body: {
            companyName: 'Test Onboarding Client LLC',
            owner1Email: '34', // invalid email format
            spocEmail: 'john.spoc@testonboarding.com',
            spocName: 'John SPOC'
        }
    };

    let negativeTestPassed = false;
    const invalidEmailRes = {
        status: (code) => {
            console.log(`[Negative Test] Response Code: ${code}`);
            if (code === 400) {
                negativeTestPassed = true;
            }
            return {
                json: (data) => {
                    console.log('[Negative Test] Response Data:', JSON.stringify(data, null, 2));
                }
            };
        }
    };

    await createClient(invalidEmailReq, invalidEmailRes);

    if (!negativeTestPassed) {
        console.error('❌ Negative test failed: Server did not return a 400 status for an invalid email.');
        process.exit(1);
    }
    console.log('✅ Negative email format test passed successfully! (Returned expected 400 Bad Request)');

    // 1. Mock request body for createClient (using new frontend form fields)
    console.log('--- Running Positive Onboarding Test ---');
    const createReq = {
        body: {
            companyName: 'Test Onboarding Client LLC',
            gstNumber: '27AAAAA1111A1Z1',
            cin: 'U11111MH2026PTC111111',
            pan: 'ABCDE1234F',
            industry: 'Technology',
            address: '123 Tech Park, Phase 2',
            city: 'Mumbai',
            state: 'Maharashtra',
            pinCode: '400001',
            owner1Name: 'Jane Owner',
            owner1Email: 'jane.owner@testonboarding.com',
            spocName: 'John SPOC',
            spocPhone: '9876543210',
            spocEmail: 'john.spoc@testonboarding.com',
            agreementType: 'Retainer',
            agreementStartDate: '2026-06-02',
            feeValue: '50000',
            paymentTerms: 'Net 30',
            totalEmployees: '50',
            workingModel: 'Hybrid',
            esiApplicable: 'Yes',
            leadSource: 'Referral',
            notes: 'Test client notes'
        }
    };

    let createdClientData = null;

    const createRes = {
        status: (code) => {
            console.log(`[Create] Response Code: ${code}`);
            return {
                json: (data) => {
                    console.log('[Create] Response Data:', JSON.stringify(data, null, 2));
                    if (data.success) {
                        createdClientData = data.data;
                    }
                }
            };
        }
    };

    try {
        // Run createClient
        await createClient(createReq, createRes);

        if (!createdClientData) {
            console.error('❌ Client creation failed or returned no data.');
            process.exit(1);
        }

        console.log('✅ Client created successfully in DB!');

        // 2. Mock request body for editClient
        const editReq = {
            body: {
                clientId: createdClientData.id,
                companyName: 'Updated Onboarding Client LLC',
                owner1Name: 'Jane Owner Updated',
                feeValue: '60000',
                status: 'Active'
            }
        };

        const editRes = {
            status: (code) => {
                console.log(`[Edit] Response Code: ${code}`);
                return {
                    json: (data) => {
                        console.log('[Edit] Response Data:', JSON.stringify(data, null, 2));
                    }
                };
            }
        };

        // Run editClient
        await editClient(editReq, editRes);

        // Clean up test client from DB
        await Client.destroy({ where: { id: createdClientData.id } });
        console.log('✅ Cleaned up test client from DB.');
        console.log('🎉 All Client controller tests passed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        process.exit(1);
    }
}

runTests();
