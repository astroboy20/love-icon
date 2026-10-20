# LoveCoin — Kiro Engineering & Code Quality Guide

## 1. Purpose

Build **LoveCoin**, a Nigerian-market app where people claim a numbered coin from a heart visualization containing up to **1 billion coins**, personalize it, pay **₦100**, and share it as a digital keepsake. The product also includes **Love of Fame**, a social feed where users can discover keepsakes and react to them.

**Required stack:** use **TanStack for the frontend** and **Supabase for the backend**. Follow the best practices for the exact TanStack framework already configured in the repository (for example, TanStack Router or TanStack Start); do not assume which TanStack product or version is installed without checking. Use Supabase for backend capabilities such as PostgreSQL, Row Level Security (RLS), migrations, and Storage or Edge Functions where appropriate.

This document guides Kiro when planning, implementing, refactoring, and reviewing the codebase. The main engineering goal is code that is **readable, modular, maintainable, efficient, secure, and easy to extend**.

> Do not implement the entire product in one large component or file. Keep each file focused and reasonably small. Split code when doing so improves clarity, reuse, or testing—not just to create many tiny files.

---

## 2. Non-negotiable coding principles

1. **One clear responsibility per file.** A component should have one main UI responsibility. A utility should perform a focused, reusable operation.
2. **Keep files readable, not cramped.** As a guideline, aim for roughly 150–250 lines or fewer per file where practical. This is not a hard limit: split a file when it becomes difficult to scan, has multiple unrelated responsibilities, or mixes UI, data access, and business logic.
3. **Use reusable components.** Extract repeated UI patterns into shared components. Do not create abstractions for one-off elements unless they meaningfully improve clarity.
4. **Separate concerns.** Keep presentation, business rules, data access, validation, formatting, and shared types separate.
5. **Use descriptive names.** Prefer `CoinPersonalizationForm.tsx` over `Form2.tsx`, and `formatNaira.ts` over `helpers.ts` containing unrelated functions.
6. **Avoid giant catch-all files.** Do not put all components in `components.tsx`, all logic in `utils.ts`, or all API calls in one oversized service file.
7. **Avoid duplication.** Extract repeated logic only when the shared abstraction remains easy to understand.
8. **Prefer simple code.** Avoid clever one-liners, deeply nested ternaries, excessive abstractions, and unnecessary design patterns.
9. **Use strict typing.** Avoid `any`. Define shared types and use safe handling for nullable or untrusted data.
10. **Keep functions focused.** A function should do one understandable task. Split long functions into named steps when that makes the logic clearer.
11. **Handle loading, empty, error, and success states.** Do not build only the happy path.
12. **Preserve existing behavior.** When modifying an existing project, inspect it first and avoid unrelated UI, styling, architectural, or business-logic changes.
13. **Do not add dependencies without a reason.** Prefer the project's existing libraries and conventions.
14. **Write testable logic.** Keep important calculations and business rules out of large UI components so they can be tested independently.
15. **Comment why, not what.** Use comments for non-obvious decisions, edge cases, and constraints—not to narrate obvious code.

---

## 3. Start by inspecting the existing project

Before writing code, Kiro must:

1. Inspect the project structure, package scripts, dependencies, framework, routing, styling, and existing conventions.
2. Identify existing reusable components, hooks, utilities, types, API clients, authentication patterns, and state-management choices.
3. Check whether relevant screens or functionality already exist.
4. Produce a short implementation plan and proposed file structure before making broad changes.
5. Reuse the existing stack unless there is a clear technical reason to change it.
6. Avoid replacing working code simply because another approach is preferred.
7. If a requirement is ambiguous or a payment/data decision affects security, explain the options and ask for clarification rather than inventing a production rule.

The required architecture is TanStack on the frontend and Supabase on the backend. Still inspect the repository to identify the exact TanStack framework/version, current folder conventions, Supabase setup, and existing integrations. Do not guess the payment provider, database schema, or business rules; confirm those from existing code and configuration or flag them as decisions needed.

---

## 4. Suggested feature-based folder structure

Adapt this to the project's actual framework and existing conventions. Do not force this exact structure if the repository already has a sound architecture.

