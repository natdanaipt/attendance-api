import psycopg2
import json

conn = psycopg2.connect(
    host="localhost", port=5432,
    dbname="attendance", user="postgres", password="1234"
)
cur = conn.cursor()

# Export employees
cur.execute("SELECT id, name, dept, pos, gender FROM employees")
employees = cur.fetchall()

# Export attendance
cur.execute("SELECT emp_id, date, check_in, check_out FROM attendance")
attendance = cur.fetchall()

cur.close()
conn.close()

# สร้าง SQL file
with open("C:/attendance-api/data_final.sql", "w", encoding="utf-8") as f:
    for row in employees:
        id_, name, dept, pos, gender = row
        name = (name or "").replace("'", "''")
        dept = (dept or "").replace("'", "''")
        pos = (pos or "").replace("'", "''")
        gender = (gender or "").replace("'", "''")
        f.write(f"INSERT INTO employees (id, name, dept, pos, gender) VALUES ('{id_}', '{name}', '{dept}', '{pos}', '{gender}') ON CONFLICT DO NOTHING;\n")

    for row in attendance:
        emp_id, date, check_in, check_out = row
        check_in = f"'{check_in}'" if check_in else "NULL"
        check_out = f"'{check_out}'" if check_out else "NULL"
        f.write(f"INSERT INTO attendance (emp_id, date, check_in, check_out) VALUES ('{emp_id}', '{date}', {check_in}, {check_out}) ON CONFLICT DO NOTHING;\n")

print("Done! data_final.sql created")