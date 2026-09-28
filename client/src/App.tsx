import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import VehicleLanding from "@/pages/VehicleLanding";
import TexasIndex from "@/pages/TexasIndex";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home}/>
      <Route path="/deals/:make/:model" component={VehicleLanding}/>
      <Route path="/texas-index" component={TexasIndex}/>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;