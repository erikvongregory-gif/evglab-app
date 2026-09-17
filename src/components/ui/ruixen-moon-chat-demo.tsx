"use client";

import React from "react";
import RuixenMoonChat from "@/components/ui/ruixen-moon-chat";

export default function DemoPage() {
  return (
    <main className="min-h-screen w-full bg-black text-white">
      {/* Chat Component */}
      <section className="flex w-full items-start justify-center">
        <RuixenMoonChat />
      </section>

      {/* Footer */}
      <footer className="mt-10 border-t border-neutral-800 py-2 text-center text-sm text-neutral-500">
        © {new Date().getFullYear()} Ruixen Demo Page
      </footer>
    </main>
  );
}
