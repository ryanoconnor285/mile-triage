import { z } from 'zod';

export const DriveStatusSchema = z.enum([
  'UNCLASSIFIED',
  'BUSINESS',
  'PERSONAL',
]);
export type DriveStatus = z.infer<typeof DriveStatusSchema>;

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  deductible: z.boolean(),
  sortOrder: z.number().int(),
});
export type Category = z.infer<typeof CategorySchema>;

export const CreateCategorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  deductible: z.boolean().default(false),
});
export type CreateCategory = z.infer<typeof CreateCategorySchema>;

export const UpdateCategorySchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  deductible: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
export type UpdateCategory = z.infer<typeof UpdateCategorySchema>;

export const DrivePointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  recordedAt: z.string().datetime(),
  odometer: z.number().nullable().optional(),
});
export type DrivePoint = z.infer<typeof DrivePointSchema>;

export const DriveSourceSchema = z.enum(['TELEMETRY', 'MANUAL', 'POLLED']);
export type DriveSource = z.infer<typeof DriveSourceSchema>;

export const DriveSummarySchema = z.object({
  id: z.string(),
  vehicleId: z.string().nullable(),
  vehicleName: z.string().nullable().optional(),
  source: DriveSourceSchema,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  startOdometer: z.number().nullable(),
  endOdometer: z.number().nullable(),
  distanceMiles: z.number().nullable(),
  durationSec: z.number().nullable(),
  startLat: z.number().nullable(),
  startLng: z.number().nullable(),
  endLat: z.number().nullable(),
  endLng: z.number().nullable(),
  startAddress: z.string().nullable().optional(),
  endAddress: z.string().nullable().optional(),
  status: DriveStatusSchema,
  categoryId: z.string().nullable().optional(),
  categoryName: z.string().nullable().optional(),
  categoryDeductible: z.boolean().nullable().optional(),
  purposeNote: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type DriveSummary = z.infer<typeof DriveSummarySchema>;

export const DriveDetailSchema = DriveSummarySchema.extend({
  points: z.array(DrivePointSchema),
});
export type DriveDetail = z.infer<typeof DriveDetailSchema>;

/** Hand-entered drives: an IRS mileage log needs a date, a distance, and a purpose. */
export const CreateDriveSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  distanceMiles: z.number().positive().max(10_000),
  vehicleId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  purposeNote: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  startAddress: z.string().max(200).optional().nullable(),
  endAddress: z.string().max(200).optional().nullable(),
});
export type CreateDrive = z.infer<typeof CreateDriveSchema>;

export const ClassifyDriveSchema = z.object({
  categoryId: z.string().nullable().optional(),
  /** @deprecated prefer categoryId; kept for batch convenience */
  status: DriveStatusSchema.optional(),
  purposeNote: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
export type ClassifyDrive = z.infer<typeof ClassifyDriveSchema>;

export const BatchClassifySchema = z.object({
  driveIds: z.array(z.string()).min(1),
  categoryId: z.string().nullable(),
  purposeNote: z.string().max(500).optional().nullable(),
});
export type BatchClassify = z.infer<typeof BatchClassifySchema>;

export const VehicleSchema = z.object({
  id: z.string(),
  vin: z.string(),
  displayName: z.string().nullable(),
  trackingEnabled: z.boolean(),
  virtualKeyPaired: z.boolean(),
  telemetryConfigured: z.boolean(),
});
export type Vehicle = z.infer<typeof VehicleSchema>;

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  teslaUserId: z.string(),
  displayName: z.string().nullable().optional(),
});
export type User = z.infer<typeof UserSchema>;

export const AppSettingsSchema = z.object({
  mileageRate: z.number().positive(),
  timezone: z.string(),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]),
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;

export const ReportSummarySchema = z.object({
  from: z.string(),
  to: z.string(),
  businessMiles: z.number(),
  personalMiles: z.number(),
  unclassifiedMiles: z.number(),
  mileageRate: z.number(),
  deductionDollars: z.number(),
  businessDriveCount: z.number(),
});
export type ReportSummary = z.infer<typeof ReportSummarySchema>;

export const TelemetryEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('drive_start'),
    vin: z.string(),
    occurredAt: z.string().datetime(),
    odometer: z.number(),
    lat: z.number().optional(),
    lng: z.number().optional(),
  }),
  z.object({
    type: z.literal('breadcrumb'),
    vin: z.string(),
    occurredAt: z.string().datetime(),
    odometer: z.number().optional(),
    lat: z.number(),
    lng: z.number(),
  }),
  z.object({
    type: z.literal('drive_end'),
    vin: z.string(),
    occurredAt: z.string().datetime(),
    odometer: z.number(),
    lat: z.number().optional(),
    lng: z.number().optional(),
  }),
]);
export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;

export const DEFAULT_MILEAGE_RATE = 0.7;
