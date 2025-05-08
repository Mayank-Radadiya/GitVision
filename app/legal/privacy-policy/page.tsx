import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import ModeToggle from "@/components/custom/mode-toggle";

export default function PrivacyPolicy() {
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
            <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-background via-background to-background ring-1 ring-primary/20 backdrop-blur-sm overflow-hidden shadow-lg transition-all duration-300 group-hover:shadow-primary/10">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-80"></div>
              <Image
                src="/Github.svg"
                alt="GitVision Logo"
                width={30}
                height={30}
                className="relative z-10 transition-transform duration-300 group-hover:scale-110"
              />
            </div>
            <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-xl font-bold tracking-tight text-transparent">
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
          <h1 className="text-3xl md:text-4xl font-bold mb-8 text-center bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
            Privacy Policy
          </h1>

          <div className="space-y-8 text-muted-foreground">
            {/* Sections */}
            {[
              {
                title: "1. Introduction",
                content:
                  "At GitVision, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and services. Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the site.",
              },
              {
                title: "2. Information We Collect",
                content:
                  "We may collect personal information that you voluntarily provide to us when you register for our services, including:",
                list: [
                  "Personal information (such as name and email address)",
                  "Account information and preferences",
                  "GitHub repository data that you grant us access to",
                  "Usage data and analytics",
                ],
              },
              {
                title: "3. How We Use Your Information",
                content:
                  "We may use the information we collect about you for various purposes, including:",
                list: [
                  "Providing, operating, and maintaining our services",
                  "Improving and personalizing the user experience",
                  "Understanding how users use our services",
                  "Developing new products, services, and features",
                  "Communicating with you about updates and support",
                  "Detecting and preventing fraud and security issues",
                ],
              },
              {
                title: "4. Cookies and Tracking Technologies",
                content:
                  "We use cookies and similar tracking technologies to track activity on our service and hold certain information. Cookies are files with a small amount of data that may include an anonymous unique identifier. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.",
              },
              {
                title: "5. Third-Party Services",
                content:
                  "We may use third-party service providers to help us operate our service or administer activities on our behalf, such as sending newsletters or analytics. These third parties have access to your Personal Information only to perform these tasks on our behalf and are obligated not to disclose or use it for any other purpose.",
              },
              {
                title: "6. Data Security",
                content:
                  "We use commercially reasonable measures to protect your personal information. However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your Personal Information, we cannot guarantee its absolute security.",
              },
              {
                title: "7. GitHub Data Access",
                content:
                  "When you connect your GitHub account to GitVision, we request limited access to your repositories in order to provide our services. We only access the data necessary to provide our features, and we do not store your source code permanently on our servers.",
              },
              {
                title: "8. Data Retention",
                content:
                  "We will retain your Personal Information only for as long as is necessary for the purposes set out in this Privacy Policy. We will retain and use your Personal Information to the extent necessary to comply with our legal obligations, resolve disputes, and enforce our legal agreements and policies.",
              },
              {
                title: "9. Your Data Protection Rights",
                content:
                  "Depending on your location, you may have certain rights regarding your personal information, including:",
                list: [
                  "The right to access, update, or delete your personal information",
                  "The right to rectification if your information is inaccurate or incomplete",
                  "The right to object to our processing of your personal data",
                  "The right to request restriction of processing your personal information",
                  "The right to data portability",
                  "The right to withdraw consent",
                ],
              },
              {
                title: "10. Children's Privacy",
                content:
                  "Our Service does not address anyone under the age of 13. We do not knowingly collect personally identifiable information from children under 13. If you are a parent or guardian and you are aware that your child has provided us with Personal Information, please contact us.",
              },
              {
                title: "11. Changes to This Privacy Policy",
                content:
                  "We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the 'Last updated' date. You are advised to review this Privacy Policy periodically for any changes.",
              },
              {
                title: "12. Contact Us",
                content: `If you have any questions about this Privacy Policy, please contact us at work.xyz.09@gmail.com </p>`,
              },
            ].map((section, index) => (
              <section key={index}>
                <h2 className="text-xl font-semibold mb-3 text-foreground">
                  {section.title}
                </h2>
                <p className="leading-relaxed">{section.content}</p>
                {section.list && (
                  <ul className="list-disc pl-6 mt-3 space-y-2">
                    {section.list.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <div className="mt-10 pt-6 border-t border-border/30 text-center text-sm text-muted-foreground">
            <p>Last updated: May 7, 2025</p>
            <div className="mt-2 flex justify-center gap-4">
              <Link
                href="/legal/terms-of-service"
                className="text-primary hover:underline"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
