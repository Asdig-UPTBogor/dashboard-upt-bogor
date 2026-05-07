async function run() {
  const res = await fetch('http://localhost:3000/api/page-data?page=/transmisi/program-kerja');
  const data = await res.json();
  const rows = data.data?.sheets?.[0]?.rows || [];
  console.log("Total rows in BQ:", rows.length);
  if (rows.length > 0) {
    console.log("First row keys:", Object.keys(rows[0]));
    console.log("First row data:", rows[0]);
  }
}
run().catch(console.error);
