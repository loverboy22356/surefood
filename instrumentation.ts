export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV !== "production") {
    const { syncDevClock } = await import("./lib/dev/clock-sync");
    await syncDevClock();
  }
}