```text
src/
  app/                         # Redux store setup, provider, root reducer
    store.ts                   # configureStore + root API + root slice wiring
  components/
    ui/                        # Small generic UI primitives
    layout/                    # Header, footer, navigation, page shell
    feedback/                  # Loading, error, empty-state, toast wrappers
  features/
    coins/
      components/
        HeartCoinVisualization.tsx
        CoinMarker.tsx
        CoinDetailsPanel.tsx
        CoinPersonalizationForm.tsx
        CoinStylePicker.tsx
        CoinPhotoUploader.tsx
        CoinPreview.tsx
      hooks/
        useCoinSelection.ts
        useCoinPersonalization.ts
      api/
        coinsApi.ts            # RTK Query API slice: endpoints for coins
      slices/
        coinsSlice.ts          # Local UI state for coins (selection, etc.) if needed
      schemas/
        coinSchema.ts
      utils/
        coinNumber.ts
        coinValidation.ts
      types/
        coin.types.ts
    payments/
      components/
        PaymentSummary.tsx
        PaymentStatus.tsx
      api/
        paymentsApi.ts         # RTK Query API slice: Bachs checkout, webhook status polling
      types/
        payment.types.ts
    fame/
      components/
        LoveOfFameFeed.tsx
        LovePostCard.tsx
        LovePostActions.tsx
        ReactionButton.tsx
      hooks/
        useLoveOfFame.ts
      api/
        fameApi.ts             # RTK Query API slice: notes, reactions
      types/
        fame.types.ts
    sharing/
      components/
        ShareKeepsakeButton.tsx
        KeepsakeCard.tsx
      api/
        sharingApi.ts
    auth/
      api/
        authApi.ts             # RTK Query / RTK slice: session, profile, sign-in/out
      slices/
        authSlice.ts           # currentUser, session state
      types/
        auth.types.ts
  hooks/                       # Truly cross-feature hooks only
  lib/
    api/                       # Shared Supabase client wrapper used by RTK Query baseQuery
    config/                    # Environment-backed configuration
  utils/
    formatNaira.ts              # Cross-feature formatting helpers only
    dates.ts
  types/
    api.types.ts                # Shared transport types only
```

### Structure rules

- Keep feature-specific code inside its feature. For example, coin selection logic belongs in `features/coins`, not in a global utility folder.
- Keep `components/ui` generic. Do not place product-specific components there.
- Keep route files thin: compose feature components and handle route-specific concerns; do not put the entire screen's implementation and data logic in a page file.
- A file named `index.ts` should not become a large re-export dumping ground. Use barrel files only when they improve imports without obscuring where code lives.
- Do not create every suggested file in advance if it is not needed. Add files as features are implemented.
- Avoid circular dependencies. Shared modules should not import feature modules that then import those shared modules back.

---

## 5. Component and file size rules

Use these as review guidelines, not arbitrary line-count enforcement:

- A screen/page should mostly arrange components and coordinate page-level state.
- A visual component should focus on rendering and user interaction.
- A hook should encapsulate reusable stateful UI behavior.
- A service should handle API communication or a clearly defined external integration.
- A utility should be pure where practical: given the same inputs, it returns the same output without hidden side effects.
- A schema/type file should define data contracts and validation, not UI.
- Split a file when it contains multiple independently understandable responsibilities, repeated blocks, a long conditional tree, or logic that would be easier to test in isolation.
- Do not split code so aggressively that a developer must jump through many files to understand one simple feature.
- Do not leave a component with dozens of unrelated props. Group cohesive configuration into typed objects when that improves clarity.
- Avoid putting large arrays of static content, complex SVG markup, and business logic in the same component file. Move them into focused modules when appropriate.

Before finishing a feature, review every changed file and ask: **Can a new developer understand this file quickly without reading the entire codebase?**

---

## 6. LoveCoin product areas

### A. Numbered coin and heart visualization

Users should be able to explore a heart-shaped visualization and select a numbered coin.

Engineering requirements:

- Treat **1 billion coins as a product-scale requirement**, not a requirement to render one billion DOM elements, React components, or client-side objects.
- Never generate, store, fetch, or render the full billion-coin collection in the browser.
- Use a scalable rendering strategy appropriate to the existing stack and UX, such as canvas/WebGL, tiled or procedurally rendered visuals, viewport-based rendering, or another measured solution.
- Keep the visualization renderer separate from selection rules, coin data fetching, and the personalization form.
- Store only the selected coin and the small amount of data needed for the current view.
- Make selection logic deterministic and validate selected coin numbers on both client and server.
- Define a canonical coin-number representation. If IDs can reach 1,000,000,000, ensure the chosen data type can represent the entire range safely. Do not rely on floating-point arithmetic for money.
- Provide keyboard and assistive-technology alternatives where feasible. A canvas-only interface must not be the only way to select or understand a coin.
- Consider mobile performance, touch input, zoom/pan behavior, loading states, and low-powered devices.
- Measure performance before introducing complicated optimizations.

