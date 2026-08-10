import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

async function main() {
  const user = await prisma.user.upsert({
    where: { teslaUserId: 'mock-tesla-user' },
    create: {
      teslaUserId: 'mock-tesla-user',
      email: 'demo@miletriage.local',
      displayName: 'Demo Driver',
      settings: { create: { mileageRate: 0.7 } },
      vehicles: {
        create: {
          vin: 'MOCK3VIN000000001',
          displayName: 'Demo Model 3',
          trackingEnabled: true,
          virtualKeyPaired: true,
          telemetryConfigured: true,
        },
      },
    },
    update: {},
    include: { vehicles: true },
  });

  let vehicle = user.vehicles.find((v) => v.vin === 'MOCK3VIN000000001');
  if (!vehicle) {
    vehicle = await prisma.vehicle.create({
      data: {
        userId: user.id,
        vin: 'MOCK3VIN000000001',
        displayName: 'Demo Model 3',
        trackingEnabled: true,
        virtualKeyPaired: true,
        telemetryConfigured: true,
      },
    });
  }

  await prisma.drive.deleteMany({ where: { userId: user.id } });

  const samples = [
    {
      start: hoursAgo(70 + 24 * 7),
      end: hoursAgo(69.4 + 24 * 7),
      startOdo: 12010,
      endOdo: 12028.4,
      startLat: 40.7128,
      startLng: -74.006,
      endLat: 40.7484,
      endLng: -73.9857,
      startAddress: 'Lower Manhattan, NY',
      endAddress: 'Midtown Manhattan, NY',
      points: [
        { lat: 40.72, lng: -74.0, t: 0.2 },
        { lat: 40.73, lng: -73.99, t: 0.4 },
        { lat: 40.74, lng: -73.987, t: 0.55 },
      ],
    },
    {
      start: hoursAgo(45 + 24 * 7),
      end: hoursAgo(44.3 + 24 * 7),
      startOdo: 12028.4,
      endOdo: 12051.1,
      startLat: 40.7484,
      startLng: -73.9857,
      endLat: 40.758,
      endLng: -73.9855,
      startAddress: 'Midtown Manhattan, NY',
      endAddress: 'Times Square, NY',
      points: [
        { lat: 40.752, lng: -73.985, t: 0.25 },
        { lat: 40.755, lng: -73.985, t: 0.45 },
      ],
    },
    {
      start: hoursAgo(20),
      end: hoursAgo(19.2),
      startOdo: 12051.1,
      endOdo: 12079.6,
      startLat: 40.758,
      startLng: -73.9855,
      endLat: 40.7061,
      endLng: -74.0087,
      startAddress: 'Times Square, NY',
      endAddress: 'Financial District, NY',
      points: [
        { lat: 40.74, lng: -73.99, t: 0.3 },
        { lat: 40.72, lng: -74.0, t: 0.55 },
      ],
    },
    {
      start: hoursAgo(6),
      end: hoursAgo(5.5),
      startOdo: 12079.6,
      endOdo: 12091.2,
      startLat: 40.7061,
      startLng: -74.0087,
      endLat: 40.6782,
      endLng: -73.9442,
      startAddress: 'Financial District, NY',
      endAddress: 'Brooklyn, NY',
      points: [
        { lat: 40.7, lng: -73.99, t: 0.2 },
        { lat: 40.69, lng: -73.96, t: 0.35 },
      ],
    },
  ];

  for (const s of samples) {
    const distanceMiles = Number((s.endOdo - s.startOdo).toFixed(2));
    const durationSec = Math.round(
      (s.end.getTime() - s.start.getTime()) / 1000,
    );
    await prisma.drive.create({
      data: {
        userId: user.id,
        vehicleId: vehicle.id,
        startedAt: s.start,
        endedAt: s.end,
        startOdometer: s.startOdo,
        endOdometer: s.endOdo,
        distanceMiles,
        durationSec,
        startLat: s.startLat,
        startLng: s.startLng,
        endLat: s.endLat,
        endLng: s.endLng,
        startAddress: s.startAddress,
        endAddress: s.endAddress,
        status: 'UNCLASSIFIED',
        points: {
          create: s.points.map((p) => ({
            lat: p.lat,
            lng: p.lng,
            recordedAt: new Date(
              s.start.getTime() + p.t * (s.end.getTime() - s.start.getTime()),
            ),
          })),
        },
      },
    });
  }

  console.log(`Seeded ${samples.length} unclassified drives for demo user`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
