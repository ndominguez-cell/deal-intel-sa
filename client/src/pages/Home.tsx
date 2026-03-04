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
  Info,
  LineChart,
  Store,
  Zap,
  Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Area, AreaChart, ResponsiveContainer, Line, LineChart as RechartsLineChart, XAxis, YAxis, Tooltip } from "recharts";

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

const MARKET_INDEX_DATA = [
  { segment: "Full-Size Trucks", avgPrice: 41200, change30d: 4.2, inventory: 3420, velocity: "High" },
  { segment: "Mid-Size Trucks", avgPrice: 34900, change30d: 3.1, inventory: 1850, velocity: "High" },
  { segment: "Large SUVs", avgPrice: 38600, change30d: 2.7, inventory: 2100, velocity: "Medium" },
  { segment: "Mid-Size SUVs", avgPrice: 28400, change30d: 0.5, inventory: 4200, velocity: "Medium" },
  { segment: "Sedans", avgPrice: 21400, change30d: -1.5, inventory: 2715, velocity: "Low" },
];

const DEALER_DATA = [
  { name: "North Park Toyota", score: "A+", avgMarkup: -3.4, daysToSell: 21, dropFreq: 1.8, listings: 1842, dealFreq: "High" },
  { name: "Bluebonnet Ford", score: "A", avgMarkup: -2.1, daysToSell: 24, dropFreq: 1.2, listings: 1450, dealFreq: "High" },
  { name: "Ancira Jeep", score: "B+", avgMarkup: -0.5, daysToSell: 31, dropFreq: 2.1, listings: 980, dealFreq: "Medium" },
  { name: "Gunn Honda", score: "B", avgMarkup: 1.2, daysToSell: 28, dropFreq: 0.8, listings: 1120, dealFreq: "Medium" },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState("top-deals");
  const [activeNav, setActiveNav] = useState("intelligence");
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
            <nav className="flex items-center gap-4 text-sm font-medium h-16">
              <button 
                onClick={() => setActiveNav("intelligence")}
                className={`h-full px-2 transition-colors ${activeNav === "intelligence" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-primary"}`}
              >
                Intelligence Hub
              </button>
              <button 
                onClick={() => setActiveNav("dealers")}
                className={`h-full px-2 transition-colors ${activeNav === "dealers" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-primary"}`}
              >
                Dealer Analytics
              </button>
              <button 
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
                  <TabsTrigger value="high-intent" className="py-2 px-4 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" /> Fast Sellers
                  </TabsTrigger>
                </TabsList>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Select defaultValue="score_desc">
                    <SelectTrigger className="w-full sm:w-[180px] bg-card border-border/50">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="score_desc">Best Deals</SelectItem>
                      <SelectItem value="velocity_desc">Highest Probability to Sell</SelectItem>
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
                        <Card key={deal.id} className="overflow-hidden border-border/40 hover:border-primary/30 transition-all duration-300 bg-card/60 backdrop-blur-md shadow-lg shadow-black/5 group">
                          <div className="p-0">
                            {/* Header Section */}
                            <div className="flex flex-col sm:flex-row">
                              {/* Image */}
                              <div className="w-full sm:w-[280px] h-[200px] relative overflow-hidden bg-muted flex-shrink-0">
                                <img 
                                  src={deal.image} 
                                  alt={`${deal.year} ${deal.make} ${deal.model}`}
                                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
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
                                      <h3 className="text-2xl font-bold tracking-tight text-foreground leading-none mb-1 group-hover:text-primary transition-colors">
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
                                    <span className="text-muted-foreground flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-orange-500"/> Velocity Predict.</span>
                                    <span className={`font-bold ${deal.velocityProb > 70 ? 'text-orange-500' : ''}`}>{deal.velocityProb}% <span className="text-xs text-muted-foreground font-normal">in 7d</span></span>
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
                                          {deal.sellerType === 'dealer' ? <Store className="w-4 h-4 text-primary" /> : <AlertTriangle className="w-4 h-4 text-orange-500" />}
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
                                      
                                      <div className="border border-border/50 rounded-md p-3 bg-background relative overflow-hidden">
                                        <div className="absolute -right-2 -bottom-2 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl"></div>
                                        <p className="text-xs text-muted-foreground mb-1 relative z-10">Flip Potential (Wholesale/Retail)</p>
                                        <div className="flex justify-between items-end relative z-10">
                                          <div>
                                            <span className="text-sm font-medium">Est. Margin</span>
                                          </div>
                                          <span className="text-lg font-bold text-emerald-500">+${(deal.marketValue - deal.wholesaleValue).toLocaleString()}</span>
                                        </div>
                                      </div>

                                      <div className="border border-primary/30 rounded-md p-3 bg-primary/5 relative overflow-hidden">
                                        <div className="absolute -right-2 -bottom-2 w-16 h-16 bg-primary/20 rounded-full blur-xl"></div>
                                        <div className="flex justify-between items-center mb-1 relative z-10">
                                          <p className="text-xs font-bold text-primary flex items-center gap-1">
                                            <Target className="w-3.5 h-3.5" /> AI Target Offer
                                          </p>
                                          <span className="text-xs font-semibold">{deal.aiAcceptanceProb}% Success</span>
                                        </div>
                                        <div className="text-xl font-bold tracking-tight relative z-10">${deal.aiSuggestedOffer.toLocaleString()}</div>
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
                          <Zap className="w-5 h-5 text-orange-500" />
                          Buyer Intent Engine
                        </CardTitle>
                        <CardDescription>Predicting which vehicles will sell fast.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="p-4 bg-background border border-border/50 rounded-lg">
                          <p className="text-sm font-medium mb-3">Model Accuracy (Last 30 days): <span className="text-emerald-500 font-bold">84%</span></p>
                          <div className="space-y-2 text-xs text-muted-foreground">
                            <p>Key drivers currently weighted:</p>
                            <ul className="list-disc pl-4 space-y-1">
                              <li>Price Advantage vs Comps (35%)</li>
                              <li>Local SA Demand Score (20%)</li>
                              <li>Days on Market Velocity (15%)</li>
                              <li>Dealer historical speed (15%)</li>
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="recently-dropped">
                <Card className="bg-card/40 border-border/50 p-12 text-center flex flex-col items-center justify-center">
                  <TrendingDown className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-bold mb-2">Recently Dropped Deals</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">This view will show vehicles that have experienced a price drop within the last 48 hours.</p>
                </Card>
              </TabsContent>

              <TabsContent value="high-intent">
                <Card className="bg-card/40 border-border/50 p-12 text-center flex flex-col items-center justify-center">
                  <Zap className="w-12 h-12 text-orange-500 mb-4" />
                  <h3 className="text-xl font-bold mb-2">High Velocity Forecast</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">Listings with &gt;70% probability of selling within the next 7 days based on our Buyer Intent Engine.</p>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* MARKET INDEX TAB */}
        {activeNav === "market" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-3xl font-bold tracking-tight mb-1">San Antonio Vehicle Price Index</h2>
                <p className="text-muted-foreground">Proprietary regional market intelligence tracking real-time pricing trends.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline">Export Data</Button>
                <Button>API Access</Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 bg-card/50 border-border/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Segment Performance (30 Days)</CardTitle>
                  <CardDescription>Average price changes across major vehicle segments in SA.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-y border-border/50">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Segment</th>
                          <th className="px-4 py-3 font-semibold">Avg Price</th>
                          <th className="px-4 py-3 font-semibold">30-Day Change</th>
                          <th className="px-4 py-3 font-semibold">Active Inventory</th>
                          <th className="px-4 py-3 font-semibold">Demand Velocity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MARKET_INDEX_DATA.map((row, idx) => (
                          <tr key={idx} className="border-b border-border/50 hover:bg-muted/20">
                            <td className="px-4 py-4 font-semibold">{row.segment}</td>
                            <td className="px-4 py-4 font-mono">${row.avgPrice.toLocaleString()}</td>
                            <td className={`px-4 py-4 font-bold ${row.change30d > 0 ? 'text-emerald-500' : row.change30d < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                              {row.change30d > 0 ? '+' : ''}{row.change30d}%
                            </td>
                            <td className="px-4 py-4">{row.inventory.toLocaleString()} units</td>
                            <td className="px-4 py-4">
                              <Badge variant={row.velocity === "High" ? "default" : row.velocity === "Medium" ? "secondary" : "outline"}
                                     className={row.velocity === "High" ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
                              >
                                {row.velocity}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Index Composition</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span>SUVs / Crossovers</span>
                        <span className="font-mono">44%</span>
                      </div>
                      <Progress value={44} className="h-2 bg-muted/50" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Trucks</span>
                        <span className="font-mono">36%</span>
                      </div>
                      <Progress value={36} className="h-2 bg-muted/50" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Sedans / Coupes</span>
                        <span className="font-mono">20%</span>
                      </div>
                      <Progress value={20} className="h-2 bg-muted/50" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-primary/5 border-primary/20 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <h3 className="font-bold mb-2 flex items-center gap-2 text-primary">
                      <Info className="w-5 h-5" /> Enterprise Data Use
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Our proprietary market index data is available for dealerships, lenders, and insurance partners.
                    </p>
                    <Button variant="outline" className="w-full bg-background">Request Data Sample</Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* DEALER ANALYTICS TAB */}
        {activeNav === "dealers" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-3xl font-bold tracking-tight mb-1">Dealer Intelligence Layer</h2>
                <p className="text-muted-foreground">Tracking dealer behavior, pricing aggressiveness, and negotiation likelihood over time.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Top Volume Dealers (San Antonio Radius)</CardTitle>
                  <CardDescription>Ranked by pricing competitiveness and deal frequency.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-y border-border/50">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Dealer</th>
                          <th className="px-4 py-3 font-semibold text-center">Deal Rating</th>
                          <th className="px-4 py-3 font-semibold">Avg Price vs Market</th>
                          <th className="px-4 py-3 font-semibold">Avg Days to Sell</th>
                          <th className="px-4 py-3 font-semibold">Drop Freq. (per vehicle)</th>
                          <th className="px-4 py-3 font-semibold">Deal Frequency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {DEALER_DATA.map((dealer, idx) => (
                          <tr key={idx} className="border-b border-border/50 hover:bg-muted/20">
                            <td className="px-4 py-4 font-semibold flex items-center gap-2">
                              <Store className="w-4 h-4 text-primary" />
                              {dealer.name}
                              <span className="text-xs font-normal text-muted-foreground ml-2">({dealer.listings} listings)</span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold
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
                            <td className="px-4 py-4">{dealer.dropFreq} drops</td>
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
                    <p className="text-sm text-muted-foreground mb-4">
                      Our system analyzes historical price drops and final sale prices to determine which dealers are most likely to negotiate, and by how much.
                    </p>
                    <div className="space-y-4">
                      <div className="p-4 border border-border/50 rounded-lg bg-background">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-semibold">North Park Toyota</h4>
                          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">High Likelihood</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">Typical Negotiation Range:</p>
                        <div className="text-xl font-mono font-bold">$800 – $1,400</div>
                      </div>
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
                        <span className="text-muted-foreground">Inventory Turnover (Velocity)</span>
                        <span className="font-medium">30%</span>
                      </li>
                      <li className="flex justify-between items-center">
                        <span className="text-muted-foreground">Deal Frequency (Underpriced)</span>
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
          </div>
        )}

      </main>
    </div>
  );
}