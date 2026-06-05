export const USER_ROLES = ["ADMIN", "RESPONSABLE", "CONSULTANT", "VIEWER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "DISABLED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const CLIENT_STATUSES = ["ACTIVE", "ARCHIVED"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const CONSULTANT_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export type ConsultantStatus = (typeof CONSULTANT_STATUSES)[number];

export const MISSION_TYPES = ["AUDIT", "FORMATION", "ASSISTANCE"] as const;
export type MissionType = (typeof MISSION_TYPES)[number];

export const MISSION_MODES = ["ONLINE", "PRESENTIELLE"] as const;
export type MissionMode = (typeof MISSION_MODES)[number];

export const ORDRE_MISSION_STATUSES = ["DRAFT", "VALIDATED", "PRINTED", "CANCELLED", "ARCHIVED"] as const;
export type OrdreMissionStatus = (typeof ORDRE_MISSION_STATUSES)[number];
