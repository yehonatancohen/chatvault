import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";

/**
 * Library screen — placeholder.
 *
 * The real entry point into this app is the share sheet, not this screen: a user arrives here
 * having already exported a chat in WhatsApp. Until an archive exists, the most useful thing
 * this screen can do is tell them how to produce one, and be honest that the deleting is
 * theirs to do.
 */
export default function LibraryScreen() {
  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>No archives yet</Text>

        <Text style={styles.body}>
          In WhatsApp, open a chat, tap the chat name, and choose{" "}
          <Text style={styles.emphasis}>Export chat</Text>. Then pick ChatVault from the share
          sheet.
        </Text>

        <View style={styles.note}>
          <Text style={styles.noteHeading}>Two things worth knowing first</Text>
          <Text style={styles.noteBody}>
            WhatsApp caps an export at about 40,000 messages, or 10,000 if you include media,
            counting back from the most recent. Archiving again later picks up where this one
            stops — and so does anyone else in the group who archives their own copy.
          </Text>
          <Text style={styles.noteBody}>
            ChatVault cannot delete anything from WhatsApp; no app can. Once your archive is
            saved and verified, we will show you how to delete the chat yourself.
          </Text>
        </View>

        {/*
          Dev builds only. The storage adapter's conformance suite cannot run in CI — the
          filesystem it uses is a native module — so the only way to run it is from inside the
          app. `__DEV__` is false in a release bundle, so this never reaches a user.
        */}
        {__DEV__ && (
          <Link href="/dev-storage" style={styles.devLink}>
            Dev: run the storage contract
          </Link>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16 },
  heading: { fontSize: 24, fontWeight: "600", letterSpacing: -0.4 },
  body: { fontSize: 16, lineHeight: 24, color: "#4a4842" },
  emphasis: { fontWeight: "600", color: "#1c1b19" },
  note: {
    marginTop: 8,
    padding: 16,
    gap: 10,
    borderRadius: 12,
    backgroundColor: "#f3f1ec",
  },
  noteHeading: { fontSize: 14, fontWeight: "600", color: "#1c1b19" },
  noteBody: { fontSize: 14, lineHeight: 21, color: "#5c594f" },
  devLink: { marginTop: 8, fontSize: 13, color: "#6b6862", textDecorationLine: "underline" },
});
