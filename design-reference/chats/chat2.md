# Pilot Signup Landing

_Started 2026-06-01 00:22 UTC_

---

## User

we also need to design a landing page for people to sign up for this

right now this would be positioned as a pilot with limited spot and waitlist mechamism, so design a landing page in a separate file according to such requirement:

Two panel left and right, left is email sign up, right is some visual and copy to tell what this product does

on the left panel, the user flow will be like:
first question would be some basic information drop down:
Are you a Netic client? 
- if choose yes, just ask for company email and copy says (feel free to shorten and polish it) "Confirm that we have received your interest and will email you access link once report is ready. Running all queries may take a couple of days so that the final report to be ready."
- if choose no, continue to ask the below
Company name
Company email
Company size
* < 15M
15-20M
20M-60M
60M-100M
100M+
- If they select revenue < 15M, say something like "Sorry that the current pilot is only offered to companies with more than 15M revenue. We will keep you on our waitlist and once this tool is available for more clients, you have a saved spot."
if they choose above 15M, then "Confirm that we have received your interest and will email you access link once report is ready. Running all queries may take a couple of days so that the final report to be ready."

Try it first. Still follow the netic design system

## Assistant

_[tool: list_files]_

_[tool: read_file]_

I'll explore the existing files first to understand the product and design system before building.I'll explore the AEO product files to understand what this is and match its style.

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: list_files]_

_[tool: read_file]_

Let me look at the design tokens, components, and assets to understand the visual vocabulary.

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: update_todos]_

_[tool: run_script]_

I have a strong understanding now. This is **Netic AI Visibility** — it tracks how often a home services company appears in AI search (ChatGPT, Gemini) for high-intent prompts, benchmarks against local competitors, surfaces citation domains and sentiment.

Let me set up the todo and create a cream wordmark for the ink-green hero panel.

_[tool: write_file]_

Now the landing CSS:

_[tool: write_file]_

Now the signup flow JSX:Now the HTML file:

_[tool: write_file]_

_[tool: update_todos]_

_[tool: done]_

Clean load. Let me verify the layout and flow visually before handing off.

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: multi_screenshot]_

Looking good. Let me check the expanded "No" flow with revenue options and the result screens.

_[tool: save_screenshot]_

The form expansion and validation work (the "Yes" text in the select is just an html-to-image rendering quirk — the "No" details fields correctly rendered). Let me do a true pixel capture of the revenue options and a result screen.

_[tool: view_image]_

_[tool: str_replace_edit]_

The preview cards and form look great on-brand. The revenue labels wrap awkwardly on a couple rows — I'll lock them to a single line. Let me also confirm the result screen renders.

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

The left panel looks empty after submit — let me re-capture the wait state cleanly to see what rendered.

_[tool: view_image]_

_[tool: eval_js_user_view]_

Let me drive the flow in the live view and read what actually renders, rather than rely on capture quirks.

_[tool: eval_js_user_view]_

_[tool: screenshot_user_view]_

The wait screen renders correctly (h2 "We've saved your spot.", opacity 1, 318px tall) — the earlier empty frame was a capture-timing artifact. The flow is now in the wait state in the live view; let me capture it.The full layout is working beautifully — the wait/waitlist screen with amber clock mark, recap card, and the brand hero with floating product preview all render on-brand. Everything functions correctly across the flow. Let me hand off to the verifier.

_[tool: update_todos]_

_[tool: fork_verifier_agent]_

Done. **`Netic Pilot Signup.html`** is built and working.

**Two-panel layout, Netic design system throughout:**
- **Left** — the signup flow. Opens with the "Are you already a Netic client?" dropdown, then branches:
  - **Yes** → just company email → confirmation ("You're on the list…").
  - **No** → company name, email, and an annual-revenue radio list. Under $15M routes to the **waitlist** screen ("We've saved your spot…"); $15M+ routes to the same confirmation. Each result screen recaps the company/email and offers a reset.
- **Right** — ink-green brand hero with the cream wordmark, the "are you the answer?" headline, three benefit ticks, and a floating product preview (visibility score + surface bars + competitor leaderboard with "You" highlighted) lifted from the real product.

It's responsive (stacks on mobile with the form first), with inline validation, focus rings, and the pilot/waitlist copy polished per your spec.

One thing to confirm: I labeled the revenue bands as **annual revenue** since your spec said "Company size" but listed dollar amounts — say the word if you'd rather phrase it as company size or headcount.

## User

too much copy on the right
remove the pilot program, no need to call that out here and the "Limited pilot · By invitation and application" at the bottom

I think the copy and image can be something like bento card style collage of showcasing AI visibility score, Competitor Visibility Ranking, Top citation sources, sentiment score

## Assistant

_[tool: grep]_

Let me pull real citation and sentiment data from the product so the bento cards are authentic.

_[tool: read_file]_

_[tool: run_script]_

_[tool: read_file]_

I have authentic data: visibility 55% (Gemini 79% / ChatGPT 32%), sentiment **+0.59 positive**, top citation sources (houzz, mapquest, nextdoor + your own domain), and the competitor ranking. Let me rebuild the right panel as a bento collage and trim the copy.

First the CSS — replacing the feature ticks + linear preview with a bento grid:

_[tool: read_file]_

_[tool: str_replace_edit]_

Now I'll replace the feature-ticks + linear preview block with a bento collage:

_[tool: str_replace_edit]_

Now update the responsive rules for the bento:Now rewrite the Hero component in the JSX with trimmed copy and the bento collage:

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: save_screenshot]_

_[tool: view_image]_

The bento collage looks great — visibility score, sentiment (+0.59 Positive with meter), and citation sources are rendering cleanly. Let me scroll the hero to confirm the citation list and competitor ranking tiles render fully.

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: str_replace_edit]_

All four tiles render well. One small issue: the "You" tag on the long `alltechservices.com` row is getting squeezed to "Y…". Let me protect the pill from shrinking.

_[tool: done]_

_[tool: fork_verifier_agent]_

Done. The right panel is now a **bento collage** of four real report tiles, with the copy trimmed.

**Changes:**
- Removed the "AI Visibility · Pilot program" overline and the "Limited pilot · By invitation and application" footer.
- Cut the three-line feature list down to a single subline.
- Replaced the stacked preview with a bento grid:
  - **AI visibility score** (tall left tile) — 55% Medium, with Gemini 79% / ChatGPT 32% bars
  - **AI sentiment** — +0.59 Positive with a gradient meter
  - **Top citation sources** — houzz, your own domain (tagged "You"), mapquest, nextdoor
  - **Competitor visibility ranking** — full-width leaderboard with "You" highlighted at #4

All values are pulled from the actual product data, and it collapses to a single column on mobile.

## User

netic logo should just appear once left or right, and right should use the white version if that is the one

## Assistant

_[tool: list_files]_

The user wants the logo only once (on the right, white version). Let me check for a white wordmark in the design system.There's a white wordmark in the design system. Let me copy it in.

_[tool: copy_files]_

## Assistant

