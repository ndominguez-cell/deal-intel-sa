import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { 
  Car, 
  MapPin, 
  TrendingDown, 
  TrendingUp, 
  Search, 
  Filter, 
  ShieldCheck, 
  AlertTriangle,
  Flame,
  BarChart3,
  Calendar,
  Gauge,
  Clock,
  DollarSign,
  CheckCircle2,
  Info,
  Store,
  Zap,
  Target,
  Loader2,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { apiRequest } from "@/lib/api";

const DEALER_DATA = [
  { name: "North Park Toyota", score: "A+", avgMarkup: -3.4, daysToSell: 21, dropFreq: 1.8, listings: 1842, dealFreq: "High" },
  { name: "Bluebonnet Ford", score: "A", avgMarkup: -2.1, daysToSell: 24, dropFreq: 1.2, listings: 1450, dealFreq: "High" },
  { name: "Ancira Jeep", score: "B+", avgMarkup: -0.5, daysToSell: 31, dropFreq: 2.1, listings: 980, dealFreq: "Medium" },
  { name: "Gunn Honda", score: "B", avgMarkup: 1.2, daysToSell: 28, dropFreq: 0.8, listings: 1120, dealFreq: "Medium" },
];

const DEFAULT_IMAGES: Record<string, string> = {
  "toyota_tacoma": "https://images.unsplash.com/photo-1629897048514-3dd7414cc710?w=800&q=80",
  "ford_f-150": "https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=800&q=80",
  "chevrolet_tahoe": "https://images.unsplash.com/photo-1563720223185-11003d516935?w=800&q=80",
  "honda_civic": "https://images.unsplash.com/photo-1605810731057-048c26ab8eb9?w=800&q=80",
  "jeep_wrangler": "https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=800&q=80",
};

function getImage(make: string, model: string, imageUrls: string[]): string {
  if (imageUrls && imageUrls.length > 0 && imageUrls[0]) return imageUrls[0];
  const key = `${make.toLowerCase()}_${model.toLowerCase()}`;
  return DEFAULT_IMAGES[key] || "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80";
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("top-deals");
  const [activeNav, setActiveNav] = useState("intelligence");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("score_desc");

  const statsQuery = useQuery({
    queryKey: ["/api/stats/overview"],
    queryFn: () => apiRequest("GET", "/api/stats/overview"),
    refetchInterval: 30000,
  });

  const dealsQuery = useQuery({
    queryKey: ["/api/deals/top", 0, 50],
    queryFn: () => apiRequest("GET", "/api/deals/top?min_score=0&limit=50"),
    refetchInterval: 30000,
  });

  const marketQuery = useQuery({
    queryKey: ["/api/stats/market"],
    queryFn: () => apiRequest("GET", "/api/stats/market?city=San%20Antonio"),
  });

  const ingestMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/jobs/ingest"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals/top"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/overview"] });
    },
  });

  const scoreMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/jobs/score"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals/top"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/market"] });
    },
  });

  const deals = dealsQuery.data?.deals || [];
  const stats = statsQuery.data;
  const marketSegments = marketQuery.data?.segments || [];

  const filteredDeals = deals.filter((d: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.listing.make.toLowerCase().includes(q) ||
      d.listing.model.toLowerCase().includes(q) ||
      (d.listing.trim && d.listing.trim.toLowerCase().includes(q)) ||
      (d.listing.dealerName && d.listing.dealerName.toLowerCase().includes(q))
    );
  });

  const sortedDeals = [...filteredDeals].sort((a: any, b: any) => {
    switch (sortBy) {
      case "score_desc": return b.score.dealScore - a.score.dealScore;
      case "savings_desc": return (b.score.savingsAmount || 0) - (a.score.savingsAmount || 0);
      case "velocity_desc": return (b.score.velocityPrediction || 0) - (a.score.velocityPrediction || 0);
      case "mileage_asc": return (a.listing.mileage || 999999) - (b.listing.mileage || 999999);
      default: return 0;
    }
  });

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-emerald-500";
    if (score >= 50) return "text-blue-500";
    if (score >= 30) return "text-yellow-500";
    return "text-orange-500";
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return "bg-emerald-500/10 border-emerald-500/30";
    if (score >= 50) return "bg-blue-500/10 border-blue-500/30";
    if (score >= 30) return "bg-yellow-500/10 border-yellow-500/30";
    return "bg-orange-500/10 border-orange-500/30";
  };

  const isEmpty = deals.length === 0 && !dealsQuery.isLoading;

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Car className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight leading-none" data-testid="text-app-title">DealIntel<span className="text-primary">SA</span></h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Automotive Market Intelligence</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-6">
            <nav className="flex items-center gap-4 text-sm font-medium h-16">
              <button 
                data-testid="nav-intelligence"
                onClick={() => setActiveNav("intelligence")}
                className={`h-full px-2 transition-colors ${activeNav === "intelligence" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-primary"}`}
              >
                Intelligence Hub
              </button>
              <button 
                data-testid="nav-dealers"
                onClick={() => setActiveNav("dealers")}
                className={`h-full px-2 transition-colors ${activeNav === "dealers" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-primary"}`}
              >
                Dealer Analytics
              </button>
              <button 
                data-testid="nav-market"
                onClick={() => setActiveNav("market")}
                className={`h-full px-2 transition-colors ${activeNav === "market" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-primary"}`}
              >
                Market Index
              </button>
            </nav>
            <div className="h-4 w-[1px] bg-border"></div>
            <Button variant="outline" size="sm" className="gap-2">
              <MapPin className="w-4 h-4" />
              San Antonio Area
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pt-8">
        
        {activeNav === "intelligence" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div>
                <h2 className="text-3xl font-bold tracking-tight mb-1">Market Intelligence</h2>
                <p className="text-muted-foreground" data-testid="text-listing-count">
                  {stats ? `Analyzing ${stats.totalListings.toLocaleString()} active listings within 100 miles of San Antonio.` : "Loading market data..."}
                </p>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    data-testid="input-search"
                    placeholder="Search make, model, or dealer..." 
                    className="pl-9 bg-card border-border/50"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button 
                  data-testid="button-ingest"
                  variant="secondary" 
                  className="gap-2" 
                  onClick={() => { ingestMutation.mutate(); }}
                  disabled={ingestMutation.isPending}
                >
                  {ingestMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  <span className="hidden sm:inline">Ingest</span>
                </Button>
                <Button 
                  data-testid="button-score"
                  variant="secondary" 
                  className="gap-2" 
                  onClick={() => { scoreMutation.mutate(); }}
                  disabled={scoreMutation.isPending}
                >
                  {scoreMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gauge className="w-4 h-4" />}
                  <span className="hidden sm:inline">Score</span>
                </Button>
              </div>
            </div>

            {/* Empty State: Bootstrap */}
            {isEmpty && (
              <Card className="bg-card/60 border-border/50 p-12 text-center flex flex-col items-center justify-center mb-8">
                <Car className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-2xl font-bold mb-2">No Data Yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-6">
                  Click "Ingest" to load seed listings, then "Score" to compute deal intelligence.
                </p>
                <div className="flex gap-3">
                  <Button onClick={() => ingestMutation.mutate()} disabled={ingestMutation.isPending}>
                    {ingestMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Load Sample Data
                  </Button>
                  <Button variant="outline" onClick={() => scoreMutation.mutate()} disabled={scoreMutation.isPending || isEmpty}>
                    {scoreMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Run Scoring
                  </Button>
                </div>
              </Card>
            )}

            {/* Stats Row */}
            {!isEmpty && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                  <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
                    <CardContent className="p-6 flex flex-col justify-between h-full gap-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Below Market Today</p>
                          <h3 className="text-3xl font-bold text-emerald-500" data-testid="text-below-market">{stats?.belowMarketToday || 0}</h3>
                        </div>
                        <div className="p-2 bg-emerald-500/10 rounded-md">
                          <Flame className="w-5 h-5 text-emerald-500" />
                        </div>
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground font-medium">
                        <span>Score 85+ deals detected</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
                    <CardContent className="p-6 flex flex-col justify-between h-full gap-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Total Listings</p>
                          <h3 className="text-2xl font-bold" data-testid="text-total-listings">{stats?.totalListings?.toLocaleString() || 0}</h3>
                        </div>
                        <div className="p-2 bg-primary/10 rounded-md">
                          <BarChart3 className="w-5 h-5 text-primary" />
                        </div>
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <span>Within 100mi radius</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
                    <CardContent className="p-6 flex flex-col justify-between h-full gap-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Price Snapshots</p>
                          <h3 className="text-2xl font-bold" data-testid="text-price-drops">{stats?.priceDrops24h || 0}</h3>
                        </div>
                        <div className="p-2 bg-orange-500/10 rounded-md">
                          <TrendingDown className="w-5 h-5 text-orange-500" />
                        </div>
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground font-medium">
                        <span>Last 24 hours</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-primary text-primary-foreground border-none overflow-hidden relative">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
                    <CardContent className="p-6 flex flex-col justify-between h-full gap-4 relative z-10">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-primary-foreground/80 mb-1">Engine Status</p>
                          <h3 className="text-2xl font-bold" data-testid="text-engine-status">Online</h3>
                        </div>
                        <div className="p-2 bg-white/20 rounded-md">
                          <ShieldCheck className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 text-xs text-primary-foreground/90">
                        <div className="flex items-center justify-between">
                          <span>Listings Scored</span>
                          <span>{deals.length}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Tabs defaultValue="top-deals" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <TabsList className="bg-card/50 border border-border/50 flex-wrap h-auto p-1">
                      <TabsTrigger value="top-deals" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 px-4" data-testid="tab-top-deals">
                        All Scored Deals
                      </TabsTrigger>
                      <TabsTrigger value="featured" className="py-2 px-4" data-testid="tab-featured">
                        Featured (85+)
                      </TabsTrigger>
                      <TabsTrigger value="high-intent" className="py-2 px-4 flex items-center gap-1.5" data-testid="tab-fast-sellers">
                        <Zap className="w-3.5 h-3.5" /> Fast Sellers
                      </TabsTrigger>
                    </TabsList>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-full sm:w-[220px] bg-card border-border/50" data-testid="select-sort">
                          <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="score_desc">Best Deal Score</SelectItem>
                          <SelectItem value="velocity_desc">Highest Velocity</SelectItem>
                          <SelectItem value="savings_desc">Largest Savings</SelectItem>
                          <SelectItem value="mileage_asc">Lowest Mileage</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <TabsContent value="top-deals" className="m-0 space-y-6">
                    <DealsList deals={sortedDeals} getScoreColor={getScoreColor} getScoreBg={getScoreBg} />
                  </TabsContent>
                  
                  <TabsContent value="featured" className="m-0 space-y-6">
                    <DealsList 
                      deals={sortedDeals.filter((d: any) => d.score.dealScore >= 85 && d.listing.titleStatus !== "salvage" && (d.listing.mileage || 0) <= 120000)}
                      getScoreColor={getScoreColor} 
                      getScoreBg={getScoreBg}
                      emptyMessage="No featured deals (score 85+) found yet. Try ingesting more data or adjusting scoring."
                    />
                  </TabsContent>

                  <TabsContent value="high-intent" className="m-0 space-y-6">
                    <DealsList 
                      deals={sortedDeals.filter((d: any) => (d.score.velocityPrediction || 0) > 60)}
                      getScoreColor={getScoreColor} 
                      getScoreBg={getScoreBg}
                      emptyMessage="No high-velocity listings detected currently."
                    />
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        )}

        {/* MARKET INDEX TAB */}
        {activeNav === "market" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-3xl font-bold tracking-tight mb-1">San Antonio Vehicle Price Index</h2>
                <p className="text-muted-foreground">Proprietary regional market intelligence from live data.</p>
              </div>
            </div>

            <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Segment Performance</CardTitle>
                <CardDescription>Average price and inventory by vehicle segment.</CardDescription>
              </CardHeader>
              <CardContent>
                {marketSegments.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Run the scoring job to generate market index data.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-y border-border/50">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Segment</th>
                          <th className="px-4 py-3 font-semibold">Median Price</th>
                          <th className="px-4 py-3 font-semibold">Active Inventory</th>
                          <th className="px-4 py-3 font-semibold">Demand Velocity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marketSegments.map((row: any, idx: number) => (
                          <tr key={idx} className="border-b border-border/50 hover:bg-muted/20">
                            <td className="px-4 py-4 font-semibold capitalize">{row.vehicleSegment}</td>
                            <td className="px-4 py-4 font-mono">${row.medianPrice?.toLocaleString() || "—"}</td>
                            <td className="px-4 py-4">{row.inventoryCount || 0} units</td>
                            <td className="px-4 py-4">
                              <Badge variant={row.demandVelocity === "High" ? "default" : "secondary"}
                                     className={row.demandVelocity === "High" ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
                              >
                                {row.demandVelocity || "—"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* DEALER ANALYTICS TAB */}
        {activeNav === "dealers" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-1">Dealer Intelligence Layer</h2>
              <p className="text-muted-foreground">Tracking dealer behavior, pricing aggressiveness, and negotiation likelihood.</p>
            </div>

            <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Top Volume Dealers (San Antonio Radius)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-y border-border/50">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Dealer</th>
                        <th className="px-4 py-3 font-semibold text-center">Rating</th>
                        <th className="px-4 py-3 font-semibold">Avg vs Market</th>
                        <th className="px-4 py-3 font-semibold">Avg Days to Sell</th>
                        <th className="px-4 py-3 font-semibold">Deal Freq.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DEALER_DATA.map((dealer, idx) => (
                        <tr key={idx} className="border-b border-border/50 hover:bg-muted/20">
                          <td className="px-4 py-4 font-semibold flex items-center gap-2">
                            <Store className="w-4 h-4 text-primary" />
                            {dealer.name}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs
                              ${dealer.score.includes('A') ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30' : 'bg-blue-500/10 text-blue-500 border border-blue-500/30'}
                            `}>
                              {dealer.score}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <Badge variant="outline" className={`font-mono border ${dealer.avgMarkup < 0 ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5' : 'text-red-500 border-red-500/30 bg-red-500/5'}`}>
                              {dealer.avgMarkup}%
                            </Badge>
                          </td>
                          <td className="px-4 py-4">{dealer.daysToSell} days</td>
                          <td className="px-4 py-4">
                            <Badge variant={dealer.dealFreq === "High" ? "default" : "secondary"}>
                              {dealer.dealFreq}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Negotiation Intelligence
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 border border-border/50 rounded-lg bg-background">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-semibold">North Park Toyota</h4>
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">High Likelihood</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">Typical Negotiation Range:</p>
                    <div className="text-xl font-mono font-bold">$800 – $1,400</div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Dealer Score Methodology</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-sm">
                    <li className="flex justify-between items-center">
                      <span className="text-muted-foreground">Price Competitiveness</span>
                      <span className="font-medium">40%</span>
                    </li>
                    <li className="flex justify-between items-center">
                      <span className="text-muted-foreground">Inventory Turnover</span>
                      <span className="font-medium">30%</span>
                    </li>
                    <li className="flex justify-between items-center">
                      <span className="text-muted-foreground">Deal Frequency</span>
                      <span className="font-medium">20%</span>
                    </li>
                    <li className="flex justify-between items-center">
                      <span className="text-muted-foreground">Consumer Reputation</span>
                      <span className="font-medium">10%</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

function DealsList({ deals, getScoreColor, getScoreBg, emptyMessage }: { deals: any[]; getScoreColor: (n: number) => string; getScoreBg: (n: number) => string; emptyMessage?: string }) {
  if (deals.length === 0) {
    return (
      <Card className="bg-card/40 border-border/50 p-12 text-center flex flex-col items-center justify-center">
        <Car className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{emptyMessage || "No deals found matching your criteria."}</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 space-y-6">
        {deals.map((deal: any) => {
          const l = deal.listing;
          const s = deal.score;
          const savings = s.savingsAmount || 0;
          const breakdown = s.scoreBreakdown || {};
          const image = getImage(l.make, l.model, l.imageUrls);

          return (
            <Card key={l.id} className="overflow-hidden border-border/40 hover:border-primary/30 transition-all duration-300 bg-card/60 backdrop-blur-md shadow-lg shadow-black/5 group" data-testid={`card-deal-${l.id}`}>
              <div className="p-0">
                <div className="flex flex-col sm:flex-row">
                  <div className="w-full sm:w-[280px] h-[200px] relative overflow-hidden bg-muted flex-shrink-0">
                    <img 
                      src={image} 
                      alt={`${l.year} ${l.make} ${l.model}`}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute top-3 left-3 flex flex-col gap-2">
                      <Badge className="bg-black/70 backdrop-blur-md text-white border-none font-bold px-3 py-1 text-sm">
                        {l.year}
                      </Badge>
                    </div>
                    
                    {savings > 1000 && (
                      <div className="absolute bottom-3 right-3">
                        <Badge className="bg-emerald-500/90 hover:bg-emerald-500 text-white border-none font-bold px-3 py-1 shadow-lg flex items-center gap-1.5">
                          <Flame className="w-4 h-4" /> 
                          ${Math.round(savings).toLocaleString()} BELOW MARKET
                        </Badge>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-2xl font-bold tracking-tight text-foreground leading-none mb-1 group-hover:text-primary transition-colors" data-testid={`text-title-${l.id}`}>
                            {l.make} {l.model}
                          </h3>
                          <p className="text-muted-foreground">{l.trim || ""}</p>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <span className="text-3xl font-bold tracking-tighter" data-testid={`text-price-${l.id}`}>
                            {l.price ? `$${l.price.toLocaleString()}` : "—"}
                          </span>
                          {s.marketValueEst && (
                            <div className="flex items-center text-sm text-muted-foreground gap-1">
                              <span>Est: <span className="line-through">${Math.round(s.marketValueEst).toLocaleString()}</span></span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-4">
                        <Badge variant="outline" className={`border ${getScoreBg(s.dealScore)} ${getScoreColor(s.dealScore)} px-2.5 py-1`} data-testid={`badge-score-${l.id}`}>
                          Score: <strong className="ml-1 text-base">{Math.round(s.dealScore)}</strong>
                        </Badge>
                        
                        {l.mileage && (
                          <Badge variant="secondary" className="bg-muted px-2.5 py-1 text-xs">
                            <Gauge className="w-3 h-3 mr-1" />
                            {l.mileage.toLocaleString()} mi
                          </Badge>
                        )}
                        
                        {l.distance != null && (
                          <Badge variant="secondary" className="bg-muted px-2.5 py-1 text-xs">
                            <MapPin className="w-3 h-3 mr-1" />
                            {l.city}{l.distance > 0 ? `, ${l.distance} mi` : ""}
                          </Badge>
                        )}

                        {l.titleStatus === "salvage" && (
                          <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20 px-2.5 py-1 text-xs">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Salvage Title
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm mt-2 pt-4 border-t border-border/50">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1"><Info className="w-3.5 h-3.5"/> Confidence</span>
                        <span className="font-semibold flex items-center gap-1 text-emerald-500">
                          {s.confidence ? `${Math.round(s.confidence * 100)}%` : "—"} 
                          {s.compCount ? <span className="text-xs text-muted-foreground font-normal">({s.compCount} comps)</span> : null}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-orange-500"/> Velocity</span>
                        <span className={`font-bold ${(s.velocityPrediction || 0) > 60 ? 'text-orange-500' : ''}`}>
                          {s.velocityPrediction ? `${Math.round(s.velocityPrediction)}%` : "—"} 
                          <span className="text-xs text-muted-foreground font-normal"> in 7d</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="intelligence" className="border-none">
                    <AccordionTrigger className="px-5 py-3 hover:bg-muted/30 hover:no-underline text-sm font-semibold text-primary" data-testid={`button-expand-${l.id}`}>
                      View Deep Intelligence & Analytics
                    </AccordionTrigger>
                    <AccordionContent className="p-0 border-t border-border/50">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-5 bg-card/30">
                        <div className="space-y-3">
                          <h4 className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Score Breakdown</h4>
                          <div className="space-y-2 text-sm">
                            {[
                              { label: "Price vs Value", val: breakdown.priceAdvantage, max: 40 },
                              { label: "Mileage", val: breakdown.mileageAdvantage, max: 15 },
                              { label: "Local Demand", val: breakdown.localDemand, max: 15 },
                              { label: "Reliability", val: breakdown.reliability, max: 10 },
                              { label: "Seller Quality", val: breakdown.sellerQuality, max: 10 },
                              { label: "Price Drop Signal", val: breakdown.priceDropSignal, max: 10 },
                            ].map((item) => (
                              <div key={item.label} className="flex justify-between items-center">
                                <span>{item.label}</span>
                                <span className={`font-mono ${(item.val || 0) > item.max * 0.6 ? 'text-emerald-500' : 'text-blue-500'}`}>+{item.val || 0}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Reasons</h4>
                          <ul className="space-y-2 text-sm">
                            {(s.scoreReasons || []).map((reason: string, idx: number) => (
                              <li key={idx} className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                <span className="text-foreground/80">{reason}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Professional Tools</h4>
                          
                          {s.wholesaleEstimate && (
                            <div className="border border-border/50 rounded-md p-3 bg-background relative overflow-hidden">
                              <p className="text-xs text-muted-foreground mb-1">Flip Potential</p>
                              <div className="flex justify-between items-end">
                                <span className="text-sm font-medium">Est. Wholesale</span>
                                <span className="font-mono font-bold">${s.wholesaleEstimate.toLocaleString()}</span>
                              </div>
                              {s.marketValueEst && (
                                <div className="text-xs text-emerald-500 mt-1 text-right font-bold">
                                  +${Math.round(s.marketValueEst - s.wholesaleEstimate).toLocaleString()} margin
                                </div>
                              )}
                            </div>
                          )}

                          {s.suggestedOffer && (
                            <div className="border border-primary/30 rounded-md p-3 bg-primary/5">
                              <div className="flex justify-between items-center mb-1">
                                <p className="text-xs font-bold text-primary flex items-center gap-1">
                                  <Target className="w-3.5 h-3.5" /> AI Target Offer
                                </p>
                              </div>
                              <div className="text-xl font-bold tracking-tight">${s.suggestedOffer.toLocaleString()}</div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-muted/20 border-t border-border/50">
                        <div className="flex items-center gap-2 text-sm">
                          {l.isDealer ? <Store className="w-4 h-4 text-primary" /> : <AlertTriangle className="w-4 h-4 text-orange-500" />}
                          <span className="font-medium">{l.dealerName || "Private Seller"}</span>
                        </div>
                        <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                          Check Financing Options
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="space-y-6">
        <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              SA Local Demand
            </CardTitle>
            <CardDescription>Segments trending in San Antonio.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">Full-Size Trucks</span>
                <span className="text-emerald-500 font-bold">+18%</span>
              </div>
              <Progress value={85} className="h-2 bg-muted/50" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">Mid-Size Trucks</span>
                <span className="text-emerald-500 font-bold">+14%</span>
              </div>
              <Progress value={75} className="h-2 bg-muted/50" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">Large SUVs</span>
                <span className="text-emerald-500 font-bold">+11%</span>
              </div>
              <Progress value={65} className="h-2 bg-muted/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Gauge className="w-5 h-5 text-blue-500" />
              Scoring Model
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              <li className="flex justify-between items-center">
                <span className="text-muted-foreground">Price vs Market Value</span>
                <span className="font-medium">40%</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-muted-foreground">Mileage Advantage</span>
                <span className="font-medium">15%</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-muted-foreground">Local SA Demand</span>
                <span className="font-medium">15%</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-muted-foreground">Reliability</span>
                <span className="font-medium">10%</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-muted-foreground">Seller Quality</span>
                <span className="font-medium">10%</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-muted-foreground">Price Drop Signal</span>
                <span className="font-medium">10%</span>
              </li>
            </ul>
            <div className="mt-4 pt-4 border-t border-border/50 text-xs text-muted-foreground">
              <AlertTriangle className="w-3 h-3 inline mr-1 text-orange-500" /> Heavy penalties for salvage/rebuilt titles.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