Do not claim that a billion individual coins are being rendered if the visualization is procedural or representative. Make the UI and technical behavior honest and understandable.

### B. Coin personalization

A user can personalize a selected coin with:

- A name
- A message
- A photo, where supported
- A visual style/theme

Engineering requirements:

- Use a focused form component and a separate validation schema where appropriate.
- Keep field limits, allowed styles, file-size limits, accepted file types, and other rules in a single clearly named place rather than duplicating them across components.
- Validate on the client for usability and on the server for security and correctness.
- Handle upload progress, upload failures, invalid file types, file-size errors, and retry behavior.
- Do not trust a filename, file extension, MIME type, price, selected coin number, or user identity supplied by the browser.
- Preview changes in a focused preview component. Avoid rebuilding unrelated parts of the page for every keystroke.
- Do not silently discard form data when payment or upload fails.

### C. ₦100 payment flow

The advertised price is **₦100 per coin**, subject to the product owner confirming the exact pricing and transaction rules.

Engineering requirements:

- Keep the displayed price and server-side price rules consistent. The server must be authoritative for the amount due.
- Do not use JavaScript floating-point values for monetary calculations. Use integer kobo or a suitable exact decimal representation for amounts and currency conversions.
- Keep payment-provider integration in a dedicated service/module. Never put secret keys in frontend code.
- The backend must verify payment status directly with the payment provider or through a verified provider webhook before marking a coin as paid/claimed.
- Handle pending, successful, failed, cancelled, expired, and duplicate payment events.
- Make payment confirmation idempotent: repeated webhook events or retries must not claim the same coin twice or create duplicate purchases.
- Protect coin allocation with a database constraint and/or transaction so two users cannot successfully claim the same coin at once.
- Do not treat a frontend redirect or a client-supplied `success: true` as proof of payment.
- Never log secret keys, full payment credentials, or unnecessary personal data.
- If a real payment provider is not configured, implement a clearly labelled development/mock flow only; do not simulate a real successful payment in production.

Before implementation, inspect existing backend and payment-provider setup. If the provider or webhook architecture is unknown, ask rather than guessing.

### D. Keepsake sharing

Users should be able to share a completed keepsake digitally.

Engineering requirements:

- Keep share-card rendering and share actions separate from coin editing and payment logic.
- Use the Web Share API when available, with a copy-link fallback where appropriate.
- Create stable, shareable URLs for published keepsakes, subject to the product's privacy rules.
- Handle unavailable images, failed share actions, unsupported browsers, and clipboard errors gracefully.
- Do not expose private user data or unapproved uploaded files through a public URL.
- Ensure shared previews have sensible responsive dimensions and accessible text.

### E. Love of Fame social feed

The feed displays keepsakes and supports reactions.

Engineering requirements:

- Use separate components for the feed, post card, reaction controls, and any comments or related actions.
- Fetch feed items in pages or cursors; do not download the entire feed at once.
- Use stable IDs as list keys.
- Keep reaction state consistent with server responses. Prevent accidental duplicate submissions and provide clear loading/error feedback.
- Enforce reaction rules on the server, including authentication requirements if applicable.
- Avoid unnecessary refetches and rerenders. Use memoization only when it addresses an identified performance issue.
- Handle loading, empty, failed, and end-of-feed states.
- Add accessible names to icon-only buttons and visible focus states.
- Do not expose private keepsakes or personal information without the owner's consent.

---

## 7. Data, API, and security boundaries

- Keep API calls out of presentational components where practical.
- Use a dedicated service or data-access module for each feature's API operations.
- Define request/response types and validate untrusted server responses at appropriate boundaries.
- Keep environment variables and secrets out of committed source code and frontend bundles.
- Never trust client-side validation as a security boundary.
- Apply server-side authorization to every protected operation.
- Use database uniqueness constraints and transactions for coin ownership and payment confirmation.
- Use rate limits and abuse protection for claiming, reactions, uploads, and public endpoints where appropriate.
- Set upload limits and verify files server-side; consider safe image processing and storage permissions.
- Avoid returning internal errors, stack traces, or sensitive provider responses to end users.
- Use structured, privacy-conscious logs that are useful for debugging.
- Do not invent API endpoints or database fields without checking existing schemas and contracts first.
- Document any required environment variables in `.env.example` with placeholder values only—never real secrets.

