import React from "react";
import { SafeAreaView, StyleSheet, Text, View, Pressable } from "react-native";
import { useRouter } from "expo-router";

export default function HomeScreen() {
  const router = useRouter();

  return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          {/* Header */}
          <Text style={styles.title}>POS</Text>
          <Text style={styles.subtitle}>Fast payments for merchants</Text>

          {/* Push cards down a bit */}
          <View style={styles.spacer} />

          {/* Big cards */}
          <Pressable
              onPress={() => router.push("/new-payment")}
              style={({ pressed }) => [styles.cardPrimary, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.cardTitleDark}>New Payment</Text>
            <Text style={styles.cardSubDark}>Card or QR</Text>
          </Pressable>

          <Pressable
              onPress={() => router.push("/transactions")}
              style={({ pressed }) => [styles.cardSecondary, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.cardTitle}>Transactions</Text>
            <Text style={styles.cardSub}>History & status</Text>
          </Pressable>

          {/* Bottom breathing room */}
          <View style={{ height: 18 }} />
        </View>
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B0F1A" },
  container: { flex: 1, padding: 20 },

  title: { color: "white", fontSize: 44, fontWeight: "900", marginTop: 10 },
  subtitle: { color: "rgba(255,255,255,0.7)", fontSize: 18, marginTop: 6 },


  spacer: { height: 60 },

  cardPrimary: {
    backgroundColor: "white",
    borderRadius: 28,
    padding: 22,
    height: 280,
    justifyContent: "center",
    marginBottom: 16,
  },
  cardSecondary: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 28,
    padding: 22,
    height: 280,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },

  cardTitleDark: { color: "#0B0F1A", fontSize: 34, fontWeight: "900" },
  cardSubDark: { color: "rgba(11,15,26,0.55)", fontSize: 18, marginTop: 6, fontWeight: "700" },

  cardTitle: { color: "white", fontSize: 34, fontWeight: "900" },
  cardSub: { color: "rgba(255,255,255,0.65)", fontSize: 18, marginTop: 6, fontWeight: "700" },
});