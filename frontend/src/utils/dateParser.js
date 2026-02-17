/**
 * Utility to parse unstructured date strings from exams.json
 * Example inputs: "Nov-Dec 2025", "May 2026 (Last Sunday)", "Feb 2026 / May 2026"
 */

export const parseExamDate = (dateString) => {
    if (!dateString) return null;

    const months = {
        "jan": 0, "feb": 1, "mar": 2, "apr": 3, "may": 4, "jun": 5,
        "jul": 6, "aug": 7, "sep": 8, "oct": 9, "nov": 10, "dec": 11,
        "january": 0, "february": 1, "march": 2, "april": 3, "may": 4, "june": 5,
        "july": 6, "august": 7, "september": 8, "october": 9, "november": 10, "december": 11
    };

    // Clean the string (remove parentheses context like "Last Sunday")
    const cleanStr = dateString.toLowerCase().replace(/\(.*\)/, "").trim();

    // Extract year (first 4 digit number found)
    const yearMatch = cleanStr.match(/\d{4}/);
    const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear() + 1; // Default to next year if missing

    // Extract month
    let monthIndex = -1;
    for (const [key, val] of Object.entries(months)) {
        if (cleanStr.includes(key)) {
            monthIndex = val;
            break; // Take the first month found (e.g. "Nov-Dec" -> Nov)
        }
    }

    // Default to future if unknown
    if (monthIndex === -1) monthIndex = 0;

    // Create a rough Date object for sorting
    const estimatedDate = new Date(year, monthIndex, 1);
    const now = new Date();

    // Status Logic
    const isPast = estimatedDate < now;
    const isUrgent = !isPast && (estimatedDate - now < 30 * 24 * 60 * 60 * 1000); // Less than 30 days

    return {
        original: dateString,
        dateObj: estimatedDate,
        monthName: estimatedDate.toLocaleString('default', { month: 'long' }),
        year: year,
        isPast,
        isUrgent
    };
};

export const sortTimelineEvents = (events) => {
    return events.sort((a, b) => a.parsedDate.dateObj - b.parsedDate.dateObj);
};
