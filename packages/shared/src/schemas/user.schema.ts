import { z } from "zod";

export const userCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(10),
  role: z.enum(["ADMIN", "RESPONSABLE", "CONSULTANT", "VIEWER"]),
  consultantId: z.string().uuid().optional().or(z.literal("")),
});

export const userUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(10).optional().or(z.literal("")),
  role: z.enum(["ADMIN", "RESPONSABLE", "CONSULTANT", "VIEWER"]).optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  consultantId: z.string().uuid().optional().or(z.literal("")),
});

export const userListQuerySchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  role: z.enum(["ADMIN", "RESPONSABLE", "CONSULTANT", "VIEWER", "ALL"]).default("ALL"),
  status: z.enum(["ACTIVE", "DISABLED", "ALL"]).default("ALL"),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type UserListQuery = z.infer<typeof userListQuerySchema>;
