import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { SERVICES } from "@/lib/services";
import { ArrowRight, BarChart3, FileText, CheckCircle, Edit3, Search, Star, Quote, Award } from "lucide-react";

const serviceIcons: Record<string, React.ReactNode> = {
  "statistical-analysis": <BarChart3 className="h-8 w-8" />,
  "research": <FileText className="h-8 w-8" />,
  "turnitin-check": <Search className="h-8 w-8" />,
  "paraphrasing": <Edit3 className="h-8 w-8" />,
  "editing": <CheckCircle className="h-8 w-8" />,
};

const Index = () => {
  const { user, isAdmin, isPartTimer, isLoading } = useAuth();
  const navigate = useNavigate();
  const [testimonials, setTestimonials] = useState<{ testimony: string; service_type: string; rating: number | null; client_name: string }[]>([]);

  useEffect(() => {
    const fetchTestimonials = async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: ratingsData } = await supabase
        .from("order_ratings")
        .select("testimony, rating, order_id, created_at")
        .not("testimony", "is", null)
        .order("created_at", { ascending: false });
      if (!ratingsData?.length) return;
      const orderIds = [...new Set(ratingsData.map((r) => r.order_id))];
      const { data: ordersData } = await supabase.from("orders").select("id, service_type, user_id").in("id", orderIds);
      if (!ordersData?.length) return;
      const userIds = [...new Set(ordersData.map((o) => o.user_id))];
      const { data: profilesData } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      const profileMap = new Map((profilesData || []).map((p) => [p.user_id, p.full_name]));
      const orderMap = new Map(ordersData.map((o) => [o.id, { service_type: o.service_type, user_id: o.user_id }]));
      setTestimonials(
        ratingsData
          .filter((t) => t.testimony?.trim())
          .map((t) => {
            const order = orderMap.get(t.order_id);
            return {
              testimony: t.testimony!,
              service_type: order?.service_type ?? "Service",
              rating: t.rating,
              client_name: order?.user_id ? (profileMap.get(order.user_id) || "Anonymous") : "Anonymous",
            };
          })
          .slice(0, 3)
      );
    };
    fetchTestimonials();
  }, []);

  useEffect(() => {
    if (!isLoading && user) {
      if (isAdmin) navigate("/admin");
      else if (isPartTimer) navigate("/parttimer");
    }
  }, [user, isAdmin, isPartTimer, isLoading, navigate]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      {/* Hero */}
      <section className="relative py-16 sm:py-24 md:py-32 pb-20 overflow-hidden text-white">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url(/hero-banner.png)",
          }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/80 to-transparent" aria-hidden />
        <div className="absolute -top-[18%] -right-[20%] w-[560px] h-[560px] rounded-full bg-primary/25 blur-[130px]" aria-hidden />
        <div className="absolute -bottom-[10%] -left-[10%] w-[420px] h-[420px] rounded-full bg-white/15 blur-[100px]" aria-hidden />
        <div className="container relative z-10 px-4 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-3 py-1 text-[10px] font-semibold text-white uppercase tracking-[0.15em]">
            BRAJ Statistical &amp; Research Consulting
          </span>
          <h1 className="mt-5 text-4xl sm:text-7xl font-extrabold tracking-tight text-balance mb-6 sm:leading-[1.12]">
            Academic support that delivers results.
          </h1>
          <p className="text-lg sm:text-xl max-w-2xl mx-auto mb-10 text-white/90">
            Professional statistical analysis, research assistance, plagiarism checking, paraphrasing, editing, and instrument validation to help you succeed.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" className="bg-white text-primary shadow-card hover:bg-white/90 transition-colors" asChild>
              <Link to={user ? (isAdmin ? "/admin" : isPartTimer ? "/parttimer" : "/dashboard") : "/auth?tab=signup"}>
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            {!user && (
              <Button size="lg" variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20" asChild>
                <Link to="/auth?tab=signup&parttimer=1">Become a Part-timer</Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-20" id="services">
        <div className="container">
          <h2 className="text-3xl font-bold text-center mb-12">Our Services</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((service) => (
              <Card
                key={service.id}
                className="flex flex-col h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
              >
                <CardHeader className="pb-4">
                  <div className="flex w-fit items-center justify-center rounded-full bg-primary/10 p-2 mb-2 transition-colors group-hover:bg-primary/20">
                    {serviceIcons[service.id]}
                  </div>
                  <CardTitle>{service.name}</CardTitle>
                  <CardDescription>{service.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="space-y-2">
                    {service.id === "statistical-analysis" ? (
                      <p className="text-sm text-muted-foreground">Pricing set by admin based on your requirements</p>
                    ) : service.id === "research" ? (
                      <>
                        <p className="text-sm text-muted-foreground">Pricing set by admin before payment</p>
                        <p className="text-sm font-medium text-primary">Contact Baltazar Abobo for an agreement</p>
                      </>
                    ) : (
                      service.tiers.map((tier) => (
                        <div key={tier.name} className="flex items-center justify-between text-sm">
                          <span>{tier.name}</span>
                          <Badge variant={tier.priceValue > 0 ? "default" : "secondary"}>{tier.price}</Badge>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" asChild>
                    <Link to={user ? `/order?service=${service.id}` : "/auth"}>
                      Place Order
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      {testimonials.length > 0 && (
        <section className="py-16 bg-muted/30">
          <div className="container">
            <h2 className="text-3xl font-bold text-center mb-12">What Our Clients Say</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((t, i) => (
                <Card key={i} className="flex flex-col border-l-2 border-l-primary">
                  <CardContent className="pt-6 flex-1">
                    <Quote className="h-8 w-8 text-primary/50 mb-2" />
                    <p className="text-sm italic mb-4">"{t.testimony}"</p>
                    {t.rating != null && (
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={`h-4 w-4 ${n <= t.rating! ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`} />
                        ))}
                      </div>
                    )}
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs font-medium">{t.client_name}</p>
                      <p className="text-xs text-muted-foreground">{t.service_type}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Certificate of Business Name Registration */}
      <section className="py-16 border-t">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Award className="h-9 w-9 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Certificate of Business Name Registration</h2>
            <p className="text-muted-foreground mb-6">
              BRAJ Consultancy is a registered business. View our official certificate below.
            </p>
            <Button asChild variant="outline" size="lg">
              <a href="/certificate-of-business-name-registration.pdf" target="_blank" rel="noopener noreferrer">
                View certificate
              </a>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