---

## 8. Performance without premature complexity

1. Avoid unnecessary client-side state. Keep state as close as possible to the component that needs it.
2. Use server rendering or client rendering according to the existing framework and the feature's actual interactivity needs.
3. Lazy-load expensive, below-the-fold, or rarely used components when it improves the real experience.
4. Optimize images and uploaded media using the project's existing image pipeline.
5. Paginate feed and search results.
6. Avoid fetching the same data repeatedly; use the project's existing caching/data-fetching approach.
7. Avoid premature `useMemo`, `useCallback`, and memoization everywhere. Use them when there is a clear reason.
8. Keep event listeners, subscriptions, and observers correctly cleaned up.
9. Prevent stale asynchronous responses from overwriting newer user selections.
10. Test the heart visualization on realistic mid-range mobile hardware and with large data inputs.
11. Do not trade away accessibility or correctness for a small, unmeasured speed improvement.
12. Avoid adding a state-management library if local state and the current architecture are sufficient.

---

## 9. UI and accessibility standards

- Follow the established design system, spacing, typography, colors, and responsive patterns.
- Do not redesign existing screens unless the task explicitly requests a redesign.
- Extract repeated design patterns into reusable components without making every element configurable.
- Use semantic HTML and correct button, form, heading, and input elements.
- Associate form controls with labels and expose validation messages to assistive technology.
- Provide keyboard support, visible focus indicators, and accessible names for icon-only controls.
- Do not rely on color alone to communicate payment status, errors, or selection.
- Respect reduced-motion preferences for non-essential animation.
- Provide responsive layouts for small mobile screens through desktop.
- Use consistent currency formatting, such as `₦100`, through a shared formatter where appropriate.

---

## 10. Error handling and user feedback

For every important interaction, explicitly consider:

- Initial/loading state
- Success state
- Empty state, if applicable
- Validation error
- Network/server error
- Retry or recovery path
- Duplicate submission
- Permission/authentication failure

Use the project's existing toast/notification system if present. Do not add multiple notification libraries or show raw technical errors to users.

Keep error mapping and reusable feedback patterns outside large page components when it makes them easier to maintain.

---

## 11. Testing expectations

Write tests using the project's existing test framework. Do not introduce a new test framework without a clear reason.

Prioritize tests for:

- Coin number validation and allocation
- Duplicate-claim prevention
- Personalization validation
- Naira/kobo conversion and ₦100 pricing rules
- Payment webhook verification and idempotency
- Payment success/failure transitions
- Upload validation and failure handling
- Sharing fallbacks
- Reaction submission and duplicate prevention
- Loading, empty, and error UI states
- Critical keyboard and accessible interaction behavior

Keep pure business rules in focused modules so unit tests do not need to render the whole application. Add integration tests for critical database/payment flows where the project supports them.

Never use a real payment secret or make a real charge in automated tests. Mock external payment providers safely.

---

## 12. Naming and code style

- Components: `PascalCase.tsx`, e.g. `CoinPreview.tsx`.
- Hooks: `useSomething.ts`, e.g. `useCoinSelection.ts`.
- Utilities: descriptive `camelCase.ts`, e.g. `formatNaira.ts`.
- Types: follow the existing project convention; use names that reveal their domain, e.g. `Coin`, `CoinPersonalization`, `PaymentStatus`.
- Use named exports by default unless the existing framework or codebase convention calls for default exports.
- Keep import lists organized and remove unused imports.
- Avoid vague names such as `data`, `item`, `temp`, `misc`, `common`, and `helpers` when a domain-specific name is available.
- Use early returns to reduce unnecessary nesting.
- Prefer explicit conditionals when they are easier to read than chained ternaries.
- Avoid mixing unrelated UI, validation, API calls, and payment state transitions in one component.
- Do not use `console.log` as permanent production logging.
- Do not disable TypeScript or lint rules to get a build passing without explaining and justifying the exception.

---

## Stack-specific standards: TanStack frontend + Supabase backend

These requirements are mandatory for LoveCoin. Follow the installed versions and the official APIs supported by the repository rather than copying patterns from a different framework version.

### A. TanStack frontend practices

