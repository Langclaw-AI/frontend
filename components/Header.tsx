import Link from "next/link";
import React from "react";
import { Button } from "./ui/button";

export default function Header() {
  return (
    <header className="flex justify-between items-center py-5 px-20">
      <nav className="flex items-center gap-5">
        <p className="text-xl font-bold">
          <Link href={"/"}>Langclaw</Link>
        </p>
        <p>
          <Link href={"/"}>Documentation</Link>
        </p>
      </nav>
      <Button className="text-end" asChild>
        <Link href={"/chat"}>TRY LANGCLAW</Link>
      </Button>
    </header>
  );
}
