import "./page.css";
import ExamDetailClient from "./ExamDetailClient";

import JsonLd from "@/components/JsonLd";
import { getExam } from "@/lib/api";

// Enable dynamic params for exams not in static list
export const dynamicParams = true;

export async function generateMetadata({ params }) {
  const exam = await getExam(params.id);
  if (!exam) return { title: "Exam Not Found" };

  return {
    title: `${exam.name} - Exam Details`,
    description: `Complete guide to ${exam.name}: syllabus, dates, eligibility, and accepting colleges.`,
    openGraph: {
      title: `${exam.name} - Exam Details`,
      description: `Everything you need to know about ${exam.name}.`,
    },
  };
}

export default async function ExamDetail({ params }) {
  const exam = await getExam(params.id);

  const jsonLd = exam ? {
    "@context": "https://schema.org",
    "@type": "Exam",
    "name": exam.name,
    "description": `Entrance exam for ${exam.type} courses.`,
    "startDate": exam.examDate,
    "location": {
      "@type": "Place",
      "name": "India"
    },
    "organizer": {
      "@type": "Organization",
      "name": exam.conductingBody || "Exam Authority"
    }
  } : null;

  return (
    <>
      <JsonLd data={jsonLd} />
      <JsonLd data={jsonLd} />
      <ExamDetailClient id={params.id} initialData={exam} />
    </>
  );
}
