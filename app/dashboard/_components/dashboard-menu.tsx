"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";

export function DashboardMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="border rounded px-4 py-2 hover:bg-gray-100"
      >
        Menu
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border rounded shadow-lg z-10">
          <div className="py-1">
            <Link
              href="/dashboard"
              className="block px-4 py-2 text-sm hover:bg-gray-100"
              onClick={() => setIsOpen(false)}
            >
              Dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
