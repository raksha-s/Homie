import { useEffect, useState } from "react";
import BottomSheet from "../../components/BottomSheet";
import { useKitchen } from "./KitchenProvider";
import { GEMINI_MODEL } from "./ai";

/** One-time setup for the optional free AI. The key never leaves this browser except to Google. */
export default function GeminiSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const k = useKitchen();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open) setValue("");
  }, [open]);

  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Smarter plans with free AI"
      description="Optional. Homie always checks the AI's plan against your rules, and falls back to its own plan if anything goes wrong."
    >
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          Open{" "}
          <a className="font-medium underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            aistudio.google.com/apikey
          </a>{" "}
          and sign in with your Google account.
        </li>
        <li>Tap "Create API key" and copy it. No card is needed.</li>
        <li>Paste it below.</li>
      </ol>
      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) {
            k.setGeminiKey(value);
            onClose();
          }
        }}
      >
        <div>
          <label htmlFor="gemini-key" className="mb-2 block text-sm font-medium">
            Gemini key
          </label>
          <input
            id="gemini-key"
            className="input"
            type="password"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={k.geminiKey ? "A key is saved. Paste a new one to replace it." : ""}
          />
        </div>
        <p className="text-sm text-muted">
          Only your food names and meal rules are sent to Google, using {GEMINI_MODEL}. Google says content sent on the free tier can be
          used to improve its products. The key is kept in this browser only, so set it up again on any other device.
        </p>
        <button type="submit" className="btn-primary" disabled={!value.trim()}>
          Save key
        </button>
        {k.geminiKey ? (
          <button
            type="button"
            className="min-h-11 font-medium text-danger"
            onClick={() => {
              k.setGeminiKey("");
              onClose();
            }}
          >
            Turn off and remove the key
          </button>
        ) : null}
      </form>
    </BottomSheet>
  );
}
