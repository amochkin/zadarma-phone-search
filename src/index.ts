#!/usr/bin/env tsx

import * as crypto from "crypto";
import { configDotenv } from "dotenv";

configDotenv({ quiet: true });

const API_BASE = "https://api.zadarma.com";

type ZadarmaStatus = "success" | "error";

type CountryDirection = {
    id: string | number;
    name: string;
    countryCode?: string;
    areaCode?: string;
    [key: string]: unknown;
};

type CountryResponse = {
    status: ZadarmaStatus;
    info?: CountryDirection[];
    message?: string;
};

type AvailableNumber = {
    id: string;
    direction_id: string | number;
    number: string;
    [key: string]: unknown;
};

type AvailableResponse = {
    status: ZadarmaStatus;
    numbers?: AvailableNumber[];
    message?: string;
};

type OutputRow = {
    number: string;
    number_id: string;
    direction_id: string | number;
    direction_name: string;
};

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getArg(name: string): string | undefined {
    const prefix = `--${name}=`;
    const arg = process.argv.find((a) => a.startsWith(prefix));
    return arg?.slice(prefix.length);
}

function getNumberArg(name: string, defaultValue: number): number {
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

function getFlag(name: string): boolean {
    return process.argv.includes(`--${name}`);
}

const isVerbose = () => getFlag("verbose");

function log(message: string): void {
    console.error(`[zadarma] ${message}`);
}

function debug(message: string): void {
    if (isVerbose()) {
        console.error(`[zadarma:debug] ${message}`);
    }
}

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

/**
 * Equivalent to PHP http_build_query(..., PHP_QUERY_RFC1738):
 * - keys sorted alphabetically before this function is called
 * - spaces encoded as "+"
 */
function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
    const searchParams = new URLSearchParams();

    Object.keys(params)
        .filter((key) => params[key] !== undefined)
        .sort()
        .forEach((key) => {
            searchParams.append(key, String(params[key]));
        });

    return searchParams.toString();
}

function signRequest(
    methodPath: string,
    params: Record<string, string | number | boolean | undefined>,
    apiSecret: string
): string {
    const paramsStr = buildQuery(params);
    const paramsMd5 = crypto.createHash("md5").update(paramsStr).digest("hex");
    const stringToSign = `${methodPath}${paramsStr}${paramsMd5}`;

    // Zadarma's PHP example uses hash_hmac('sha1', ...) without raw_output,
    // so it returns a hex string, which is then base64-encoded.
    const hmacHex = crypto
        .createHmac("sha1", apiSecret)
        .update(stringToSign)
        .digest("hex");

    return Buffer.from(hmacHex).toString("base64");
}

async function zadarmaGet<T>(
    methodPath: string,
    params: Record<string, string | number | boolean | undefined>,
    apiKey: string,
    apiSecret: string
): Promise<T> {
    const query = buildQuery(params);
    const signature = signRequest(methodPath, params, apiSecret);
    const url = `${API_BASE}${methodPath}${query ? `?${query}` : ""}`;

    debug(`GET ${methodPath}${query ? `?${query}` : ""}`);

    const startedAt = Date.now();

    const response = await fetch(url, {
        method: "GET",
        headers: {
            Authorization: `${apiKey}:${signature}`,
        },
    });

    const elapsedMs = Date.now() - startedAt;

    debug(`Response ${response.status} from ${methodPath} in ${elapsedMs}ms`);

    const bodyText = await response.text();

    let body: unknown;
    try {
        body = JSON.parse(bodyText);
    } catch {
        throw new Error(`Non-JSON response from Zadarma: HTTP ${response.status}\n${bodyText}`);
    }

    if (!response.ok) {
        throw new Error(`Zadarma HTTP error ${response.status}: ${JSON.stringify(body, null, 2)}`);
    }

    return body as T;
}

