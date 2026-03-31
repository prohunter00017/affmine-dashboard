/**
 * Campaign Browser page.
 *
 * Lists all AffMine campaigns with filters for status, platform, category,
 * country, and incentive.  Supports client-side pagination and CSV export
 * of the full (filtered) result set.  Clicking a row opens a detail dialog.
 */

import { useState, useEffect } from "react";
import { useGetCampaigns, getGetCampaignsQueryKey, useGetCampaignFilterOptions, getGetCampaignFilterOptionsQueryKey } from "@workspace/api-client-react";
import type { Campaign, CountryEntry, CampaignsResponse } from "@workspace/api-client-react";
import { useCredentials } from "@/hooks/use-credentials";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, ArrowRight, Image as ImageIcon, Check, ChevronsUpDown, Download, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

/** Build a CSV string from the given campaigns and trigger a browser download. */
function exportCsv(campaigns: Campaign[]) {
  const headers = ["ID", "Name", "Description", "Payout", "Payout Type", "Currency", "Category", "Countries", "Platforms", "Incentive", "Preview URL", "Tracking URL"];
  const escapeField = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };
  const rows = campaigns.map((c: Campaign) => [
    c.id,
    c.name,
    c.description,
    c.payout,
    c.payout_type,
    c.currency,
    c.category,
    c.countries.map((co: CountryEntry) => `${co.code} (${co.name})`).join("; "),
    c.platforms.join("; "),
    c.incentive,
    c.preview_url,
    c.tracking_url,
  ].map((v) => escapeField(String(v ?? ""))));

  const csv = [headers.join(","), ...rows.map((r: string[]) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `campaigns_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Campaigns() {
  const { affId, apiKey, hasCredentials } = useCredentials();
  const [page, setPage] = useState(0);
  const rowsPerPage = 20;

  const [filters, setFilters] = useState({
    offer_status: "",
    platform: "",
    category: "",
    incentive: "",
  });

  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [countryOpen, setCountryOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  const queryParams = {
    aff_id: affId,
    api_key: apiKey,
    ...(filters.offer_status && { offer_status: filters.offer_status }),
    ...(selectedCountries.length > 0 && { countries: selectedCountries.join(",") }),
    ...(filters.platform && { platform: filters.platform }),
    ...(filters.category && { category: filters.category }),
    ...(filters.incentive && { incentive: filters.incentive }),
  };

  const { data, isLoading, isError } = useGetCampaigns(queryParams, {
    query: {
      enabled: hasCredentials,
      queryKey: getGetCampaignsQueryKey(queryParams),
      placeholderData: (prev: CampaignsResponse | undefined) => prev,
    },
  });

  const { data: filterOptions } = useGetCampaignFilterOptions(
    { aff_id: affId, api_key: apiKey },
    {
      query: {
        enabled: hasCredentials,
        queryKey: getGetCampaignFilterOptionsQueryKey({ aff_id: affId, api_key: apiKey }),
        staleTime: 5 * 60 * 1000,
      },
    }
  );

  const allCampaigns = data?.campaigns ?? [];
  const totalPages = Math.max(1, Math.ceil(allCampaigns.length / rowsPerPage));
  const paginatedCampaigns = allCampaigns.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  useEffect(() => {
    if (page > 0 && page >= totalPages) {
      setPage(Math.max(0, totalPages - 1));
    }
  }, [page, totalPages]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value === "all" ? "" : value }));
    setPage(0);
  };

  const toggleCountry = (code: string) => {
    setSelectedCountries((prev) =>
      prev.includes(code) ? prev.filter((c: string) => c !== code) : [...prev, code]
    );
    setPage(0);
  };

  if (!hasCredentials) {
    return <div className="p-8 text-center text-muted-foreground">Please configure settings.</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-mono">Campaign Browser</h1>
          <p className="text-muted-foreground mt-1">Search and filter available campaigns</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-mono bg-card px-3 py-1.5 rounded border border-border">
          <span className="text-muted-foreground">Total:</span>
          <span className="text-primary font-bold">{data?.total || 0}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 bg-card p-4 rounded-lg border border-border">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select value={filters.offer_status || "all"} onValueChange={(v: string) => handleFilterChange("offer_status", v)}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Platform</label>
          <Select value={filters.platform || "all"} onValueChange={(v: string) => handleFilterChange("platform", v)}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="desktop">Desktop</SelectItem>
              <SelectItem value="ios">iOS</SelectItem>
              <SelectItem value="android">Android</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Category</label>
          <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={categoryOpen} className="w-full justify-between bg-background font-normal">
                {filters.category || "All"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search categories..." />
                <CommandList>
                  <CommandEmpty>No categories found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="__all__"
                      onSelect={() => {
                        handleFilterChange("category", "all");
                        setCategoryOpen(false);
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", !filters.category ? "opacity-100" : "opacity-0")} />
                      All
                    </CommandItem>
                    {(filterOptions?.categories ?? []).map((cat: string) => (
                      <CommandItem
                        key={cat}
                        value={cat}
                        onSelect={() => {
                          handleFilterChange("category", cat);
                          setCategoryOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", filters.category === cat ? "opacity-100" : "opacity-0")} />
                        {cat}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Country</label>
          <Popover open={countryOpen} onOpenChange={setCountryOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={countryOpen} className="w-full justify-between bg-background font-normal">
                <span className="truncate">
                  {selectedCountries.length === 0
                    ? "All"
                    : selectedCountries.length === 1
                      ? (filterOptions?.countries?.find((c: CountryEntry) => c.code === selectedCountries[0])?.name ?? selectedCountries[0])
                      : `${selectedCountries.length} selected`}
                </span>
                {selectedCountries.length > 0 ? (
                  <X
                    className="ml-2 h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      setSelectedCountries([]);
                      setPage(0);
                    }}
                  />
                ) : (
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search countries..." />
                <CommandList>
                  <CommandEmpty>No countries found.</CommandEmpty>
                  <CommandGroup>
                    {(filterOptions?.countries ?? []).map((country: CountryEntry) => (
                      <CommandItem
                        key={country.code}
                        value={`${country.code} ${country.name}`}
                        onSelect={() => toggleCountry(country.code)}
                      >
                        <Check className={cn("mr-2 h-4 w-4", selectedCountries.includes(country.code) ? "opacity-100" : "opacity-0")} />
                        <span className="font-mono text-xs mr-2">{country.code}</span>
                        {country.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Incentive</label>
          <Select value={filters.incentive || "all"} onValueChange={(v: string) => handleFilterChange("incentive", v)}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 flex items-end">
          <Button
            variant="outline"
            className="w-full gap-2"
            disabled={allCampaigns.length === 0}
            onClick={() => exportCsv(allCampaigns)}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Payout</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Countries</th>
                <th className="px-4 py-3">Platforms</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i: number) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-4 py-4"><Skeleton className="h-4 w-12" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-4 w-48" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-4 text-right"><Skeleton className="h-8 w-20 ml-auto" /></td>
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-destructive">
                    Failed to load campaigns. Check your API credentials.
                  </td>
                </tr>
              ) : paginatedCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                    <Filter className="mx-auto h-8 w-8 mb-3 opacity-20" />
                    <p>No campaigns found matching these filters.</p>
                  </td>
                </tr>
              ) : (
                paginatedCampaigns.map((campaign: Campaign) => (
                  <tr key={campaign.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors group">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{campaign.id}</td>
                    <td className="px-4 py-3 font-medium max-w-[250px] truncate" title={campaign.name}>
                      {campaign.name}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-primary font-bold">${campaign.payout}</span>
                      <span className="text-xs text-muted-foreground ml-1">{campaign.payout_type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="font-normal">{campaign.category}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap max-w-[120px]">
                        {campaign.countries.slice(0, 3).map((c: CountryEntry) => (
                          <span key={c.code} className="text-xs border border-border px-1 rounded bg-background" title={c.name}>
                            {c.code}
                          </span>
                        ))}
                        {campaign.countries.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{campaign.countries.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {campaign.platforms.map((p: string) => (
                          <span key={p} className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedCampaign(campaign)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`button-view-${campaign.id}`}
                      >
                        Details <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 border-t border-border flex items-center justify-between bg-muted/20">
          <div className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{paginatedCampaigns.length}</span> of{" "}
            <span className="font-medium text-foreground">{allCampaigns.length}</span> rows
            {totalPages > 1 && (
              <span className="ml-2">(Page {page + 1} of {totalPages})</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPage((p: number) => Math.max(0, p - 1))}
              disabled={page === 0 || isLoading}
            >
              Previous
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPage((p: number) => p + 1)}
              disabled={page >= totalPages - 1 || isLoading}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={!!selectedCampaign} onOpenChange={(open: boolean) => !open && setSelectedCampaign(null)}>
        <DialogContent className="max-w-2xl bg-card border-border">
          {selectedCampaign && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <Badge className="bg-primary/20 text-primary border-primary/30">ID: {selectedCampaign.id}</Badge>
                  {selectedCampaign.incentive === "yes" && <Badge variant="outline">Incentive Allowed</Badge>}
                </div>
                <DialogTitle className="text-xl">{selectedCampaign.name}</DialogTitle>
                <DialogDescription>
                  {selectedCampaign.category}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-6 py-4">
                {selectedCampaign.preview_url && (
                  <div className="rounded-md border border-border overflow-hidden bg-muted/30 aspect-video flex items-center justify-center relative">
                    <img 
                      src={selectedCampaign.preview_url} 
                      alt="Preview" 
                      className="object-contain w-full h-full"
                      onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <div className="hidden absolute flex-col items-center text-muted-foreground">
                      <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
                      <span className="text-xs">Preview unavailable</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 p-3 bg-muted/20 rounded border border-border/50">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Payout</span>
                    <div className="font-mono text-xl text-primary font-bold">
                      ${selectedCampaign.payout} <span className="text-sm font-normal text-muted-foreground">{selectedCampaign.payout_type}</span>
                    </div>
                  </div>
                  <div className="space-y-1 p-3 bg-muted/20 rounded border border-border/50">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Currency</span>
                    <div className="font-mono text-xl">{selectedCampaign.currency}</div>
                  </div>
                </div>

                {selectedCampaign.description && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Description</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {selectedCampaign.description}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Target Countries</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedCampaign.countries.map((c: CountryEntry) => (
                        <Badge key={c.code} variant="secondary" className="bg-background border border-border">
                          {c.code} - {c.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Target Platforms</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedCampaign.platforms.map((p: string) => (
                        <Badge key={p} variant="outline" className="uppercase text-xs">
                          {p}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-border">
                  <h4 className="text-sm font-medium">Your Tracking Link</h4>
                  <div className="flex gap-2">
                    <Input 
                      readOnly 
                      value={selectedCampaign.tracking_url} 
                      className="font-mono text-xs bg-muted/30 border-border"
                    />
                    <Button 
                      variant="default" 
                      className="shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedCampaign.tracking_url);
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
