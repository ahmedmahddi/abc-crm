import * as argon2 from "argon2";
import { PrismaClient, MissionType, MissionMode, MissionStatus, MissionConsultantRole, PersonnelType } from "@abc/db";

const prisma = new PrismaClient();

const SEED_MARKER = "SEED-";
const DEV_PASSWORD = "DevPass1234!";

function daysFromNow(days: number, hour: number, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

async function seedMockData() {
  const existing = await prisma.client.findFirst({ where: { fiscalNumber: { startsWith: SEED_MARKER } } });
  if (existing) {
    console.log("Mock data already present (found seeded client) — skipping. Delete seeded records manually to reseed.");
    return;
  }

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("No ADMIN user found — run `pnpm seed:admin` first.");

  const passwordHash = await argon2.hash(DEV_PASSWORD);

  const responsableUser = await prisma.user.upsert({
    where: { email: "responsable@example.com" },
    update: {},
    create: {
      name: "Karim Jaziri",
      email: "responsable@example.com",
      passwordHash,
      role: "RESPONSABLE",
      status: "ACTIVE",
    },
  });

  const consultantUser = await prisma.user.upsert({
    where: { email: "consultant@example.com" },
    update: {},
    create: {
      name: "Sami Ben Ali",
      email: "consultant@example.com",
      passwordHash,
      role: "CONSULTANT",
      status: "ACTIVE",
    },
  });

  await prisma.user.upsert({
    where: { email: "viewer@example.com" },
    update: {},
    create: {
      name: "Wiem Haddad",
      email: "viewer@example.com",
      passwordHash,
      role: "VIEWER",
      status: "ACTIVE",
    },
  });

  const consultantSami = await prisma.consultant.upsert({
    where: { email: "sami.benali@abc-consulting.tn" },
    update: {},
    create: {
      fullName: "Sami Ben Ali",
      email: "sami.benali@abc-consulting.tn",
      phone: "+216 20 111 222",
      color: "#125885",
      status: "ACTIVE",
      userId: consultantUser.id,
    },
  });

  const consultantKarim = await prisma.consultant.upsert({
    where: { email: "karim.jaziri@abc-consulting.tn" },
    update: {},
    create: {
      fullName: "Karim Jaziri",
      email: "karim.jaziri@abc-consulting.tn",
      phone: "+216 20 333 444",
      color: "#1F7A5A",
      status: "ACTIVE",
      userId: responsableUser.id,
    },
  });

  const consultantNadia = await prisma.consultant.upsert({
    where: { email: "nadia.trabelsi@abc-consulting.tn" },
    update: {},
    create: {
      fullName: "Nadia Trabelsi",
      email: "nadia.trabelsi@abc-consulting.tn",
      phone: "+216 20 555 666",
      color: "#C48A1A",
      status: "ACTIVE",
    },
  });

  const consultants = [consultantSami, consultantKarim, consultantNadia];

  const clientDefs = [
    {
      companyName: "Groupe Amen Manufacturing",
      fiscalNumber: `${SEED_MARKER}1234567A`,
      address: "Zone Industrielle Ben Arous, Tunis",
      zone: "Tunis",
      activitySector: "Industrie textile",
      cadreCount: 12,
      nonCadreCount: 48,
      color: "#125885",
      consultants: [consultantSami, consultantKarim],
      personnel: [
        { fullName: "Amine Cherif", position: "Directeur Général", type: PersonnelType.CADRE },
        { fullName: "Salma Ferjani", position: "Ouvrière qualifiée", type: PersonnelType.NON_CADRE },
      ],
    },
    {
      companyName: "Société Tunisienne d'Électronique",
      fiscalNumber: `${SEED_MARKER}2345678B`,
      address: "Route de Gremda, Sfax",
      zone: "Sfax",
      activitySector: "Électronique",
      cadreCount: 8,
      nonCadreCount: 22,
      color: "#7A868F",
      consultants: [consultantNadia],
      personnel: [
        { fullName: "Youssef Mansour", position: "Responsable Qualité", type: PersonnelType.CADRE },
        { fullName: "Rania Bouzid", position: "Technicienne", type: PersonnelType.NON_CADRE },
      ],
    },
    {
      companyName: "Cimenterie du Nord",
      fiscalNumber: `${SEED_MARKER}3456789C`,
      address: "Zone Industrielle, Bizerte",
      zone: "Bizerte",
      activitySector: "Matériaux de construction",
      cadreCount: 15,
      nonCadreCount: 60,
      color: "#C44545",
      consultants: [consultantKarim],
      personnel: [
        { fullName: "Hedi Zaoui", position: "Directeur Technique", type: PersonnelType.CADRE },
        { fullName: "Mongi Saidi", position: "Chef d'équipe", type: PersonnelType.NON_CADRE },
      ],
    },
    {
      companyName: "AgroPlus Tunisie",
      fiscalNumber: `${SEED_MARKER}4567890D`,
      address: "Route de Kairouan, Sousse",
      zone: "Sousse",
      activitySector: "Agroalimentaire",
      cadreCount: 6,
      nonCadreCount: 18,
      color: "#0E476C",
      consultants: [consultantSami],
      personnel: [
        { fullName: "Leila Ghorbel", position: "Responsable RH", type: PersonnelType.CADRE },
        { fullName: "Fares Abidi", position: "Agent de production", type: PersonnelType.NON_CADRE },
      ],
    },
    {
      companyName: "Chimika Industries",
      fiscalNumber: `${SEED_MARKER}5678901E`,
      address: "Zone Industrielle, Gabès",
      zone: "Gabès",
      activitySector: "Chimie",
      cadreCount: 10,
      nonCadreCount: 30,
      color: "#BDC3C7",
      consultants: [consultantNadia, consultantSami],
      personnel: [
        { fullName: "Nizar Klibi", position: "Responsable HSE", type: PersonnelType.CADRE },
        { fullName: "Imen Rekik", position: "Opératrice", type: PersonnelType.NON_CADRE },
      ],
    },
  ];

  const createdClients = [];
  for (const def of clientDefs) {
    const client = await prisma.client.create({
      data: {
        companyName: def.companyName,
        fiscalNumber: def.fiscalNumber,
        address: def.address,
        zone: def.zone,
        activitySector: def.activitySector,
        cadreCount: def.cadreCount,
        nonCadreCount: def.nonCadreCount,
        color: def.color,
        consultants: {
          create: def.consultants.map((c) => ({ consultantId: c.id })),
        },
        personnel: {
          create: def.personnel,
        },
      },
    });
    createdClients.push({ client, consultants: def.consultants });
  }

  const missionDefs: Array<{
    clientIndex: number;
    title: string;
    missionType: MissionType;
    missionMode: MissionMode;
    status: MissionStatus;
    startsInDays: number;
    startHour: number;
    durationHours: number;
    location?: string;
    consultants: (typeof consultants)[number][];
  }> = [
    {
      clientIndex: 0,
      title: "Audit interne annuel",
      missionType: MissionType.AUDIT_INTERNE,
      missionMode: MissionMode.PRESENTIELLE,
      status: MissionStatus.DONE,
      startsInDays: -6,
      startHour: 9,
      durationHours: 4,
      location: "Site Ben Arous",
      consultants: [consultantSami, consultantKarim],
    },
    {
      clientIndex: 1,
      title: "Audit externe certification ISO",
      missionType: MissionType.AUDIT_EXTERNE,
      missionMode: MissionMode.PRESENTIELLE,
      status: MissionStatus.DONE,
      startsInDays: -3,
      startHour: 8,
      durationHours: 6,
      location: "Site Sfax",
      consultants: [consultantNadia],
    },
    {
      clientIndex: 2,
      title: "Formation sécurité industrielle",
      missionType: MissionType.FORMATION,
      missionMode: MissionMode.PRESENTIELLE,
      status: MissionStatus.PLANNED,
      startsInDays: 0,
      startHour: 9,
      durationHours: 3,
      location: "Site Bizerte",
      consultants: [consultantKarim],
    },
    {
      clientIndex: 3,
      title: "Assistance mise en conformité RH",
      missionType: MissionType.ASSISTANCE,
      missionMode: MissionMode.ONLINE,
      status: MissionStatus.PLANNED,
      startsInDays: 1,
      startHour: 10,
      durationHours: 2,
      consultants: [consultantSami],
    },
    {
      clientIndex: 4,
      title: "Audit interne processus HSE",
      missionType: MissionType.AUDIT_INTERNE,
      missionMode: MissionMode.PRESENTIELLE,
      status: MissionStatus.PLANNED,
      startsInDays: 2,
      startHour: 8,
      durationHours: 5,
      location: "Site Gabès",
      consultants: [consultantNadia, consultantSami],
    },
    {
      clientIndex: 0,
      title: "Suivi plan d'action qualité",
      missionType: MissionType.ASSISTANCE,
      missionMode: MissionMode.ONLINE,
      status: MissionStatus.PLANNED,
      startsInDays: 3,
      startHour: 14,
      durationHours: 2,
      consultants: [consultantKarim],
    },
    {
      clientIndex: 1,
      title: "Formation nouvelles normes électroniques",
      missionType: MissionType.FORMATION,
      missionMode: MissionMode.PRESENTIELLE,
      status: MissionStatus.PLANNED,
      startsInDays: 4,
      startHour: 9,
      durationHours: 4,
      location: "Site Sfax",
      consultants: [consultantNadia],
    },
    {
      clientIndex: 2,
      title: "Audit externe environnemental",
      missionType: MissionType.AUDIT_EXTERNE,
      missionMode: MissionMode.PRESENTIELLE,
      status: MissionStatus.PLANNED,
      startsInDays: 6,
      startHour: 9,
      durationHours: 6,
      location: "Site Bizerte",
      consultants: [consultantKarim, consultantSami],
    },
    {
      clientIndex: 3,
      title: "Mission annulée - report client",
      missionType: MissionType.ASSISTANCE,
      missionMode: MissionMode.PRESENTIELLE,
      status: MissionStatus.CANCELLED,
      startsInDays: 5,
      startHour: 10,
      durationHours: 3,
      location: "Site Sousse",
      consultants: [consultantSami],
    },
    {
      clientIndex: 4,
      title: "Consultation autre - étude spécifique",
      missionType: MissionType.AUTRE,
      missionMode: MissionMode.ONLINE,
      status: MissionStatus.PLANNED,
      startsInDays: 8,
      startHour: 11,
      durationHours: 2,
      consultants: [consultantNadia],
    },
  ];

  for (const def of missionDefs) {
    const entry = createdClients[def.clientIndex];
    if (!entry) throw new Error(`No created client at index ${def.clientIndex}`);
    const { client } = entry;
    const start = daysFromNow(def.startsInDays, def.startHour);
    const end = daysFromNow(def.startsInDays, def.startHour + def.durationHours);
    const isCancelled = def.status === MissionStatus.CANCELLED;

    await prisma.mission.create({
      data: {
        clientId: client.id,
        title: def.title,
        missionType: def.missionType,
        missionMode: def.missionMode,
        status: def.status,
        startDateTime: start,
        endDateTime: end,
        location: def.location ?? null,
        createdById: isCancelled ? responsableUser.id : admin.id,
        cancellationType: isCancelled ? "CLIENT" : null,
        cancellationReason: isCancelled ? "Report demandé par le client" : null,
        cancelledAt: isCancelled ? new Date() : null,
        consultants: {
          create: def.consultants.map((c, index) => ({
            consultantId: c.id,
            role: index === 0 ? MissionConsultantRole.RESPONSABLE : MissionConsultantRole.PARTICIPANT,
          })),
        },
      },
    });
  }

  console.log("Mock data seeded:");
  console.log(`  ${createdClients.length} clients, ${consultants.length} consultants, ${missionDefs.length} missions`);
  console.log("Extra test logins (all use the same password):");
  console.log(`  responsable@example.com / ${DEV_PASSWORD}`);
  console.log(`  consultant@example.com  / ${DEV_PASSWORD}`);
  console.log(`  viewer@example.com      / ${DEV_PASSWORD}`);
}

seedMockData()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Unable to seed mock data");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
