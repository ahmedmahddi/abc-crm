export const brandColors = {
  primary: "#125885",
  primaryDark: "#0E476C",
  primaryLight: "#EAF2F7",
  neutral: "#BDC3C7",
  neutralDark: "#7A868F",
  neutralLight: "#E7EBEE",
  background: "#F7F9FB",
  surface: "#FFFFFF",
  text: "#0F1720",
  border: "#D9E0E4",
  success: "#1F7A5A",
  warning: "#C48A1A",
  danger: "#C44545",
} as const;

export const consultantColorPalette = [
  "#125885",
  "#1F7A5A",
  "#C48A1A",
  "#0E476C",
  "#7A868F",
  "#C44545",
  "#2F6F8F",
  "#5F6B7A",
] as const;

export type ConsultantColor = (typeof consultantColorPalette)[number];
