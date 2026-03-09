const axios = require('axios');

async function testApi() {
    try {
        console.log("Testing /api/suggest?q=iit...");
        const res = await axios.get('http://localhost:4000/api/suggest?q=iit');
        console.log("Response Status:", res.status);
        console.log("Response Data Length:", res.data.length);
        console.log("Suggestions:", JSON.stringify(res.data, null, 2));

        console.log("\nTesting /api/colleges?q=iit...");
        const res2 = await axios.get('http://localhost:4000/api/colleges?q=iit');
        console.log("Response Status:", res2.status);
        console.log("Response Pagination:", JSON.stringify(res2.data.pagination, null, 2));
        console.log("First College Name:", res2.data.data?.[0]?.name);
    } catch (err) {
        console.error("API Test Failed:");
        if (err.response) {
            console.error("Status:", err.response.status);
            console.error("Data:", JSON.stringify(err.response.data, null, 2));
        } else {
            console.error("Message:", err.message);
        }
    }
}

testApi();
