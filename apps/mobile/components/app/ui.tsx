/**
 * The pieces every screen was rebuilding for itself.
 *
 * Before this, six screens each declared their own `Section`, `Row` and `Button`, with six
 * slightly different paddings and three different ideas of what a section heading looks like.
 * That divergence is most of what made the app look assembled rather than designed, and it is
 * also why a palette change had to be made six times.
 *
 * Everything here is theme-driven through `createStyles`, so these restyle with the setting
 * rather than needing a relaunch — unlike layout direction, which is native and does.
 */

import type { ReactNode } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { createStyles, useTheme } from "./providers";
import { radius, space } from "../../lib/ui/theme";

/** A titled group of rows on a card. The iOS grouped-list convention. */
export function Section({
  title,
  action,
  footnote,
  children,
}: {
  title?: string;
  // `exactOptionalPropertyTypes` treats "absent" and "explicitly undefined" as different, and
  // these props are genuinely conditional.
  action?: { label: string; onPress: () => void } | undefined;
  footnote?: string | undefined;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      {(title !== undefined || action !== undefined) && (
        <View style={styles.sectionHeader}>
          {title !== undefined && <Text style={styles.sectionTitle}>{title}</Text>}
          {action && (
            <Pressable
              onPress={action.onPress}
              accessibilityRole="button"
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.sectionAction}>{action.label}</Text>
            </Pressable>
          )}
        </View>
      )}
      <View style={styles.sectionBody}>{children}</View>
      {footnote !== undefined && <Text style={styles.footnote}>{footnote}</Text>}
    </View>
  );
}

/**
 * A label/value pair.
 *
 * `textAlign: "right"` is deliberately absent: under RTL the value has to sit on the other
 * side, and `flex-end` on the container gets there without the style needing to know which
 * direction it is in — React Native mirrors `justifyContent`, it does not mirror `textAlign`.
 */
export function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong === true && styles.rowValueStrong]} selectable>
        {value}
      </Text>
    </View>
  );
}

export type ButtonTone = "primary" | "quiet" | "danger";

export function Button({
  label,
  onPress,
  tone = "primary",
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: ButtonTone;
  disabled?: boolean;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled === true}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      style={({ pressed }) => [
        styles.button,
        tone === "quiet" && styles.buttonQuiet,
        tone === "danger" && styles.buttonDanger,
        pressed && styles.pressed,
        disabled === true && styles.buttonDisabled,
      ]}
    >
      <Text
        style={[
          styles.buttonLabel,
          tone === "quiet" && styles.buttonLabelQuiet,
          tone === "danger" && styles.buttonLabelDanger,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * One choice in a set — the segmented row Settings uses for language and appearance.
 *
 * A row of these rather than a switch because both settings have three states in at least one
 * case (appearance), and mixing a two-state control with a three-state one in the same screen
 * reads as two different kinds of setting when they are the same kind.
 */
export function ChoiceRow({
  label,
  selected,
  onPress,
  note,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  note?: string | undefined;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.choice, pressed && styles.pressed]}
    >
      <View style={styles.choiceText}>
        <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{label}</Text>
        {note !== undefined && <Text style={styles.choiceNote}>{note}</Text>}
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <View style={styles.radioDot} />}
      </View>
    </Pressable>
  );
}

/** A tappable row that leads somewhere. The chevron is a rotated box, for the reason in `TabIcon`. */
export function LinkRow({
  label,
  note,
  onPress,
  tone,
}: {
  label: string;
  note?: string | undefined;
  onPress: () => void;
  tone?: "danger";
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.choice, pressed && styles.pressed]}
    >
      <View style={styles.choiceText}>
        <Text style={[styles.choiceLabel, tone === "danger" && styles.dangerText]}>{label}</Text>
        {note !== undefined && <Text style={styles.choiceNote}>{note}</Text>}
      </View>
      <View style={styles.chevron} />
    </Pressable>
  );
}

/** A numbered instruction. Used by Add and by the guided delete, which are both procedures. */
export function Step({ index, text }: { index: number; text: string }) {
  const styles = useStyles();
  return (
    <View style={styles.step}>
      <Text style={styles.stepNumber}>{index}</Text>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

/** A checkbox with its label, for a confirmation the user gives us. */
export function CheckRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Text style={styles.checkboxMark}>✓</Text>}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

/** A label and an on/off switch. The whole row toggles, not just the switch. */
export function SwitchRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={styles.checkRow}
    >
      <Text style={styles.checkLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.accent, false: theme.hairline }}
      />
    </Pressable>
  );
}

