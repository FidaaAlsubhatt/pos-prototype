// pos-app/app/transactions.tsx
// Transactions screen (merchant-friendly)

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    SafeAreaView,
    StyleSheet,
    Text,
    View,
    Pressable,
    FlatList,
    RefreshControl,
    ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { listPaymentIntents } from "../lib/api";

type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "EXPIRED";
type PaymentMethod = "QR" | "CARD";

type PaymentIntentDto = {
    id: string;
    amount: number; // minor units
    currency: string;
    method: PaymentMethod;
    status: PaymentStatus;
    createdAt: string;
    updatedAt: string;
    expiresAt: string;
    customerUrl: string;
    failureReason?: string | null;
};

type ListResponse = {
    items: PaymentIntentDto[];
};

const FILTERS: Array<{ label: string; status?: PaymentStatus }> = [
    { label: "All" },
    { label: "Pending", status: "PENDING" },
    { label: "Succeeded", status: "SUCCEEDED" },
    { label: "Failed", status: "FAILED" },
    { label: "Cancelled", status: "CANCELLED" },
    { label: "Expired", status: "EXPIRED" },
];

function formatMoney(amountMinor: number, currency: string) {
    const units = Math.floor(amountMinor / 100);
    const cents = Math.abs(amountMinor % 100);
    const symbol = currency === "GBP" ? "£" : "";
    return `${symbol}${units}.${cents.toString().padStart(2, "0")}`;
}

