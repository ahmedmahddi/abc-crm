export const USER_ROLES = ["ADMIN", "RESPONSABLE", "CONSULTANT", "VIEWER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "DISABLED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const CLIENT_STATUSES = ["ACTIVE", "ARCHIVED"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const CONSULTANT_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export type ConsultantStatus = (typeof CONSULTANT_STATUSES)[number];

export const MISSION_TYPES = ["AUDIT", "AUDIT_INTERNE", "AUDIT_EXTERNE", "FORMATION", "ASSISTANCE", "AUTRE"] as const;
export type MissionType = (typeof MISSION_TYPES)[number];
export const MISSION_TYPE_OPTIONS = ["AUDIT_INTERNE", "AUDIT_EXTERNE", "FORMATION", "ASSISTANCE", "AUTRE"] as const;
export type MissionTypeOption = (typeof MISSION_TYPE_OPTIONS)[number];

export const MISSION_TYPE_LABELS: Record<MissionType, string> = {
  ASSISTANCE: "Assistance",
  AUDIT: "Audit interne",
  AUDIT_EXTERNE: "Audit externe",
  AUDIT_INTERNE: "Audit interne",
  AUTRE: "Autre",
  FORMATION: "Formation",
};

export const MISSION_TYPE_SHORT_LABELS: Record<MissionType, string> = {
  ASSISTANCE: "Assist.",
  AUDIT: "Int.",
  AUDIT_EXTERNE: "Ext.",
  AUDIT_INTERNE: "Int.",
  AUTRE: "Autre",
  FORMATION: "Form.",
};

export function getMissionTypeLabel(missionType: MissionType, otherLabel?: string | null) {
  return missionType === "AUTRE" && otherLabel?.trim() ? otherLabel.trim() : MISSION_TYPE_LABELS[missionType];
}

export function getMissionTypeShortLabel(missionType: MissionType, otherLabel?: string | null) {
  return missionType === "AUTRE" && otherLabel?.trim() ? otherLabel.trim() : MISSION_TYPE_SHORT_LABELS[missionType];
}

export const MISSION_MODES = ["ONLINE", "PRESENTIELLE"] as const;
export type MissionMode = (typeof MISSION_MODES)[number];

export const ORDRE_MISSION_STATUSES = ["DRAFT", "VALIDATED", "PRINTED", "CANCELLED", "ARCHIVED"] as const;
export type OrdreMissionStatus = (typeof ORDRE_MISSION_STATUSES)[number];
