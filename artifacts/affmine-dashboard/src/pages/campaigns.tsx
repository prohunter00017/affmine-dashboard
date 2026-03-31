/**
 * Campaign Browser page.
 *
 * Lists all AffMine campaigns with filters for status, platform, category,
 * country, and incentive.  Supports favorites, saved filter presets,
 * client-side pagination, CSV export, and LLM-friendly export.
 */

import { useState, useEffect, useRef } from "react";
import { useGetCampaigns, getGetCampaignsQueryKey, useGetCampaignFilterOptions, getGetCampaignFilterOptionsQueryKey } from "@workspace/api-client-react";
import type { Campaign, CountryEntry, CampaignsResponse } from "@workspace/api-client-react";
import { useCredentials } from "@/hooks/use-credentials";
import { useFavorites } from "@/hooks/use-favorites";
import { useSavedFilters } from "@/hooks/use-saved-filters";
import type { FilterState } from "@/hooks/use-saved-filters";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Filter, ArrowRight, Image as ImageIcon, Check, ChevronsUpDown,
  Download, X, Star, ChevronDown, BookmarkPlus, Trash2, FileJson, FileText,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

function triggerDownload(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCsv(campaigns: Campaign[]) {
  const headers = ["ID", "Name", "Description", "Payout", "Payout Type", "Currency", "Category", "Countries", "Platforms", "Incentive", "Preview URL", "Tracking URL"];
  const escapeField = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };
  const rows = campaigns.map((c: Campaign) => [
    c.id, c.name, c.description, c.payout, c.payout_type, c.currency,
    c.category,
    c.countries.map((co: CountryEntry) => `${co.code} (${co.name})`).join("; "),
    c.platforms.join("; "),
    c.incentive, c.preview_url, c.tracking_url,
  ].map((v) => escapeField(String(v ?? ""))));
  const csv = [headers.join(","), ...rows.map((r: string[]) => r.join(","))].join("\n");
  triggerDownload(csv, `campaigns_${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8;");
}

function exportLlmMarkdown(campaigns: Campaign[]) {
  const date = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const lines: string[] = [
    "# AffMine Campaign Export",
    "",
    `**Exported**: ${date}  `,
    `**Total campaigns**: ${campaigns.length}`,
    "",
  ];
  for (const c of campaigns) {
    lines.push("---", "");
    lines.push(`## [${c.id}] ${c.name}`, "");
    lines.push(`- **Payout**: $${c.payout} ${c.payout_type} (${c.currency})`);
    lines.push(`- **Category**: ${c.category}`);
    lines.push(`- **Incentive**: ${c.incentive === "yes" ? "Yes" : "No"}`);
    lines.push(`- **Countries**: ${c.countries.map((co: CountryEntry) => `${co.code} (${co.name})`).join("; ") || "—"}`);
    lines.push(`- **Platforms**: ${c.platforms.join("; ") || "—"}`);
    if (c.description) {
      lines.push(`- **Description**: ${c.description.replace(/\n/g, " ").trim()}`);
    }
    lines.push(`- **Tracking URL**: \`${c.tracking_url}\``);
    lines.push("");
  }
  triggerDownload(lines.join("\n"), `campaigns_llm_${new Date().toISOString().slice(0, 10)}.md`, "text/markdown;charset=utf-8;");
}

function exportLlmJson(campaigns: Campaign[]) {
  const payload = {
    exportedAt: new Date().toISOString(),
    totalCampaigns: campaigns.length,
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      payout: c.payout,
      payout_type: c.payout_type,
      currency: c.currency,
      category: c.category,
      incentive: c.incentive,
      countries: c.countries,
      platforms: c.platforms,
      description: c.description,
      tracking_url: c.tracking_url,
      preview_url: c.preview_url,
    })),
  };
  triggerDownload(JSON.stringify(payload, null, 2), `campaigns_llm_${new Date().toISOString().slice(0, 10)}.json`, "application/json;charset=utf-8;");
}

