// app/new-payment.tsx
// New Payment screen

import React, { useMemo, useState } from "react";
import { SafeAreaView, StyleSheet, Text, View, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { createPaymentIntent } from "../lib/api";

type Method = "QR" | "CARD";

/** digits represent pence. Example: "1234" => £12.34 */
function digitsToPence(digits: string) {
    if (!digits) return 0;
    const capped = digits.slice(0, 9); // up to 9 digits => 9,999,999.99
    return Number(capped);
}

function formatGBPFromPence(pence: number) {
    const abs = Math.abs(pence);
    const pounds = Math.floor(abs / 100);
    const pennies = abs % 100;
    const sign = pence < 0 ? "-" : "";
    return `${sign}£${pounds}.${pennies.toString().padStart(2, "0")}`;
}

function addPence(digits: string, add: number) {
    const current = digitsToPence(digits);
    return String(current + add);
}

function appendDigit(digits: string, d: string) {
    const next = (digits + d).replace(/^0+(?=\d)/, "");
    return next.slice(0, 9);
}

function backspace(digits: string) {
    return digits.length <= 1 ? "" : digits.slice(0, -1);
}

function Key({
                 label,
                 onPress,
                 variant = "default",
             }: {
    label: string;
    onPress: () => void;
    variant?: "default" | "danger";
}) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.key,
                variant === "danger" && styles.keyDanger,
                pressed && { opacity: 0.7 },
            ]}
        >
            <Text style={[styles.keyText, variant === "danger" && styles.keyTextDanger]}>{label}</Text>
        </Pressable>
    );
}

