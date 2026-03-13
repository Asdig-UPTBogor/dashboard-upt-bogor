export type WorkerPauseReason = "dsm" | "dc" | "manual" | "dev" | null;

interface WorkerUiStateInput {
    isRefreshing: boolean;
    isPaused: boolean;
    pauseReason: WorkerPauseReason;
    phase?: string | null;
    progressCurrent?: number;
    progressTotal?: number;
}

export function getWorkerUiState({
    isRefreshing,
    isPaused,
    pauseReason,
    phase,
    progressCurrent = 0,
    progressTotal = 0,
}: WorkerUiStateInput) {
    const isDevMode = pauseReason === "dev";
    const isOverride = pauseReason === "dsm" || pauseReason === "dc";

    const modeLabel = isDevMode
        ? "Dev Mode"
        : isOverride
            ? `Override: ${pauseReason?.toUpperCase()} Active`
            : isPaused
                ? "Paused"
                : "Auto Sync";

    const activityLabel = isRefreshing
        ? phase === "planning"
            ? "Planning"
            : phase === "fetching"
                ? progressTotal > 0
                    ? `Fetching ${Math.min(progressCurrent, progressTotal)}/${progressTotal}`
                    : "Fetching"
                : phase === "qc"
                    ? "QC"
                    : phase === "writeback"
                        ? "Writeback"
                        : phase === "publishing"
                            ? progressTotal > 0
                                ? `Publishing ${Math.min(progressCurrent, progressTotal)}/${progressTotal}`
                                : "Publishing"
                            : "Running"
        : null;

    const label = activityLabel || modeLabel;

    const textClass = isRefreshing ? "text-blue-400" :
        isDevMode ? "text-orange-400" :
            isOverride ? "text-amber-400" :
                isPaused ? "text-yellow-400" :
                    "text-emerald-400";

    const dotClass = isRefreshing ? "bg-blue-500 animate-pulse" :
        isDevMode ? "bg-orange-500" :
            isOverride ? "bg-amber-500 animate-pulse" :
                isPaused ? "bg-yellow-500" :
                    "bg-emerald-500";

    return {
        isDevMode,
        isOverride,
        modeLabel,
        activityLabel,
        label,
        textClass,
        dotClass,
    };
}

interface WorkerCountdownInput {
    lastRefreshAt: string | null;
    intervalSec: number;
    isPaused: boolean;
    isRefreshing: boolean;
    now?: number;
}

export function getWorkerCountdown({
    lastRefreshAt,
    intervalSec,
    isPaused,
    isRefreshing,
    now = Date.now(),
}: WorkerCountdownInput) {
    if (isPaused || isRefreshing || !lastRefreshAt || !intervalSec) {
        return null;
    }

    const lastRefreshMs = new Date(lastRefreshAt).getTime();
    if (Number.isNaN(lastRefreshMs)) {
        return null;
    }

    return Math.max(0, intervalSec - Math.floor((now - lastRefreshMs) / 1000));
}

interface WorkerNextSyncLabelInput {
    countdown: number | null;
    isPaused: boolean;
    isRefreshing: boolean;
}

export function getWorkerNextSyncLabel({
    countdown,
    isPaused,
    isRefreshing,
}: WorkerNextSyncLabelInput) {
    if (isRefreshing) {
        return "After run";
    }
    if (isPaused || countdown === null) {
        return "—";
    }
    if (countdown <= 0) {
        return "Queued";
    }
    return `${countdown}s`;
}

interface WorkerDetailLabelInput {
    phase?: string | null;
    currentItemType?: "sheet" | "page" | null;
    currentItemLabel?: string | null;
}

export function getWorkerDetailLabel({
    phase,
    currentItemType,
    currentItemLabel,
}: WorkerDetailLabelInput) {
    if (phase === "planning") {
        return "Loading config and building fetch plan";
    }
    if (phase === "fetching") {
        return currentItemLabel ? `Fetching ${currentItemLabel}` : "Fetching spreadsheet data";
    }
    if (phase === "qc") {
        return "Validating hierarchy before publish";
    }
    if (phase === "writeback") {
        return "Applying QC markers";
    }
    if (phase === "publishing") {
        if (currentItemType === "page" && currentItemLabel) {
            return `Publishing ${currentItemLabel}`;
        }
        return "Publishing page snapshots";
    }
    return "Worker is idle";
}
