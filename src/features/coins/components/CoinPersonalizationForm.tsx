/**
 * CoinPersonalizationForm — reusable personalization UI for a single coin spot.
 *
 * Renders the creator name, recipient name, relation, message, style picker,
 * and photo uploader for one `SpotPersonalization` entry. Used inside the
 * ClaimFlow modal.
 *
 * Also exports:
 *   - `CoinPersonalizationData`  — the data shape for a spot's personalization
 *   - `CoinPersonalizationFormProps` — props for the standalone form variant
 *   - `BulkApplyBar`             — collapsible panel for applying name/style to all spots
 *   - `SpotPersonalization`      — per-spot data type (extends CoinPersonalizationData)
 *   - `BulkApplyFields`          — fields supported by bulk apply
 *   - `makeDefaultSpot`          — factory that creates a blank SpotPersonalization
 *
 * Requirements: 11.5
 */
import * as React from "react";
import { CoinVisual } from "@/components/CoinVisual";
import { CoinPhotoUploader } from "@/features/coins/components/CoinPhotoUploader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { coinLabel } from "@/lib/format";
import { COIN_STYLES, type CoinStyle, type CoinRelation } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The data payload for personalizing a single LoveCoin spot.
 * This interface is intentionally decoupled from `coinNumber` so it can be
 * reused by both the accordion (per-spot) and any standalone form contexts.
 */
export interface CoinPersonalizationData {
  creatorName: string;
  recipientName: string;
  relation: string;
  message: string;
  photoUrl: string | null;
  style: string;
}

/**
 * Per-spot data used inside the ClaimFlow accordion.
 * Extends CoinPersonalizationData with `coinNumber` for identity.
 */
export interface SpotPersonalization extends CoinPersonalizationData {
  coinNumber: number;
  style: CoinStyle;
}

/**
 * Props for the standalone reusable form variant.
 *
 * Use this when embedding the personalization form outside of ClaimFlow
 * (e.g. an edit screen), where you control the data externally.
 */
