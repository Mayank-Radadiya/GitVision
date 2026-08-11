import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import ModeToggle from "@/shared/components/theme/mode-toggle";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-muted/30 pt-16 pb-12 relative overflow-hidden">
      {/* Subtle gradient overlays */}
      <div className="absolute top-0 right-0 h-[300px] w-[300px] bg-primary/5 blur-[100px] rounded-full"></div>
      <div className="absolute bottom-0 left-0 h-[250px] w-[250px] bg-blue-500/5 blur-[100px] rounded-full"></div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl relative z-10">
        {/* Header with Logo and Theme Toggle */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/"
            className="group flex items-center gap-3 transition-all duration-300"
          >
            <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-background via-background to-background ring-1 ring-primary/20 backdrop-blur-sm overflow-hidden shadow-lg transition-all duration-300 group-hover:shadow-primary/10">
              <div className="absolute inset-0 bg-linear-to-br from-primary/10 to-transparent opacity-80"></div>
              <Image
                src="/Github.svg"
                alt="GitVision Logo"
                width={30}
                height={30}
                className="relative z-10 transition-transform duration-300 group-hover:scale-110"
              />
            </div>
            <span className="bg-linear-to-r from-foreground to-foreground/80 bg-clip-text text-xl font-bold tracking-tight text-transparent">
              Git<span className="text-primary">Vision</span>
            </span>
          </Link>
          <ModeToggle />
        </div>

        {/* Back to Home Link */}
        <Link
          href="/"
          className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to home</span>
        </Link>

        <div className="bg-card/95 backdrop-blur-sm p-8 md:p-10 rounded-xl shadow-lg border border-border/30">
          <h1 className="text-3xl md:text-4xl font-bold mb-8 text-center bg-linear-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
            Terms of Service
          </h1>

          <div className="space-y-8 text-muted-foreground">
            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">
                1. Introduction
              </h2>
              <p className="leading-relaxed">
                Welcome to GitVision. By accessing our website at gitvision.com
                or using our services, you agree to be bound by these Terms of
                Service. Please read these terms carefully before using our
                service.
              </p>
            </section>

            {/* Rest of the sections with improved spacing and typography */}
            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">
                2. Acceptance of Terms
              </h2>
              <p className="leading-relaxed">
                By registering for and/or using the Service in any manner, you
                agree to all of these Terms and all other operating rules,
                policies, and procedures that may be published by GitVision,
                which are incorporated by reference.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">
                3. Eligibility
              </h2>
              <p className="leading-relaxed">
                You represent and warrant that you are at least 13 years of age
                and that you have the legal capacity to enter into these Terms.
                If you are using the service on behalf of an organization, you
                represent and warrant that you are authorized to agree to these
                Terms on behalf of that organization.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">
                4. Account Registration
              </h2>
              <p className="leading-relaxed">
                To access certain features of the Service, you may be required
                to register for an account. You must provide accurate, current,
                and complete information during the registration process and
                keep your account information updated.
              </p>
              <p className="mt-2 leading-relaxed">
                You are responsible for safeguarding your account credentials
                and for any activity that occurs through your account. You must
                notify GitVision immediately of any breach of security or
                unauthorized use of your account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">
                5. User Content
              </h2>
              <p className="leading-relaxed">
                You retain ownership of and responsibility for the content you
                create and share on the Service (&quot;User Content&quot;). By
                submitting User Content, you grant GitVision a worldwide,
                royalty-free license to use, reproduce, modify, and distribute
                the content solely for the purpose of operating and improving
                the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">
                6. Acceptable Use
              </h2>
              <p className="leading-relaxed">You agree not to:</p>
              <ul className="list-disc pl-6 mt-3 space-y-2">
                <li>
                  Use the Service in any way that violates applicable laws or
                  regulations
                </li>
                <li>Impersonate others or provide inaccurate information</li>
                <li>Use the Service to transmit malware or harmful code</li>
                <li>Attempt to circumvent any access control measures</li>
                <li>
                  Engage in any activity that interferes with or disrupts the
                  Service
                </li>
                <li>
                  Scrape, crawl, or otherwise extract data from the Service
                  without permission
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">
                7. Termination
              </h2>
              <p className="leading-relaxed">
                GitVision reserves the right to suspend or terminate your access
                to the Service at any time for any reason without notice or
                liability. You may also terminate your account at any time.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">
                8. Intellectual Property
              </h2>
              <p className="leading-relaxed">
                The Service and its original content, features, and
                functionality are owned by GitVision and are protected by
                international copyright, trademark, and other intellectual
                property laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">
                9. Disclaimer of Warranties
              </h2>
              <p className="leading-relaxed">
                The Service is provided &quot;as is&quot; and &quot;as
                available&quot; without warranties of any kind, either express
                or implied. GitVision does not guarantee that the Service will
                be uninterrupted, secure, or error-free.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">
                10. Limitation of Liability
              </h2>
              <p className="leading-relaxed">
                To the maximum extent permitted by law, GitVision shall not be
                liable for any indirect, incidental, special, consequential, or
                punitive damages resulting from your use of or inability to use
                the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">
                11. Changes to Terms
              </h2>
              <p className="leading-relaxed">
                GitVision reserves the right to modify these Terms at any time.
                We will provide notice of significant changes by posting the
                updated Terms on our website. Your continued use of the Service
                after such changes constitutes your acceptance of the new Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">
                12. Governing Law
              </h2>
              <p className="leading-relaxed">
                These Terms shall be governed by and construed in accordance
                with the laws of India, without regard to its conflict of law
                provisions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">
                13. Contact Information
              </h2>
              <p className="leading-relaxed">
                If you have any questions about these Terms, please contact us
                at <span className="text-blue-300">work.xyz.09@gmail.com</span>.
              </p>
            </section>
          </div>

          <div className="mt-10 pt-6 border-t border-border/30 text-center text-sm text-muted-foreground">
            <p>Last updated: May 7, 2025</p>
            <div className="mt-2 flex justify-center gap-4">
              <Link
                href="/legal/privacy-policy"
                className="text-primary hover:underline"
              >
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
