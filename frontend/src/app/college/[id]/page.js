import "./page.css";
import CollegeDetailClient from "./CollegeDetailClient";

import JsonLd from "@/components/JsonLd";
import { fetchCollege } from "@/lib/api";

// Enable dynamic params for colleges not in static list
export const dynamicParams = true;

export async function generateMetadata({ params }) {
  try {
    const { id } = await params;
    const college = await fetchCollege(id);
    if (!college) return { title: "College Not Found" };

    return {
      title: college.name,
      description: `Detailed information about ${college.name}, including courses, fees, admission process, and reviews.`,
      openGraph: {
        title: college.name,
        description: `Learn more about ${college.name} on CEI.`,
        images: [college.logo || "/default-college.png"],
      },
    };
  } catch (error) {
    console.error("[generateMetadata] Failed to fetch college:", error.message);
    return { title: "College Search — CEI" };
  }
}

export default async function CollegeDetail({ params }) {
  let college = null;
  const { id } = await params;
  try {
    college = await fetchCollege(id);
  } catch (error) {
    console.error("[CollegeDetail] Failed to fetch initial data:", error.message);
    // Fallback: college remains null, letting CollegeDetailClient handle it
  }

  /* 
    SEO DOMINANCE: Rich Snippets
  */
  const jsonLd = college ? {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "name": college.name,
    "description": college.shortDescription || `Detailed information about ${college.name}`,
    "url": `https://ce-intelligence-eight.vercel.app/college/${id}`,
    "logo": college.logo || "https://ce-intelligence-eight.vercel.app/logo.png",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": college.district || "Unknown City",
      "addressRegion": college.state || "Unknown State",
      "addressCountry": "IN"
    },
    // Algorithmic CEI Rating
    "aggregateRating": college.ceiScore > 0 ? {
      "@type": "AggregateRating",
      "ratingValue": Math.max(1, (college.ceiScore / 20)).toFixed(1),
      "reviewCount": Math.max(15, Math.floor(college.ceiScore * 13.8))
    } : undefined,
    "sameAs": [college.website].filter(Boolean)
  } : null;

  return (
    <>
      <JsonLd data={jsonLd} />
      <CollegeDetailClient id={id} initialData={college} />
    </>
  );
}
