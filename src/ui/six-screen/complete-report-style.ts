export type CompleteReportSectionStyle = {
  accent: string;
  tint: string;
};

const styles: Record<string, CompleteReportSectionStyle> = {
  "01": { accent: "#275EA8", tint: "#EAF3FF" },
  "02": { accent: "#6235B5", tint: "#F1ECFB" },
  "03": { accent: "#B44573", tint: "#FCECF3" },
  "04": { accent: "#087F79", tint: "#E6F6F4" },
  "05": { accent: "#173C50", tint: "#EAF1F4" },
  REF: { accent: "#5B6672", tint: "#EFF2F5" },
};

export function completeReportSectionStyle(
  number: string,
): CompleteReportSectionStyle {
  return styles[number] ?? styles.REF!;
}
