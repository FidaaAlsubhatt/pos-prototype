// app/payment/[id].tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    SafeAreaView,
    StyleSheet,
    Text,
    View,
    Pressable,
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";

import {
    cancelPaymentIntent,
    confirmPaymentIntent,
    failPaymentIntent,
    getPaymentIntent,
} from "../../lib/api";

type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "EXPIRED";

type PaymentIntentDto = {
    id: string;
    merchantId: string;
    amount: number; // minor units
    currency: string;
    method: "QR" | "CARD";
    status: PaymentStatus;
    failureReason?: string | null;
    expiresAt: string;
    createdAt: string;
    updatedAt: string;
    customerUrl: string;
};

function formatMoney(amountMinor: number, currency: string) {
    const major = Math.floor(amountMinor / 100);
    const minor = Math.abs(amountMinor % 100);
    const symbol = currency === "GBP" ? "£" : "";
    return `${symbol}${major}.${minor.toString().padStart(2, "0")}`;
}

function statusLabel(status: PaymentStatus) {
    switch (status) {
        case "PENDING":
            return "Waiting for customer…";
        case "SUCCEEDED":
            return "Payment approved";
        case "FAILED":
            return "Payment failed";
        case "CANCELLED":
            return "Payment cancelled";
        case "EXPIRED":
            return "Payment expired";
    }
}

function statusPillStyle(status: PaymentStatus) {
    if (status === "SUCCEEDED") return styles.pillSuccess;
    if (status === "FAILED") return styles.pillFail;
    if (status === "CANCELLED" || status === "EXPIRED") return styles.pillMuted;
    return styles.pillPending;
}

