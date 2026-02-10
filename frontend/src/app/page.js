import { fetchColleges, fetchExams } from "../lib/api";
import HomeClient from "./HomeClient";

// Force dynamic rendering since we randomize content
export const dynamic = "force-dynamic";

export default async function Home() {
  return <HomeClient />;
}
