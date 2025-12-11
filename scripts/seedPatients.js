npimport mongoose from 'mongoose';
import dotenv from 'dotenv';
import Patient from '../models/Patient.js';

dotenv.config({ path: './.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vm-clinic';

const pediatricNames = [
  'Liam Smith', 'Noah Johnson', 'Oliver Williams', 'Elijah Brown', 'James Jones',
  'Benjamin Garcia', 'Lucas Miller', 'Mason Davis', 'Ethan Rodriguez', 'Logan Martinez'
];
const motherNames = [
  'Emma Smith', 'Olivia Johnson', 'Ava Williams', 'Sophia Brown', 'Isabella Jones',
  'Mia Garcia', 'Charlotte Miller', 'Amelia Davis', 'Harper Rodriguez', 'Evelyn Martinez'
];
const obGyneNames = [
  'Emily Clark', 'Abigail Lewis', 'Madison Walker', 'Elizabeth Hall', 'Sofia Allen',
  'Avery Young', 'Ella Hernandez', 'Scarlett King', 'Grace Wright', 'Chloe Lopez'
];

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');
  console.log('MONGODB_URI:', MONGODB_URI);
  console.log('Using database:', mongoose.connection.name);

  // Remove existing test patients
  await Patient.deleteMany({});

  const pediatricPatients = [];
  for (let i = 0; i < 10; i++) {
    const pid = `PED${String(i + 1).padStart(6, '0')}`;
    pediatricPatients.push({
      patientType: 'pediatric',
      patientId: pid,
      patientNumber: pid,
      contactInfo: {
        email: `pediatric${i + 1}@test.com`,
        emergencyContact: {
          name: motherNames[i],
          relationship: 'Mother',
          phone: `0917${1000000 + i}`
        }
      },
      pediatricRecord: {
        nameOfChildren: pediatricNames[i],
        nameOfMother: motherNames[i],
        nameOfFather: `Father ${i + 1}`,
        address: `123 Pediatric St, City ${i + 1}`,
        contactNumber: `0917${2000000 + i}`,
        birthDate: randomDate(new Date(2018, 0, 1), new Date(2022, 0, 1)),
        age: `${2 + i} years`,
        sex: i % 2 === 0 ? 'Male' : 'Female',
        birthWeight: `${2.5 + i * 0.1} kg`,
        birthLength: `${48 + i} cm`,
        immunizations: {
          dpt: { d1: { date: randomDate(new Date(2018, 0, 1), new Date(2022, 0, 1)), remarks: 'Done' } },
          opvIpv: { d1: { date: randomDate(new Date(2018, 0, 1), new Date(2022, 0, 1)), remarks: 'Done' } },
          hInfluenzaHib: { d1: { date: randomDate(new Date(2018, 0, 1), new Date(2022, 0, 1)), remarks: 'Done' } },
          measlesMmr: { d1: { date: randomDate(new Date(2018, 0, 1), new Date(2022, 0, 1)), remarks: 'Done' } },
          pneumococcalPcv: { d1: { date: randomDate(new Date(2018, 0, 1), new Date(2022, 0, 1)), remarks: 'Done' } },
        },
        consultations: [
          {
            date: randomDate(new Date(2022, 1, 1), new Date()),
            historyAndPE: 'Routine checkup, healthy.',
            natureTxn: 'Consultation',
            impression: 'Normal growth.'
          }
        ]
      },
      isActive: true,
      status: 'Active'
    });
  }

  const obGynePatients = [];
  for (let i = 0; i < 10; i++) {
    const pid = `OBG${String(i + 1).padStart(6, '0')}`;
    obGynePatients.push({
      patientType: 'ob-gyne',
      patientId: pid,
      patientNumber: pid,
      contactInfo: {
        email: `obgyne${i + 1}@test.com`,
        emergencyContact: {
          name: `Contact ${i + 1}`,
          relationship: 'Husband',
          phone: `0920${1000000 + i}`
        }
      },
      obGyneRecord: {
        patientName: obGyneNames[i],
        address: `456 OB-GYNE Ave, City ${i + 1}`,
        contactNumber: `0920${2000000 + i}`,
        birthDate: randomDate(new Date(1985, 0, 1), new Date(2000, 0, 1)),
        age: 25 + i,
        civilStatus: 'Married',
        occupation: 'Employee',
        religion: 'Catholic',
        referredBy: 'Dr. Smith',
        pastMedicalHistory: {
          hypertension: false,
          diabetes: false,
          bronchialAsthma: false,
          lastAttack: '',
          heartDisease: false,
          thyroidDisease: false,
          previousSurgery: '',
          allergies: ''
        },
        familyHistory: {
          smoker: false,
          alcohol: false,
          drugs: false
        },
        baselineDiagnostics: {
          cbc: { hgb: '13', hct: '40', plt: '250', wbc: '6' },
          urinalysis: 'Normal',
          bloodType: 'O+',
          fbs: '90',
          hbsag: 'Negative',
          vdrlRpr: 'Negative',
          hiv: 'Negative',
          ogtt75g: { fbs: '90', firstHour: '120', secondHour: '110' },
          other: ''
        },
        obstetricHistory: [
          {
            year: 2010 + i,
            place: `Hospital ${i + 1}`,
            typeOfDelivery: 'Normal',
            bw: '3.2 kg',
            complications: 'None'
          }
        ],
        gynecologicHistory: {
          obScore: 'G1P1',
          gravidity: 1,
          parity: 1,
          lmp: randomDate(new Date(2023, 0, 1), new Date()),
          pmp: randomDate(new Date(2022, 0, 1), new Date(2023, 0, 1)),
          aog: '12 weeks',
          earlyUltrasound: randomDate(new Date(2023, 0, 1), new Date()),
          aogByEutz: '12 weeks',
          eddByLmp: randomDate(new Date(2023, 6, 1), new Date(2023, 11, 31)),
          eddByEutz: randomDate(new Date(2023, 6, 1), new Date(2023, 11, 31)),
          menarche: 13,
          intervalIsRegular: true,
          intervalDays: 28,
          durationDays: 5,
          amountPads: 'Normal',
          dysmenorrhea: false,
          coitarche: 18,
          sexualPartners: 1,
          contraceptiveUse: 'Pills',
          lastPapSmear: { date: randomDate(new Date(2022, 0, 1), new Date()), result: 'Normal' }
        },
        immunizations: {
          tt1: randomDate(new Date(2022, 0, 1), new Date()),
          tt2: randomDate(new Date(2022, 0, 1), new Date()),
          tt3: randomDate(new Date(2022, 0, 1), new Date()),
          tdap: randomDate(new Date(2022, 0, 1), new Date()),
          flu: randomDate(new Date(2022, 0, 1), new Date()),
          hpv: randomDate(new Date(2022, 0, 1), new Date()),
          pcv: randomDate(new Date(2022, 0, 1), new Date()),
          covid19: { brand: 'Pfizer', primary: randomDate(new Date(2021, 0, 1), new Date()), booster: randomDate(new Date(2022, 0, 1), new Date()) }
        },
        consultations: [
          {
            date: randomDate(new Date(2022, 1, 1), new Date()),
            bp: '120/80',
            pr: '75',
            rr: '18',
            temp: '36.7',
            weight: '60',
            bmi: '22',
            aog: '12 weeks',
            fh: '12 cm',
            fht: '140',
            internalExam: 'Normal',
            historyPhysicalExam: 'Routine prenatal checkup.',
            assessmentPlan: 'Continue prenatal vitamins.',
            nextAppointment: randomDate(new Date(2023, 6, 1), new Date(2023, 11, 31))
          }
        ]
      },
      isActive: true,
      status: 'Active'
    });
  }

  await Patient.insertMany([...pediatricPatients, ...obGynePatients]);
  console.log('Seeded 10 pediatric and 10 ob-gyne patients.');
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

seed().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
}); 