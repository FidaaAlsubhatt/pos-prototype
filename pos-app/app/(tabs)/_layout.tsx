import { Tabs } from "expo-router";
import React from "react";

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: { display: "none" },
            }}
        >
            {/* Only screens that actually exist inside (tabs)/ */}
            <Tabs.Screen name="index" />

            {/* If you keep explore.tsx but don’t want it visible */}
            <Tabs.Screen name="explore" options={{ href: null }} />
        </Tabs>
    );
}