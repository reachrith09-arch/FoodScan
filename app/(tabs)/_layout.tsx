import { Activity, History, ScanBarcode, Settings, User } from "lucide-react-native";
import { Tabs } from "expo-router";
import { useColorScheme, View } from "react-native";
import { HapticTab } from "@/components/haptic-tab";
import { THEME } from "@/lib/theme";
const ICON_SIZE = 24;

function TabIconWrapper({
  focused,
  children,
}: {
  focused: boolean;
  isDark: boolean;
  children: React.ReactNode;
}) {
  if (!focused) return <>{children}</>;
  return (
    <View
      style={{
        minWidth: 44,
        minHeight: 44,
        paddingHorizontal: 12,
        borderRadius: 22,
        backgroundColor: THEME.primary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const iconActive = THEME.white;
  const iconInactive = isDark ? "#a1a1aa" : THEME.mutedGrey;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarBackground: () => (
          <View
            className="flex-1 border-t"
            style={{
              backgroundColor: isDark ? THEME.darkBg : THEME.cardLight,
              borderTopColor: isDark ? THEME.borderDark : THEME.borderLight,
            }}
          />
        ),
        tabBarButton: HapticTab,
        tabBarShowLabel: false,
        tabBarActiveTintColor: iconActive,
        tabBarInactiveTintColor: iconInactive,
        tabBarStyle: {
          paddingTop: 10,
          minHeight: 56,
          elevation: 0,
          shadowOpacity: 0,
          borderTopWidth: 1,
          borderTopColor: isDark ? THEME.borderDark : THEME.borderLight,
          backgroundColor: isDark ? THEME.darkBg : THEME.cardLight,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Scan",
          tabBarIcon: ({ color, focused }) => (
            <TabIconWrapper focused={focused} isDark={isDark}>
              <ScanBarcode size={ICON_SIZE} color={color} />
            </TabIconWrapper>
          ),
        }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: "Today",
          tabBarIcon: ({ color, focused }) => (
            <TabIconWrapper focused={focused} isDark={isDark}>
              <Activity size={ICON_SIZE} color={color} />
            </TabIconWrapper>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color, focused }) => (
            <TabIconWrapper focused={focused} isDark={isDark}>
              <History size={ICON_SIZE} color={color} />
            </TabIconWrapper>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <TabIconWrapper focused={focused} isDark={isDark}>
              <User size={ICON_SIZE} color={color} />
            </TabIconWrapper>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <TabIconWrapper focused={focused} isDark={isDark}>
              <Settings size={ICON_SIZE} color={color} />
            </TabIconWrapper>
          ),
        }}
      />
    </Tabs>
  );
}
