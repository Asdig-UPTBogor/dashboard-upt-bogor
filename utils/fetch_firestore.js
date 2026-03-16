const { google } = require('googleapis');

async function run() {
    console.warn("Mendapatkan kredensial Firestore...");
    // Load default credentials from environment
    const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/datastore'] });
    const client = await auth.getClient();
    const tokenOptions = await client.getAccessToken();
    const token = typeof tokenOptions === 'string' ? tokenOptions : tokenOptions?.token;

    const url = `https://firestore.googleapis.com/v1/projects/gcp-bridge-meshvpn/databases/(default)/documents/dashboard_pages?pageSize=100`;

    console.warn("Menarik koleksi dashboard_pages...");
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();

    // Dump JSON array of documents to stdout
    console.log(JSON.stringify(json, null, 2));
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
