import { Link } from "react-router-dom";
import { BarChart3, Mail, Phone, FileText, ArrowRight } from "lucide-react";
import { SERVICES } from "@/lib/services";

export function Footer() {
  return (
    <footer className="border-t bg-card py-10 mt-auto">
      <div className="container grid gap-8 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-bold text-lg text-primary mb-2">
            <BarChart3 className="h-5 w-5" />
            BRAJ Consultancy
          </div>
          <p className="text-sm text-muted-foreground max-w-[260px] leading-relaxed">
            Professional statistical analysis, research, and academic support services.
          </p>
          <div className="flex gap-4 mt-6">
            <a href="mailto:baltazarabobojr@gmail.com" className="text-xs text-muted-foreground hover:text-primary hover:underline">
              <Mail className="h-4 w-4 mr-1" />
              baltazarabobojr@gmail.com
            </a>
            <a href="tel:+639155090144" className="text-xs text-muted-foreground hover:text-primary hover:underline">
              <Phone className="h-4 w-4 mr-1" />
              09155090144
            </a>
          </div>
        </div>
        <div>
          <h4 className="font-semibold mb-3">Services</h4>
          <ul className="text-sm text-muted-foreground space-y-2">
            {SERVICES.map((service) => (
              <li key={service.id}>
                <Link
                  to={`/order?service=${service.id}`}
                  className="flex items-center gap-1.5 hover:text-primary hover:underline transition-colors"
                >
                  <ArrowRight className="h-3 w-3 shrink-0" />
                  {service.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3">Quick links</h4>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>
              <Link to="/order" className="flex items-center gap-1.5 hover:text-primary hover:underline transition-colors">
                <ArrowRight className="h-3 w-3 shrink-0" />
                Place an Order
              </Link>
            </li>
            <li>
              <Link to="/dashboard" className="flex items-center gap-1.5 hover:text-primary hover:underline transition-colors">
                <ArrowRight className="h-3 w-3 shrink-0" />
                My Dashboard
              </Link>
            </li>
            <li>
              <a
                href="/certificate-of-business-name-registration.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-primary hover:underline transition-colors"
              >
                <FileText className="h-3 w-3 shrink-0" />
                View Certificate
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3">Register</h4>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>
              <Link to="/auth?tab=signup" className="flex items-center gap-1.5 hover:text-primary hover:underline transition-colors">
                <ArrowRight className="h-3 w-3 shrink-0" />
                Client Sign Up
              </Link>
            </li>
            <li>
              <Link to="/auth?tab=signup&parttimer=1" className="flex items-center gap-1.5 hover:text-primary hover:underline transition-colors">
                <ArrowRight className="h-3 w-3 shrink-0" />
                Become a Part-timer
              </Link>
            </li>
            <li>
              <Link to="/auth" className="flex items-center gap-1.5 hover:text-primary hover:underline transition-colors">
                <ArrowRight className="h-3 w-3 shrink-0" />
                Log In
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="container mt-10 pt-6 border-t text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} BRAJ Statistical and Research Consultancy. All rights reserved.
      </div>
    </footer>
  );
}