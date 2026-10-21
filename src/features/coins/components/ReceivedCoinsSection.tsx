/**
 * ReceivedCoinsSection — displays LoveCoins received by the current user.
 *
 * Queries `coinsApi.useGetReceivedCoinsQuery` for coins where the current
 * user is the recipient but NOT the owner. Renders each coin with its number,
 * creator name, recipient name, message, style, and optional photo.
 *
 * Shows a loading skeleton while data is being fetched, an error message on
 * failure, and an empty state when no received coins exist.
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5
 */
import { useGetReceivedCoinsQuery, type LoveCoin } from "@/features/coins/api/coinsApi";
import { CoinVisual } from "@/components/CoinVisual";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { coinLabel, formatDate } from "@/lib/format";
import type { CoinStyle } from "@/lib/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fallback style when an unknown style value comes from the DB. */
const DEFAULT_STYLE: CoinStyle = "classic";

/** Valid coin styles — used to safely cast the DB string value. */
const VALID_STYLES = new Set<string>(["classic", "romantic", "minimal", "golden", "personal"]);

function safeStyle(style: string): CoinStyle {
  return VALID_STYLES.has(style) ? (style as CoinStyle) : DEFAULT_STYLE;
}

// ---------------------------------------------------------------------------
// ReceivedCoinCard — renders a single received coin
// ---------------------------------------------------------------------------

interface ReceivedCoinCardProps {
  coin: LoveCoin;
}

function ReceivedCoinCard({ coin }: ReceivedCoinCardProps) {
  const style = safeStyle(coin.style);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row items-start gap-4 p-4">
          {/* Coin visual */}
          <div className="shrink-0 flex justify-center w-full sm:w-auto">
            <CoinVisual
              style={style}
              coinNumber={coin.coin_number}
              creator={coin.creator_name}
              recipient={coin.recipient_name}
              imageUrl={coin.image_url}
              size={96}
            />
          </div>

          {/* Coin details */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Coin number + style badge */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {coinLabel(coin.coin_number)}
              </span>
              <Badge variant="secondary" className="text-xs capitalize">
                {coin.style}
              </Badge>
            </div>

            {/* From → To */}
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{coin.creator_name}</span>
              {" → "}
              <span className="font-medium text-foreground">{coin.recipient_name}</span>
            </p>

            {/* Message */}
            {coin.message && (
              <p className="text-sm text-muted-foreground italic line-clamp-3">
                &ldquo;{coin.message}&rdquo;
              </p>
            )}

            {/* Date */}
            <p className="text-xs text-muted-foreground">
              Received {formatDate(coin.created_at)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// LoadingSkeleton — placeholder cards while the query is in flight
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading received coins">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <Skeleton className="h-24 w-24 rounded-full shrink-0" />
              <div className="flex-1 space-y-2 w-full">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-3 w-full max-w-xs" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmptyState — displayed when no received coins exist (Requirement 15.4)
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-12 px-6 text-center"
      role="status"
      aria-label="No received coins"
    >
      <span className="text-4xl" aria-hidden>
        💌
      </span>
      <p className="mt-4 text-base font-medium text-foreground">No coins received yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        LoveCoins sent to you by others will appear here.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ErrorState — displayed when the query fails
// ---------------------------------------------------------------------------

function ErrorState() {
  return (
    <div
      className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-center"
      role="alert"
    >
      <p className="text-sm font-medium text-destructive">
        Could not load received coins. Please refresh and try again.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReceivedCoinsSection — main export (Requirement 15.1)
// ---------------------------------------------------------------------------

/**
 * Displays the "Coins I've received" section on the My LoveCoins page.
 *
 * Fetches coins where the current user is the recipient but NOT the owner
 * (Requirement 15.2, 15.5). Shows a loading state, error state, empty state
 * (Requirement 15.4), or a list of received coin cards (Requirement 15.3).
 */
export function ReceivedCoinsSection() {
  // Requirements 15.2: query coins where owner_id != current user and
  // recipient matches the current user.
  const { data: receivedCoins, isLoading, isError } = useGetReceivedCoinsQuery();

  return (
    <section aria-labelledby="received-coins-heading">
      {/* Section heading — Requirement 15.1 */}
      <h2
        id="received-coins-heading"
        className="text-xl font-semibold text-foreground mb-4"
      >
        Coins I&apos;ve received
      </h2>

      {/* Loading state */}
      {isLoading && <LoadingSkeleton />}

      {/* Error state */}
      {isError && !isLoading && <ErrorState />}

      {/* Empty state — Requirement 15.4 */}
      {!isLoading && !isError && receivedCoins && receivedCoins.length === 0 && (
        <EmptyState />
      )}

      {/* Coin list — Requirements 15.3, 15.5 */}
      {/* Note: the API already filters out coins owned by the current user
          (owner_id != current user), satisfying Requirement 15.5. */}
      {!isLoading && !isError && receivedCoins && receivedCoins.length > 0 && (
        <div className="space-y-3">
          {receivedCoins.map((coin) => (
            <ReceivedCoinCard key={coin.id} coin={coin} />
          ))}
        </div>
      )}
    </section>
  );
}
