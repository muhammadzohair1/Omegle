# Graph Report - .  (2026-04-23)

## Corpus Check
- Corpus is ~4,633 words - fits in a single context window. You may not need a graph.

## Summary
- 32 nodes · 28 edges · 11 communities detected
- Extraction: 68% EXTRACTED · 32% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Authentication|Authentication]]
- [[_COMMUNITY_Icons|Icons]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Authentication|Authentication]]
- [[_COMMUNITY_Chat Features|Chat Features]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Icons|Icons]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Firebase|Firebase]]
- [[_COMMUNITY_Community 10|Community 10]]

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 7 edges
2. `Icon Sprite Sheet` - 6 edges
3. `Bluesky Social Icon` - 3 edges
4. `Discord Icon` - 3 edges
5. `ProtectedRoute()` - 2 edges
6. `RequireInterestsRoute()` - 2 edges
7. `Navbar()` - 2 edges
8. `Chat()` - 2 edges
9. `InterestSelector()` - 2 edges
10. `Login()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `InterestSelector()` --calls--> `useAuth()`  [INFERRED]
  client\src\pages\InterestSelector.jsx → client\src\context\AuthContext.jsx
- `Login()` --calls--> `useAuth()`  [INFERRED]
  client\src\pages\Login.jsx → client\src\context\AuthContext.jsx
- `ProtectedRoute()` --calls--> `useAuth()`  [INFERRED]
  client\src\App.jsx → client\src\context\AuthContext.jsx
- `RequireInterestsRoute()` --calls--> `useAuth()`  [INFERRED]
  client\src\App.jsx → client\src\context\AuthContext.jsx
- `Navbar()` --calls--> `useAuth()`  [INFERRED]
  client\src\components\Navbar.jsx → client\src\context\AuthContext.jsx

## Hyperedges (group relationships)
- **Social Media Icons** — bluesky_icon, discord_icon, github_icon, social_icon, x_icon [EXTRACTED 1.00]

## Communities

### Community 0 - "Authentication"
Cohesion: 0.25
Nodes (5): ProtectedRoute(), RequireInterestsRoute(), useAuth(), Chat(), Navbar()

### Community 1 - "Icons"
Cohesion: 0.43
Nodes (7): Bluesky Social Icon, Discord Icon, Documentation Icon, GitHub Icon, Icon Sprite Sheet, Generic Social Icon, X/Twitter Icon

### Community 2 - "Community 2"
Cohesion: 0.5
Nodes (0): 

### Community 3 - "Authentication"
Cohesion: 1.0
Nodes (0): 

### Community 4 - "Chat Features"
Cohesion: 1.0
Nodes (1): InterestSelector()

### Community 5 - "Community 5"
Cohesion: 1.0
Nodes (1): Login()

### Community 6 - "Icons"
Cohesion: 1.0
Nodes (2): Site Favicon Logo, HTML Entry Point

### Community 7 - "Community 7"
Cohesion: 1.0
Nodes (0): 

### Community 8 - "Community 8"
Cohesion: 1.0
Nodes (0): 

### Community 9 - "Firebase"
Cohesion: 1.0
Nodes (0): 

### Community 10 - "Community 10"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **4 isolated node(s):** `HTML Entry Point`, `Site Favicon Logo`, `Documentation Icon`, `Generic Social Icon`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Authentication`** (2 nodes): `AuthProvider()`, `AuthContext.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Chat Features`** (2 nodes): `InterestSelector.jsx`, `InterestSelector()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 5`** (2 nodes): `Login.jsx`, `Login()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Icons`** (2 nodes): `Site Favicon Logo`, `HTML Entry Point`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 7`** (1 nodes): `eslint.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 8`** (1 nodes): `vite.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Firebase`** (1 nodes): `firebase.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 10`** (1 nodes): `main.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAuth()` connect `Authentication` to `Authentication`, `Chat Features`, `Community 5`?**
  _High betweenness centrality (0.173) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `useAuth()` (e.g. with `ProtectedRoute()` and `RequireInterestsRoute()`) actually correct?**
  _`useAuth()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `Bluesky Social Icon` (e.g. with `Discord Icon` and `X/Twitter Icon`) actually correct?**
  _`Bluesky Social Icon` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `Discord Icon` (e.g. with `Bluesky Social Icon` and `GitHub Icon`) actually correct?**
  _`Discord Icon` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `HTML Entry Point`, `Site Favicon Logo`, `Documentation Icon` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._