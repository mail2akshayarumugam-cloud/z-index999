"""
Seed data for Scam Shield — 3 realistic user profiles.

User 1: Arjun Kumar    — Software engineer in Bangalore, steady salary patterns.
User 2: Neha Gupta     — Marketing professional in Bangalore, Arjun's college friend.
User 3: Vikram Reddy   — Poses as a freelance "investment advisor" / "customer support".
                         Actually a scammer — but his profile looks plausible at first.

Arjun and Neha are friends: they split rent, share Swiggy/Zomato bills, send each
other money for birthdays and trips.  Vikram contacted Neha via WhatsApp claiming
to be from her bank's "investment desk" — H.I.V.E. flagged that message as a scam.

All data is synthetic — no real personal information.
"""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from app.database import engine, async_session, Base
from app.models.tables import User, Message, ScamDetection
from app.models.financial import (
    Account, Device, Beneficiary, Transaction, TransactionAttempt,
    LoginEvent, AccountEvent, BeneficiaryEvent, BehavioralProfile,
    RiskSignalV2,
)
from app.routers.auth import hash_password


def _id():
    return str(uuid.uuid4())


def _ts(days_ago=0, hours_ago=0, minutes_ago=0):
    return datetime.now(timezone.utc) - timedelta(
        days=days_ago, hours=hours_ago, minutes=minutes_ago
    )


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # ================================================================
        # USERS
        # ================================================================
        arjun = User(
            id="user-arjun", name="Arjun Kumar",
            phone_number="+919845012345", email="arjun.kumar7@gmail.com",
            password_hash=hash_password("arjun@123"),
            upi_pin_hash=hash_password("1234"),
            security_question="What nickname does your family call you?",
            security_answer_hash=hash_password("aju"),
        )
        neha = User(
            id="user-neha", name="Neha Gupta",
            phone_number="+919632098765", email="neha.gupta92@gmail.com",
            password_hash=hash_password("neha@123"),
            upi_pin_hash=hash_password("5678"),
            security_question="What nickname does your family call you?",
            security_answer_hash=hash_password("nini"),
        )
        vikram = User(
            id="user-vikram", name="Vikram Reddy",
            phone_number="+919900088877", email="vikram.reddy@proton.me",
            password_hash=hash_password("vikram@123"),
            upi_pin_hash=hash_password("9999"),
            security_question="What nickname does your family call you?",
            security_answer_hash=hash_password("vicky"),
        )
        # Authority user — CFO / Manager who approves high-risk transactions
        authority = User(
            id="user-authority", name="Rajesh Mehta (CFO)",
            phone_number="+919800000100", email="rajesh.mehta@company.com",
            password_hash=hash_password("admin@123"),
            role="authority",
        )

        for u in [arjun, neha, vikram, authority]:
            db.add(u)
        await db.flush()

        # ================================================================
        # MERCHANT ACCOUNTS (system-level UPI entities)
        #   Real businesses that anyone can pay. They exist as "users"
        #   with accounts so UPI validation passes for all payers.
        # ================================================================
        merchants = [
            ("merch-swiggy",     "Swiggy",               "swiggy@axl",              Decimal("0")),
            ("merch-zomato",     "Zomato",                "zomato@hdfcbank",         Decimal("0")),
            ("merch-dmart",      "D-Mart HSR Layout",     "dmart.hsr@okicici",       Decimal("0")),
            ("merch-myntra",     "Myntra",                "myntra@ybl",              Decimal("0")),
            ("merch-netflix",    "Netflix India",         "netflix@axl",             Decimal("0")),
            ("merch-bescom",     "BESCOM Electricity",    "bescom.blr@oksbi",        Decimal("0")),
            ("merch-act",        "ACT Fibernet",          "actcorp@icici",           Decimal("0")),
            ("merch-cultfit",    "Cult.fit Koramangala",  "cultfit.krmgla@okaxis",   Decimal("0")),
            ("merch-jio",        "Jio Recharge",          "jiorecharge@axl",         Decimal("0")),
            ("merch-srinivas",   "Srinivas PG",           "srinivas.pg@okaxis",      Decimal("0")),
            ("merch-kavitha",    "Kavitha (Landlord)",    "kavitha.m@oksbi",         Decimal("0")),
            ("merch-babu",       "Babu Hostel",           "babu.hostel@oksbi",       Decimal("0")),
            ("merch-annapurna",  "Annapurna Mess",        "annapurna.mess@paytm",    Decimal("0")),
            ("merch-rgupta",     "R. Gupta (Neha's Dad)", "rgupta.delhi@oksbi",      Decimal("0")),
            ("merch-amma",       "Arjun's Amma",          "9844055566@paytm",        Decimal("0")),
        ]
        for mid, mname, mupi, mbal in merchants:
            db.add(User(id=mid, name=mname))
            db.add(Account(id=f"acct-{mid}", user_id=mid, balance=mbal, upi_id=mupi))

        # Money mule accounts (Vikram's partners — flagged by H.I.V.E.)
        db.add(User(id="mule-suresh", name="Suresh Kumar"))
        db.add(Account(id="acct-mule-suresh", user_id="mule-suresh", balance=Decimal("0"), upi_id="suresh.mule99@ybl"))
        db.add(User(id="mule-raju", name="Raju Prasad"))
        db.add(Account(id="acct-mule-raju", user_id="mule-raju", balance=Decimal("0"), upi_id="raju.transfers@paytm"))
        await db.flush()

        # ================================================================
        # ACCOUNTS  (realistic UPI IDs)
        # ================================================================
        acct_arjun = Account(
            id="acct-arjun", user_id="user-arjun",
            balance=Decimal("67500.00"), upi_id="arjun.kumar7@okicici",
        )
        acct_neha = Account(
            id="acct-neha", user_id="user-neha",
            balance=Decimal("43200.00"), upi_id="neha.gupta92@okhdfcbank",
        )
        acct_vikram = Account(
            id="acct-vikram", user_id="user-vikram",
            balance=Decimal("8500.00"), upi_id="vikram.invest@ybl",
        )
        for a in [acct_arjun, acct_neha, acct_vikram]:
            db.add(a)
        await db.flush()

        # ================================================================
        # DEVICES
        # ================================================================
        # Arjun — Pixel phone (trusted, 14 months old) + work MacBook (trusted)
        dev_arjun_phone = Device(
            id="dev-arjun-pixel", user_id="user-arjun",
            device_fingerprint="fp-arjun-pixel7a",
            device_name="Arjun's Pixel 7a", platform="android",
            trusted=True, first_seen=_ts(days_ago=420), last_seen=_ts(hours_ago=1),
        )
        dev_arjun_laptop = Device(
            id="dev-arjun-mac", user_id="user-arjun",
            device_fingerprint="fp-arjun-macbook",
            device_name="Work MacBook", platform="web",
            trusted=True, first_seen=_ts(days_ago=300), last_seen=_ts(hours_ago=8),
        )

        # Neha — iPhone (trusted, 10 months) + iPad (trusted)
        dev_neha_iphone = Device(
            id="dev-neha-iphone", user_id="user-neha",
            device_fingerprint="fp-neha-iphone14",
            device_name="Neha's iPhone 14", platform="ios",
            trusted=True, first_seen=_ts(days_ago=310), last_seen=_ts(hours_ago=2),
        )
        dev_neha_ipad = Device(
            id="dev-neha-ipad", user_id="user-neha",
            device_fingerprint="fp-neha-ipadair",
            device_name="Neha's iPad Air", platform="ios",
            trusted=True, first_seen=_ts(days_ago=200), last_seen=_ts(days_ago=3),
        )

        # Vikram — one Android phone (trusted-ish, 2 months) + brand new browser
        dev_vikram_phone = Device(
            id="dev-vikram-android", user_id="user-vikram",
            device_fingerprint="fp-vikram-samsung",
            device_name="Samsung Galaxy A14", platform="android",
            trusted=True, first_seen=_ts(days_ago=65), last_seen=_ts(hours_ago=1),
        )
        dev_vikram_browser = Device(
            id="dev-vikram-browser", user_id="user-vikram",
            device_fingerprint="fp-vikram-chrome-incognito",
            device_name="Chrome Incognito", platform="web",
            trusted=False, first_seen=_ts(days_ago=1), last_seen=_ts(hours_ago=3),
        )

        for d in [
            dev_arjun_phone, dev_arjun_laptop,
            dev_neha_iphone, dev_neha_ipad,
            dev_vikram_phone, dev_vikram_browser,
        ]:
            db.add(d)
        await db.flush()

        # ================================================================
        # BENEFICIARIES — Arjun (7 verified, long-term + Neha as friend)
        # ================================================================
        arjun_bens = [
            Beneficiary(
                id="ben-arjun-rent", user_id="user-arjun",
                name="PG Rent - Srinivas", upi_id="srinivas.pg@okaxis",
                verified=True, added_at=_ts(days_ago=400),
            ),
            Beneficiary(
                id="ben-arjun-elec", user_id="user-arjun",
                name="BESCOM Electricity", upi_id="bescom.blr@oksbi",
                verified=True, added_at=_ts(days_ago=390),
            ),
            Beneficiary(
                id="ben-arjun-broadband", user_id="user-arjun",
                name="ACT Fibernet", upi_id="actcorp@icici",
                verified=True, added_at=_ts(days_ago=380),
            ),
            Beneficiary(
                id="ben-arjun-swiggy", user_id="user-arjun",
                name="Swiggy", upi_id="swiggy@axl",
                verified=True, added_at=_ts(days_ago=350),
            ),
            Beneficiary(
                id="ben-arjun-dmart", user_id="user-arjun",
                name="D-Mart HSR Layout", upi_id="dmart.hsr@okicici",
                verified=True, added_at=_ts(days_ago=280),
            ),
            Beneficiary(
                id="ben-arjun-mom", user_id="user-arjun",
                name="Amma", upi_id="9844055566@paytm",
                verified=True, added_at=_ts(days_ago=420),
            ),
            Beneficiary(
                id="ben-arjun-neha", user_id="user-arjun",
                name="Neha (friend)", upi_id="neha.gupta92@okhdfcbank",
                verified=True, added_at=_ts(days_ago=360),
            ),
        ]
        for b in arjun_bens:
            db.add(b)

        # ================================================================
        # BENEFICIARIES — Neha (6 verified + Arjun as friend)
        # ================================================================
        neha_bens = [
            Beneficiary(
                id="ben-neha-rent", user_id="user-neha",
                name="Flat Rent - Kavitha", upi_id="kavitha.m@oksbi",
                verified=True, added_at=_ts(days_ago=300),
            ),
            Beneficiary(
                id="ben-neha-zomato", user_id="user-neha",
                name="Zomato", upi_id="zomato@hdfcbank",
                verified=True, added_at=_ts(days_ago=290),
            ),
            Beneficiary(
                id="ben-neha-myntra", user_id="user-neha",
                name="Myntra", upi_id="myntra@ybl",
                verified=True, added_at=_ts(days_ago=250),
            ),
            Beneficiary(
                id="ben-neha-gym", user_id="user-neha",
                name="Cult.fit Koramangala", upi_id="cultfit.krmgla@okaxis",
                verified=True, added_at=_ts(days_ago=200),
            ),
            Beneficiary(
                id="ben-neha-netflix", user_id="user-neha",
                name="Netflix", upi_id="netflix@axl",
                verified=True, added_at=_ts(days_ago=310),
            ),
            Beneficiary(
                id="ben-neha-dad", user_id="user-neha",
                name="Papa", upi_id="rgupta.delhi@oksbi",
                verified=True, added_at=_ts(days_ago=310),
            ),
            Beneficiary(
                id="ben-neha-arjun", user_id="user-neha",
                name="Arjun (friend)", upi_id="arjun.kumar7@okicici",
                verified=True, added_at=_ts(days_ago=360),
            ),
        ]
        for b in neha_bens:
            db.add(b)

        # ================================================================
        # BENEFICIARIES — Vikram
        #   Looks normal: has a few real-looking contacts.
        #   But notice: most were added recently (within 2 months)
        #   and he has one beneficiary that matches a flagged UPI.
        # ================================================================
        vikram_bens = [
            Beneficiary(
                id="ben-vikram-rent", user_id="user-vikram",
                name="Room Rent", upi_id="babu.hostel@oksbi",
                verified=True, added_at=_ts(days_ago=60),
            ),
            Beneficiary(
                id="ben-vikram-food", user_id="user-vikram",
                name="Mess Payment", upi_id="annapurna.mess@paytm",
                verified=True, added_at=_ts(days_ago=55),
            ),
            Beneficiary(
                id="ben-vikram-recharge", user_id="user-vikram",
                name="Jio Recharge", upi_id="jiorecharge@axl",
                verified=True, added_at=_ts(days_ago=50),
            ),
            Beneficiary(
                id="ben-vikram-cash1", user_id="user-vikram",
                name="Suresh (partner)", upi_id="suresh.mule99@ybl",
                verified=False, added_at=_ts(days_ago=20),
            ),
            Beneficiary(
                id="ben-vikram-cash2", user_id="user-vikram",
                name="Raju", upi_id="raju.transfers@paytm",
                verified=False, added_at=_ts(days_ago=15),
            ),
        ]
        for b in vikram_bens:
            db.add(b)
        await db.flush()

        # ================================================================
        # TRANSACTIONS — Arjun (55 txns over 6 months)
        #
        # Steady salary-day rhythm: rent 1st, electricity 5th, broadband 7th,
        # grocery 2x/month, Swiggy 5-6x/month, mom monthly, Neha 2-3x/month
        # ================================================================
        arjun_txns = [
            # Month 1 (180-150 days ago)
            ("srinivas.pg@okaxis",          8500, 180, "dev-arjun-pixel",  "Rent - April"),
            ("bescom.blr@oksbi",             780, 175, "dev-arjun-pixel",  "Electricity bill"),
            ("actcorp@icici",                999, 173, "dev-arjun-mac",    "Broadband - Apr"),
            ("swiggy@axl",                   320, 172, "dev-arjun-pixel",  "Lunch order"),
            ("dmart.hsr@okicici",           1380, 168, "dev-arjun-pixel",  "Weekly groceries"),
            ("swiggy@axl",                   450, 164, "dev-arjun-pixel",  "Dinner order"),
            ("9844055566@paytm",            3000, 162, "dev-arjun-pixel",  "Amma monthly"),
            ("neha.gupta92@okhdfcbank",      300, 158, "dev-arjun-pixel",  "Cab split"),
            ("swiggy@axl",                   280, 155, "dev-arjun-pixel",  "Lunch"),
            ("dmart.hsr@okicici",           1520, 152, "dev-arjun-pixel",  "Groceries + snacks"),
            # Month 2 (150-120 days ago)
            ("srinivas.pg@okaxis",          8500, 150, "dev-arjun-pixel",  "Rent - May"),
            ("bescom.blr@oksbi",             920, 145, "dev-arjun-pixel",  "Electricity bill"),
            ("actcorp@icici",                999, 143, "dev-arjun-mac",    "Broadband - May"),
            ("swiggy@axl",                   390, 140, "dev-arjun-pixel",  "Biryani order"),
            ("neha.gupta92@okhdfcbank",     1500, 138, "dev-arjun-pixel",  "Trip advance - Coorg"),
            ("dmart.hsr@okicici",           1650, 135, "dev-arjun-pixel",  "Monthly groceries"),
            ("swiggy@axl",                   510, 132, "dev-arjun-pixel",  "Late night order"),
            ("9844055566@paytm",            3000, 130, "dev-arjun-pixel",  "Amma monthly"),
            ("swiggy@axl",                   340, 127, "dev-arjun-pixel",  "Lunch order"),
            ("neha.gupta92@okhdfcbank",      400, 124, "dev-arjun-pixel",  "Movie tickets split"),
            # Month 3 (120-90 days ago)
            ("srinivas.pg@okaxis",          8500, 120, "dev-arjun-pixel",  "Rent - June"),
            ("bescom.blr@oksbi",             850, 115, "dev-arjun-pixel",  "Electricity bill"),
            ("actcorp@icici",                999, 113, "dev-arjun-mac",    "Broadband - Jun"),
            ("swiggy@axl",                   380, 110, "dev-arjun-pixel",  "Lunch order"),
            ("dmart.hsr@okicici",           1450, 108, "dev-arjun-pixel",  "Weekly groceries"),
            ("neha.gupta92@okhdfcbank",      350, 105, "dev-arjun-pixel",  "Cab split - office party"),
            ("swiggy@axl",                   420, 102, "dev-arjun-pixel",  "Dinner order"),
            ("9844055566@paytm",            3000, 100, "dev-arjun-pixel",  "Amma monthly"),
            ("swiggy@axl",                   290,  96, "dev-arjun-pixel",  "Lunch"),
            # Month 4 (90-60 days ago)
            ("srinivas.pg@okaxis",          8500,  90, "dev-arjun-pixel",  "Rent - July"),
            ("bescom.blr@oksbi",             890,  85, "dev-arjun-pixel",  "Electricity bill"),
            ("actcorp@icici",                999,  83, "dev-arjun-mac",    "Broadband - Jul"),
            ("dmart.hsr@okicici",           1680,  80, "dev-arjun-pixel",  "Groceries + cleaning"),
            ("swiggy@axl",                   350,  78, "dev-arjun-pixel",  "Lunch order"),
            ("neha.gupta92@okhdfcbank",      800,  75, "dev-arjun-pixel",  "Split dinner at Toit"),
            ("swiggy@axl",                   470, 72, "dev-arjun-pixel",   "Dinner order"),
            ("9844055566@paytm",            3000,  70, "dev-arjun-pixel",  "Amma monthly"),
            ("swiggy@axl",                   310,  66, "dev-arjun-pixel",  "Breakfast order"),
            ("dmart.hsr@okicici",           1350,  63, "dev-arjun-pixel",  "Weekly groceries"),
            # Month 5 (60-30 days ago)
            ("srinivas.pg@okaxis",          8500,  60, "dev-arjun-pixel",  "Rent - August"),
            ("bescom.blr@oksbi",             920,  55, "dev-arjun-pixel",  "Electricity bill"),
            ("actcorp@icici",                999,  53, "dev-arjun-mac",    "Broadband - Aug"),
            ("swiggy@axl",                   390,  50, "dev-arjun-pixel",  "Lunch order"),
            ("neha.gupta92@okhdfcbank",     1200,  48, "dev-arjun-pixel",  "Neha birthday gift"),
            ("dmart.hsr@okicici",           1580,  45, "dev-arjun-pixel",  "Monthly groceries"),
            ("swiggy@axl",                   440,  42, "dev-arjun-pixel",  "Dinner order"),
            ("9844055566@paytm",            3000,  38, "dev-arjun-pixel",  "Amma monthly"),
            ("swiggy@axl",                   280,  35, "dev-arjun-pixel",  "Snacks order"),
            ("neha.gupta92@okhdfcbank",      600,  33, "dev-arjun-pixel",  "Shared Uber to mall"),
            # Month 6 (30-0 days ago)
            ("srinivas.pg@okaxis",          8500,  30, "dev-arjun-pixel",  "Rent - September"),
            ("bescom.blr@oksbi",             780,  25, "dev-arjun-pixel",  "Electricity bill"),
            ("actcorp@icici",                999,  23, "dev-arjun-mac",    "Broadband - Sep"),
            ("swiggy@axl",                   440,  20, "dev-arjun-pixel",  "Lunch order"),
            ("dmart.hsr@okicici",           1520,  15, "dev-arjun-pixel",  "Groceries"),
            ("neha.gupta92@okhdfcbank",      500,  10, "dev-arjun-pixel",  "Shared cab to airport"),
            ("9844055566@paytm",            3000,   7, "dev-arjun-pixel",  "Amma monthly"),
            ("swiggy@axl",                   360,   5, "dev-arjun-pixel",  "Dinner order"),
            ("swiggy@axl",                   290,   3, "dev-arjun-pixel",  "Lunch"),
            ("neha.gupta92@okhdfcbank",      250,   1, "dev-arjun-pixel",  "Coffee reimbursement"),
        ]

        arjun_ben_map = {b.upi_id: b.id for b in arjun_bens}
        for idx, (upi, amt, days, dev, desc) in enumerate(arjun_txns):
            txn = Transaction(
                id=f"txn-arjun-{idx:03d}", user_id="user-arjun",
                account_id="acct-arjun",
                beneficiary_id=arjun_ben_map.get(upi),
                beneficiary_upi=upi,
                amount=Decimal(str(amt)), description=desc,
                status="committed",
                created_at=_ts(days_ago=days), committed_at=_ts(days_ago=days),
            )
            db.add(txn)
            db.add(TransactionAttempt(
                transaction_id=txn.id, device_id=dev,
                ip_address="106.51.72.130", location="Bangalore, KA",
                attempt_time=txn.created_at, source="app",
            ))

        # ================================================================
        # TRANSACTIONS — Neha (48 txns over 6 months)
        #
        # Rent 3rd, Zomato 4-5x/month, Myntra 1-2x/month, gym monthly,
        # Netflix monthly, dad monthly, Arjun 2-3x/month
        # ================================================================
        neha_txns = [
            # Month 1 (180-150 days ago)
            ("kavitha.m@oksbi",            12000, 178, "dev-neha-iphone",  "Rent - April"),
            ("zomato@hdfcbank",              340, 175, "dev-neha-iphone",  "Lunch order"),
            ("netflix@axl",                  649, 172, "dev-neha-ipad",    "Netflix monthly"),
            ("arjun.kumar7@okicici",         300, 168, "dev-neha-iphone",  "Arjun cab split"),
            ("zomato@hdfcbank",              290, 165, "dev-neha-iphone",  "Dinner - pizza"),
            ("cultfit.krmgla@okaxis",       1500, 162, "dev-neha-iphone",  "Gym - May"),
            ("rgupta.delhi@oksbi",          2000, 158, "dev-neha-iphone",  "Papa monthly"),
            ("zomato@hdfcbank",              420, 155, "dev-neha-iphone",  "Team lunch"),
            ("myntra@ybl",                  1800, 153, "dev-neha-iphone",  "Summer dress"),
            # Month 2 (150-120 days ago)
            ("kavitha.m@oksbi",            12000, 148, "dev-neha-iphone",  "Rent - May"),
            ("zomato@hdfcbank",              350, 145, "dev-neha-iphone",  "Biryani order"),
            ("netflix@axl",                  649, 142, "dev-neha-ipad",    "Netflix monthly"),
            ("arjun.kumar7@okicici",        1500, 138, "dev-neha-iphone",  "Coorg trip share"),
            ("zomato@hdfcbank",              280, 135, "dev-neha-iphone",  "Lunch order"),
            ("cultfit.krmgla@okaxis",       1500, 132, "dev-neha-iphone",  "Gym - Jun"),
            ("rgupta.delhi@oksbi",          2000, 128, "dev-neha-iphone",  "Papa monthly"),
            ("myntra@ybl",                  2500, 125, "dev-neha-iphone",  "Shoes + bag"),
            ("arjun.kumar7@okicici",         400, 124, "dev-neha-iphone",  "Movie split"),
            # Month 3 (120-90 days ago)
            ("kavitha.m@oksbi",            12000, 118, "dev-neha-iphone",  "Rent - June"),
            ("zomato@hdfcbank",              380, 115, "dev-neha-iphone",  "Dinner order"),
            ("netflix@axl",                  649, 112, "dev-neha-ipad",    "Netflix monthly"),
            ("zomato@hdfcbank",              310, 108, "dev-neha-iphone",  "Lunch order"),
            ("cultfit.krmgla@okaxis",       1500, 105, "dev-neha-iphone",  "Gym - Jul"),
            ("arjun.kumar7@okicici",         350, 102, "dev-neha-iphone",  "Cab split"),
            ("rgupta.delhi@oksbi",          5000,  98, "dev-neha-iphone",  "Papa birthday gift"),
            ("zomato@hdfcbank",              450,  95, "dev-neha-iphone",  "Team celebration"),
            # Month 4 (90-60 days ago)
            ("kavitha.m@oksbi",            12000,  88, "dev-neha-iphone",  "Rent - July"),
            ("zomato@hdfcbank",              320,  85, "dev-neha-iphone",  "Biryani order"),
            ("netflix@axl",                  649,  82, "dev-neha-ipad",    "Netflix monthly"),
            ("cultfit.krmgla@okaxis",       1500,  78, "dev-neha-iphone",  "Gym - Aug"),
            ("zomato@hdfcbank",              280,  75, "dev-neha-iphone",  "Lunch order"),
            ("arjun.kumar7@okicici",         800,  72, "dev-neha-iphone",  "Dinner at Toit"),
            ("rgupta.delhi@oksbi",          2000,  68, "dev-neha-iphone",  "Papa monthly"),
            ("myntra@ybl",                  2300,  65, "dev-neha-iphone",  "Kurti + jeans"),
            # Month 5 (60-30 days ago)
            ("kavitha.m@oksbi",            12000,  58, "dev-neha-iphone",  "Rent - August"),
            ("zomato@hdfcbank",              450,  55, "dev-neha-iphone",  "Team lunch"),
            ("netflix@axl",                  649,  52, "dev-neha-ipad",    "Netflix monthly"),
            ("cultfit.krmgla@okaxis",       1500,  48, "dev-neha-iphone",  "Gym - Sep"),
            ("arjun.kumar7@okicici",        1200,  45, "dev-neha-iphone",  "Arjun birthday gift"),
            ("zomato@hdfcbank",              380,  42, "dev-neha-iphone",  "Pizza night"),
            ("rgupta.delhi@oksbi",          2000,  38, "dev-neha-iphone",  "Papa monthly"),
            ("myntra@ybl",                  1600,  35, "dev-neha-iphone",  "Ethnic wear"),
            # Month 6 (30-0 days ago)
            ("kavitha.m@oksbi",            12000,  28, "dev-neha-iphone",  "Rent - September"),
            ("zomato@hdfcbank",              310,  22, "dev-neha-iphone",  "Dinner order"),
            ("netflix@axl",                  649,  20, "dev-neha-ipad",    "Netflix monthly"),
            ("cultfit.krmgla@okaxis",       1500,  15, "dev-neha-iphone",  "Gym - Oct"),
            ("arjun.kumar7@okicici",         500,  10, "dev-neha-iphone",  "Shared cab airport"),
            ("zomato@hdfcbank",              390,   8, "dev-neha-iphone",  "Lunch order"),
            ("myntra@ybl",                  1800,   5, "dev-neha-iphone",  "Winter jacket"),
            ("rgupta.delhi@oksbi",          2000,   3, "dev-neha-iphone",  "Papa monthly"),
            ("arjun.kumar7@okicici",         250,   1, "dev-neha-iphone",  "Coffee reimbursement"),
        ]

        neha_ben_map = {b.upi_id: b.id for b in neha_bens}
        for idx, (upi, amt, days, dev, desc) in enumerate(neha_txns):
            txn = Transaction(
                id=f"txn-neha-{idx:03d}", user_id="user-neha",
                account_id="acct-neha",
                beneficiary_id=neha_ben_map.get(upi),
                beneficiary_upi=upi,
                amount=Decimal(str(amt)), description=desc,
                status="committed",
                created_at=_ts(days_ago=days), committed_at=_ts(days_ago=days),
            )
            db.add(txn)
            db.add(TransactionAttempt(
                transaction_id=txn.id, device_id=dev,
                ip_address="49.207.58.12", location="Bangalore, KA",
                attempt_time=txn.created_at, source="app",
            ))

        # ================================================================
        # TRANSACTIONS — Vikram (18 txns over 2 months)
        #
        # Looks normal at first — rent, food, recharge.
        # But account is only 2 months old and he recently started
        # sending escalating amounts to unverified mule partners.
        # ================================================================
        vikram_txns = [
            # Weeks 1-3 (building a "normal" history)
            ("babu.hostel@oksbi",           3500,  58, "dev-vikram-android", "Room rent Oct"),
            ("annapurna.mess@paytm",         900,  56, "dev-vikram-android", "Mess bill"),
            ("jiorecharge@axl",              299,  54, "dev-vikram-android", "Recharge"),
            ("annapurna.mess@paytm",         850,  50, "dev-vikram-android", "Mess bill"),
            ("annapurna.mess@paytm",         120,  47, "dev-vikram-android", "Tea + snacks"),
            ("jiorecharge@axl",              199,  44, "dev-vikram-android", "Data pack"),
            ("annapurna.mess@paytm",         900,  40, "dev-vikram-android", "Mess bill"),
            # Month 2 (normal + escalating mule transfers)
            ("babu.hostel@oksbi",           3500,  30, "dev-vikram-android", "Room rent Nov"),
            ("annapurna.mess@paytm",         900,  28, "dev-vikram-android", "Mess bill"),
            ("jiorecharge@axl",              299,  25, "dev-vikram-android", "Recharge"),
            ("annapurna.mess@paytm",         150,  22, "dev-vikram-android", "Snacks"),
            # Mule transfers start (escalating)
            ("suresh.mule99@ybl",           2500,  18, "dev-vikram-android", "Transfer"),
            ("raju.transfers@paytm",        1800,  15, "dev-vikram-android", "Payment"),
            ("suresh.mule99@ybl",           4500,  12, "dev-vikram-android", "Transfer"),
            ("raju.transfers@paytm",        3200,   8, "dev-vikram-android", "Payment"),
            ("suresh.mule99@ybl",           6000,   5, "dev-vikram-browser", "Transfer"),
            ("raju.transfers@paytm",        5500,   3, "dev-vikram-browser", "Payment"),
            ("suresh.mule99@ybl",           8000,   1, "dev-vikram-browser", "Urgent transfer"),
        ]

        vikram_ben_map = {b.upi_id: b.id for b in vikram_bens}
        for idx, (upi, amt, days, dev, desc) in enumerate(vikram_txns):
            txn = Transaction(
                id=f"txn-vikram-{idx:03d}", user_id="user-vikram",
                account_id="acct-vikram",
                beneficiary_id=vikram_ben_map.get(upi),
                beneficiary_upi=upi,
                amount=Decimal(str(amt)), description=desc,
                status="committed",
                created_at=_ts(days_ago=days), committed_at=_ts(days_ago=days),
            )
            db.add(txn)
            db.add(TransactionAttempt(
                transaction_id=txn.id, device_id=dev,
                ip_address="103.87.56.201" if "browser" in dev else "182.73.12.45",
                location="Hyderabad, TS" if "browser" not in dev else "Unknown (VPN)",
                attempt_time=txn.created_at, source="app",
            ))
        await db.flush()

        # ================================================================
        # BEHAVIORAL PROFILES
        # ================================================================
        db.add(BehavioralProfile(
            user_id="user-arjun",
            avg_transaction_amount=1850.0,
            median_transaction_amount=950.0,
            max_transaction_amount=8500.0,
            common_transaction_hours=[9, 10, 12, 13, 19, 20, 21],
            common_beneficiaries=[
                "srinivas.pg@okaxis", "bescom.blr@oksbi", "actcorp@icici",
                "swiggy@axl", "dmart.hsr@okicici", "9844055566@paytm",
                "neha.gupta92@okhdfcbank",
            ],
            typical_frequency_per_week=5.0,
            total_transactions=60,
            last_updated=_ts(),
        ))
        db.add(BehavioralProfile(
            user_id="user-neha",
            avg_transaction_amount=2500.0,
            median_transaction_amount=1050.0,
            max_transaction_amount=12000.0,
            common_transaction_hours=[8, 9, 12, 13, 18, 19, 20, 21],
            common_beneficiaries=[
                "kavitha.m@oksbi", "zomato@hdfcbank", "netflix@axl",
                "myntra@ybl", "cultfit.krmgla@okaxis", "rgupta.delhi@oksbi",
                "arjun.kumar7@okicici",
            ],
            typical_frequency_per_week=4.5,
            total_transactions=48,
            last_updated=_ts(),
        ))
        db.add(BehavioralProfile(
            user_id="user-vikram",
            avg_transaction_amount=2000.0,
            median_transaction_amount=1600.0,
            max_transaction_amount=8000.0,
            common_transaction_hours=[10, 11, 14, 22, 23],
            common_beneficiaries=[
                "babu.hostel@oksbi", "annapurna.mess@paytm", "jiorecharge@axl",
            ],
            typical_frequency_per_week=3.0,
            total_transactions=12,
            last_updated=_ts(),
        ))
        await db.flush()

        # ================================================================
        # LOGIN EVENTS
        # ================================================================
        # Arjun — consistent logins from Bangalore, same device
        for d in [0, 1, 2, 3, 5, 7, 10, 14, 20, 30]:
            db.add(LoginEvent(
                user_id="user-arjun", device_id="dev-arjun-pixel",
                event_type="login_success", ip_address="106.51.72.130",
                timestamp=_ts(days_ago=d),
            ))

        # Neha — consistent logins
        for d in [0, 1, 2, 4, 6, 8, 12, 18, 25]:
            db.add(LoginEvent(
                user_id="user-neha", device_id="dev-neha-iphone",
                event_type="login_success", ip_address="49.207.58.12",
                timestamp=_ts(days_ago=d),
            ))

        # Vikram — logins from phone + recent logins from unknown browser / VPN IP
        for d in [55, 45, 30, 25, 20, 12, 8, 5]:
            db.add(LoginEvent(
                user_id="user-vikram", device_id="dev-vikram-android",
                event_type="login_success", ip_address="182.73.12.45",
                timestamp=_ts(days_ago=d),
            ))
        for d in [3, 1]:
            db.add(LoginEvent(
                user_id="user-vikram", device_id="dev-vikram-browser",
                event_type="login_success", ip_address="103.87.56.201",
                timestamp=_ts(days_ago=d),
            ))
        # Vikram had a failed login attempt (someone trying his creds? Or he fat-fingered?)
        db.add(LoginEvent(
            user_id="user-vikram", device_id="dev-vikram-browser",
            event_type="login_failed", ip_address="103.87.56.201",
            timestamp=_ts(days_ago=4),
        ))
        await db.flush()

        # ================================================================
        # ACCOUNT EVENTS
        #
        # Arjun & Neha: nothing suspicious.
        # Vikram: changed his email recently (obfuscation) + added a
        #         new phone number (burner for scam operations).
        # ================================================================
        db.add(AccountEvent(
            user_id="user-vikram", event_type="email_change",
            details={
                "old_email": "vikram.r123@gmail.com",
                "new_email": "vikram.reddy@proton.me",
                "ip": "103.87.56.201",
            },
            timestamp=_ts(days_ago=10),
        ))
        db.add(AccountEvent(
            user_id="user-vikram", event_type="phone_change",
            details={
                "old_number": "+919876000111",
                "new_number": "+919900088877",
                "carrier": "Jio",
            },
            timestamp=_ts(days_ago=8),
        ))
        await db.flush()

        # No pre-seeded H.I.V.E. risk signals.
        # Signals are created LIVE when:
        #   - H.I.V.E. WhatsApp extension detects a scam (auto-synced every 10s)
        #   - Email monitor scans a scam email
        #   - User reports a UPI manually
        await db.flush()

        # No pre-seeded scam messages — detections come from live scanning.

        # ================================================================
        # SCAM EMAILS — pre-loaded for email monitor demo
        # ================================================================
        scam_emails = [
            {
                "id": "email-scam-001",
                "user_id": "user-arjun",
                "sender": "security-alert@sbi-update.tk",
                "content": (
                    "Subject: URGENT: SBI Account Suspended — Action Required\n\n"
                    "Dear Valued Customer,\n\n"
                    "Your SBI savings account has been temporarily suspended due to "
                    "incomplete KYC verification. To reactivate your account and avoid "
                    "permanent closure, please transfer Rs 500 verification fee to "
                    "kycverify.sbi@ybl within 24 hours.\n\n"
                    "Failure to complete this step will result in permanent account "
                    "termination and forfeiture of all funds.\n\n"
                    "Reference: SBI/KYC/2026/ARJ-4521\n"
                    "Helpline: 9876012345\n\n"
                    "Regards,\nSBI Customer Security Team"
                ),
                "source": "email",
                "is_scam": True,
                "confidence": 0.95,
                "risk_level": "CRITICAL",
                "scam_type": "kyc_scam",
                "explanation": (
                    "Phishing email impersonating SBI. Uses fake domain (sbi-update.tk), "
                    "threatens account suspension, demands payment to suspicious UPI "
                    "(kycverify.sbi@ybl). Real banks never ask for KYC fees via email."
                ),
                "key_indicators": [
                    "Fake sender domain: sbi-update.tk",
                    "Threatens account suspension",
                    "Demands payment for KYC verification",
                    "Suspicious UPI: kycverify.sbi@ybl",
                    "Creates urgency: 24 hours deadline",
                ],
                "hours_ago": 8,
            },
            {
                "id": "email-scam-002",
                "user_id": "user-neha",
                "sender": "rewards@paytm-lucky.in",
                "content": (
                    "Subject: Congratulations! You won Rs 50,000 Paytm Cashback!\n\n"
                    "Dear Neha Gupta,\n\n"
                    "You have been selected as the winner of our Paytm Anniversary "
                    "Lucky Draw! You have won Rs 50,000 cashback.\n\n"
                    "To claim your reward, pay a processing fee of Rs 999 to "
                    "paytm.rewards99@ybl and share the screenshot.\n\n"
                    "Offer expires today at 11:59 PM. Don't miss out!\n\n"
                    "Claim ID: PTM-WIN-2026-98761\n"
                    "Support: 8765432109\n\n"
                    "— Paytm Rewards Team"
                ),
                "source": "email",
                "is_scam": True,
                "confidence": 0.92,
                "risk_level": "HIGH",
                "scam_type": "reward_scam",
                "explanation": (
                    "Fake Paytm reward email from spoofed domain (paytm-lucky.in). "
                    "Claims lottery win, demands 'processing fee' via UPI. "
                    "Real Paytm never asks users to pay to claim rewards."
                ),
                "key_indicators": [
                    "Fake domain: paytm-lucky.in",
                    "Lottery/reward scam",
                    "Processing fee demanded: Rs 999",
                    "Suspicious UPI: paytm.rewards99@ybl",
                    "Urgency: expires today",
                ],
                "hours_ago": 24,
            },
            {
                "id": "email-legit-001",
                "user_id": "user-arjun",
                "sender": "noreply@hdfcbank.com",
                "content": (
                    "Subject: Your HDFC Bank Statement for August 2026\n\n"
                    "Dear Arjun Kumar,\n\n"
                    "Your monthly account statement for August 2026 is now available. "
                    "Please login to NetBanking to view your statement.\n\n"
                    "Account ending: ****4521\n"
                    "Statement period: 01 Aug 2026 - 31 Aug 2026\n\n"
                    "This is an automated email. Please do not reply.\n\n"
                    "Regards,\nHDFC Bank"
                ),
                "source": "email",
                "is_scam": False,
                "confidence": 0.12,
                "risk_level": "LOW",
                "scam_type": None,
                "explanation": "Legitimate bank statement notification. No suspicious indicators.",
                "key_indicators": [],
                "hours_ago": 48,
            },
            {
                "id": "email-legit-002",
                "user_id": "user-neha",
                "sender": "noreply@swiggy.in",
                "content": (
                    "Subject: Your Swiggy order #SW-98234 has been delivered!\n\n"
                    "Hi Neha,\n\n"
                    "Your order from Meghana Foods has been delivered. "
                    "Enjoy your meal!\n\n"
                    "Order total: Rs 380\n"
                    "Paid via: UPI (neha.gupta92@okhdfcbank)\n\n"
                    "Rate your experience on the Swiggy app.\n\n"
                    "— Team Swiggy"
                ),
                "source": "email",
                "is_scam": False,
                "confidence": 0.05,
                "risk_level": "LOW",
                "scam_type": None,
                "explanation": "Legitimate Swiggy delivery confirmation. No suspicious indicators.",
                "key_indicators": [],
                "hours_ago": 72,
            },
        ]

        for em in scam_emails:
            msg = Message(
                id=em["id"], user_id=em["user_id"], sender=em["sender"],
                content=em["content"], source=em["source"],
                received_at=_ts(hours_ago=em["hours_ago"]),
            )
            db.add(msg)
            await db.flush()
            db.add(ScamDetection(
                id=f"det-{em['id']}",
                message_id=em["id"],
                is_scam=em["is_scam"],
                confidence=em["confidence"],
                risk_level=em["risk_level"],
                scam_type=em["scam_type"],
                explanation=em["explanation"],
                key_indicators=em["key_indicators"],
                detected_at=_ts(hours_ago=em["hours_ago"]),
            ))
        await db.flush()

        # ================================================================
        # BENEFICIARY EVENTS — Vikram's suspicious additions
        # ================================================================
        db.add(BeneficiaryEvent(
            user_id="user-vikram", beneficiary_id="ben-vikram-cash1",
            event_type="added", timestamp=_ts(days_ago=20),
        ))
        db.add(BeneficiaryEvent(
            user_id="user-vikram", beneficiary_id="ben-vikram-cash2",
            event_type="added", timestamp=_ts(days_ago=15),
        ))
        await db.flush()

        await db.commit()

        # ================================================================
        # SUMMARY
        # ================================================================
        print("=" * 60)
        print("  SCAM SHIELD — SEED DATA CREATED")
        print("=" * 60)
        print()
        print("LOGIN CREDENTIALS:")
        print("  Arjun:     arjun.kumar7@gmail.com   /  arjun@123  /  UPI PIN: 1234  (user)")
        print("  Neha:      neha.gupta92@gmail.com   /  neha@123   /  UPI PIN: 5678  (user)")
        print("  Vikram:    vikram.reddy@proton.me   /  vikram@123 /  UPI PIN: 9999  (user)")
        print("  Authority: rajesh.mehta@company.com /  admin@123  /  (CFO - approves/rejects)")
        print()
        print("ARJUN KUMAR (user-arjun) — Software Engineer, Bangalore")
        print("  UPI: arjun.kumar7@okicici")
        print("  Balance: Rs 67,500 | Avg txn: Rs 1,800 | Max: Rs 8,500")
        print("  28 transactions | 7 verified beneficiaries | 2 trusted devices")
        print("  Pattern: rent, bills, groceries, Swiggy, sends to mom & Neha")
        print("  Risk: LOW — clean account, stable history")
        print()
        print("NEHA GUPTA (user-neha) — Marketing Professional, Bangalore")
        print("  UPI: neha.gupta92@okhdfcbank")
        print("  Balance: Rs 43,200 | Avg txn: Rs 2,600 | Max: Rs 12,000")
        print("  23 transactions | 7 verified beneficiaries | 2 trusted devices")
        print("  Pattern: rent, food delivery, Netflix, gym, sends to dad & Arjun")
        print("  Risk: LOW — but received scam WhatsApp from Vikram!")
        print("  H.I.V.E. caught the scam message (investment_scam, 93% confidence)")
        print()
        print("VIKRAM REDDY (user-vikram) — 'Investment Advisor' (SCAMMER)")
        print("  UPI: vikram.invest@ybl")
        print("  Balance: Rs 8,500 | Avg txn: Rs 2,000 | Max: Rs 8,000")
        print("  12 transactions | 3 legit + 2 unverified (money mule) beneficiaries")
        print("  Pattern: small legit txns to build history, then large transfers")
        print("           to money mule partners (suresh.mule99@ybl, raju.transfers@paytm)")
        print("  Account: only 2 months old, recent email + phone change")
        print("  Risk: HIGH — H.I.V.E. flagged his UPI + phone + URL")
        print()
        print("FRIENDS: Arjun <-> Neha")
        print("  They have each other as verified beneficiaries")
        print("  Regular payments: cab splits, dinner splits, birthday gifts")
        print("  Arjun -> Neha: 4 txns (Rs 350-1200)")
        print("  Neha -> Arjun: 4 txns (Rs 250-1200)")
        print()
        print("SCAM SCENARIO:")
        print("  Vikram messaged Neha pretending to be HDFC Bank investment desk")
        print("  Asked her to transfer Rs 25,000 to vikram.invest@ybl")
        print("  H.I.V.E. detected: investment_scam (93% confidence)")
        print("  If Neha tries to pay vikram.invest@ybl, Model 2 will HOLD because:")
        print("    - H.I.V.E. flagged the UPI (severity: high)")
        print("    - New beneficiary (never paid before)")
        print("    - Amount Rs 25,000 is 9.6x her average (Rs 2,600)")
        print("    - Amount exceeds her max (Rs 12,000) by 2x")
        print()
        print("H.I.V.E. signals: 2 UPI + 1 phone + 1 URL flagged globally")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(seed())
