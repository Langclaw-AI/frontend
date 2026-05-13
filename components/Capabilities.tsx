import { Bot, MessagesSquare, Rss } from "lucide-react";
import React from "react";
import { Separator } from "./ui/separator";

export default function Capabilities() {
  return (
    <div className="m-10 p-10 bg-accent rounded space-y-5">
      <section>
        <h1 className="text-3xl font-bold">
          Six Core Capabilities to Build Your AI Agent
        </h1>
        <h2>Chat / Models / Multi-Agent / Channels Skills / Scheduled Tasks</h2>
      </section>
      <Separator />
      <section className="grid grid-cols-3 gap-5">
        <article className="border-r p-3 space-y-3">
          <MessagesSquare size={40} />
          <h3 className="text-xl font-bold">Smart Interaction</h3>
          <h4 className="font-semibold">Conversational Chat Interface</h4>
          <p>
            Immersive chat experience with Markdown rendering, code
            highlighting, and conversation history.
          </p>
        </article>

        <article className="border-r p-3 space-y-3">
          <Bot size={40} />
          <h3 className="text-xl font-bold">Agent Management</h3>
          <h4 className="font-semibold">Multi-Agent Smart Routing</h4>
          <p>
            Create and manage multiple AI assistants, each with its own
            configuration.
          </p>
        </article>

        <article className="border-r p-3 space-y-3">
          <Rss size={40} />
          <h3 className="text-xl font-bold">Channel Management</h3>
          <h4 className="font-semibold">Multi-Platform Account Binding</h4>
          <p>
            Immersive chat experience with Markdown rendering, code
            highlighting, and conversation history.
          </p>
        </article>
      </section>

      <section className="grid grid-cols-3 gap-5">
        <article className="border-r p-3 space-y-3">
          <MessagesSquare size={40} />
          <h3 className="text-xl font-bold">Smart Interaction</h3>
          <h4 className="font-semibold">Conversational Chat Interface</h4>
          <p>
            Immersive chat experience with Markdown rendering, code
            highlighting, and conversation history.
          </p>
        </article>

        <article className="border-r p-3 space-y-3">
          <Bot size={40} />
          <h3 className="text-xl font-bold">Agent Management</h3>
          <h4 className="font-semibold">Multi-Agent Smart Routing</h4>
          <p>
            Create and manage multiple AI assistants, each with its own
            configuration.
          </p>
        </article>

        <article className="border-r p-3 space-y-3">
          <Rss size={40} />
          <h3 className="text-xl font-bold">Channel Management</h3>
          <h4 className="font-semibold">Multi-Platform Account Binding</h4>
          <p>
            Immersive chat experience with Markdown rendering, code
            highlighting, and conversation history.
          </p>
        </article>
      </section>
    </div>
  );
}