/** Format countdown seconds into mm:ss */
function formatCountdown(totalSeconds: number | null) {
    if (totalSeconds == null) return "—";
    const clamped = Math.max(0, totalSeconds);
    const minutes = Math.floor(clamped / 60);
    const seconds = clamped % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** POS-friendly date+time: "Mon, 23 Feb · 20:57" */
function formatDateTime(iso: string) {
    const d = new Date(iso);
    const day = d.toLocaleDateString(undefined, { weekday: "short" });
    const date = d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
    const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    return `${day}, ${date} · ${time}`;
}

export default function PaymentScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const id = String(params.id || "");

    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState(false);
    const [intent, setIntent] = useState<PaymentIntentDto | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inFlightRef = useRef(false);

    // Countdown updates every second (separate from API polling).
    const [nowMs, setNowMs] = useState(() => Date.now());

    const isTerminal = useMemo(() => {
        const s = intent?.status;
        return s === "SUCCEEDED" || s === "FAILED" || s === "CANCELLED" || s === "EXPIRED";
    }, [intent?.status]);

    const secondsRemaining = useMemo(() => {
        if (!intent?.expiresAt) return null;
        const expiryMs = new Date(intent.expiresAt).getTime();
        const diffMs = expiryMs - nowMs;
        return Math.max(0, Math.ceil(diffMs / 1000));
    }, [intent?.expiresAt, nowMs]);

    const countdownText = useMemo(() => formatCountdown(secondsRemaining), [secondsRemaining]);

    async function loadOnce() {
        if (!id) return;

        try {
            const dto = await getPaymentIntent(id);
            setIntent(dto);
            setErrorMsg(null);
        } catch (err: any) {
            setErrorMsg(err?.message || "Could not load payment.");
        } finally {
            setLoading(false);
        }
    }

    // Initial load
    useEffect(() => {
        loadOnce();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Countdown tick
    useEffect(() => {
        const timer = setInterval(() => setNowMs(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

// Poll backend every 1s until terminal
    useEffect(() => {
        if (!id) return;

        let cancelled = false;

        async function tick() {
            // stop conditions
            if (cancelled || isTerminal) return;


            if (inFlightRef.current) {
                pollRef.current = setTimeout(tick, 250);
                return;
            }

            inFlightRef.current = true;

            try {
                const dto = await getPaymentIntent(id);
                if (!cancelled) {
                    setIntent(dto);
                    setErrorMsg(null);
                }
            } catch (err: any) {
                if (!cancelled) {
                    setErrorMsg(err?.message || "Connection issue while polling.");
                }
            } finally {
                inFlightRef.current = false;
                if (!cancelled && !isTerminal) {
                    pollRef.current = setTimeout(tick, 1000);
                }
            }
        }

        // start
        tick();

        // cleanup
        return () => {
            cancelled = true;
            if (pollRef.current) clearTimeout(pollRef.current);
        };
    }, [id, isTerminal]);

    async function onCancel() {
        if (!intent) return;

        Alert.alert("Cancel payment?", "This will stop the payment and mark it cancelled.", [
            { text: "Keep", style: "cancel" },
            {
                text: "Cancel payment",
                style: "destructive",
                onPress: async () => {
                    try {
                        setActing(true);
                        const dto = await cancelPaymentIntent(intent.id);
                        setIntent(dto);
                        setErrorMsg(null);
                    } catch (err: any) {
                        Alert.alert("Cancel failed", err?.message || "Could not cancel payment.");
                    } finally {
                        setActing(false);
                    }
                },
            },
        ]);
    }

    async function onSimulateSuccess() {
        if (!intent) return;

        try {
            setActing(true);
            const dto = await confirmPaymentIntent(intent.id);
            setIntent(dto);
            setErrorMsg(null);
        } catch (err: any) {
            Alert.alert("Could not confirm", err?.message || "Confirm failed.");
        } finally {
            setActing(false);
        }
    }

    async function onSimulateFail() {
        if (!intent) return;

        Alert.alert("Simulate failure", "Mark this payment as FAILED (declined)?", [
            { text: "Back", style: "cancel" },
            {
                text: "Fail payment",
                style: "destructive",
                onPress: async () => {
                    try {
                        setActing(true);
                        const dto = await failPaymentIntent(intent.id, { reason: "DECLINED" });
                        setIntent(dto);
                        setErrorMsg(null);
                    } catch (err: any) {
                        Alert.alert("Could not fail", err?.message || "Fail request failed.");
                    } finally {
                        setActing(false);
                    }
                },
            },
        ]);
    }

    async function onOpenCustomerPage() {
        if (!intent?.customerUrl) return;

        try {
            await Linking.openURL(intent.customerUrl);
        } catch (err: any) {
            Alert.alert(
                "Could not open customer page",
                err?.message || "Open the link manually from the text below."
            );
        }
    }

    function onNewPayment() {
        router.replace("/new-payment");
    }

    function onDone() {
        router.replace("/");
    }

    const amountText = intent ? formatMoney(intent.amount, intent.currency) : "—";
    const showQrPending = !!intent && intent.method === "QR" && intent.status === "PENDING";

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>Payment</Text>

                {/* Top summary card */}
                <View style={styles.card}>
                    <Text style={styles.amount}>{amountText}</Text>

                    <View style={[styles.pill, intent ? statusPillStyle(intent.status) : styles.pillPending]}>
                        <Text style={styles.pillText}>{intent ? statusLabel(intent.status) : "Loading…"}</Text>
                    </View>

                    {intent?.method ? (
                        <Text style={styles.meta}>
                            Method: <Text style={styles.metaStrong}>{intent.method}</Text>
                        </Text>
                    ) : null}

                    {intent?.createdAt ? (
                        <Text style={styles.meta}>
                            Created: <Text style={styles.metaStrong}>{formatDateTime(intent.createdAt)}</Text>
                        </Text>
                    ) : null}

                    {intent?.expiresAt ? (
                        <Text style={styles.meta}>
                            Expires: <Text style={styles.metaStrong}>{formatDateTime(intent.expiresAt)}</Text>
                        </Text>
                    ) : null}

                    {intent?.status === "PENDING" && secondsRemaining != null ? (
                        <Text style={styles.meta}>
                            Time left: <Text style={styles.metaStrong}>{countdownText}</Text>
                        </Text>
                    ) : null}

                    {intent?.status === "FAILED" && intent?.failureReason ? (
                        <Text style={styles.failReason}>Reason: {intent.failureReason}</Text>
                    ) : null}
                </View>

                {/* Main content */}
                <View style={styles.card}>
                    {loading ? (
                        <View style={styles.centerRow}>
                            <ActivityIndicator />
                            <Text style={styles.loadingText}>Loading payment…</Text>
                        </View>
                    ) : errorMsg ? (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorTitle}>Connection issue</Text>
                            <Text style={styles.errorText}>{errorMsg}</Text>

                            <Pressable style={styles.smallBtn} onPress={loadOnce}>
                                <Text style={styles.smallBtnText}>Retry</Text>
                            </Pressable>
                        </View>
                    ) : intent ? (
                        <>
                            {intent.method === "QR" ? (
                                showQrPending ? (
                                    <>
                                        <Text style={styles.sectionTitle}>Show QR to customer</Text>
                                        <Text style={styles.sectionSubtitle}>
                                            Customer scans and confirms on the demo page.
                                        </Text>

                                        <View style={styles.qrWrap}>
                                            <QRCode value={intent.customerUrl} size={220} />
                                        </View>

                                        <Text style={styles.qrHint}>
                                            {Platform.OS === "web"
                                                ? "Tip: open the customer page in another tab to simulate the customer."
                                                : "Tip: tap 'Open Customer Page' for a quick demo."}
                                        </Text>

                                        <Pressable
                                            style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.75 }]}
                                            onPress={onOpenCustomerPage}
                                        >
                                            <Text style={styles.smallBtnText}>Open Customer Page</Text>
                                        </Pressable>

                                        <Text style={styles.urlLabel}>Link</Text>
                                        <Text selectable style={styles.urlText}>
                                            {intent.customerUrl}
                                        </Text>
                                    </>
                                ) : (
                                    <>
                                        <Text style={styles.sectionTitle}>Payment complete</Text>
                                        <View style={styles.helperBox}>
                                            <Text style={styles.helperTitle}>Status: {intent.status}</Text>
                                            <Text style={styles.helperText}>
                                                This payment is finished. Start a new payment to continue.
                                            </Text>
                                        </View>
                                    </>
                                )
                            ) : (
                                <>
                                    <Text style={styles.sectionTitle}>Card payment</Text>
                                    <Text style={styles.sectionSubtitle}>
                                        Ask the customer to tap/insert card, then record the result.
                                    </Text>

                                    <View style={styles.helperBox}>
                                        <Text style={styles.helperTitle}>{isTerminal ? "Completed" : "Terminal result"}</Text>
                                        <Text style={styles.helperText}>
                                            {isTerminal
                                                ? "You can start a new payment or go back home."
                                                : "Use the buttons below to simulate approve/decline."}
                                        </Text>
                                    </View>
                                </>
                            )}
                        </>
                    ) : (
                        <Text style={styles.loadingText}>No payment loaded.</Text>
                    )}
                </View>

                {/* Actions */}
                <View style={styles.actions}>
                    {!isTerminal ? (
                        <>
                            <Pressable
                                style={({ pressed }) => [styles.secondary, (acting || pressed) && { opacity: 0.7 }]}
                                disabled={acting || !intent}
                                onPress={onCancel}
                            >
                                <Text style={styles.secondaryText}>{acting ? "Working…" : "Cancel"}</Text>
                            </Pressable>

                            <View style={styles.row2}>
                                <Pressable
                                    style={({ pressed }) => [styles.secondaryHalf, (acting || pressed) && { opacity: 0.7 }]}
                                    disabled={acting || !intent}
                                    onPress={onSimulateFail}
                                >
                                    <Text style={styles.secondaryText}>Decline</Text>
                                </Pressable>

                                <Pressable
                                    style={({ pressed }) => [styles.primaryHalf, (acting || pressed) && { opacity: 0.7 }]}
                                    disabled={acting || !intent}
                                    onPress={onSimulateSuccess}
                                >
                                    <Text style={styles.primaryText}>Approve</Text>
                                </Pressable>
                            </View>
                        </>
                    ) : (
                        <View style={styles.row2}>
                            <Pressable style={styles.secondaryHalf} onPress={onNewPayment}>
                                <Text style={styles.secondaryText}>New Payment</Text>
                            </Pressable>

                            <Pressable style={styles.primaryHalf} onPress={onDone}>
                                <Text style={styles.primaryText}>Done</Text>
                            </Pressable>
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#0B0F1A" },
    container: { padding: 20, gap: 14 },

    title: { color: "white", fontSize: 28, fontWeight: "800" },

    card: {
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 18,
        padding: 16,
    },

    amount: { color: "white", fontSize: 38, fontWeight: "900", marginBottom: 10 },

    pill: {
        alignSelf: "flex-start",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        marginBottom: 10,
    },
    pillText: { color: "white", fontWeight: "800" },
    pillPending: { backgroundColor: "rgba(255,255,255,0.18)" },
    pillSuccess: { backgroundColor: "rgba(255,255,255,0.25)" },
    pillFail: { backgroundColor: "rgba(255,255,255,0.18)" },
    pillMuted: { backgroundColor: "rgba(255,255,255,0.12)" },

    meta: { color: "rgba(255,255,255,0.75)", marginTop: 2 },
    metaStrong: { color: "white", fontWeight: "800" },

    failReason: { marginTop: 10, color: "rgba(255,255,255,0.85)", fontWeight: "700" },

    centerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    loadingText: { color: "rgba(255,255,255,0.75)" },

    sectionTitle: { color: "white", fontSize: 18, fontWeight: "900", marginBottom: 6 },
    sectionSubtitle: { color: "rgba(255,255,255,0.75)", marginBottom: 14 },

    helperBox: {
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 14,
        padding: 14,
    },
    helperTitle: { color: "white", fontWeight: "900", marginBottom: 6 },
    helperText: { color: "rgba(255,255,255,0.75)" },

    qrWrap: {
        alignSelf: "center",
        backgroundColor: "white",
        padding: 16,
        borderRadius: 18,
        marginBottom: 12,
    },
    qrHint: { color: "rgba(255,255,255,0.65)", textAlign: "center", marginBottom: 12 },

    urlLabel: { marginTop: 14, color: "rgba(255,255,255,0.7)", fontWeight: "800" },
    urlText: { marginTop: 6, color: "white" },

    errorBox: {
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 14,
        gap: 8,
    },
    errorTitle: { color: "white", fontWeight: "900" },
    errorText: { color: "rgba(255,255,255,0.75)" },

    smallBtn: {
        alignSelf: "flex-start",
        backgroundColor: "white",
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
    },
    smallBtnText: { color: "#0B0F1A", fontWeight: "900" },

    actions: { gap: 10, marginTop: 6 },

    row2: { flexDirection: "row", gap: 10 },

    primaryHalf: {
        flex: 1,
        backgroundColor: "white",
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: "center",
    },
    primaryText: { color: "#0B0F1A", fontWeight: "900", fontSize: 18 },

    secondary: {
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.25)",
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: "center",
    },
    secondaryHalf: {
        flex: 1,
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.25)",
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: "center",
    },
    secondaryText: { color: "white", fontWeight: "900", fontSize: 16 },
});