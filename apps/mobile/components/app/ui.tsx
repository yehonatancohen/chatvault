/**
 * The pieces every screen builds from.
 *
 * Before this, six screens each declared their own `Section`, `Row` and `Button`, with six
 * slightly different paddings and three ideas of what a section heading looks like. That is
 * most of what made the app look assembled rather than designed, and it is why a palette
 * change had to be made six times.
 *
 * **The rules these encode**, all of them from `lib/ui/theme.ts`:
 *
 * - **A group is one surface with lines between its rows**, not a stack of cards. `Section`
 *   inserts the separators itself, so a screen cannot get the rhythm wrong by forgetting one,
 *   and a row never has to know whether it is first or last.
 * - **Nothing tappable is shorter than `TAP`.** Every pressable here sets `minHeight`, which is
 *   why rows can hold one line or three without the screen changing character.
 * - **Sizes come from `type`.** No component here names a font size of its own.
 * - **One primary action per screen.** `Button` defaults to `primary` — iOS's filled button, the
 *   tint with a white label; a screen with three filled buttons has no primary action, so the
 *   others take `tone="quiet"`, which is iOS's tinted button: a wash of the tint with the tint as
 *   its label.
 * - **A group is an inset grouped list.** Rows highlight grey edge to edge when pressed, and the
 *   separators run from the text's leading edge to the group's trailing edge, as in Settings.
 *
 * - **Text that can wrap sets `textAlign: "left"`.** React Native swaps left and right under an
 *   RTL layout, so "left" is the start edge in both languages; left at its natural default, a
 *   wrapped Hebrew paragraph sets flush left on iOS.
 *
 * Everything is theme-driven through `createStyles`, so these restyle with the setting rather
 * than needing a relaunch — unlike layout direction, which is native and does.
 */

import { Children, useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useNavigation } from "expo-router";
import { Icon } from "./Icon";
import { createStyles, useTheme } from "./providers";
import { gutter, radius, space, TAP, type } from "../../lib/ui/theme";

/**
 * A screen's scrolling body: one side margin, one rhythm between sections, room at the bottom.
 *
 * Screens used to each set their own `contentContainerStyle`, which is why no two of them had
 * their content starting at the same place. `gap` here is the space *between sections* — a
 * `Section` adds none of its own above itself.
 */
export function Screen({
  children,
  gap = space.xl,
  keyboard,
  largeTitle,
}: {
  children: ReactNode;
  /** A top-level (tab) screen's name, set as a large title that collapses into the header. */
  largeTitle?: string;
  /** Override only when a screen is one continuous thing rather than a set of groups. */
  gap?: number;
  /** True on a screen with a text field, so taps reach buttons behind the keyboard. */
  keyboard?: boolean;
}) {
  const styles = useStyles();
  const onScroll = useLargeTitle(largeTitle);
  return (
    <ScrollView
      contentContainerStyle={[styles.screen, { gap }]}
      keyboardShouldPersistTaps={keyboard === true ? "handled" : "never"}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      {largeTitle !== undefined && <LargeTitle text={largeTitle} />}
      {children}
    </ScrollView>
  );
}

/** How far a screen scrolls before its large title has left and the header takes the name over. */
const LARGE_TITLE_COLLAPSE = 36;

/**
 * A large title's other half: the header shows nothing while the title is on screen, and takes
 * the name (and its hairline) once the title has scrolled under it — what a system navigation
 * bar does on a top-level screen.
 *
 * Done by hand because the tab navigator's header is drawn in JS (`expo-router/js-tabs`) and has
 * no large-title mode; nesting a native stack inside each tab would get the real one and would
 * move the routes a share hand-off depends on (`apps/mobile/CLAUDE.md`). Returns the scroll
 * handler for the screen's own scroll view; with no `title` it does nothing.
 */
export function useLargeTitle(
  title: string | undefined,
): (event: NativeSyntheticEvent<NativeScrollEvent>) => void {
  const navigation = useNavigation();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (title === undefined) return;
    navigation.setOptions({ headerTitle: collapsed ? title : "", headerShadowVisible: collapsed });
  }, [navigation, title, collapsed]);

  return useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setCollapsed(event.nativeEvent.contentOffset.y > LARGE_TITLE_COLLAPSE);
  }, []);
}

