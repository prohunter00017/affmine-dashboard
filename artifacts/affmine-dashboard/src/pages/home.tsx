/**
 * Dashboard overview page.
 *
 * Shows high-level KPI cards (total campaigns, average payout, top category,
 * top platform) fetched from the `/api/campaigns/stats` endpoint, plus a
 * preview table of the 5 most-recent campaigns.
 */

import { useGetCampaignStats, useGetCampaigns, getGetCampaignStatsQueryKey, getGetCampaignsQueryKey } from "@workspace/api-client-react";
import type { Campaign } from "@workspace/api-client-react";
import { useCredentials } from "@/hooks/use-credentials";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Layers, Megaphone, MonitorSmartphone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { affId, apiKey, hasCredentials } = useCredentials();

  const { data: stats, isLoading: statsLoading } = useGetCampaignStats(
    { aff_id: affId, api_key: apiKey },
    {
      query: {
        enabled: hasCredentials,
        queryKey: getGetCampaignStatsQueryKey({ aff_id: affId, api_key: apiKey }),
      },
    }
  );

  const { data: campaignsRes, isLoading: campaignsLoading } = useGetCampaigns(
    { aff_id: affId, api_key: apiKey, limit_row: "5" },
    {
      query: {
        enabled: hasCredentials,
        queryKey: getGetCampaignsQueryKey({ aff_id: affId, api_key: apiKey, limit_row: "5" }),
      },
    }
  );

  if (!hasCredentials) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-4 text-foreground">Welcome to AffMine Terminal</h1>
        <p className="text-muted-foreground mb-8 max-w-md">Your command center for affiliate marketing. Please configure your API credentials to get started.</p>
        <Link href="/settings">
          <Button size="lg" data-testid="button-home-setup">Configure Settings</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground font-mono">Overview</h1>
        <p className="text-muted-foreground mt-1">High-level metrics for your campaigns.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Campaigns</CardTitle>
            <Megaphone className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-[100px]" />
            ) : (
              <div className="text-2xl font-bold font-mono text-foreground" data-testid="text-total-campaigns">
                {stats?.total_campaigns?.toLocaleString() || 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Payout</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-[80px]" />
            ) : (
              <div className="text-2xl font-bold font-mono text-foreground" data-testid="text-avg-payout">
                ${stats?.avg_payout?.toFixed(2) || "0.00"}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Top Category</CardTitle>
            <Layers className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-[120px]" />
            ) : (
              <div className="text-2xl font-bold text-foreground truncate" data-testid="text-top-category">
                {stats?.by_category?.[0]?.name || "N/A"}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Top Platform</CardTitle>
            <MonitorSmartphone className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-[90px]" />
            ) : (
              <div className="text-2xl font-bold text-foreground" data-testid="text-top-platform">
                {stats?.by_platform?.[0]?.name || "N/A"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Recent Campaigns</h2>
          <Link href="/campaigns">
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10">
              View All
            </Button>
          </Link>
        </div>

        <Card className="border-border/50 bg-card/50">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/30 uppercase border-b border-border">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Payout</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Platforms</th>
                </tr>
              </thead>
              <tbody>
                {campaignsLoading ? (
                  Array.from({ length: 5 }).map((_, i: number) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    </tr>
                  ))
                ) : campaignsRes?.campaigns?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No campaigns found.
                    </td>
                  </tr>
                ) : (
                  campaignsRes?.campaigns?.map((campaign: Campaign) => (
                    <tr key={campaign.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-muted-foreground">{campaign.id}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{campaign.name}</td>
                      <td className="px-4 py-3 font-mono text-primary">${campaign.payout} {campaign.payout_type}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-sm bg-secondary text-secondary-foreground text-xs">
                          {campaign.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{campaign.platforms.join(", ")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
