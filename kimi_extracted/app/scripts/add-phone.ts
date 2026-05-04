import mysql from "mysql2/promise";
import fs from "fs";

const envContent = fs.readFileSync(".env", "utf-8");
const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1].trim() : null;

if (!databaseUrl) {
  console.error("DATABASE_URL not found in .env");
  process.exit(1);
}

async function addPhoneColumn() {
  const conn = await mysql.createConnection(databaseUrl);
  try {
    await conn.execute("ALTER TABLE users ADD COLUMN phone VARCHAR(32)");
    console.log("Phone column added successfully");
  } catch (err) {
    if ((err as any).code === "ER_DUP_FIELDNAME") {
      console.log("Phone column already exists");
    } else {
      throw err;
    }
  } finally {
    await conn.end();
  }
}

addPhoneColumn().catch(console.error);
