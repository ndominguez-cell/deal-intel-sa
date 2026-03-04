import { useState } from "react";
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
  Percent,
  CheckCircle2,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

// Mock data enhanced with new intelligence features
const MOCK_DEALS = [
  {
    id: "deal_1",
    year: 2021,
    make: "Toyota",
    model: "Tacoma",
    trim: "TRD Off-Road",
    price: 34500,
    marketValue: 38000,
    confidence: 87,
    compsCount: 14,
    mileage: 42000,
    dealScore: 94,
    scoreBreakdown: { price: 38, mileage: 9, demand: 18, reliability: 12, dealer: 8, drops: 9 },
    city: "San Antonio",
    state: "TX",
    distance: 12,
    sellerType: "dealer",
    sellerName: "North Park Toyota",
    dealerAggressiveness: "-3.8%",
    titleStatus: "clean",
    riskFlags: [],
    daysListed: 18,
    priceDrops: 2,
    lastDropDays: 3,
    velocityProb: 72,
    wholesaleValue: 33900,
    aiSuggestedOffer: 33200,
    aiAcceptanceProb: 64,
    priceHistory: [
      { day: "1", price: 37900 },
      { day: "7", price: 37900 },
      { day: "8", price: 36500 },
      { day: "14", price: 36500 },
      { day: "15", price: 34500 },
      { day: "18", price: 34500 }
    ],
    image: "https://images.unsplash.com/photo-1629897048514-3dd7414cc710?w=800&q=80",
    reasons: [
      "Price is $3,500 below estimated market value",
      "High local demand for Trucks in San Antonio",
      "Excellent reliability score for Toyota Tacoma",
      "Recent price drop of $1,200 detected"
    ]
  },
  {
    id: "deal_2",
    year: 2022,
    make: "Ford",
    model: "F-150",
    trim: "XLT",
    price: 39900,
    marketValue: 43200,
    confidence: 92,
    compsCount: 28,
    mileage: 35000,
    dealScore: 91,
    scoreBreakdown: { price: 35, mileage: 14, demand: 17, reliability: 10, dealer: 9, drops: 6 },
    city: "New Braunfels",
    state: "TX",
    distance: 32,
    sellerType: "dealer",
    sellerName: "Bluebonnet Ford",
    dealerAggressiveness: "-2.1%",
    titleStatus: "clean",
    riskFlags: ["Rental history"],
    daysListed: 24,
    priceDrops: 1,
    lastDropDays: 1,
    velocityProb: 85,
    wholesaleValue: 38500,
    aiSuggestedOffer: 38900,
    aiAcceptanceProb: 45,
    priceHistory: [
      { day: "1", price: 41000 },
      { day: "23", price: 41000 },
      { day: "24", price: 39900 }
    ],
    image: "https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=800&q=80",
    reasons: [
      "Price is $3,300 below estimated market value",
      "Strong local demand for F-150s in Bexar/Comal area",
      "Mileage is 15% lower than comparable listings"
    ]
  },
  {
    id: "deal_3",
    year: 2020,
    make: "Chevrolet",
    model: "Tahoe",
    trim: "LT",
    price: 42500,
    marketValue: 44000,
    confidence: 76,
    compsCount: 6,
    mileage: 68000,
    dealScore: 86,
    scoreBreakdown: { price: 28, mileage: 7, demand: 15, reliability: 9, dealer: 12, drops: 15 },
    city: "San Antonio",
    state: "TX",
    distance: 8,
    sellerType: "private",
    sellerName: "Private Seller",
    dealerAggressiveness: "N/A",
    titleStatus: "clean",
    riskFlags: ["3 previous owners"],
    daysListed: 45,
    priceDrops: 3,
    lastDropDays: 5,
    velocityProb: 40,
    wholesaleValue: 39000,
    aiSuggestedOffer: 39500,
    aiAcceptanceProb: 78,
    priceHistory: [
      { day: "1", price: 46000 },
      { day: "15", price: 45000 },
      { day: "30", price: 44000 },
      { day: "40", price: 42500 },
      { day: "45", price: 42500 }
    ],
    image: "https://images.unsplash.com/photo-1563720223185-11003d516935?w=800&q=80",
    reasons: [
      "Fair price, slightly below market median",
      "High local demand for large SUVs",
      "Private seller - potential negotiation room"
    ]
  }
];

