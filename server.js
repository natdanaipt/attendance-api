const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
console.log("Server version: 2.0");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// โ”€โ”€ API: เธ”เธถเธ records โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
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

// โ”€โ”€ API: เธ”เธถเธ employees โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
app.get("/api/employees", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM employees ORDER BY id::integer",
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// โ”€โ”€ API: เธ”เธถเธเธเนเธญเธกเธนเธฅเธ•เธฒเธก email (SSO) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
app.get("/api/me", async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: "เธเธฃเธธเธ“เธฒเธฃเธฐเธเธธ email" });

  try {
    const emp = await pool.query("SELECT * FROM employees WHERE email = $1", [
      email,
    ]);
    if (emp.rows.length === 0)
      return res.status(404).json({ error: "เนเธกเนเธเธเธเธเธฑเธเธเธฒเธ" });

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
app.get("/api/attendance/:empId", async (req, res) => {
  const { empId } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM attendance WHERE emp_id = $1 ORDER BY date DESC",
      [empId],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// โ”€โ”€ API: SSO Login โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
app.post("/api/sso/callback", async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "เนเธกเนเธกเธต code" });

  try {
    // เนเธฅเธ code เน€เธเนเธ token
    const credentials = Buffer.from(
      `${process.env.KMUTNB_CLIENT_ID}:${process.env.KMUTNB_CLIENT_SECRET}`,
    ).toString("base64");

    const tokenRes = await fetch("https://sso.kmutnb.ac.th/auth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.KMUTNB_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json();
    console.log("Token Response Status:", tokenRes.status); // โ เน€เธเธดเนเธก
    console.log("Token Data:", JSON.stringify(tokenData));
    if (!tokenRes.ok)
      return res.status(401).json({ error: "เนเธฅเธ token เนเธกเนเนเธ”เน" });

    // เธ”เธถเธเธเนเธญเธกเธนเธฅ profile
    const profileRes = await fetch(
      "https://sso.kmutnb.ac.th/resources/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      },
    );
    const profileData = await profileRes.json();
    const email = profileData.email;
    console.log("SSO Profile:", JSON.stringify(profileData));

    // เธซเธฒ employee เธเธฒเธ email
    const emp = await pool.query("SELECT * FROM employees WHERE email = $1", [
      email,
    ]);
    if (emp.rows.length === 0)
      return res.status(404).json({ error: "เนเธกเนเธเธเธเธเธฑเธเธเธฒเธเนเธเธฃเธฐเธเธ" });

    const userInfo = tokenData.user_info;

    await pool.query(`UPDATE employees SET name = $1 WHERE email = $2`, [
      userInfo?.display_name || emp.rows[0].name,
      email,
    ]);

    const updatedEmp = await pool.query(
      "SELECT * FROM employees WHERE email = $1",
      [email],
    );
    res.json({ employee: updatedEmp.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -- API: แก้ไขข้อมูลพนักงาน (Admin only) --
app.put("/api/employees/:id", async (req, res) => {
  const { id } = req.params;
  const { dept, pos } = req.body;
  try {
    const result = await pool.query(
      "UPDATE employees SET dept = $1, pos = $2 WHERE id = $3 RETURNING *",
      [dept, pos, id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "ไม่พบพนักงาน" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(5000, () => console.log("โ… API running on http://localhost:5000"));

