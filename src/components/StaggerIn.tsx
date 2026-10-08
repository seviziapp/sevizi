// Entrance animation for a screen's blocks: each child fades in and rises a
// few pixels, one after another. Wrap each block in <StaggerIn index={n}>.
// Skipped entirely when the device asks for reduced motion.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, AccessibilityInfo, Easing, Platform, StyleProp, ViewStyle } from 'react-native';

const STEP_MS = 90;      // delay between consecutive blocks
const DURATION_MS = 480;
const RISE_PX = 14;

export function StaggerIn({ index, children, style }: { index: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Safety net: browsers give hidden/background tabs no animation frames,
    // which would leave the block invisible. Timers still fire there, so
    // force the end state once the animation should have finished.
    const fallback = setTimeout(() => progress.setValue(1), index * STEP_MS + DURATION_MS + 400);
    AccessibilityInfo.isReduceMotionEnabled()
      .then(reduce => {
        if (cancelled) return;
        if (reduce) { setReduceMotion(true); progress.setValue(1); return; }
        Animated.timing(progress, {
          toValue: 1,
          duration: DURATION_MS,
          delay: index * STEP_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      })
      .catch(() => progress.setValue(1));
    return () => { cancelled = true; clearTimeout(fallback); };
  }, [index, progress]);

  if (reduceMotion) return <Animated.View style={style}>{children}</Animated.View>;

  return (
    <Animated.View
      style={[style, {
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [RISE_PX, 0] }) }],
      }]}
    >
      {children}
    </Animated.View>
  );
}
