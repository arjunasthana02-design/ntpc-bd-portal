from app.database import SessionLocal
from app.models import Company

companies = [
("Anushakti Vidyut Nigam Ltd","ASHWINI"),
("Aravali Power Co. Pvt Ltd","APCPL"),
("Bangladesh-India Friendship Power Co. Pvt. Ltd","BIFPCL"),
("BF-NTPC Energy Systems Ltd","BFNESL"),
("Bhartiya Rail Bijlee Co. Ltd","BRBCL"),
("CIL NTPC Urja Pvt Ltd","CNUPL"),
("Energy Efficiency Services Ltd","EESL"),
("Hindustan Urvarak & Rasayan Ltd","HURL"),
("International Coal Ventures Pvt Ltd","ICVL"),
("Jhabua Power Ltd","JHABUA"),
("Meja Urja Nigam Pvt Ltd","MUNPL"),
("National High Power Test Laboratory Pvt Ltd","NHPTL"),
("North Eastern Electric Power Corporation Ltd.","NEEPCO"),
("NTPC BHEL Power Projects Pvt Ltd","NBPPL"),
("NTPC EDMC Waste Solutions Pvt. Limited","NEWS"),
("NTPC Electric Supply Co. Ltd","NESCL"),
("NTPC GE Power Services Pvt Ltd","NTPC-GE"),
("NTPC Green Energy Ltd","NGEL"),
("NTPC Mining Limited","NML"),
("NTPC Parmanu Urja Nigam Limited","NPUNL"),
("NTPC SAIL Power Co. Pvt Ltd","NSPCL"),
("NTPC Tamilnadu Energy Co. Ltd","NTECL"),
("NTPC Vidyut Vyapar Nigam Ltd","NVVN"),
("Patratu Vidyut Utpadan Nigam Ltd","PVUNL"),
("Power Trading Corporation Ltd","PTC"),
("Ratnagiri Gas and Power Pvt Ltd","RGPPL"),
("THDC India Ltd.","THDC"),
("Transformers and Electricals Kerala Ltd","TELK"),
("Trincomalee Power Co. Ltd","TPCL"),
("Utility Powertech Ltd","UPL"),
("Sinnar Thermal Power Limited","STPL"),
]

db = SessionLocal()

for name, short in companies:

    exists = db.query(Company).filter(
        Company.company_name == name
    ).first()

    if not exists:
        db.add(
            Company(
                company_name=name,
                short_name=short,
                is_custom=False
            )
        )

db.commit()
db.close()

print("Companies inserted.")