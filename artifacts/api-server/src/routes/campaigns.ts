import { Router, type IRouter } from "express";
import {
  GetCampaignsQueryParams,
  GetCampaignStatsQueryParams,
  GetCampaignsResponse,
  GetCampaignStatsResponse,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { XMLParser } from "fast-xml-parser";

const router: IRouter = Router();

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  isArray: (name) => {
    return ["row", "offer", "campaign", "country", "platform"].includes(name);
  },
});

const PLATFORM_MAP: Record<string, string> = {
  "1": "Windows",
  "2": "Mac",
  "3": "Android",
  "4": "iOS",
  "5": "Mobile other",
};

function normalizePlatform(p: string): string {
  return PLATFORM_MAP[p.trim()] ?? p.trim();
}

interface ParsedCampaign {
  id: string;
  name: string;
  payout: string;
  payout_type: string;
  currency: string;
  preview_url: string | null;
  tracking_url: string;
  description: string | null;
  countries: Array<{ code: string; name: string }>;
  platforms: string[];
  category: string;
  incentive: string;
}

function parseSingleCountry(co: unknown): { code: string; name: string } | null {
  if (typeof co === "string") return { code: co.trim(), name: co.trim() };
  if (co && typeof co === "object") {
    const obj = co as Record<string, unknown>;
    const code = String(obj.code ?? obj.country_code ?? obj["#text"] ?? "").trim();
    const name = String(obj.name ?? obj.country_name ?? code).trim();
    if (code) return { code, name };
  }
  return null;
}

function parseCountries(raw: unknown): Array<{ code: string; name: string }> {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw.map(parseSingleCountry)
      .filter((co): co is { code: string; name: string } => co !== null);
  }

  if (typeof raw === "string" && raw.trim()) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean).map((code) => ({ code, name: code }));
  }

  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (obj.country) {
      const countryVal = obj.country;
      if (Array.isArray(countryVal)) {
        return countryVal.map(parseSingleCountry)
          .filter((co): co is { code: string; name: string } => co !== null);
      }
      const single = parseSingleCountry(countryVal);
      if (single) return [single];
      return [];
    }
    const single = parseSingleCountry(raw);
    if (single) return [single];
  }

  return [];
}

function extractTextValue(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    return String(obj["#text"] ?? obj.id ?? obj.name ?? obj.value ?? "");
  }
  return "";
}

function parsePlatforms(raw: unknown): string[] {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw.map((p) => normalizePlatform(extractTextValue(p))).filter(Boolean);
  }

  if (typeof raw === "string" && raw.trim()) {
    return raw.split(",").map((p) => normalizePlatform(p.trim())).filter(Boolean);
  }

  if (typeof raw === "number") {
    return [normalizePlatform(String(raw))];
  }

  return [];
}

function extractCampaign(c: Record<string, unknown>): ParsedCampaign {
  const payoutRaw = c.payout ?? c.default_payout ?? c.payout_amount ?? "0";
  const payoutStr =
    typeof payoutRaw === "number"
      ? payoutRaw.toFixed(2)
      : String(payoutRaw).trim();

  const incentiveRaw = c.incentive ?? c.is_incentive ?? c.allow_incentive ?? "no";
  const incentive =
    incentiveRaw === true ||
    incentiveRaw === 1 ||
    incentiveRaw === "1" ||
    incentiveRaw === "yes" ||
    incentiveRaw === "true" ||
    String(incentiveRaw).toLowerCase() === "yes"
      ? "yes"
      : "no";

  const category = String(
    c.category ?? c.categories ?? c.vertical ?? c.offer_category ?? "Unknown"
  ).trim();

  const previewRaw = c.preview_url ?? c.thumbnail ?? c.preview ?? c.image_url ?? c.offer_image ?? null;
  const previewUrl = previewRaw != null ? String(previewRaw).trim() || null : null;

  const trackingRaw = c.tracking_url ?? c.offer_url ?? c.click_url ?? c.url ?? "";
  const trackingUrl = String(trackingRaw).trim();

  return {
    id: String(c.offer_id ?? c.id ?? c.campaign_id ?? "").trim(),
    name: String(c.name ?? c.offer_name ?? c.title ?? c.campaign_name ?? "").trim(),
    payout: payoutStr,
    payout_type: String(c.price_format ?? c.payout_type ?? c.conversion_type ?? c.type ?? "CPA").trim(),
    currency: String(c.currency ?? c.payout_currency ?? "USD").trim(),
    preview_url: previewUrl,
    tracking_url: trackingUrl,
    description: c.description != null ? String(c.description).trim() : (c.offer_description != null ? String(c.offer_description).trim() : null),
    countries: parseCountries(c.countries ?? c.country),
    platforms: parsePlatforms(c.platforms ?? c.platform ?? c.allowed_platform ?? c.allowed_platforms),
    category,
    incentive,
  };
}

