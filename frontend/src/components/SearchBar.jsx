import "./SearchBar.css";
import { useState } from "react";
import Button from "./Button";

export default function SearchBar({ onSearch }) {
  const [scope, setScope] = useState("all");
  const [query, setQuery] = useState("");

  return (
    <div className="search-bar glass">
      <div className="scope">
        <button className={scope === "all" ? "active" : ""} onClick={() => setScope("all")}>
          All
        </button>
        <button className={scope === "college" ? "active" : ""} onClick={() => setScope("college")}>
          Colleges
        </button>
        <button className={scope === "exam" ? "active" : ""} onClick={() => setScope("exam")}>
          Exams
        </button>
      </div>
      <input
        placeholder="Search colleges, exams, or cities"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <Button onClick={() => onSearch?.(query, scope)}>Search</Button>
    </div>
  );
}
