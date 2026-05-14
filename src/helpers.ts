import crypto from "crypto";

export function alphaPhraseToPhoneMask(value: string): string {
    const letterToDigit: Record<string, string> = {
        A: "2", B: "2", C: "2",
        D: "3", E: "3", F: "3",
        G: "4", H: "4", I: "4",
        J: "5", K: "5", L: "5",
        M: "6", N: "6", O: "6",
        P: "7", Q: "7", R: "7", S: "7",
        T: "8", U: "8", V: "8",
        W: "9", X: "9", Y: "9", Z: "9",
    };

    return value
        .toUpperCase()
        .split("")
        .map((char) => {
            if (char >= "A" && char <= "Z") {
                return letterToDigit[char];
            }

            if (char >= "0" && char <= "9") {
                return char;
            }

            return "";
        })
        .join("");
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getArg(name: string): string | undefined {
    const prefix = `--${name}=`;
    const arg = process.argv.find((a) => a.startsWith(prefix));
    return arg?.slice(prefix.length);
}

export function getNumberArg(name: string, defaultValue: number): number {
    const value = getArg(name);
    if (value === undefined) {
        return defaultValue;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`Invalid --${name}. Expected a non-negative number.`);
    }

    return parsed;
}

export function getFlag(name: string): boolean {
    return process.argv.includes(`--${name}`);
}

export const isVerbose = () => getFlag("verbose");

export function log(message: string): void {
    console.error(`[zadarma] ${message}`);
}

export function debug(message: string): void {
    if (isVerbose()) {
        console.error(`[zadarma:debug] ${message}`);
    }
}

export function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}