function unwrapRoot(obj: Record<string, unknown>): Record<string, unknown> {
  const wrapperKeys = ["offer_feed", "response", "result", "data"];
  for (const key of wrapperKeys) {
    const val = obj[key];
    if (val && typeof val === "object" && !Array.isArray(val)) {
      logger.info({ wrapperKey: key }, "Unwrapped root object");
      return val as Record<string, unknown>;
    }
  }
  return obj;
}

function findArrayInObject(obj: Record<string, unknown>): Record<string, unknown>[] {
  const root = unwrapRoot(obj);

  const candidateKeys = [
    "offers", "data", "campaigns", "rows", "results",
    "items", "offer", "campaign", "row",
  ];

  for (const key of candidateKeys) {
    const val = root[key];
    if (Array.isArray(val) && val.length > 0) {
      logger.info({ key, count: val.length }, "Found campaigns at key");
      return val as Record<string, unknown>[];
    }
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const nested = val as Record<string, unknown>;
      for (const subKey of candidateKeys) {
        const subVal = nested[subKey];
        if (Array.isArray(subVal) && subVal.length > 0) {
          logger.info({ key: `${key}.${subKey}`, count: subVal.length }, "Found campaigns at nested key");
          return subVal as Record<string, unknown>[];
        }
      }
    }
  }

  for (const [key, val] of Object.entries(root)) {
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
      logger.info({ key, count: val.length }, "Found campaigns array at dynamic key");
      return val as Record<string, unknown>[];
    }
  }

  return [];
}

function parseAffMineResponse(rawText: string): {
  total: number;
  campaigns: ParsedCampaign[];
  error?: string;
} {
  let parsed: Record<string, unknown>;

  const trimmed = rawText.trim();
  const isXml = trimmed.startsWith("<?xml") || trimmed.startsWith("<");

  if (isXml) {
    logger.info("Parsing AffMine response as XML");
    const xmlResult = xmlParser.parse(trimmed) as Record<string, unknown>;
    logger.info({ xmlTopKeys: Object.keys(xmlResult) }, "XML parsed top-level keys");

    const root = (xmlResult.offer_feed ??
      xmlResult.response ??
      xmlResult.offers ??
      xmlResult) as Record<string, unknown>;

    logger.info({ rootKeys: Object.keys(root) }, "XML root element keys");

    const errorId = root.error_id ?? root.errorId;
    if (errorId && Number(errorId) !== 0) {
      const code = Number(errorId);
      if (code === 100) {
        return { total: 0, campaigns: [], error: "Invalid credentials" };
      }
      return { total: 0, campaigns: [], error: `AffMine error: ${errorId} - ${root.message ?? ""}` };
    }

    const successVal = root.success;
    if (successVal === false || successVal === "false") {
      return { total: 0, campaigns: [], error: String(root.message ?? "Request failed") };
    }

    const items = findArrayInObject(root);
    if (items.length > 0) {
      logger.info({ sampleKeys: Object.keys(items[0]) }, "Sample XML campaign keys");
      logger.info({ sample: JSON.stringify(items[0]).slice(0, 500) }, "Sample XML campaign");
    }

    const campaigns = items.map(extractCampaign);
    const totalRaw = root.row_count ?? root.total_count ?? root.count ?? root.total;
    const total =
      typeof totalRaw === "number"
        ? totalRaw
        : parseInt(String(totalRaw ?? campaigns.length), 10) || campaigns.length;

    return { total, campaigns };
  } else {
    logger.info("Parsing AffMine response as JSON");
    try {
      parsed = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      logger.error({ preview: trimmed.slice(0, 300) }, "Failed to parse response as JSON");
      return { total: 0, campaigns: [], error: "Failed to parse AffMine response" };
    }

    logger.info({ jsonTopKeys: Object.keys(parsed) }, "JSON parsed top-level keys");

    const root = unwrapRoot(parsed);
    logger.info({ rootKeys: Object.keys(root) }, "JSON root keys after unwrap");

    const errorId = root.error_id ?? root.errorId ?? root.error;
    if (errorId && Number(errorId) !== 0 && typeof errorId !== "object") {
      const code = Number(errorId);
      if (code === 100) {
        return { total: 0, campaigns: [], error: "Invalid credentials" };
      }
      return { total: 0, campaigns: [], error: `AffMine error: ${errorId}` };
    }

    const successVal = root.success;
    if (successVal === false || successVal === "false") {
      return { total: 0, campaigns: [], error: String(root.message ?? "Request failed") };
    }

    const items = findArrayInObject(parsed);
    if (items.length > 0) {
      logger.info({ sampleKeys: Object.keys(items[0]) }, "Sample JSON campaign keys");
    }

    const campaigns = items.map(extractCampaign);
    const totalRaw = root.row_count ?? root.total_count ?? root.totalCount ?? root.count ?? root.total;
    const total =
      typeof totalRaw === "number"
        ? totalRaw
        : parseInt(String(totalRaw ?? campaigns.length), 10) || campaigns.length;

    return { total, campaigns };
  }
}