- Inspect `package.json` and the source tree first. Determine whether the project uses TanStack Router, TanStack Start, or another TanStack setup. Do not mix patterns from different TanStack products.
- Use the routing conventions of the installed framework. Keep route files focused on route configuration, route-level data coordination, and composing feature components; move complex UI and business logic into focused modules.
- If using TanStack Router, use its typed route definitions and typed route/search parameters according to the project's existing setup. Validate user-controlled search parameters at the boundary when relevant.
- If using TanStack Start, follow its server/client boundaries and official server-function patterns for work that must run on the server. Do not import server-only modules into client code.
- Use Redux Toolkit (RTK) and RTK Query for all asynchronous server state, data persistence, caching, and real-time data synchronization. Do not use raw `fetch` directly in components, hooks, or services. Define a centralized Redux store with feature-scoped API slices (one per feature: coins, payments, fame, sharing, auth) using `createApi` from RTK Query.
- Centralize RTK Query tag types and cache invalidation rules so mutations invalidate the correct cached queries. Handle pending, error, and success states through RTK Query's built-in lifecycle.
- Do not use RTK Query as a replacement for ordinary local form state or all UI state. Keep temporary UI state close to the component that owns it. Use RTK slices only for cross-component state that needs to be shared or persisted.
- Keep API/data access in feature-level RTK Query API slices or well-defined query/mutation endpoints rather than placing raw `fetch` calls throughout visual components. The Supabase JS client may be used inside RTK Query `queryFn` handlers, but all data flow to components goes through RTK Query so caching, invalidation, and loading state are centralized.
- Use shared, strongly typed request/response contracts. Treat browser input and remote data as untrusted even when TypeScript types exist.
- Use the repository's existing form and validation libraries. Validate at the UI boundary for good feedback and again on the trusted server/backend boundary for correctness and security.
- Keep route loaders, server functions, hooks, and components focused. Avoid route files that contain an entire feature implementation.
- Use framework-supported pending, not-found, and error handling patterns. Avoid swallowing errors or returning misleading success states.
- Do not introduce Next.js-specific APIs, file conventions, or assumptions into a TanStack project. Do not migrate frameworks unless the user explicitly asks.
- Preserve the existing design system and routing behavior when implementing new features or refactoring.

### B. Supabase backend practices

- Use Supabase as the backend platform, with PostgreSQL as the source of truth for persistent product data. Inspect existing tables, policies, buckets, functions, and migrations before changing the data model.
- Manage schema changes through version-controlled SQL migrations. Do not rely on manual dashboard-only schema edits for changes that need to be reproducible across environments.
- Enable Row Level Security (RLS) on tables exposed to clients through Supabase's Data API. Add policies that explicitly express who can select, insert, update, and delete each row. Test policies for anonymous users and authenticated users with different roles.
- Never assume that hiding a button or restricting a TanStack route secures data. Authorization must be enforced by RLS and/or trusted server-side code.
- Keep the Supabase project URL and publishable/anon key in the appropriate public configuration. **Never expose the service-role/secret key in browser code, client bundles, source control, logs, or public environment variables.** Use elevated credentials only in trusted server-side code or securely configured Edge Functions.
- Create a clearly named Supabase client for browser use and a separate server-only client when the architecture requires server access or privileged operations. Follow the official SSR/cookie integration for the installed libraries if server rendering is used; do not invent your own session handling.
- Handle authentication session changes and token refresh using the official Supabase client patterns already supported by the project. Do not build a parallel password/token system without a justified requirement.
- Generate and maintain TypeScript database types from the Supabase schema where supported by the project's workflow. Avoid manually duplicating database models in multiple places. Still validate external/user input at runtime; generated types do not validate browser input.
- Keep SQL, policies, and database functions small, named clearly, and documented where constraints or security decisions are not obvious. Add indexes for actual query patterns and constraints for important invariants.
- Use database constraints and transactions/RPCs where needed for concurrency-sensitive operations. For LoveCoin, coin ownership and payment confirmation must remain correct when multiple users act at the same time.
- Use Supabase Storage policies for uploaded photos. Do not assume that an unguessable URL makes a private file secure. Decide deliberately whether each keepsake image should be public or private, and protect access accordingly.
- Use Edge Functions or another trusted server-side integration for operations requiring secrets, verified payment webhooks, privileged writes, or external services. Verify webhook signatures and make handlers idempotent.
- Do not trust a client-supplied payment amount, paid status, ownership value, role, or user ID. Derive identity from the verified session and confirm payment with the payment provider on the trusted side.
- Do not place secrets in `VITE_*`, `NEXT_PUBLIC_*`, or any other client-exposed environment variables. Check the selected TanStack build tool's convention and keep privileged configuration server-only.
- Provide a safe `.env.example` listing variable names and placeholder values only. Never commit actual secrets.
- Use separate development and production Supabase projects when possible. Do not run destructive migrations or seed scripts against production without explicit authorization and safeguards.

