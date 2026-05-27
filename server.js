const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── API: ดึง records ──────────────────────────────
app.get("/api/records", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM attendance ORDER BY date DESC",
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: ดึง employees ────────────────────────────
app.get("/api/employees", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM employees ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: ดึงข้อมูลตาม email (SSO) ────────────────
app.get("/api/me", async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: "กรุณาระบุ email" });

  try {
    const emp = await pool.query("SELECT * FROM employees WHERE email = $1", [
      email,
    ]);
    if (emp.rows.length === 0)
      return res.status(404).json({ error: "ไม่พบพนักงาน" });

    const empId = emp.rows[0].id;
    const attendance = await pool.query(
      "SELECT * FROM attendance WHERE emp_id = $1 ORDER BY date DESC",
      [empId],
    );

    res.json({
      employee: emp.rows[0],
      attendance: attendance.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(5000, () => console.log("✅ API running on http://localhost:5000"));
