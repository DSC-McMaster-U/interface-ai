import psycopg

try:
    with psycopg.connect(
        host="34.130.177.250",
        port=5432,
        dbname="interfaceai-db",
        user="postgres",
        password="=JVO7L6=@>qYO$m,"
    ) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT table_name, column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                ORDER BY table_name, ordinal_position;
            """)
            rows = cur.fetchall()
            if not rows:
                print("No tables found in public schema.")
            else:
                for r in rows:
                    print(r)
except Exception as e:
    print("Error:", e)
