import { useState, type FormEvent } from "react";

type SearchBarProps = {
  onSearch: (query: string) => void;
  placeholder?: string;
  defaultValue?: string;
  className?: string;
  buttonText?: string;
  loading?: boolean;
};

export default function SearchBar({
  onSearch,
  placeholder,
  defaultValue = "",
  className = "",
  buttonText = "Search",
  loading = false,
}: SearchBarProps) {
  const [q, setQ] = useState(defaultValue);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    onSearch(trimmed);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`w-full ${className}`}
      role="search"
      data-coachmark="search-bar"
    >
      <label htmlFor="default-search" className="sr-only">
        Search
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3">
          <svg
            className="h-4 w-4 text-gray-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 20 20"
          >
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0  1 1 14 0Z"
            />
          </svg>
        </div>

        <input
          id="default-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          required
          autoComplete="off"
          className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-4 ps-10 text-sm text-gray-900
                     focus:border-blue-500 focus:ring-blue-500"
        />

        <button
          type="submit"
          disabled={loading}
          className="absolute end-2.5 bottom-2.5 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white
                     hover:bg-gray-800 focus:outline-none focus:ring-4 focus:ring-gray-300 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Loading..." : buttonText}
        </button>
      </div>
    </form>
  );
}
