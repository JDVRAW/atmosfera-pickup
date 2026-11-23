# Design

The approved design lives in the project doc "Atmosfera Cafe pickup ordering: design"
(https://claude.ai/artifact/XrJCtjviZ4PkaEzLBuczDD). Summary:

- Custom Next.js storefront; Square holds the menu, payments and orders. No database in v1.
- Customers pick ASAP (about 10 minutes) or a later slot today within Square business hours.
- Payment by card, Apple Pay or Google Pay through Square; optional tip (15, 18, 20 percent or custom).
- Not in v1: delivery, accounts, loyalty, native apps, admin screens.
