const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

export const btnPrimary = `${btn} bg-crimson-strong text-white hover:bg-crimson`;
export const btnGhost = `${btn} border border-line bg-raised text-cream hover:border-flare hover:text-white`;
export const btnDanger = `${btn} border border-crimson-strong/60 bg-transparent text-flare hover:bg-crimson-strong hover:text-white`;
export const btnSmall = "min-h-9 px-4 text-xs";

export const input =
  "w-full rounded-lg border border-line bg-ink px-3.5 py-2.5 text-cream placeholder:text-muted/70 focus:border-flare";
export const label = "mb-1.5 block text-sm font-medium text-cream";
export const fieldError = "mt-1.5 text-sm text-flare";
export const panel = "rounded-2xl border border-line bg-surface p-5 sm:p-6";