### C. LoveCoin data and security rules

- Treat the database—not the browser—as the authority for coin availability, ownership, payment status, reactions, and published keepsake state.
- Put a unique constraint on the canonical coin number/ID and use a transaction-safe claim operation so two users cannot claim the same coin.
- Store the ₦100 price using an exact representation, such as integer kobo, or an appropriate exact decimal type. Never calculate currency using binary floating-point values.
- Separate a payment attempt from a confirmed, paid claim. A redirect to a success page must never prove payment. Confirm status through a trusted provider verification step or verified webhook.
- Make payment processing idempotent using a unique provider transaction/event reference and safe database state transitions.
- Enforce reaction uniqueness at the database level if the product rules allow only one reaction of a given type per user and post. The server/database must enforce the rule, not just the UI.
- Validate name, message, style, file size, file type, and any other product constraints in a trusted boundary as well as in the UI.
- Define public vs private data deliberately. Do not return email addresses, private profile information, payment metadata, storage internals, or non-public keepsake content to the Love of Fame feed.

### D. Required frontend/backend boundary

- **TanStack UI:** rendering, accessible interactions, form feedback, and non-sensitive temporary UI state.
- **TanStack data layer:** RTK Query endpoints (per-feature API slices) and RTK slices for cross-component shared state, following RTK conventions. Raw `fetch` is prohibited; the Supabase JS client is wrapped inside RTK Query `queryFn`/`mutationFn` handlers.
- **Supabase database:** persistent product state, constraints, RLS, and transactional invariants.
- **Trusted server-side code / Edge Functions:** privileged operations, secrets, payment-provider verification, verified webhooks, and other operations that must not be callable with elevated permissions directly from the browser.
- Never put service-role keys or privileged business decisions in client components. Client checks are for usability; trusted backend checks are for security and correctness.

## 13. Required Kiro workflow for each feature

For each feature, follow this sequence:

1. **Inspect** relevant files, existing patterns, and data contracts.
2. **Plan** the smallest coherent set of changes and list the files to add or modify.
3. **Separate responsibilities** before implementation: UI, hooks, service/API, schema/types, and utilities where appropriate.
4. **Implement incrementally** rather than generating the whole product in one huge file.
5. **Verify** types, lint, tests, and build using the scripts available in the repository.
6. **Review the diff** for unrelated changes, duplicated logic, overly large files, security issues, and regressions.
7. **Report** what changed, files created/modified, checks run, results, and anything requiring credentials or a real backend.

If the feature is too large for one implementation pass, break it into small steps and finish one coherent step at a time.

---

## 14. Definition of done

A feature is not complete until:

- [ ] Code follows the existing project's conventions.
- [ ] Components, services, hooks, schemas, and utilities have clear responsibilities.
- [ ] No file is unnecessarily crowded or responsible for unrelated features.
- [ ] Repeated logic is reused where doing so improves clarity.
- [ ] No unnecessary dependencies or unrelated refactors were introduced.
- [ ] Loading, success, empty, and error states are handled where relevant.
- [ ] Validation and authorization are enforced at the appropriate server boundary.
- [ ] Sensitive values are not exposed in frontend code or logs.
- [ ] Important business rules have tests or a clear explanation of why tests are not yet possible.
- [ ] Type-check, lint, tests, and build have been run when available; any failures are reported honestly.
- [ ] UI behavior remains consistent with the existing design unless a change was requested.
- [ ] The final summary names the important files and explains the implementation clearly.

---

## 15. Instructions to Kiro

Treat this file as the default engineering standard for all LoveCoin work.

**Do not optimize for writing the fewest files or the fewest lines. Optimize for clear responsibilities, easy navigation, correctness, and maintainability.** At the same time, do not split every few lines into a new file. Keep each file cohesive, readable, and reasonably small.

Before making substantial changes, summarize your plan and proposed file layout. After implementation, provide a concise report of files changed, architectural decisions, verification performed, and any remaining setup steps.

If an existing instruction conflicts with this guide, preserve the user's explicit request and the repository's established conventions, and explain the conflict rather than silently making a sweeping change.
