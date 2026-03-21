import CollegesClient from "./CollegesClient";
import { fetchColleges } from "@/lib/api";

export default async function CollegesPage({ searchParams }) {
  // Convert searchParams object to clean params for API
  const params = {
    limit: 18,
    page: searchParams.page || 1,
    state: searchParams.state !== 'All' ? searchParams.state : undefined,
    district: searchParams.district !== 'All' ? searchParams.district : undefined,
    course: searchParams.course !== 'All' ? searchParams.course : undefined,
    tier: searchParams.tier !== 'All' ? searchParams.tier : undefined,
    band: searchParams.band !== 'All' ? searchParams.band : undefined,
    q: searchParams.q || undefined,
    sort: searchParams.sort || undefined
  };

  let initialData = { data: [], pagination: null };

  try {
    const res = await fetchColleges(params);
    if (res.data) {
      initialData = res;
    } else if (Array.isArray(res)) {
      // Fallback for non-paginated response (if API changes fallback)
      initialData.data = res;
    }
  } catch (err) {
    console.error("Colleges SSR Error:", err);
  }

  return <CollegesClient initialData={initialData} />;
}