export default function NewPaymentScreen() {
    const router = useRouter();

    const [digits, setDigits] = useState<string>("");
    const [method, setMethod] = useState<Method>("CARD"); // ✅ default CARD
    const [loading, setLoading] = useState(false);

    const pence = useMemo(() => digitsToPence(digits), [digits]);
    const display = useMemo(() => formatGBPFromPence(pence), [pence]);

    async function handleCreatePayment() {
        if (pence <= 0) {
            Alert.alert("Invalid amount", "Enter an amount greater than £0.00");
            return;
        }

        try {
            setLoading(true);

            const intent = await createPaymentIntent({
                amount: pence, // already minor units
                currency: "GBP",
                method,
            });

            router.push(`/payment/${intent.id}`);
        } catch (err: any) {
            Alert.alert("Could not create payment", err?.message || "Something went wrong.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.headerRow}>
                    <Text style={styles.title}>New Payment</Text>

                    {/* Method toggle (simple) */}
                    <View style={styles.segment}>
                        <Pressable
                            onPress={() => setMethod("CARD")}
                            style={[styles.segmentBtn, method === "CARD" && styles.segmentBtnActive]}
                        >
                            <Text style={[styles.segmentText, method === "CARD" && styles.segmentTextActive]}>
                                Card
                            </Text>
                        </Pressable>

                        <Pressable
                            onPress={() => setMethod("QR")}
                            style={[styles.segmentBtn, method === "QR" && styles.segmentBtnActive]}
                        >
                            <Text style={[styles.segmentText, method === "QR" && styles.segmentTextActive]}>
                                QR
                            </Text>
                        </Pressable>
                    </View>
                </View>

                {/* Amount Display */}
                <View style={styles.amountCard}>
                    <Text style={styles.amountHint}>Enter amount</Text>
                    <Text style={styles.amountValue}>{display}</Text>

                    <View style={styles.quickRow}>
                        <Pressable style={styles.quickChip} onPress={() => setDigits((p) => addPence(p, 500))}>
                            <Text style={styles.quickChipText}>+£5</Text>
                        </Pressable>

                        <Pressable style={styles.quickChip} onPress={() => setDigits((p) => addPence(p, 1000))}>
                            <Text style={styles.quickChipText}>+£10</Text>
                        </Pressable>

                        <Pressable style={styles.quickChip} onPress={() => setDigits((p) => addPence(p, 2000))}>
                            <Text style={styles.quickChipText}>+£20</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Keypad */}
                <View style={styles.keypad}>
                    <View style={styles.keyRow}>
                        <Key label="1" onPress={() => setDigits((p) => appendDigit(p, "1"))} />
                        <Key label="2" onPress={() => setDigits((p) => appendDigit(p, "2"))} />
                        <Key label="3" onPress={() => setDigits((p) => appendDigit(p, "3"))} />
                    </View>
                    <View style={styles.keyRow}>
                        <Key label="4" onPress={() => setDigits((p) => appendDigit(p, "4"))} />
                        <Key label="5" onPress={() => setDigits((p) => appendDigit(p, "5"))} />
                        <Key label="6" onPress={() => setDigits((p) => appendDigit(p, "6"))} />
                    </View>
                    <View style={styles.keyRow}>
                        <Key label="7" onPress={() => setDigits((p) => appendDigit(p, "7"))} />
                        <Key label="8" onPress={() => setDigits((p) => appendDigit(p, "8"))} />
                        <Key label="9" onPress={() => setDigits((p) => appendDigit(p, "9"))} />
                    </View>
                    <View style={styles.keyRow}>
                        <Key label="C" variant="danger" onPress={() => setDigits("")} />
                        <Key label="0" onPress={() => setDigits((p) => appendDigit(p, "0"))} />
                        <Key label="⌫" onPress={() => setDigits((p) => backspace(p))} />
                    </View>
                </View>

                {/* Spacer pushes actions to bottom */}
                <View style={{ flex: 1 }} />

                {/* Bottom actions */}
                <View style={styles.bottomActions}>
                    <Pressable
                        onPress={handleCreatePayment}
                        disabled={loading}
                        style={({ pressed }) => [styles.primary, (loading || pressed) && { opacity: 0.7 }]}
                    >
                        <Text style={styles.primaryText}>{loading ? "Creating…" : "Create Payment"}</Text>
                    </Pressable>

                    <Pressable
                        onPress={() => router.back()}
                        style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.7 }]}
                    >
                        <Text style={styles.cancelText}>Cancel</Text>
                    </Pressable>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#0B0F1A" },
    container: { flex: 1, padding: 20, gap: 14 },

    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
    },
    title: { color: "white", fontSize: 28, fontWeight: "800" },

    segment: {
        flexDirection: "row",
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 4,
        gap: 10,
    },
    segmentBtn: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    segmentBtnActive: { backgroundColor: "white" },
    segmentText: { fontSize: 14, fontWeight: "800", color: "rgba(255,255,255,0.85)" },
    segmentTextActive: { color: "#0B0F1A" },

    amountCard: {
        backgroundColor: "white",
        borderRadius: 20,
        paddingVertical: 18,
        paddingHorizontal: 18,
    },
    amountHint: {
        color: "rgba(11,15,26,0.45)",
        fontSize: 13,
        fontWeight: "600",
        letterSpacing: 1,
        textTransform: "uppercase",
        marginBottom: 6,
    },
    amountValue: { fontSize: 44, fontWeight: "900", color: "#0B0F1A" },

    quickRow: { flexDirection: "row", gap: 10, marginTop: 14 },
    quickChip: {
        flex: 1,
        borderRadius: 999,
        backgroundColor: "rgba(11,15,26,0.06)",
        paddingVertical: 12,
        alignItems: "center",
    },
    quickChipText: { fontWeight: "900", color: "#0B0F1A" },

    keypad: {
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 20,
        padding: 12,
        gap: 10,
    },
    keyRow: { flexDirection: "row", gap: 10 },

    key: {
        flex: 1,
        backgroundColor: "white",
        borderRadius: 18,
        height: 80,
        alignItems: "center",
        justifyContent: "center",
    },
    keyText: { fontSize: 22, fontWeight: "900", color: "#0B0F1A" },
    keyDanger: { backgroundColor: "rgba(255,255,255,0.85)" },
    keyTextDanger: { color: "#C0392B" },

    bottomActions: {
        gap: 12,
        paddingBottom: 16,
    },

    primary: {
        backgroundColor: "white",
        borderRadius: 18,
        paddingVertical: 18,
        alignItems: "center",
    },
    primaryText: { fontSize: 18, fontWeight: "900", color: "#0B0F1A" },

    cancel: {
        borderRadius: 18,
        paddingVertical: 16,
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    cancelText: {
        fontSize: 16,
        fontWeight: "700",
        color: "rgba(255,255,255,0.85)",
    },
});