export default function Home() {
  const [activeTab, setActiveTab] = useState("top-deals");
  const [searchQuery, setSearchQuery] = useState("");

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-500";
    if (score >= 80) return "text-blue-500";
    if (score >= 70) return "text-yellow-500";
    return "text-orange-500";
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return "bg-emerald-500/10 border-emerald-500/30";
    if (score >= 80) return "bg-blue-500/10 border-blue-500/30";
    if (score >= 70) return "bg-yellow-500/10 border-yellow-500/30";
    return "bg-orange-500/10 border-orange-500/30";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return "bg-emerald-500 hover:bg-emerald-600 text-white";
    if (score >= 80) return "bg-blue-500 hover:bg-blue-600 text-white";
    if (score >= 70) return "bg-yellow-500 hover:bg-yellow-600 text-white";
    return "bg-orange-500 hover:bg-orange-600 text-white";
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header/Nav */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Car className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight leading-none">DealIntel<span className="text-primary">SA</span></h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Automotive Market Intelligence</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-6">
            <nav className="flex items-center gap-4 text-sm font-medium">
              <a href="#" className="text-primary border-b-2 border-primary py-5">Intelligence Hub</a>
              <a href="#" className="text-muted-foreground transition-colors hover:text-primary py-5">Dealer Analytics</a>
              <a href="#" className="text-muted-foreground transition-colors hover:text-primary py-5">Demand Models</a>
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
        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-1">Market Intelligence</h2>
            <p className="text-muted-foreground">Analyzing 14,285 active listings within 100 miles of San Antonio.</p>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search make, model, or VIN..." 
                className="pl-9 bg-card border-border/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="secondary" className="gap-2">
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
            <CardContent className="p-6 flex flex-col justify-between h-full gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Below Market Today</p>
                  <h3 className="text-3xl font-bold text-emerald-500">124</h3>
                </div>
                <div className="p-2 bg-emerald-500/10 rounded-md">
                  <Flame className="w-5 h-5 text-emerald-500" />
                </div>
              </div>
              <div className="flex items-center text-xs text-muted-foreground font-medium">
                <span>Highly actionable signals detected</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
            <CardContent className="p-6 flex flex-col justify-between h-full gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Avg Deal Score</p>
                  <h3 className="text-2xl font-bold">68<span className="text-base font-normal text-muted-foreground">/100</span></h3>
                </div>
                <div className="p-2 bg-primary/10 rounded-md">
                  <Gauge className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div className="flex items-center text-xs text-muted-foreground">
                <span>Market baseline</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
            <CardContent className="p-6 flex flex-col justify-between h-full gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Price Drops (24h)</p>
                  <h3 className="text-2xl font-bold">842</h3>
                </div>
                <div className="p-2 bg-orange-500/10 rounded-md">
                  <TrendingDown className="w-5 h-5 text-orange-500" />
                </div>
              </div>
              <div className="flex items-center text-xs text-emerald-500 font-medium">
                <TrendingUp className="w-3 h-3 mr-1" />
                <span>+12% vs 30d avg</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary text-primary-foreground border-none overflow-hidden relative">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
            <CardContent className="p-6 flex flex-col justify-between h-full gap-4 relative z-10">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-primary-foreground/80 mb-1">Engine Status</p>
                  <h3 className="text-2xl font-bold">Online</h3>
                </div>
                <div className="p-2 bg-white/20 rounded-md">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="flex flex-col gap-1 text-xs text-primary-foreground/90">
                <div className="flex items-center justify-between">
                  <span>Last Scrape</span>
                  <span>14 mins ago</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Scored</span>
                  <span>3 mins ago</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Area */}
        <Tabs defaultValue="top-deals" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <TabsList className="bg-card/50 border border-border/50 flex-wrap h-auto p-1">
              <TabsTrigger value="top-deals" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 px-4">
                Top Signals (Score 85+)
              </TabsTrigger>
              <TabsTrigger value="recently-dropped" className="py-2 px-4">
                Recently Dropped
              </TabsTrigger>
              <TabsTrigger value="market-trends" className="py-2 px-4">
                Market Trends
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select defaultValue="score_desc">
                <SelectTrigger className="w-full sm:w-[180px] bg-card border-border/50">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score_desc">Best Deals</SelectItem>
                  <SelectItem value="newest">Newest Listings</SelectItem>
                  <SelectItem value="savings_desc">Largest Savings</SelectItem>
                  <SelectItem value="mileage_asc">Lowest Mileage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <TabsContent value="top-deals" className="m-0 space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              
              {/* Deals List */}
              <div className="xl:col-span-2 space-y-6">
                {MOCK_DEALS.map((deal) => {
                  const savings = deal.marketValue - deal.price;
                  return (
                    <Card key={deal.id} className="overflow-hidden border-border/40 hover:border-primary/30 transition-all duration-300 bg-card/60 backdrop-blur-md shadow-lg shadow-black/5">
                      <div className="p-0">
                        {/* Header Section */}
                        <div className="flex flex-col sm:flex-row">
                          {/* Image */}
                          <div className="w-full sm:w-[280px] h-[200px] relative overflow-hidden bg-muted flex-shrink-0">
                            <img 
                              src={deal.image} 
                              alt={`${deal.year} ${deal.make} ${deal.model}`}
                              className="w-full h-full object-cover transition-transform duration-700 hover:scale-110"
                            />
                            <div className="absolute top-3 left-3 flex flex-col gap-2">
                              <Badge className="bg-black/70 backdrop-blur-md text-white border-none font-bold px-3 py-1 text-sm">
                                {deal.year}
                              </Badge>
                            </div>
                            
                            {savings > 0 && (
                              <div className="absolute bottom-3 right-3">
                                <Badge className="bg-emerald-500/90 hover:bg-emerald-500 text-white border-none font-bold px-3 py-1 shadow-lg flex items-center gap-1.5 animate-pulse">
                                  <Flame className="w-4 h-4" /> 
                                  ${savings.toLocaleString()} BELOW MARKET
                                </Badge>
                              </div>
                            )}
                          </div>

                          {/* Top Info */}
                          <div className="flex-1 p-5 flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <h3 className="text-2xl font-bold tracking-tight text-foreground leading-none mb-1">
                                    {deal.make} {deal.model}
                                  </h3>
                                  <p className="text-muted-foreground">{deal.trim}</p>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                  <span className="text-3xl font-bold tracking-tighter">${deal.price.toLocaleString()}</span>
                                  <div className="flex items-center text-sm text-muted-foreground gap-1">
                                    <span>Est. Value: <span className="line-through">${deal.marketValue.toLocaleString()}</span></span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2 mb-4">
                                <Badge variant="outline" className={`border ${getScoreBg(deal.dealScore)} ${getScoreColor(deal.dealScore)} px-2.5 py-1`}>
                                  Score: <strong className="ml-1 text-base">{deal.dealScore}</strong>
                                </Badge>
                                
                                <Badge variant="secondary" className="bg-muted px-2.5 py-1 text-xs">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {deal.daysListed} days listed
                                </Badge>
                                
                                <Badge variant="secondary" className="bg-muted px-2.5 py-1 text-xs">
                                  <Gauge className="w-3 h-3 mr-1" />
                                  {deal.mileage.toLocaleString()} mi
                                </Badge>

                                {deal.riskFlags.map((flag, idx) => (
                                  <Badge key={idx} variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20 px-2.5 py-1 text-xs">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    {flag}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm mt-2 pt-4 border-t border-border/50">
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground flex items-center gap-1"><Info className="w-3.5 h-3.5"/> Confidence</span>
                                <span className="font-semibold flex items-center gap-1 text-emerald-500">
                                  {deal.confidence}% <span className="text-xs text-muted-foreground font-normal">({deal.compsCount} comps)</span>
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Velocity Predict.</span>
                                <span className="font-semibold">{deal.velocityProb}% <span className="text-xs text-muted-foreground font-normal font-normal">in 7d</span></span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Expandable Intelligence Section */}
                        <Accordion type="single" collapsible className="w-full">
                          <AccordionItem value="intelligence" className="border-none">
                            <AccordionTrigger className="px-5 py-3 hover:bg-muted/30 hover:no-underline text-sm font-semibold text-primary">
                              View Deep Intelligence & Analytics
                            </AccordionTrigger>
                            <AccordionContent className="p-0 border-t border-border/50">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-5 bg-card/30">
                                
                                {/* Scoring Breakdown */}
                                <div className="space-y-3">
                                  <h4 className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Score Breakdown</h4>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between items-center">
                                      <span>Price vs Value</span>
                                      <span className="font-mono text-emerald-500">+{deal.scoreBreakdown.price}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span>Mileage</span>
                                      <span className="font-mono text-emerald-500">+{deal.scoreBreakdown.mileage}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span>Local Demand</span>
                                      <span className="font-mono text-emerald-500">+{deal.scoreBreakdown.demand}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span>Reliability</span>
                                      <span className="font-mono text-blue-500">+{deal.scoreBreakdown.reliability}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span>Dealer Quality</span>
                                      <span className="font-mono text-blue-500">+{deal.scoreBreakdown.dealer}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Price History & Dealer */}
                                <div className="space-y-3">
                                  <h4 className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Price & Dealer Data</h4>
                                  
                                  <div className="bg-background rounded-md p-3 border border-border/50">
                                    <div className="flex justify-between text-xs mb-2">
                                      <span className="text-muted-foreground">Drops: <strong className="text-foreground">{deal.priceDrops}</strong></span>
                                      <span className="text-muted-foreground">Last: <strong className="text-foreground">{deal.lastDropDays}d ago</strong></span>
                                    </div>
                                    <div className="h-12 w-full">
                                      <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={deal.priceHistory}>
                                          <Area type="stepAfter" dataKey="price" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/.1)" strokeWidth={2} />
                                        </AreaChart>
                                      </ResponsiveContainer>
                                    </div>
                                  </div>

                                  <div className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded-md">
                                    <div className="flex items-center gap-1.5">
                                      {deal.sellerType === 'dealer' ? <ShieldCheck className="w-4 h-4 text-primary" /> : <AlertTriangle className="w-4 h-4 text-orange-500" />}
                                      <span className="font-medium truncate max-w-[100px]" title={deal.sellerName}>{deal.sellerName}</span>
                                    </div>
                                    <div className="text-xs">
                                      Aggressiveness: <span className="font-bold text-emerald-500">{deal.dealerAggressiveness}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Professional Tools */}
                                <div className="space-y-3">
                                  <h4 className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Professional Tools</h4>
                                  
                                  <div className="border border-border/50 rounded-md p-3 bg-background">
                                    <p className="text-xs text-muted-foreground mb-1">Flip Potential (Wholesale/Retail)</p>
                                    <div className="flex justify-between items-end">
                                      <div>
                                        <span className="text-sm font-medium">Est. Margin</span>
                                      </div>
                                      <span className="text-lg font-bold text-emerald-500">+${(deal.marketValue - deal.wholesaleValue).toLocaleString()}</span>
                                    </div>
                                  </div>

                                  <div className="border border-border/50 rounded-md p-3 bg-primary/5">
                                    <div className="flex justify-between items-center mb-1">
                                      <p className="text-xs font-bold text-primary flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> AI Target Offer
                                      </p>
                                      <span className="text-xs font-semibold">{deal.aiAcceptanceProb}% Success</span>
                                    </div>
                                    <div className="text-xl font-bold tracking-tight">${deal.aiSuggestedOffer.toLocaleString()}</div>
                                  </div>
                                </div>
                                
                              </div>
                              
                              {/* Bottom Actions */}
                              <div className="flex flex-wrap items-center justify-end gap-3 p-4 bg-muted/20 border-t border-border/50">
                                <Button variant="outline" className="border-border/50">
                                  View on {deal.sellerType === 'dealer' ? 'Dealer Site' : 'Marketplace'}
                                </Button>
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

              {/* Sidebar Insights */}
              <div className="space-y-6">
                <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Flame className="w-5 h-5 text-orange-500" />
                      San Antonio Local Demand
                    </CardTitle>
                    <CardDescription>Segments currently trending higher than national average.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">Full-Size Trucks</span>
                        <span className="text-emerald-500 font-bold">+18%</span>
                      </div>
                      <Progress value={85} className="h-2 bg-muted/50" />
                      <p className="text-xs text-muted-foreground mt-1 text-right">F-150, Silverado, Ram 1500</p>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">Mid-Size Trucks</span>
                        <span className="text-emerald-500 font-bold">+14%</span>
                      </div>
                      <Progress value={75} className="h-2 bg-muted/50" />
                      <p className="text-xs text-muted-foreground mt-1 text-right">Tacoma, Colorado</p>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">Large SUVs</span>
                        <span className="text-emerald-500 font-bold">+11%</span>
                      </div>
                      <Progress value={65} className="h-2 bg-muted/50" />
                      <p className="text-xs text-muted-foreground mt-1 text-right">Tahoe, Expedition, Yukon</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/40 border-border/50 backdrop-blur-sm overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -z-10"></div>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-primary" />
                      Dealer Analytics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="p-3 bg-background rounded-md border border-border/50">
                        <p className="text-sm font-medium mb-1">Most Aggressive Pricing</p>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">North Park Toyota</span>
                          <span className="font-bold text-emerald-500">-3.8% vs Mkt</span>
                        </div>
                      </div>
                      <div className="p-3 bg-background rounded-md border border-border/50">
                        <p className="text-sm font-medium mb-1">Highest Deal Frequency</p>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">Bluebonnet Ford</span>
                          <span className="font-bold">14 deals/wk</span>
                        </div>
                      </div>
                    </div>
                    <Button variant="link" className="w-full mt-2 text-primary text-xs">View Full Dealer Leaderboard</Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="market-trends">
            <Card className="bg-card/40 border-border/50 p-8">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Flame className="w-6 h-6 text-orange-500" />
                Market Heat Map
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Hottest Price Bands</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-orange-500/10 border border-orange-500/20 rounded-md">
                      <span className="font-bold">$15k – $25k</span>
                      <span className="text-orange-500 font-bold">+22% demand</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-orange-500/5 border border-orange-500/10 rounded-md">
                      <span className="font-bold">$25k – $35k</span>
                      <span className="text-orange-500 font-bold">+14% demand</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                      <span className="font-medium text-muted-foreground">$35k – $45k</span>
                      <span className="text-muted-foreground">Baseline</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Velocity Forecast</h4>
                  <p className="text-sm text-muted-foreground">
                    Vehicles priced at least 5% below market median in the $15k-$25k bracket are currently selling in an average of <strong className="text-foreground">8 days</strong> in the San Antonio area.
                  </p>
                  <div className="p-4 bg-primary/10 border border-primary/20 rounded-md mt-4">
                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <h5 className="font-bold text-sm">Seasonal Alert: Tax Season</h5>
                        <p className="text-xs text-muted-foreground mt-1">Model is applying a +5% demand modifier to the $15k-$25k segment through April.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}