import React, { useEffect, useRef } from "react";
import { Text, View, Animated, Platform, StyleSheet } from "react-native";

const styles = StyleSheet.create({
  monoText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  pulsingDotContainer: {
    width: 8,
    height: 8,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  pulsingDotPing: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pulsingDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export function Mono({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[styles.monoText, style]}>{children}</Text>;
}

export function PulsingDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 2.2,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.8,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  }, [scale, opacity]);

  return (
    <View style={styles.pulsingDotContainer}>
      <Animated.View
        style={[
          styles.pulsingDotPing,
          {
            backgroundColor: color,
            transform: [{ scale }],
            opacity,
          },
        ]}
      />
      <View style={[styles.pulsingDotInner, { backgroundColor: color }]} />
    </View>
  );
}
