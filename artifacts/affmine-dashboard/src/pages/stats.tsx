import { useGetCampaignStats, getGetCampaignStatsQueryKey } from "@workspace/api-client-react";
import { useCredentials } from "@/hooks/use-credentials";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

export default function Stats() {
  const { affId, apiKey, hasCredentials } = useCredentials();

  const { data: stats, isLoading } = useGetCampaignStats(
    { aff_id: affId, api_key: apiKey },
    {
      query: {
        enabled: hasCredentials,
        queryKey: getGetCampaignStatsQueryKey({ aff_id: affId, api_key: apiKey }),
      },
    }
  );

  if (!hasCredentials) {
    return <div className="p-8 text-center text-muted-foreground">Please configure settings.</div>;
  }

  // Colors derived from our theme
  const COLORS = ['hsl(140, 100%, 45%)', 'hsl(190, 90%, 50%)', 'hsl(280, 80%, 60%)', 'hsl(40, 90%, 60%)', 'hsl(330, 80%, 60%)'];
  const CHART_TEXT = 'hsl(220, 10%, 65%)';
  const CHART_GRID = 'hsl(220, 20%, 15%)';

  const categoryData = stats?.by_category?.slice(0, 10) || [];
  const platformData = stats?.by_platform || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-mono">Analytics</h1>
        <p className="text-muted-foreground mt-1">Deep dive into network performance metrics</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-card">
              <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-16" /></CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card className="bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-medium">Max Payout</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-mono text-primary font-bold">${stats?.max_payout?.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-medium">Min Payout</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-mono text-foreground">${stats?.min_payout?.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-medium">Incentive Offers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-mono text-foreground">{stats?.incentive_count}</div>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-medium">Non-Incentive</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-mono text-foreground">{stats?.non_incentive_count}</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Top Categories by Volume</CardTitle>
            <CardDescription>Number of active campaigns per category</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {isLoading ? (
              <Skeleton className="w-full h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                  <XAxis dataKey="name" stroke={CHART_TEXT} fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke={CHART_TEXT} fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    cursor={{fill: 'hsl(220, 20%, 15%)'}}
                    contentStyle={{ backgroundColor: 'hsl(220, 20%, 11%)', borderColor: 'hsl(220, 20%, 15%)', color: '#fff', borderRadius: '4px' }}
                    itemStyle={{ color: 'hsl(140, 100%, 45%)' }}
                  />
                  <Bar dataKey="count" fill="hsl(140, 100%, 45%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Platform Distribution</CardTitle>
            <CardDescription>Campaign targeting by platform</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            {isLoading ? (
              <Skeleton className="w-48 h-48 rounded-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={platformData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="count"
                    stroke="none"
                  >
                    {platformData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'hsl(220, 20%, 11%)', borderColor: 'hsl(220, 20%, 15%)', color: '#fff', borderRadius: '4px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border md:col-span-2">
          <CardHeader>
            <CardTitle>Top Countries</CardTitle>
            <CardDescription>Sorted by total available campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {stats?.by_country?.slice(0, 20).map((country) => (
                  <div key={country.code} className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{country.code}</span>
                    </div>
                    <span className="font-mono text-primary font-bold text-sm">{country.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
