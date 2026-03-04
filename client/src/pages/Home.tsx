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
  Gauge
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Mock data based on the user's requirements for San Antonio
const MOCK_DEALS = [
  {
    id: "deal_1",
    year: 2021,
    make: "Toyota",
    model: "Tacoma",
    trim: "TRD Off-Road",
    price: 34500,
    marketValue: 38000,
    mileage: 42000,
    dealScore: 94,
    city: "San Antonio",
    state: "TX",
    distance: 12,
    sellerType: "dealer",
    sellerName: "North Park Toyota",
    titleStatus: "clean",
    priceDrop: true,
    localDemandBoost: true,
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
    mileage: 35000,
    dealScore: 91,
    city: "New Braunfels",
    state: "TX",
    distance: 32,
    sellerType: "dealer",
    sellerName: "Bluebonnet Ford",
    titleStatus: "clean",
    priceDrop: false,
    localDemandBoost: true,
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
    mileage: 68000,
    dealScore: 86,
    city: "San Antonio",
    state: "TX",
    distance: 8,
    sellerType: "private",
    sellerName: "Private Seller",
    titleStatus: "clean",
    priceDrop: true,
    localDemandBoost: true,
    image: "https://images.unsplash.com/photo-1563720223185-11003d516935?w=800&q=80",
    reasons: [
      "Fair price, slightly below market median",
      "High local demand for large SUVs",
      "Private seller - potential negotiation room"
    ]
  },
  {
    id: "deal_4",
    year: 2019,
    make: "Honda",
    model: "Civic",
    trim: "EX",
    price: 18500,
    marketValue: 20500,
    mileage: 55000,
    dealScore: 88,
    city: "Boerne",
    state: "TX",
    distance: 28,
    sellerType: "dealer",
    sellerName: "Boerne Honda",
    titleStatus: "clean",
    priceDrop: false,
    localDemandBoost: false,
    image: "https://images.unsplash.com/photo-1605810731057-048c26ab8eb9?w=800&q=80",
    reasons: [
      "Excellent reliability rating",
      "Price is $2,000 below market value",
      "Low mileage for the year"
    ]
  },
  {
    id: "deal_5",
    year: 2021,
    make: "Jeep",
    model: "Wrangler",
    trim: "Unlimited Rubicon",
    price: 36000,
    marketValue: 39500,
    mileage: 48000,
    dealScore: 84,
    city: "San Antonio",
    state: "TX",
    distance: 15,
    sellerType: "dealer",
    sellerName: "Ancira Jeep",
    titleStatus: "clean",
    priceDrop: true,
    localDemandBoost: true,
    image: "https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=800&q=80",
    reasons: [
      "Highly sought after in local market",
      "Price reduced by $1,500 recently",
      "Priced aggressively against comparables"
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
    if (score >= 90) return "bg-emerald-500/10";
    if (score >= 80) return "bg-blue-500/10";
    if (score >= 70) return "bg-yellow-500/10";
    return "bg-orange-500/10";
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
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">San Antonio 100mi Radius</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-6">
            <nav className="flex items-center gap-4 text-sm font-medium">
              <a href="#" className="text-foreground transition-colors hover:text-primary">Dashboard</a>
              <a href="#" className="text-muted-foreground transition-colors hover:text-primary">Market Trends</a>
              <a href="#" className="text-muted-foreground transition-colors hover:text-primary">Saved Searches</a>
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
                  <p className="text-sm font-medium text-muted-foreground mb-1">Active Listings</p>
                  <h3 className="text-2xl font-bold">14,285</h3>
                </div>
                <div className="p-2 bg-blue-500/10 rounded-md">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                </div>
              </div>
              <div className="flex items-center text-xs text-emerald-500 font-medium">
                <TrendingUp className="w-3 h-3 mr-1" />
                <span>+2.4% from last week</span>
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
                <span>124 deals scored 85+ today</span>
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
          <div className="flex items-center justify-between">
            <TabsList className="bg-card/50 border border-border/50">
              <TabsTrigger value="top-deals" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                Top Deals (Score 85+)
              </TabsTrigger>
              <TabsTrigger value="recently-dropped">
                Recently Dropped
              </TabsTrigger>
              <TabsTrigger value="market-comps">
                Market Comps
              </TabsTrigger>
            </TabsList>

            <div className="hidden sm:flex items-center gap-2">
              <Select defaultValue="score_desc">
                <SelectTrigger className="w-[180px] bg-card border-border/50">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score_desc">Highest Score First</SelectItem>
                  <SelectItem value="savings_desc">Biggest Savings</SelectItem>
                  <SelectItem value="price_asc">Lowest Price</SelectItem>
                  <SelectItem value="distance_asc">Closest Distance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <TabsContent value="top-deals" className="m-0 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Deals List */}
              <div className="lg:col-span-2 space-y-4">
                {MOCK_DEALS.map((deal) => (
                  <Card key={deal.id} className="overflow-hidden border-border/40 hover:border-primary/30 transition-all duration-300 bg-card/40 backdrop-blur-sm group">
                    <div className="flex flex-col sm:flex-row h-full">
                      {/* Image Area */}
                      <div className="w-full sm:w-1/3 h-48 sm:h-auto relative overflow-hidden bg-muted">
                        <img 
                          src={deal.image} 
                          alt={`${deal.year} ${deal.make} ${deal.model}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-2 left-2 flex flex-col gap-2">
                          <Badge className="bg-background/80 backdrop-blur-md text-foreground border-none font-bold shadow-sm">
                            {deal.year}
                          </Badge>
                          {deal.priceDrop && (
                            <Badge variant="destructive" className="shadow-sm flex items-center gap-1">
                              <TrendingDown className="w-3 h-3" /> Price Drop
                            </Badge>
                          )}
                        </div>
                        <div className="absolute bottom-2 left-2">
                          <Badge variant="secondary" className="bg-background/80 backdrop-blur-md border-none text-xs flex items-center gap-1 shadow-sm">
                            <MapPin className="w-3 h-3" /> {deal.city}, {deal.distance} mi
                          </Badge>
                        </div>
                      </div>

                      {/* Content Area */}
                      <div className="w-full sm:w-2/3 p-5 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="text-xl font-bold leading-tight group-hover:text-primary transition-colors">
                                {deal.make} {deal.model}
                              </h3>
                              <p className="text-sm text-muted-foreground">{deal.trim}</p>
                            </div>
                            
                            {/* Score Ring */}
                            <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-full border-4 shadow-sm ${getScoreBg(deal.dealScore)} ${getScoreColor(deal.dealScore).replace('text-', 'border-')}`}>
                              <span className={`text-xl font-bold ${getScoreColor(deal.dealScore)}`}>{deal.dealScore}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
                            <div className="flex flex-col">
                              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Price</span>
                              <span className="text-xl font-bold">${deal.price.toLocaleString()}</span>
                            </div>
                            <div className="h-8 w-[1px] bg-border hidden sm:block"></div>
                            <div className="flex flex-col">
                              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Est. Value</span>
                              <span className="text-sm font-medium line-through text-muted-foreground">${deal.marketValue.toLocaleString()}</span>
                              <span className="text-xs text-emerald-500 font-bold mt-0.5">
                                ${((deal.marketValue - deal.price)).toLocaleString()} below
                              </span>
                            </div>
                            <div className="h-8 w-[1px] bg-border hidden sm:block"></div>
                            <div className="flex flex-col">
                              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Mileage</span>
                              <span className="text-sm font-medium">{deal.mileage.toLocaleString()} mi</span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Why it scores high</p>
                            <ul className="space-y-1">
                              {deal.reasons.slice(0, 2).map((reason, idx) => (
                                <li key={idx} className="text-sm flex items-start gap-2">
                                  <div className="mt-0.5 min-w-4 text-primary">
                                    <ShieldCheck className="w-4 h-4" />
                                  </div>
                                  <span className="text-foreground/80">{reason}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                              {deal.sellerType === 'dealer' ? <ShieldCheck className="w-3 h-3 text-primary" /> : <AlertTriangle className="w-3 h-3 text-orange-500" />}
                            </div>
                            <span className="text-xs font-medium">{deal.sellerName}</span>
                          </div>
                          <Button size="sm" className="font-semibold">
                            View Deal
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
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

                <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-primary" />
                      Seasonal Adjustment
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                      <h4 className="font-semibold text-sm mb-2 text-foreground">Tax Refund Season Active</h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        Model applies a +5% demand boost to vehicles priced $15k-$25k from Feb-April.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="bg-background">Honda Civic</Badge>
                        <Badge variant="outline" className="bg-background">Toyota Corolla</Badge>
                        <Badge variant="outline" className="bg-background">Nissan Camry</Badge>
                      </div>
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
                        <span className="text-muted-foreground">Reliability (Make/Model)</span>
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
                      <AlertTriangle className="w-3 h-3 inline mr-1 text-orange-500" /> Heavy penalties apply for salvage/rebuilt titles.
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

          <TabsContent value="market-comps">
            <Card className="bg-card/40 border-border/50 p-12 text-center flex flex-col items-center justify-center">
              <BarChart3 className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-bold mb-2">Market Comps</h3>
              <p className="text-muted-foreground max-w-md mx-auto">Explore market value estimations computed using comparables within 100 miles of San Antonio centroid.</p>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}