/** A top-level screen's name, as the first thing in its scrolling content. See `useLargeTitle`. */
export function LargeTitle({ text }: { text: string }) {
  const styles = useStyles();
  return (
    <Text style={styles.largeTitle} accessibilityRole="header">
      {text}
    </Text>
  );
}

/**
 * A screen's own headline, with an optional line under it.
 *
 * For screens whose subject is the thing named — a chat being imported, a chat being deleted.
 * A screen that already shows its name in the navigation header does not repeat it here.
 */
export function Title({ text, note }: { text: string; note?: string | undefined }) {
  const styles = useStyles();
  return (
    <View style={styles.titleBlock}>
      <Text style={styles.title}>{text}</Text>
      {note !== undefined && <Text style={styles.titleNote}>{note}</Text>}
    </View>
  );
}

/**
 * A titled group of rows on one surface.
 *
 * Separators are inserted between children rather than drawn by them: a row that draws its own
 * bottom border leaves a stray line under the last one, and every screen that has ever had this
 * component has had that bug. `flat` drops the surface for a group that is really just a
 * paragraph and a button.
 */
export function Section({
  title,
  action,
  footnote,
  flat,
  children,
}: {
  title?: string;
  // `exactOptionalPropertyTypes` treats "absent" and "explicitly undefined" as different, and
  // these props are genuinely conditional.
  action?: { label: string; onPress: () => void } | undefined;
  footnote?: string | undefined;
  flat?: boolean;
  children: ReactNode;
}) {
  const styles = useStyles();
  const rows = Children.toArray(children).filter(Boolean);

  return (
    <View style={styles.section}>
      {(title !== undefined || action !== undefined) && (
        <View style={styles.sectionHeader}>
          {title !== undefined && <Text style={styles.sectionTitle}>{title}</Text>}
          {action && (
            <Pressable
              onPress={action.onPress}
              accessibilityRole="button"
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.sectionAction}>{action.label}</Text>
            </Pressable>
          )}
        </View>
      )}
      <View style={flat === true ? styles.sectionFlat : styles.sectionBody}>
        {rows.map((row, index) => (
          // The index is the only identity a caller's arbitrary children have, and it is safe
          // here in the way it usually is not: these are literal rows written in a screen's
          // source, not a reorderable list, so a given position is always the same row.
          <View key={index}>
            {index > 0 && flat !== true && <View style={styles.separator} />}
            {row}
          </View>
        ))}
      </View>
      {footnote !== undefined && <Text style={styles.footnote}>{footnote}</Text>}
    </View>
  );
}

/**
 * A label/value pair, as a system cell sets one: the label leads in primary text, the value
 * trails in secondary.
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

/**
 * A number that is the point of the screen, with what it counts underneath.
 *
 * Verify's whole job is to state what was captured, and a count set in body copy does not read
 * as evidence. The number is set at Large Title's size in tabular figures, and the label stays
 * quiet.
 */
