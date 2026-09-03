"""Quick database viewer. Run: python showdb.py"""
import asyncio
from sqlalchemy import text
from app.database import engine

async def show():
    async with engine.connect() as c:
        tables = await c.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"))
        print(f"\n{'TABLE':<35} {'ROWS':>6}")
        print("=" * 43)
        for (t,) in tables:
            n = (await c.execute(text(f'SELECT COUNT(*) FROM "{t}"'))).scalar()
            print(f"  {t:<33} {n:>6}")

        print("\n  USERS")
        print("  " + "-" * 70)
        for r in (await c.execute(text("SELECT id, name, email, phone_number FROM users WHERE id LIKE 'user-%' ORDER BY id"))):
            print(f"  {r[0]:<16} {r[1]:<20} {r[2] or '':<30} {r[3] or ''}")

        print("\n  ACCOUNTS")
        print("  " + "-" * 70)
        for r in (await c.execute(text("SELECT user_id, upi_id, balance FROM accounts WHERE user_id LIKE 'user-%' ORDER BY user_id"))):
            print(f"  {r[0]:<16} {r[1]:<30} Rs {r[2]:>10}")

        print("\n  MERCHANT ACCOUNTS")
        print("  " + "-" * 70)
        for r in (await c.execute(text("SELECT u.name, a.upi_id FROM users u JOIN accounts a ON u.id = a.user_id WHERE u.id LIKE 'merch-%' OR u.id LIKE 'mule-%' ORDER BY u.name"))):
            print(f"  {r[0]:<25} {r[1]}")

        print("\n  BENEFICIARIES")
        print("  " + "-" * 70)
        for r in (await c.execute(text("SELECT user_id, name, upi_id, verified FROM beneficiaries ORDER BY user_id, name"))):
            v = "Y" if r[3] else "N"
            print(f"  {r[0]:<16} {r[1]:<25} {r[2]:<30} verified={v}")

        print("\n  RECENT TRANSACTIONS (last 20)")
        print("  " + "-" * 70)
        for r in (await c.execute(text("SELECT user_id, beneficiary_upi, amount, status, description FROM transactions ORDER BY created_at DESC LIMIT 20"))):
            print(f"  {r[0]:<16} -> {r[1]:<28} Rs {r[2]:>8}  {r[3]:<10} {r[4] or ''}")

        print("\n  H.I.V.E. RISK SIGNALS")
        print("  " + "-" * 70)
        for r in (await c.execute(text("SELECT entity_type, entity_value, severity, scam_type FROM risk_signals_v2 ORDER BY created_at DESC"))):
            print(f"  [{r[2]:>8}] {r[0]:<8} {r[1]:<40} {r[3]}")

        print("\n  BEHAVIORAL PROFILES")
        print("  " + "-" * 70)
        for r in (await c.execute(text("SELECT user_id, avg_transaction_amount, max_transaction_amount, total_transactions FROM behavioral_profiles ORDER BY user_id"))):
            print(f"  {r[0]:<16} avg=Rs {r[1]:>8.0f}  max=Rs {r[2]:>8.0f}  txns={r[3]}")

        print()

asyncio.run(show())