async function main() {
    const apiKey = requireEnv("ZADARMA_KEY");
    const apiSecret = requireEnv("ZADARMA_SECRET");

    const country = getArg("country");
    const mask = getArg("mask") ?? "";
    const language = getArg("language") ?? "en";
    const onlyDirectionId = getArg("direction-id");
    const exitOnFind = getFlag("exit-on-find");
    const delayMs = getNumberArg("delay-ms", 600);

    if (!country) {
        throw new Error(
            [
                "Usage:",
                "  ZADARMA_KEY=xxx ZADARMA_SECRET=yyy tsx zadarma-search-numbers.ts --country=GB --mask=207",
                "",
                "Optional:",
                "  --language=en",
                "  --direction-id=13755",
                "  --exit-on-find",
                "  --delay-ms=500",
                "  --verbose",
            ].join("\n")
        );
    }

    log(
        [
            `Starting search`,
            `country=${country.toUpperCase()}`,
            `language=${language}`,
            `mask=${mask || "(none)"}`,
            `direction_id=${onlyDirectionId || "(all)"}`,
            `exit_on_find=${exitOnFind ? "yes" : "no"}`,
            `delay_ms=${delayMs}`,
        ].join(" | ")
    );

    const countryMethod = "/v1/direct_numbers/country/";
    const countryParams: Record<string, string> = {
        country: country.toUpperCase(),
        language,
    };

    if (onlyDirectionId) {
        countryParams.direction_id = onlyDirectionId;
    }

    log("Fetching available directions...");

    const directionsResponse = await zadarmaGet<CountryResponse>(
        countryMethod,
        countryParams,
        apiKey,
        apiSecret
    );

    if (directionsResponse.status !== "success") {
        throw new Error(`Zadarma error: ${directionsResponse.message ?? "unknown error"}`);
    }

    const directions = directionsResponse.info ?? [];
    const rows: OutputRow[] = [];

    log(`Found ${directions.length} direction(s) to search.`);

    if (directions.length === 0) {
        console.log("No directions found.");
        return;
    }

    for (const [index, direction] of directions.entries()) {
        const directionNumber = index + 1;
        const totalDirections = directions.length;
        const progress = `${directionNumber} of ${totalDirections}`;

        const directionId = direction.id;
        const directionName = direction.name;

        log(
            `Searching direction ${progress}: ${directionName} ` +
            `(id=${directionId})`
        );

        const availableMethod = `/v1/direct_numbers/available/${directionId}/`;
        const availableParams: Record<string, string> = {};

        if (mask) {
            availableParams.mask = mask;
        }

        let availableResponse: AvailableResponse;

        try {
            availableResponse = await zadarmaGet<AvailableResponse>(
                availableMethod,
                availableParams,
                apiKey,
                apiSecret
            );
        } catch (error) {
            console.error(
                `[zadarma] Failed direction ${progress} - ${directionId} (${directionName}): ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            continue;
        }

        if (availableResponse.status !== "success") {
            console.error(
                `[zadarma] Skipping direction ${progress} - ${directionId} (${directionName}): ${
                    availableResponse.message ?? "unknown error"
                }`
            );
            continue;
        }

        const numbers = availableResponse.numbers ?? [];

        log(
            `Completed direction ${progress}: ${directionName} ` +
            `(id=${directionId}) returned ${numbers.length} number(s).`
        );

        for (const item of numbers) {
            rows.push({
                number: item.number,
                number_id: item.id,
                direction_id: item.direction_id ?? directionId,
                direction_name: directionName,
            });
        }

        if (exitOnFind && numbers.length > 0) {
            log(
                `Found available number(s) at direction ${progress}: ${directionName} ` +
                `(id=${directionId}); exiting early.`
            );
            console.table(rows);
            return;
        }

        log(`Progress: ${progress} complete, ${rows.length} total number(s) found.`);

        if (delayMs > 0 && directionNumber < totalDirections) {
            log(`Waiting ${delayMs}ms before next request...`);
            await sleep(delayMs);
        }
    }

    log(`Search complete. Found ${rows.length} available number(s).`);

    if (rows.length === 0) {
        console.log("No available numbers found.");
        return;
    }

    console.table(rows);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});