export function Stat({ value, label }: { value: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** A small status chip. `tone` picks the signal colour; `neutral` is the default. */
export function Pill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "good" | "bad" | "accent";
}) {
  const styles = useStyles();
  return (
    <View
      style={[
        styles.pill,
        tone === "good" && styles.pillGood,
        tone === "bad" && styles.pillBad,
        tone === "accent" && styles.pillAccent,
      ]}
    >
      <Text
        style={[
          styles.pillLabel,
          tone === "good" && styles.goodText,
          tone === "bad" && styles.dangerText,
          tone === "accent" && styles.accentText,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * A screen with nothing on it yet: what is missing, and the one thing to do about it.
 *
 * Centred and vertically generous, because an empty library is the first screen a new user
 * sees and a heading pinned to the top of a blank page reads as a failure rather than a start.
 *
 * `graphic`, when given, sits above the heading — it is what tells a new user "something is
 * supposed to go here" rather than "this text is loading". `actionTone: "help"` swaps the
 * primary `Button` for a tinted pill, for a screen whose action is "learn how" rather than "do
 * the thing that fixes this" —
 * `app/verify.tsx`'s fallback keeps the default so it still reads as a normal action.
 */
export function EmptyState({
  heading,
  body,
  graphic,
  action,
  actionTone = "primary",
}: {
  heading: string;
  body?: string | undefined;
  graphic?: ReactNode;
  action?: { label: string; onPress: () => void } | undefined;
  actionTone?: "primary" | "help";
}) {
  const styles = useStyles();
  return (
    <View style={styles.empty}>
      {graphic}
      <Text style={styles.emptyHeading}>{heading}</Text>
      {body !== undefined && <Text style={styles.emptyBody}>{body}</Text>}
      {action &&
        (actionTone === "help" ? (
          <Pressable
            onPress={action.onPress}
            accessibilityRole="button"
            style={({ pressed }) => [styles.helpPill, pressed && styles.pressedRow]}
          >
            <Icon name="help" color={styles.helpPillLabel.color} size={20} />
            <Text style={styles.helpPillLabel}>{action.label}</Text>
          </Pressable>
        ) : (
          <View style={styles.emptyAction}>
            <Button label={action.label} onPress={action.onPress} />
          </View>
        ))}
    </View>
  );
}

export type ButtonTone = "primary" | "quiet" | "danger";

/**
 * The one action, or one of the few.
 *
 * `quiet` is a tinted button rather than bare text so that a screen offering three things
 * still reads as three buttons; `primary` is the filled one and there should be at most one
 * per screen.
 */
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
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** A column of buttons at a screen's foot, the primary one first. */
export function Actions({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <View style={styles.actions}>{children}</View>;
}

/**
 * One choice in a set — the rows Settings uses for language and appearance.
 *
 * Rows rather than a segmented control because appearance has three states and language two,
 * and mixing a segmented control with a switch in one screen reads as two different kinds of
 * setting when they are the same kind. The mark is a checkmark on the selected row, which is
 * the platform convention for "one of these", and it sits in the same place as `LinkRow`'s
 * chevron so a settings list has one right-hand column rather than two.
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
      style={({ pressed }) => [styles.tapRow, pressed && styles.pressedRow]}
    >
      <View style={styles.tapRowText}>
        <Text style={styles.tapRowLabel}>{label}</Text>
        {note !== undefined && <Text style={styles.tapRowNote}>{note}</Text>}
      </View>
      {selected && <Icon name="check" color={styles.check.color} size={18} weight="semibold" />}
    </Pressable>
  );
}

/** A tappable row that leads somewhere, with the system's forward chevron at its end. */
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
      style={({ pressed }) => [styles.tapRow, pressed && styles.pressedRow]}
    >
      <View style={styles.tapRowText}>
        <Text style={[styles.tapRowLabel, tone === "danger" && styles.dangerText]}>{label}</Text>
        {note !== undefined && <Text style={styles.tapRowNote}>{note}</Text>}
      </View>
      <Icon name="chevron" color={styles.chevron.color} size={14} weight="bold" />
    </Pressable>
  );
}

/**
 * A numbered instruction. Used by Add and by the guided delete, which are both procedures.
 *
 * The number stands in a tint disc, the way the system numbers a procedure (`1.circle.fill`).
 *
 * `icon`, when given, sits at the row's end — the add-chat sheet passes one per step
 * (its screenshot); the guided delete's steps omit it.
 */
export function Step({
  index,
  text,
  icon,
}: {
  index: number;
  text: string;
  icon?: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.step}>
      <View style={styles.stepPlate}>
        <Text style={styles.stepNumber}>{index}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
      {icon}
    </View>
  );
}

/**
 * A confirmation the user gives us: the system's selection circle, filled with the tint and a
 * checkmark once it is given.
 */
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
      style={({ pressed }) => [styles.tapRow, pressed && styles.pressedRow]}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Icon name="check" color={styles.checkboxMark.color} size={13} weight="bold" />}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

/** A label and an on/off switch. The whole row toggles, not just the switch. */
export function SwitchRow({
  label,
  note,
  value,
  onChange,
}: {
  label: string;
  note?: string | undefined;
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
      style={styles.tapRow}
    >
      <View style={styles.tapRowText}>
        <Text style={styles.tapRowLabel}>{label}</Text>
        {note !== undefined && <Text style={styles.tapRowNote}>{note}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        // No `true` colour: left alone, iOS draws its own "on" green, which is what a system
        // switch is — the one control the tint never reaches.
        trackColor={{ false: theme.sunken }}
        // iOS draws the thumb white in both states; Android takes the accent unless told.
        thumbColor={theme.dark && !value ? theme.muted : undefined}
      />
    </Pressable>
  );
}

/**
 * A callout: a tinted block that says one thing.
 *
 * No accent stripe down the side any more — a tinted ground and a coloured title carry the tone
 * on their own, and the stripe was the single most decorative thing in the app. `neutral` is
 * for a note that is merely quiet, and it is the right choice far more often than the other
 * three: nothing normal gets a colour (`apps/mobile/CLAUDE.md`, minimal text).
 */
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

/** Body copy inside a `Callout`, so callers do not each invent a paragraph style. */
export function CalloutText({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.calloutBody}>{children}</Text>;
}

/**
 * A text field, with its error underneath.
 *
 * The only text a user ever types into this app is a passphrase, and the two screens that ask
 * for one had drifted into two different fields. Both rules below were in one of those copies
 * and not the other, which is exactly why this is a component:
 *
 * - **A passphrase is never RTL**, so the field stays left-aligned even in Hebrew. Mirroring
 *   the caret makes it feel broken while typing.
 * - **The keyboard follows the palette.** Without `keyboardAppearance` the system keyboard
 *   comes up light behind a dark app.
 */
export function Field({
  value,
  onChange,
  placeholder,
  error,
  secure,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string | undefined;
  secure?: boolean;
  onSubmit?: (() => void) | undefined;
}) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <TextInput
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure === true}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, error !== undefined && styles.inputBad]}
        placeholder={placeholder}
        placeholderTextColor={theme.faint}
        keyboardAppearance={theme.dark ? "dark" : "light"}
        accessibilityLabel={placeholder}
        {...(onSubmit !== undefined ? { onSubmitEditing: onSubmit } : {})}
      />
      {error !== undefined && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

/** A paragraph of the screen's own copy, outside any card. */
export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  const styles = useStyles();
  return <Text style={[styles.bodyText, muted === true && styles.bodyMuted]}>{children}</Text>;
}