/** A callout. `tone` picks which of the three signal colours frames it. */
export function Callout({
  tone,
  title,
  children,
}: {
  tone: "good" | "bad" | "caution" | "neutral";
  title?: string;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View
      style={[
        styles.callout,
        tone === "good" && styles.calloutGood,
        tone === "bad" && styles.calloutBad,
        tone === "caution" && styles.calloutCaution,
      ]}
    >
      {title !== undefined && (
        <Text
          style={[
            styles.calloutTitle,
            tone === "good" && styles.goodText,
            tone === "bad" && styles.dangerText,
          ]}
        >
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}

const useStyles = createStyles((t) => ({
  section: { marginTop: space.lg, gap: space.sm },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.xs,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: t.muted,
    letterSpacing: 0.2,
    writingDirection: "auto",
  },
  sectionAction: { fontSize: 13.5, fontWeight: "700", color: t.accent },
  sectionBody: {
    backgroundColor: t.panel,
    borderRadius: radius.card,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.sm,
    gap: space.xs + 2,
  },
  footnote: {
    fontSize: 12.5,
    lineHeight: 18,
    color: t.muted,
    paddingHorizontal: space.xs,
    writingDirection: "auto",
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: space.lg,
    paddingVertical: space.sm + 1,
  },
  rowLabel: { fontSize: 14, color: t.muted, writingDirection: "auto" },
  rowValue: {
    fontSize: 14,
    fontWeight: "500",
    color: t.ink,
    flexShrink: 1,
    writingDirection: "auto",
  },
  rowValueStrong: { fontSize: 17, fontWeight: "700" },

  button: {
    marginTop: space.md,
    paddingVertical: 15,
    borderRadius: radius.card,
    alignItems: "center",
    backgroundColor: t.accent,
  },
  buttonQuiet: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: t.hairline,
  },
  buttonDanger: { backgroundColor: t.bad },
  buttonDisabled: { opacity: 0.35 },
  buttonLabel: { fontSize: 16, fontWeight: "700", color: t.onAccent },
  buttonLabelQuiet: { color: t.ink },
  buttonLabelDanger: { color: t.dark ? "#1a0f0c" : "#ffffff" },
  pressed: { opacity: 0.65 },

  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md - 2,
  },
  choiceText: { flex: 1, gap: 2 },
  choiceLabel: { fontSize: 16, color: t.ink, writingDirection: "auto" },
  choiceLabelSelected: { fontWeight: "700" },
  choiceNote: { fontSize: 12.5, lineHeight: 18, color: t.muted, writingDirection: "auto" },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: t.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: t.accent },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: t.accent },
  chevron: {
    width: 8,
    height: 8,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: t.muted,
    transform: [{ rotate: "45deg" }],
  },

  step: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: t.accent,
    color: t.onAccent,
    textAlign: "center",
    lineHeight: 24,
    fontSize: 13,
    fontWeight: "700",
    overflow: "hidden",
  },
  stepText: { flex: 1, fontSize: 15, lineHeight: 23, color: t.body, writingDirection: "auto" },

  checkRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: t.hairline,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.field,
  },
  checkboxChecked: { backgroundColor: t.good, borderColor: t.good },
  checkboxMark: { color: t.dark ? "#0d1a13" : "#ffffff", fontSize: 15, fontWeight: "700" },
  checkLabel: { flex: 1, fontSize: 15, lineHeight: 22, color: t.ink, writingDirection: "auto" },

  callout: {
    marginTop: space.lg,
    padding: space.lg,
    gap: space.sm - 2,
    borderRadius: radius.card,
    backgroundColor: t.panel,
    // `borderStartWidth` rather than `borderLeftWidth`: the accent stripe belongs on the side
    // the text starts from, and only the logical property follows the direction.
    borderStartWidth: 3,
    borderStartColor: t.hairline,
  },
  calloutGood: { backgroundColor: t.goodWash, borderStartColor: t.good },
  calloutBad: { backgroundColor: t.badWash, borderStartColor: t.bad },
  calloutCaution: { borderStartColor: t.caution },
  calloutTitle: { fontSize: 16, fontWeight: "700", color: t.ink, writingDirection: "auto" },
  goodText: { color: t.good },
  dangerText: { color: t.bad },
}));

/** Body copy inside a `Callout`, so callers do not each invent a paragraph style. */
export function CalloutText({ children }: { children: ReactNode }) {
  const styles = useCalloutTextStyles();
  return <Text style={styles.text}>{children}</Text>;
}

const useCalloutTextStyles = createStyles((t) => ({
  text: { fontSize: 14, lineHeight: 21, color: t.body, writingDirection: "auto" },
}));
