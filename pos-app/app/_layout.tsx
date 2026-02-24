import { Stack } from "expo-router";
import "react-native-reanimated";

export default function RootLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
            }}
        >
            {/* Main entry: Tabs group */}
            <Stack.Screen name="(tabs)" />

            {/* Other screens outside tabs */}
            <Stack.Screen name="new-payment" />
            <Stack.Screen name="transactions" />
            <Stack.Screen name="payment/[id]" />

            {/* Optional: if you still use modal */}
            <Stack.Screen name="modal" options={{ presentation: "modal" }} />
        </Stack>
    );
}