const useStyles = createStyles((t) => ({
  screen: { paddingHorizontal: gutter, paddingTop: space.sm, paddingBottom: space.xxxl },
  largeTitle: { ...type.display, color: t.ink, textAlign: "left", writingDirection: "auto" },

  titleBlock: { gap: space.xs },
  title: { ...type.title, color: t.ink, textAlign: "left", writingDirection: "auto" },
  titleNote: { ...type.caption, color: t.muted, textAlign: "left", writingDirection: "auto" },

  section: { gap: space.sm },
  // Inset by the cell's own padding, so a header's text starts where its rows' text does.
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.lg,
  },
  sectionTitle: { ...type.micro, color: t.muted, writingDirection: "auto" },
  sectionAction: { ...type.micro, color: t.accent, writingDirection: "auto" },
  sectionBody: {
    backgroundColor: t.panel,
    borderRadius: radius.card,
    borderCurve: "continuous",
    paddingHorizontal: space.lg,
    overflow: "hidden",
  },
  sectionFlat: { gap: space.md },
  // From the text's leading edge to the group's trailing edge, as a system list divides rows.
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: t.separator, marginEnd: -space.lg },
  footnote: { ...type.micro, color: t.muted, paddingHorizontal: space.lg, textAlign: "left", writingDirection: "auto" },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: space.lg,
    minHeight: TAP,
    paddingVertical: space.md,
  },
  rowLabel: { ...type.label, color: t.ink, writingDirection: "auto" },
  rowValue: { ...type.label, color: t.muted, flexShrink: 1, writingDirection: "auto" },
  rowValueStrong: { ...type.heading, color: t.ink },

  stat: { gap: 2 },
  statValue: { ...type.numeral, color: t.ink, writingDirection: "auto" },
  statLabel: { ...type.caption, color: t.muted, writingDirection: "auto" },

  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: t.sunken,
  },
  pillGood: { backgroundColor: t.goodWash },
  pillBad: { backgroundColor: t.badWash },
  pillAccent: { backgroundColor: t.accentWash },
  pillLabel: { ...type.micro, color: t.muted, writingDirection: "auto" },

  empty: { paddingTop: space.xxxl, alignItems: "center", gap: space.sm },
  emptyHeading: { ...type.title, color: t.ink, textAlign: "center", writingDirection: "auto" },
  emptyBody: {
    ...type.body,
    color: t.muted,
    textAlign: "center",
    maxWidth: 320,
    writingDirection: "auto",
  },
  emptyAction: { alignSelf: "stretch", paddingTop: space.md },
  helpPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: t.accentWash,
    minHeight: TAP,
  },
  helpPillLabel: { ...type.label, fontWeight: "600", color: t.accent, writingDirection: "auto" },

  button: {
    minHeight: 50,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.accent,
  },
  buttonQuiet: { backgroundColor: t.accentWash },
  buttonDanger: { backgroundColor: t.badWash },
  buttonDisabled: { opacity: 0.4 },
  buttonLabel: { ...type.label, fontWeight: "600", color: t.onAccent, writingDirection: "auto" },
  buttonLabelQuiet: { color: t.accent },
  buttonLabelDanger: { color: t.bad },
  pressed: { opacity: 0.6 },
  pressedRow: { backgroundColor: t.highlight },
  actions: { gap: space.md },

  // Bled out to the group's edges and padded back in, so the pressed highlight fills the cell
  // (the group clips it to its corners) rather than stopping short of them.
  tapRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: TAP,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    marginHorizontal: -space.lg,
  },
  tapRowText: { flex: 1, gap: 2 },
  tapRowLabel: { ...type.label, color: t.ink, textAlign: "left", writingDirection: "auto" },
  tapRowNote: { ...type.caption, color: t.muted, textAlign: "left", writingDirection: "auto" },
  check: { color: t.accent },
  chevron: { color: t.faint },

  step: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  stepPlate: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: t.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumber: { ...type.caption, fontWeight: "600", color: t.onAccent, fontVariant: ["tabular-nums"] },
  stepText: { flex: 1, ...type.body, color: t.body, paddingTop: 3, textAlign: "left", writingDirection: "auto" },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: t.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: t.accent, borderColor: t.accent },
  checkboxMark: { color: t.onAccent },
  checkLabel: { flex: 1, ...type.label, color: t.ink, textAlign: "left", writingDirection: "auto" },

  callout: {
    padding: space.lg,
    gap: space.xs,
    borderRadius: radius.card,
    borderCurve: "continuous",
    backgroundColor: t.panel,
  },
  calloutGood: { backgroundColor: t.goodWash },
  calloutBad: { backgroundColor: t.badWash },
  calloutCaution: { backgroundColor: t.cautionWash },
  calloutTitle: { ...type.heading, color: t.ink, textAlign: "left", writingDirection: "auto" },
  calloutBody: { ...type.caption, color: t.body, textAlign: "left", writingDirection: "auto" },

  field: { gap: space.sm },
  // No outline at rest: a field is a cell-coloured well on the grouped page, as in a system
  // form. The border exists only to turn red.
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: radius.field,
    borderCurve: "continuous",
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    ...type.body,
    color: t.ink,
    backgroundColor: t.field,
    // A passphrase is never RTL text and mirroring the caret makes it feel broken while typing.
    textAlign: "left",
    writingDirection: "ltr",
  },
  inputBad: { borderColor: t.bad },
  fieldError: { ...type.micro, color: t.bad, paddingHorizontal: space.lg, textAlign: "left", writingDirection: "auto" },

  bodyText: { ...type.body, color: t.body, textAlign: "left", writingDirection: "auto" },
  bodyMuted: { ...type.caption, color: t.muted },

  goodText: { color: t.good },
  dangerText: { color: t.bad },
  accentText: { color: t.accent },
}));
