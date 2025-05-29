function formatDate(date: Date): string {
    const parts = date.toLocaleString("en-US", {
        day: "2-digit",
        year: "numeric",
        month: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour: "2-digit",
        fractionalSecondDigits: 3,
        hour12: false
    }).split("/").flatMap(s => s.split(","));

    return `${parts[2]}-${parts[0]}-${parts[1]} ${parts[3]}`;
}

type Level = "DEBUG"
    | "INFO"
    | "WARN"
    | "ERROR"
    | "FATAL";

function _log(level: Level, ...data: any[]) {
    const timestamp = formatDate(new Date(Date.now()));
    console.log(`${level.padEnd(5)} ${timestamp} - ${data.map(String).join(' ')}`);
}

export const log = {
    debug: (...data: any[]) => _log("DEBUG", ...data),
    info: (...data: any[]) => _log("INFO", ...data),
    warn: (...data: any[]) => _log("WARN", ...data),
    error: (...data: any[]) => _log("ERROR", ...data)
};