function formatTime(iso: string) {
    // Shows just time; you can switch to locale date+time later.
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function statusLabel(s: PaymentStatus) {
    switch (s) {
        case "PENDING":
            return "Pending";
        case "SUCCEEDED":
            return "Succeeded";
        case "FAILED":
            return "Failed";
        case "CANCELLED":
            return "Cancelled";
        case "EXPIRED":
            return "Expired";
    }
}

function statusPillStyle(s: PaymentStatus) {
    // Keep it simple: still gives visual hierarchy without “fancy” styling.
    if (s === "SUCCEEDED") return styles.pillSuccess;
    if (s === "FAILED") return styles.pillFail;
    if (s === "CANCELLED" || s === "EXPIRED") return styles.pillMuted;
    return styles.pillPending;
}

export default function TransactionsScreen() {
    const router = useRouter();

    const [activeStatus, setActiveStatus] = useState<PaymentStatus | undefined>(undefined);
    const [items, setItems] = useState<PaymentIntentDto[]>([]);
    const [loading, setLoading] = useState(true); // first load
    const [refreshing, setRefreshing] = useState(false); // pull-to-refresh
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const title = useMemo(() => "Transactions", []);

    const load = useCallback(
        async (opts?: { refresh?: boolean }) => {
            const isRefresh = Boolean(opts?.refresh);

            try {
                if (isRefresh) setRefreshing(true);
                else setLoading(true);

                setErrorMsg(null);

                // Call backend: GET /api/payment-intents?limit=50&status=...
                const res: ListResponse = await listPaymentIntents({
                    limit: 50,
                    status: activeStatus,
                });

                setItems(res.items || []);
            } catch (err: any) {
                // Our api.js throws Error(message) on non-2xx, so err.message is best default.
                setErrorMsg(err?.message || "Could not load transactions.");
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [activeStatus]
    );

    // Load on first mount + whenever filter changes
    useEffect(() => {
        load();
    }, [load]);

    const onRefresh = useCallback(() => load({ refresh: true }), [load]);

    function onOpenPayment(id: string) {
        // Opens the existing Payment screen so cashier can re-check status / show QR again.
        router.push(`/payment/${id}`);
    }

    function renderItem({ item }: { item: PaymentIntentDto }) {
        const amountText = formatMoney(item.amount, item.currency);
        const timeText = formatTime(item.createdAt);

        return (
            <Pressable
                onPress={() => onOpenPayment(item.id)}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
            >
                <View style={styles.rowLeft}>
                    <Text style={styles.amount}>{amountText}</Text>
                    <Text style={styles.meta}>
                        {timeText} • {item.method}
                    </Text>
                </View>

                <View style={[styles.pill, statusPillStyle(item.status)]}>
                    <Text style={styles.pillText}>{statusLabel(item.status)}</Text>
                </View>
            </Pressable>
        );
    }

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.container}>
                {/* Header */}
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>Tap a transaction to reopen it</Text>

                {/* Filters */}
                <View style={styles.filtersWrap}>
                    {FILTERS.map((f) => {
                        const selected = f.status === activeStatus || (!f.status && !activeStatus);
                        return (
                            <Pressable
                                key={f.label}
                                onPress={() => setActiveStatus(f.status)}
                                style={[
                                    styles.chip,
                                    selected ? styles.chipSelected : styles.chipUnselected,
                                ]}
                            >
                                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                                    {f.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                {/* Content */}
                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator />
                        <Text style={styles.centerText}>Loading…</Text>
                    </View>
                ) : errorMsg ? (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorTitle}>Couldn’t load transactions</Text>
                        <Text style={styles.errorText}>{errorMsg}</Text>

                        <Pressable style={styles.retryBtn} onPress={() => load()}>
                            <Text style={styles.retryBtnText}>Retry</Text>
                        </Pressable>
                    </View>
                ) : (
                    <FlatList
                        data={items}
                        keyExtractor={(x) => x.id}
                        renderItem={renderItem}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                        contentContainerStyle={items.length === 0 ? styles.emptyListContainer : undefined}
                        ListEmptyComponent={
                            <View style={styles.empty}>
                                <Text style={styles.emptyTitle}>No transactions yet</Text>
                                <Text style={styles.emptyText}>Create a payment to see history here.</Text>

                                <Pressable style={styles.primaryBtn} onPress={() => router.push("/new-payment")}>
                                    <Text style={styles.primaryBtnText}>New Payment</Text>
                                </Pressable>
                            </View>
                        }
                    />
                )}

            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#0B0F1A" },
    container: { flex: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },

    title: { color: "white", fontSize: 28, fontWeight: "900" },
    subtitle: { color: "rgba(255,255,255,0.7)", marginTop: 6, marginBottom: 14 },

    filtersWrap: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
        marginBottom: 12,
    },

    chip: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 2,
    },
    chipSelected: {
        backgroundColor: "white",
        borderColor: "white",
    },
    chipUnselected: {
        backgroundColor: "transparent",
        borderColor: "rgba(255,255,255,0.18)",
    },
    chipText: {
        fontWeight: "900",
        color: "rgba(255,255,255,0.85)",
    },
    chipTextSelected: {
        color: "#0B0F1A",
    },

    row: {
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
    },
    rowLeft: { flex: 1 },

    amount: { color: "white", fontSize: 22, fontWeight: "900" },
    meta: { marginTop: 6, color: "rgba(255,255,255,0.7)", fontWeight: "700" },

    pill: {
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 999,
        alignSelf: "flex-start",
    },
    pillText: { color: "white", fontWeight: "900" },

    pillPending: { backgroundColor: "rgba(255,255,255,0.18)" },
    pillSuccess: { backgroundColor: "rgba(255,255,255,0.25)" },
    pillFail: { backgroundColor: "rgba(255,255,255,0.18)" },
    pillMuted: { backgroundColor: "rgba(255,255,255,0.12)" },

    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
    centerText: { color: "rgba(255,255,255,0.7)", fontWeight: "700" },

    errorBox: {
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 18,
        padding: 16,
        gap: 10,
    },
    errorTitle: { color: "white", fontWeight: "900", fontSize: 16 },
    errorText: { color: "rgba(255,255,255,0.75)" },

    retryBtn: {
        alignSelf: "flex-start",
        backgroundColor: "white",
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
    },
    retryBtnText: { color: "#0B0F1A", fontWeight: "900" },

    emptyListContainer: { flexGrow: 1 },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, gap: 10 },
    emptyTitle: { color: "white", fontWeight: "900", fontSize: 18 },
    emptyText: { color: "rgba(255,255,255,0.75)", textAlign: "center" },

    primaryBtn: {
        marginTop: 10,
        backgroundColor: "white",
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    primaryBtnText: { color: "#0B0F1A", fontWeight: "900", fontSize: 16 },

    footer: { textAlign: "center", color: "rgba(255,255,255,0.5)", marginTop: 8 },
});