async function fetchCampaigns(
  affId: string,
  apiKey: string,
  extra: Record<string, string | undefined>,
): Promise<{ total: number; campaigns: ParsedCampaign[] }> {
  const url = new URL("https://network.affmine.com/api/v1/getCampaigns");
  url.searchParams.set("aff_id", affId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");

  const paramKeys = [
    "offer_status",
    "countries",
    "platform",
    "category",
    "incentive",
    "start_row",
    "limit_row",
  ] as const;
  for (const key of paramKeys) {
    if (extra[key] != null && extra[key] !== "") {
      url.searchParams.set(key, extra[key]!);
    }
  }

  const response = await fetch(url.toString());

  if (!response.ok && response.status >= 500) {
    logger.warn({ statusCode: response.status }, "AffMine API upstream error");
    throw Object.assign(new Error("AffMine API is temporarily unavailable"), { status: 502 });
  }

  const rawText = await response.text();

  logger.info({
    statusCode: response.status,
    contentType: response.headers.get("content-type"),
    bodyLength: rawText.length,
  }, "AffMine API response received");

  let result: ReturnType<typeof parseAffMineResponse>;
  try {
    result = parseAffMineResponse(rawText);
  } catch (parseErr) {
    logger.error({ err: (parseErr as Error).message }, "Failed to parse AffMine response");
    throw Object.assign(new Error("Failed to parse AffMine API response"), { status: 502 });
  }

  if (result.error) {
    const status = result.error.includes("credentials") ? 401 : 400;
    throw Object.assign(new Error(result.error), { status });
  }

  logger.info({ totalCampaigns: result.campaigns.length, totalReported: result.total }, "Parsed campaigns");

  return { total: result.total, campaigns: result.campaigns };
}

router.get("/campaigns", async (req, res): Promise<void> => {
  const parsed = GetCampaignsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { aff_id, api_key, ...filters } = parsed.data;

  try {
    const result = await fetchCampaigns(aff_id, api_key, filters);
    res.json(GetCampaignsResponse.parse(result));
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    req.log.warn({ err: e.message }, "Campaigns fetch failed");
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

router.get("/campaigns/stats", async (req, res): Promise<void> => {
  const parsed = GetCampaignStatsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { aff_id, api_key } = parsed.data;

  try {
    const { campaigns } = await fetchCampaigns(aff_id, api_key, {});

    const payouts = campaigns
      .map((c) => parseFloat(c.payout))
      .filter((p) => !isNaN(p) && isFinite(p));
    const total = campaigns.length;
    const avgPayout =
      payouts.length > 0 ? payouts.reduce((s, p) => s + p, 0) / payouts.length : 0;
    const maxPayout = payouts.length > 0 ? Math.max(...payouts) : 0;
    const minPayout = payouts.length > 0 ? Math.min(...payouts) : 0;

    const incentiveCount = campaigns.filter((c) => c.incentive === "yes").length;
    const nonIncentiveCount = total - incentiveCount;

    const categoryMap = new Map<string, { count: number; payoutSum: number }>();
    for (const c of campaigns) {
      const cat = c.category || "Unknown";
      const payout = parseFloat(c.payout) || 0;
      const existing = categoryMap.get(cat) ?? { count: 0, payoutSum: 0 };
      categoryMap.set(cat, {
        count: existing.count + 1,
        payoutSum: existing.payoutSum + payout,
      });
    }
    const byCategory = Array.from(categoryMap.entries())
      .map(([name, { count, payoutSum }]) => ({
        name,
        count,
        avg_payout: count > 0 ? Math.round((payoutSum / count) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const countryMap = new Map<string, { name: string; count: number }>();
    for (const c of campaigns) {
      for (const co of c.countries) {
        const existing = countryMap.get(co.code);
        if (existing) {
          existing.count++;
        } else {
          countryMap.set(co.code, { name: co.name, count: 1 });
        }
      }
    }
    const byCountry = Array.from(countryMap.entries())
      .map(([code, { name, count }]) => ({ code, name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);

    const platformMap = new Map<string, number>();
    for (const c of campaigns) {
      for (const p of c.platforms) {
        platformMap.set(p, (platformMap.get(p) ?? 0) + 1);
      }
    }
    const byPlatform = Array.from(platformMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const stats = {
      total_campaigns: total,
      avg_payout: Math.round(avgPayout * 100) / 100,
      max_payout: Math.round(maxPayout * 100) / 100,
      min_payout: Math.round(minPayout * 100) / 100,
      incentive_count: incentiveCount,
      non_incentive_count: nonIncentiveCount,
      by_category: byCategory,
      by_country: byCountry,
      by_platform: byPlatform,
    };

    res.json(GetCampaignStatsResponse.parse(stats));
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    req.log.warn({ err: e.message }, "Campaign stats fetch failed");
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

export default router;
