import { Router, type IRouter } from "express";
import {
  GetCampaignsQueryParams,
  GetCampaignStatsQueryParams,
  GetCampaignsResponse,
  GetCampaignStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const PLATFORM_MAP: Record<string, string> = {
  "1": "Windows",
  "2": "Mac",
  "3": "Android",
  "4": "iOS",
  "5": "Mobile other",
};

function normalizePlatform(p: string): string {
  return PLATFORM_MAP[p] ?? p;
}

interface AffMineCampaign {
  id?: string | number;
  offer_id?: string | number;
  name?: string;
  offer_name?: string;
  payout?: string | number;
  payout_type?: string;
  currency?: string;
  preview_url?: string | null;
  thumbnail?: string | null;
  tracking_url?: string;
  offer_url?: string;
  description?: string | null;
  countries?: Array<{ code: string; name: string } | string>;
  platforms?: Array<string | number>;
  platform?: string | number;
  category?: string;
  categories?: string;
  incentive?: string | boolean;
  is_incentive?: string | boolean;
}

interface AffMineResponse {
  status?: string;
  error_id?: string | number;
  total_count?: number | string;
  data?: AffMineCampaign[];
  offers?: AffMineCampaign[];
  campaigns?: AffMineCampaign[];
}

function parseCampaigns(raw: AffMineResponse): Array<{
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
}> {
  const items: AffMineCampaign[] =
    raw.data ?? raw.offers ?? raw.campaigns ?? [];

  return items.map((c) => {
    const rawCountries = c.countries ?? [];
    const countries = rawCountries
      .map((co) => {
        if (typeof co === "string") return { code: co, name: co };
        return { code: co.code ?? "", name: co.name ?? co.code ?? "" };
      })
      .filter((co) => co.code);

    const rawPlatforms = c.platforms ?? (c.platform != null ? [c.platform] : []);
    const platforms = rawPlatforms.map((p) =>
      normalizePlatform(String(p)),
    );

    const payoutRaw = c.payout ?? "0";
    const payoutStr =
      typeof payoutRaw === "number"
        ? payoutRaw.toFixed(2)
        : String(payoutRaw);

    const incentiveRaw = c.incentive ?? c.is_incentive ?? "no";
    const incentive =
      incentiveRaw === true ||
      incentiveRaw === "1" ||
      incentiveRaw === "yes" ||
      incentiveRaw === "true"
        ? "yes"
        : "no";

    const category =
      c.category ?? c.categories ?? "Unknown";

    return {
      id: String(c.id ?? c.offer_id ?? ""),
      name: String(c.name ?? c.offer_name ?? ""),
      payout: payoutStr,
      payout_type: String(c.payout_type ?? "CPA"),
      currency: String(c.currency ?? "USD"),
      preview_url: c.preview_url ?? c.thumbnail ?? null,
      tracking_url: String(c.tracking_url ?? c.offer_url ?? ""),
      description: c.description ?? null,
      countries,
      platforms,
      category,
      incentive,
    };
  });
}

async function fetchCampaigns(
  affId: string,
  apiKey: string,
  extra: Record<string, string | undefined>,
): Promise<{ total: number; campaigns: ReturnType<typeof parseCampaigns> }> {
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

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  const raw = (await response.json()) as AffMineResponse;

  if (raw.error_id && Number(raw.error_id) !== 0) {
    const code = Number(raw.error_id);
    if (code === 100) {
      throw Object.assign(new Error("Invalid credentials"), { status: 401 });
    }
    throw Object.assign(new Error(`AffMine error: ${raw.error_id}`), {
      status: 400,
    });
  }

  const campaigns = parseCampaigns(raw);
  const total =
    typeof raw.total_count === "number"
      ? raw.total_count
      : parseInt(String(raw.total_count ?? campaigns.length), 10) ||
        campaigns.length;

  return { total, campaigns };
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
      .filter((p) => !isNaN(p));
    const total = campaigns.length;
    const avgPayout =
      total > 0 ? payouts.reduce((s, p) => s + p, 0) / payouts.length : 0;
    const maxPayout = total > 0 ? Math.max(...payouts) : 0;
    const minPayout = total > 0 ? Math.min(...payouts) : 0;

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
        avg_payout: count > 0 ? payoutSum / count : 0,
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
