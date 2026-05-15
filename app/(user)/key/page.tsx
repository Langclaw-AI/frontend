import CreateKey from "@/components/CreateKey";
import ZeroGApiConsole from "@/components/ZeroGApiConsole";

export default function ApiConsolePage() {
  return (
    <div className="space-y-8">
      <CreateKey />
      <ZeroGApiConsole />
    </div>
  );
}
