import { fetchSheetData } from "./src/lib/sheets-api";
async function run() {
  try {
    const data = await fetchSheetData("1Ow4oie7qeXryuDiiFxwgyULnc93M17o3WiZY4nU5mYo", "22. TEBANG PANGKAS", []);
    console.log(JSON.stringify(data.headers));
  } catch (e) {
    console.error(e);
  }
}
run();
