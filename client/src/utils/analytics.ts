/**
 * Tracks a custom event using GoatCounter if available.
 * @param eventPath A descriptive path for the event (e.g., 'game/start', 'room/create').
 */
export const trackEvent = (eventPath: string) => {
    if (typeof window.goatcounter?.count === 'function') {
      try {
        if (import.meta.env.DEV) {
          console.log(`[Analytics DEV] Tracking event: ${eventPath}`);
        }
        // Only track in production, or track everywhere if desired
        if (!import.meta.env.DEV) {
           window.goatcounter.count({
             path: eventPath,
             event: true, // Mark as custom event
           });
        }
      } catch (error) {
        console.warn(`GoatCounter track event failed for ${eventPath}:`, error);
      }
    } else {
        if (import.meta.env.DEV) {
           console.log(`[Analytics DEV] GoatCounter not found. Would track: ${eventPath}`);
        }
    }
  };