export default function Campaigns() {
  const { affId, apiKey, hasCredentials } = useCredentials();
  const { toggleFavorite, isFavorite, count: favCount } = useFavorites();
  const { savedFilters, saveFilter, deleteSavedFilter } = useSavedFilters();

  const [page, setPage] = useState(0);
  const rowsPerPage = 20;

  const [filters, setFilters] = useState({
    offer_status: "",
    platform: "",
    category: "",
    incentive: "",
  });
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const [countryOpen, setCountryOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const presetInputRef = useRef<HTMLInputElement>(null);

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
  const visibleCampaigns = showFavoritesOnly
    ? allCampaigns.filter((c: Campaign) => isFavorite(c.id))
    : allCampaigns;

  const totalPages = Math.max(1, Math.ceil(visibleCampaigns.length / rowsPerPage));
  const paginatedCampaigns = visibleCampaigns.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  useEffect(() => {
    if (page > 0 && page >= totalPages) {
      setPage(Math.max(0, totalPages - 1));
    }
  }, [page, totalPages]);

  useEffect(() => {
    setPage(0);
  }, [showFavoritesOnly]);

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

  const currentFilterState: FilterState = {
    offer_status: filters.offer_status,
    platform: filters.platform,
    category: filters.category,
    incentive: filters.incentive,
    countries: selectedCountries,
  };

  const handleLoadPreset = (preset: FilterState) => {
    setFilters({
      offer_status: preset.offer_status,
      platform: preset.platform,
      category: preset.category,
      incentive: preset.incentive,
    });
    setSelectedCountries(preset.countries);
    setShowFavoritesOnly(false);
    setPage(0);
  };

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    saveFilter(name, currentFilterState);
    setPresetName("");
    setSavePresetOpen(false);
    toast({ title: `Preset "${name}" saved` });
  };

  if (!hasCredentials) {
    return <div className="p-8 text-center text-muted-foreground">Please configure settings.</div>;
  }

  const hasActiveFilters =
    filters.offer_status || filters.platform || filters.category ||
    filters.incentive || selectedCountries.length > 0;

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-mono">Campaign Browser</h1>
          <p className="text-muted-foreground mt-1">Search and filter available campaigns</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-mono bg-card px-3 py-1.5 rounded border border-border">
          <span className="text-muted-foreground">Total:</span>
          <span className="text-primary font-bold">{data?.total || 0}</span>
          {showFavoritesOnly && (
            <>
              <span className="text-muted-foreground ml-2">Favorites:</span>
              <span className="text-yellow-400 font-bold">{favCount}</span>
            </>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
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
                      <CommandItem value="__all__" onSelect={() => { handleFilterChange("category", "all"); setCategoryOpen(false); }}>
                        <Check className={cn("mr-2 h-4 w-4", !filters.category ? "opacity-100" : "opacity-0")} />
                        All
                      </CommandItem>
                      {(filterOptions?.categories ?? []).map((cat: string) => (
                        <CommandItem key={cat} value={cat} onSelect={() => { handleFilterChange("category", cat); setCategoryOpen(false); }}>
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
                    <X className="ml-2 h-4 w-4 shrink-0 opacity-50 hover:opacity-100" onClick={(e: React.MouseEvent) => { e.stopPropagation(); setSelectedCountries([]); setPage(0); }} />
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
                        <CommandItem key={country.code} value={`${country.code} ${country.name}`} onSelect={() => toggleCountry(country.code)}>
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
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
          <button
            onClick={() => setShowFavoritesOnly((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors",
              showFavoritesOnly
                ? "bg-yellow-400/15 border-yellow-400/40 text-yellow-400"
                : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
            )}
          >
            <Star className={cn("h-3 w-3", showFavoritesOnly && "fill-yellow-400")} />
            Favorites
            {favCount > 0 && (
              <span className={cn("ml-0.5 font-mono", showFavoritesOnly ? "text-yellow-400" : "text-primary")}>
                {favCount}
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={() => {
                setFilters({ offer_status: "", platform: "", category: "", incentive: "" });
                setSelectedCountries([]);
                setPage(0);
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-muted-foreground border border-dashed border-border hover:border-destructive hover:text-destructive transition-colors"
            >
              <X className="h-3 w-3" /> Clear filters
            </button>
          )}

          <div className="flex-1" />

          <Popover open={savePresetOpen} onOpenChange={(open) => { setSavePresetOpen(open); if (open) setTimeout(() => presetInputRef.current?.focus(), 50); }}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7 px-2">
                <BookmarkPlus className="h-3.5 w-3.5" />
                Save filters
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="end">
              <p className="text-xs font-medium mb-2">Save current filters as preset</p>
              <div className="flex gap-2">
                <Input
                  ref={presetInputRef}
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Preset name…"
                  className="h-8 text-xs"
                  onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
                />
                <Button size="sm" className="h-8 px-3 text-xs shrink-0" onClick={handleSavePreset} disabled={!presetName.trim()}>
                  Save
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {savedFilters.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7 px-2">
                  Presets
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs">Saved presets</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {savedFilters.map((preset) => (
                  <DropdownMenuItem key={preset.name} className="flex items-center justify-between group cursor-pointer" onSelect={() => handleLoadPreset(preset.filters)}>
                    <span className="truncate text-xs">{preset.name}</span>
                    <button
                      className="ml-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={(e) => { e.stopPropagation(); deleteSavedFilter(preset.name); toast({ title: `Preset "${preset.name}" deleted` }); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <div className="flex items-center rounded-md border border-border overflow-hidden">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs h-7 px-2 rounded-none border-0"
              disabled={visibleCampaigns.length === 0}
              onClick={() => exportLlmMarkdown(visibleCampaigns)}
            >
              <FileText className="h-3.5 w-3.5" />
              Export for LLM
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-6 px-0 rounded-none border-0 border-l border-border"
                  disabled={visibleCampaigns.length === 0}
                >
                  <ChevronDown className="h-3 w-3" />
                  <span className="sr-only">More export options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="text-xs">Export format</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-xs cursor-pointer" onSelect={() => exportLlmMarkdown(visibleCampaigns)}>
                  <FileText className="h-3.5 w-3.5 mr-2" />
                  Markdown (.md)
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs cursor-pointer" onSelect={() => exportLlmJson(visibleCampaigns)}>
                  <FileJson className="h-3.5 w-3.5 mr-2" />
                  JSON (.json)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-7 px-2"
            disabled={visibleCampaigns.length === 0}
            onClick={() => exportCsv(visibleCampaigns)}
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border">
              <tr>
                <th className="px-3 py-3 w-8"></th>
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
                    <td className="px-3 py-4"><Skeleton className="h-4 w-4" /></td>
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
                  <td colSpan={8} className="px-4 py-12 text-center text-destructive">
                    Failed to load campaigns. Check your API credentials.
                  </td>
                </tr>
              ) : paginatedCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">
                    <Filter className="mx-auto h-8 w-8 mb-3 opacity-20" />
                    <p>{showFavoritesOnly ? "No favorites yet. Star campaigns to save them here." : "No campaigns found matching these filters."}</p>
                  </td>
                </tr>
              ) : (
                paginatedCampaigns.map((campaign: Campaign) => {
                  const starred = isFavorite(campaign.id);
                  return (
                    <tr key={campaign.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors group">
                      <td className="px-3 py-3">
                        <button
                          onClick={() => toggleFavorite(campaign.id)}
                          className={cn(
                            "h-6 w-6 flex items-center justify-center rounded transition-colors",
                            starred
                              ? "text-yellow-400"
                              : "text-muted-foreground/30 hover:text-yellow-400/70 opacity-0 group-hover:opacity-100"
                          )}
                          aria-label={starred ? "Remove from favorites" : "Add to favorites"}
                        >
                          <Star className={cn("h-4 w-4", starred && "fill-yellow-400")} />
                        </button>
                      </td>
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
                        >
                          Details <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between bg-muted/20">
          <div className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{paginatedCampaigns.length}</span> of{" "}
            <span className="font-medium text-foreground">{visibleCampaigns.length}</span> rows
            {totalPages > 1 && (
              <span className="ml-2">(Page {page + 1} of {totalPages})</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p: number) => Math.max(0, p - 1))} disabled={page === 0 || isLoading}>
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p: number) => p + 1)} disabled={page >= totalPages - 1 || isLoading}>
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
                  <button
                    onClick={() => toggleFavorite(selectedCampaign.id)}
                    className={cn(
                      "ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                      isFavorite(selectedCampaign.id)
                        ? "bg-yellow-400/15 border-yellow-400/40 text-yellow-400"
                        : "border-border text-muted-foreground hover:text-yellow-400 hover:border-yellow-400/40"
                    )}
                  >
                    <Star className={cn("h-3.5 w-3.5", isFavorite(selectedCampaign.id) && "fill-yellow-400")} />
                    {isFavorite(selectedCampaign.id) ? "Favorited" : "Add to favorites"}
                  </button>
                </div>
                <DialogTitle className="text-xl">{selectedCampaign.name}</DialogTitle>
                <DialogDescription>{selectedCampaign.category}</DialogDescription>
              </DialogHeader>

              <div className="grid gap-6 py-4">
                {selectedCampaign.preview_url && (
                  <div className="rounded-md border border-border overflow-hidden bg-muted/30 aspect-video flex items-center justify-center relative">
                    <img
                      src={selectedCampaign.preview_url}
                      alt="Preview"
                      className="object-contain w-full h-full"
                      onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
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
                      ${selectedCampaign.payout}{" "}
                      <span className="text-sm font-normal text-muted-foreground">{selectedCampaign.payout_type}</span>
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
                    <p className="text-sm text-muted-foreground leading-relaxed">{selectedCampaign.description}</p>
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
                        <Badge key={p} variant="outline" className="uppercase text-xs">{p}</Badge>
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
                      onClick={() => { navigator.clipboard.writeText(selectedCampaign.tracking_url); }}
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