export interface CoinPersonalizationFormProps {
  /** The coin spot number being personalized — displayed in the form heading. */
  coinNumber: number;
  /** Current personalization data. */
  personalization: CoinPersonalizationData;
  /** Called with the full updated data whenever any field changes. */
  onChange: (data: CoinPersonalizationData) => void;
  /**
   * When true, renders a checkbox/button allowing the user to apply this
   * spot's personalization to all selected spots.
   */
  showApplyToAll?: boolean;
  /** Called when the user clicks "Apply to all spots". */
  onApplyToAll?: () => void;
  /** Disables all form controls (e.g. during submission). */
  disabled?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_STYLE: CoinStyle = "classic";
const DEFAULT_RELATION: CoinRelation = "Someone I love";

const COIN_RELATIONS: CoinRelation[] = [
  "Myself",
  "Someone I love",
  "Family",
  "Friend",
  "Someone special",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a blank SpotPersonalization for the given coin number. */
export function makeDefaultSpot(coinNumber: number): SpotPersonalization {
  return {
    coinNumber,
    creatorName: "",
    recipientName: "",
    relation: DEFAULT_RELATION,
    message: "",
    style: DEFAULT_STYLE,
    photoUrl: null,
  };
}

// ---------------------------------------------------------------------------
// StylePicker — shared pill-style style selector
// ---------------------------------------------------------------------------

interface StylePickerProps {
  value: CoinStyle;
  onChange: (style: CoinStyle) => void;
  /** Unique id suffix to scope label association (e.g. the coin number). */
  idSuffix: string;
  disabled?: boolean | undefined;
}

function StylePicker({ value, onChange, idSuffix, disabled }: StylePickerProps) {
  return (
    <div>
      <span
        id={`style-label-${idSuffix}`}
        className="mb-1.5 block text-xs font-semibold"
      >
        Style
      </span>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-labelledby={`style-label-${idSuffix}`}
      >
        {COIN_STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={value === s.id}
            disabled={disabled}
            onClick={() => onChange(s.id)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-all disabled:pointer-events-none disabled:opacity-50 ${
              value === s.id
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RelationPicker — dropdown for giver/recipient relationship
// ---------------------------------------------------------------------------

interface RelationPickerProps {
  value: string;
  onChange: (relation: string) => void;
  idSuffix: string;
  disabled?: boolean | undefined;
}

function RelationPicker({ value, onChange, idSuffix, disabled }: RelationPickerProps) {
  return (
    <div>
      <label
        className="mb-1.5 block text-xs font-semibold"
        htmlFor={`relation-trigger-${idSuffix}`}
      >
        Relationship
        <span className="ml-1 text-muted-foreground font-normal">(optional)</span>
      </label>
      <Select
        value={value || DEFAULT_RELATION}
        onValueChange={onChange}
        {...(disabled ? { disabled: true } : {})}
      >
        <SelectTrigger
          id={`relation-trigger-${idSuffix}`}
          aria-label="Select relationship"
          className="w-full"
        >
          <SelectValue placeholder="Choose relationship" />
        </SelectTrigger>
        <SelectContent>
          {COIN_RELATIONS.map((rel) => (
            <SelectItem key={rel} value={rel}>
              {rel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PersonalizationFields — shared form body used by both form variants
// ---------------------------------------------------------------------------

interface PersonalizationFieldsProps {
  data: CoinPersonalizationData;
  onChange: (data: CoinPersonalizationData) => void;
  idSuffix: string;
  disabled?: boolean | undefined;
}

/**
 * Renders all personalization form fields (name, relation, message, style,
 * photo) given a `CoinPersonalizationData` value. Used by both the accordion
 * variant and the standalone `CoinPersonalizationFormProps`-based variant.
 */
function PersonalizationFields({
  data,
  onChange,
  idSuffix,
  disabled,
}: PersonalizationFieldsProps) {
  const update = (fields: Partial<CoinPersonalizationData>) =>
    onChange({ ...data, ...fields });

  return (
    <div className="space-y-4">
      {/* Name inputs */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label
            className="mb-1.5 block text-xs font-semibold"
            htmlFor={`creator-${idSuffix}`}
          >
            Your name
          </label>
          <Input
            id={`creator-${idSuffix}`}
            value={data.creatorName}
            onChange={(e) => update({ creatorName: e.target.value })}
            placeholder="Simi"
            autoComplete="name"
            disabled={disabled}
          />
        </div>
        <div>
          <label
            className="mb-1.5 block text-xs font-semibold"
            htmlFor={`recipient-${idSuffix}`}
          >
            Their name
          </label>
          <Input
            id={`recipient-${idSuffix}`}
            value={data.recipientName}
            onChange={(e) => update({ recipientName: e.target.value })}
            placeholder="Abbie"
            disabled={disabled}
          />
        </div>
      </div>

      {/* Relationship */}
      <RelationPicker
        value={data.relation}
        onChange={(relation) => update({ relation })}
        idSuffix={idSuffix}
        disabled={disabled}
      />

      {/* Message */}
      <div>
        <label
          className="mb-1.5 block text-xs font-semibold"
          htmlFor={`message-${idSuffix}`}
        >
          Message{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <Textarea
          id={`message-${idSuffix}`}
          rows={2}
          className="resize-none"
          value={data.message}
          onChange={(e) => update({ message: e.target.value })}
          placeholder="Ordinary days with you never feel ordinary…"
          disabled={disabled}
        />
      </div>

      {/* Style picker */}
      <StylePicker
        value={(data.style as CoinStyle) || DEFAULT_STYLE}
        onChange={(style) => update({ style })}
        idSuffix={idSuffix}
        disabled={disabled}
      />

      {/* Photo uploader */}
      <CoinPhotoUploader
        onUploadSuccess={(url) => update({ photoUrl: url })}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CoinPersonalizationForm — accordion variant (used by ClaimFlow)
// ---------------------------------------------------------------------------

/**
 * Props for the accordion/collapsible variant used inside ClaimFlow.
 * @internal — prefer `CoinPersonalizationFormProps` for standalone use.
 */
export interface AccordionFormProps {
  spot: SpotPersonalization;
  onChange: (updated: SpotPersonalization) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

/**
 * Collapsible accordion row for personalizing a single coin spot.
 *
 * When collapsed, shows the coin label and a summary of the entered names
 * (or a "not personalized yet" hint). When expanded, shows the full form:
 * a live coin preview, name inputs, relation, message textarea, style
 * picker, and photo uploader.
 *
 * Used by ClaimFlow for multi-spot selection. For standalone use, prefer
 * `CoinPersonalizationFormStandalone` or the `CoinPersonalizationFormProps`
 * interface below.
 */
export function CoinPersonalizationForm({
  spot,
  onChange,
  isExpanded,
  onToggle,
}: AccordionFormProps) {
  const update = (fields: Partial<SpotPersonalization>) =>
    onChange({ ...spot, ...fields });

  const idSuffix = String(spot.coinNumber);

  const handleDataChange = (data: CoinPersonalizationData) => {
    update({
      creatorName: data.creatorName,
      recipientName: data.recipientName,
      relation: data.relation,
      message: data.message,
      photoUrl: data.photoUrl,
      style: (data.style as CoinStyle) || DEFAULT_STYLE,
    });
  };

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Header row — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        aria-expanded={isExpanded}
        aria-controls={`spot-form-${idSuffix}`}
      >
        <span className="text-sm font-medium">
          {coinLabel(spot.coinNumber)}
        </span>
        <div className="flex items-center gap-3">
          {spot.creatorName && spot.recipientName ? (
            <span className="text-xs text-muted-foreground truncate max-w-[160px]">
              {spot.creatorName} → {spot.recipientName}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground italic">
              Not personalized yet
            </span>
          )}
          <span className="text-muted-foreground text-xs" aria-hidden>
            {isExpanded ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {/* Expanded form */}
      {isExpanded && (
        <div
          id={`spot-form-${idSuffix}`}
          className="px-4 pb-5 pt-1 space-y-4 border-t border-border bg-card"
        >
          {/* Live coin preview */}
          <div className="flex justify-center pt-2">
            <CoinVisual
              style={spot.style}
              coinNumber={spot.coinNumber}
              creator={spot.creatorName || "Your name"}
              recipient={spot.recipientName || "Their name"}
              imageUrl={spot.photoUrl}
              size={120}
            />
          </div>

          <PersonalizationFields
            data={spot}
            onChange={handleDataChange}
            idSuffix={idSuffix}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CoinPersonalizationFormStandalone — standalone form with apply-to-all support
// ---------------------------------------------------------------------------

/**
 * Standalone form for personalizing a single LoveCoin spot.
 *
 * Accepts a `CoinPersonalizationData` value and calls `onChange` whenever
 * any field changes. Optionally shows an "Apply to all spots" button via
 * `showApplyToAll` and `onApplyToAll`.
 *
 * Use this component outside of ClaimFlow (e.g. on a coin edit page) where
 * you manage the coin number and data externally.
 */
export function CoinPersonalizationFormStandalone({
  coinNumber,
  personalization,
  onChange,
  showApplyToAll = false,
  onApplyToAll,
  disabled = false,
}: CoinPersonalizationFormProps) {
  const idSuffix = String(coinNumber);

  return (
    <div className="space-y-5">
      {/* Heading */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {coinLabel(coinNumber)}
        </h3>
        {showApplyToAll && onApplyToAll && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onApplyToAll}
            disabled={disabled}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Apply to all spots
          </Button>
        )}
      </div>

      {/* Live coin preview */}
      <div className="flex justify-center">
        <CoinVisual
          style={(personalization.style as CoinStyle) || DEFAULT_STYLE}
          coinNumber={coinNumber}
          creator={personalization.creatorName || "Your name"}
          recipient={personalization.recipientName || "Their name"}
          imageUrl={personalization.photoUrl}
          size={120}
        />
      </div>

      {/* Form fields */}
      <PersonalizationFields
        data={personalization}
        onChange={onChange}
        idSuffix={idSuffix}
        disabled={disabled}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// BulkApplyBar — apply name/style to all selected spots at once
// ---------------------------------------------------------------------------

export interface BulkApplyFields {
  creatorName: string;
  recipientName: string;
  style: CoinStyle;
}

export interface BulkApplyBarProps {
  /** Called when the user confirms their bulk personalization. */
  onApply: (fields: BulkApplyFields) => void;
}

/**
 * Collapsible panel that lets the user fill in one name / style combination
 * and stamp it across every selected coin spot at once.
 *
 * Apply is disabled until at least one name field has a non-empty value,
 * so the user cannot accidentally overwrite their spots with blank names.
 */
export function BulkApplyBar({ onApply }: BulkApplyBarProps) {
  const [creator, setCreator] = React.useState("");
  const [recipient, setRecipient] = React.useState("");
  const [style, setStyle] = React.useState<CoinStyle>(DEFAULT_STYLE);
  const [expanded, setExpanded] = React.useState(false);

  const canApply = creator.trim().length > 0 || recipient.trim().length > 0;

  const handleApply = () => {
    if (!canApply) return;
    onApply({
      creatorName: creator.trim(),
      recipientName: recipient.trim(),
      style,
    });
  };

  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors text-left"
        aria-expanded={expanded}
        aria-controls="bulk-apply-panel"
      >
        <span aria-hidden>✨</span>
        <span>Apply same personalization to all spots</span>
        <span className="ml-auto text-xs" aria-hidden>
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div
          id="bulk-apply-panel"
          className="px-4 pb-4 pt-1 space-y-3 border-t border-border"
        >
          {/* Name inputs */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                className="mb-1.5 block text-xs font-semibold"
                htmlFor="bulk-creator"
              >
                Your name
              </label>
              <Input
                id="bulk-creator"
                value={creator}
                onChange={(e) => setCreator(e.target.value)}
                placeholder="Simi"
                autoComplete="name"
              />
            </div>
            <div>
              <label
                className="mb-1.5 block text-xs font-semibold"
                htmlFor="bulk-recipient"
              >
                Their name
              </label>
              <Input
                id="bulk-recipient"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Abbie"
              />
            </div>
          </div>

          {/* Style for all */}
          <StylePicker
            value={style}
            onChange={setStyle}
            idSuffix="bulk"
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleApply}
            disabled={!canApply}
          >
            Apply to all spots
          </Button>
        </div>
      )}
    </div>
  );
}
