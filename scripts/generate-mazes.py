"""Generate the easy and hard maze figures for Chapter 16.

Writes resources/figures/maze-easy.svg and resources/figures/maze-hard.svg,
two activity-book mazes with the entrance in the middle of the left side and
the exit straight across on the right. The obvious move at any fork (the
"dominant response", in Zajonc's terms) is whichever way heads most directly
toward the exit: right if possible, otherwise toward the exit's row.

The two mazes are matched on what they can be matched on and differ in one
thing only:

- Same route length, and the same number of forks along the route (CHOICES).
- Easy: at every fork, the dominant response is correct. The wrong way
  always leads left or away from the exit, so "head for the exit" ignores it.
- Hard: at most forks (TRAPS of them), the dominant response is wrong. The
  wrong way is a short, straight passage pointing toward the exit that dead-
  ends after 2 or 3 squares, while the real route turns up, down or back.

Wrong turns are designed one by one, not left to chance, so each is a
plausible mistake. The only open passages are the route and those wrong
turns; the rest of the grid is drawn as walled-off maze, so the forks counted
are the only forks there are.

A red marker line traces each route at the same speed. On the hard maze it
falls for each trap (in to the dead end, then back), so it takes longer. The
line draws once when the maze scrolls into view; clicking replays it.

    python3 scripts/generate-mazes.py
"""

import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "resources" / "figures"

N = 11              # grid is N x N cells
MID = N // 2        # entrance and exit row
SIZE = 300          # maze drawing size in px
PADX, PADY = 54, 12 # room for Start / Finish beside the openings
WALL = "var(--sfs-text, #212529)"
ROUTE = "var(--sfs-critical-color, #c63f3f)"
SPEED = 350         # marker speed, px per second, both mazes
CHOICES = 8         # forks along the route, both mazes
TRAPS = 6           # forks on the hard maze where the dominant response is wrong
START, GOAL = (0, MID), (N - 1, MID)


def neighbours(cell):
    c, r = cell
    return [(x, y) for x, y in ((c + 1, r), (c - 1, r), (c, r + 1), (c, r - 1))
            if 0 <= x < N and 0 <= y < N]


def edge(a, b):
    return frozenset((a, b))


def pull(frm, to):
    """How strongly a step from `frm` to `to` heads for the exit: rightward
    progress first, then progress toward the exit's row. Higher is more
    dominant."""
    return (to[0] - frm[0], abs(frm[1] - MID) - abs(to[1] - MID))


# --- routes -----------------------------------------------------------------

def easy_route(rng):
    """Monotone route: in each column, wander up or down, then step right."""
    path, r = [START], MID
    for c in range(N):
        target = MID if c == N - 1 else rng.randrange(N)
        step = 1 if target > r else -1
        while r != target:
            r += step
            path.append((c, r))
        if c < N - 1:
            path.append((c + 1, r))
    return path


def grow(rng, cells, seeds, edges=(), branchiness=0.5):
    """Growing-tree carve over `cells`, starting from `seeds`. No loops."""
    edges = set(edges)
    seen = set(seeds)
    active = list(seeds)
    while active:
        i = rng.randrange(len(active)) if rng.random() < branchiness else len(active) - 1
        cell = active[i]
        free = [nb for nb in neighbours(cell) if nb in cells and nb not in seen]
        if not free:
            active.pop(i)
            continue
        nxt = rng.choice(free)
        edges.add(edge(cell, nxt))
        seen.add(nxt)
        active.append(nxt)
    return edges


def solve(edges):
    prev, queue = {START: None}, [START]
    while queue:
        cur = queue.pop(0)
        if cur == GOAL:
            break
        for nb in neighbours(cur):
            if nb not in prev and edge(cur, nb) in edges:
                prev[nb] = cur
                queue.append(nb)
    if GOAL not in prev:
        return None
    path, cur = [], GOAL
    while cur is not None:
        path.append(cur)
        cur = prev[cur]
    return path[::-1]


def random_route(rng):
    """Solution path of a random depth-first maze from START to GOAL."""
    every = {(c, r) for c in range(N) for r in range(N)}
    return solve(grow(rng, every, [START], branchiness=0))


def left_stretches(path):
    """(starting column, squares) for each stretch where the route heads left."""
    out, cur = [], None
    for a, b in zip(path, path[1:]):
        if b[0] < a[0]:
            if cur is None:
                cur = [a[0], 0]
                out.append(cur)
            cur[1] += 1
        elif b[0] > a[0]:
            cur = None
    return [tuple(s) for s in out]


def spread(path):
    """Fraction of columns the route visits in both the top and bottom half."""
    top = {c for c, r in path if r < MID}
    bottom = {c for c, r in path if r > MID}
    return len(top & bottom) / N


# --- forks ------------------------------------------------------------------

def dead_end(start, first, used, length, toward_exit):
    """A straight-ish dead-end passage from `start` through `first`.
    toward_exit: keep heading for the exit (a trap); otherwise keep heading
    away from it. Returns its cells, or None if there isn't room."""
    if first in used:
        return None
    cells, cur, d = [first], first, (first[0] - start[0], first[1] - start[1])
    while len(cells) < length:
        options = [nb for nb in neighbours(cur) if nb not in used and nb not in cells]
        if toward_exit:
            options = [o for o in options if pull(cur, o) >= (0, 0) and o[0] >= cur[0]]
        else:
            options = [o for o in options if o[0] <= cur[0] and pull(cur, o) < (1, 0)]
        if not options:
            break
        straight = (cur[0] + d[0], cur[1] + d[1])
        nxt = straight if straight in options else max(options, key=lambda o: pull(cur, o))
        d = (nxt[0] - cur[0], nxt[1] - cur[1])
        cells.append(nxt)
        cur = nxt
    return cells if len(cells) >= 2 else None


def add_forks(route, rng, traps):
    """Add CHOICES forks to the route, `traps` of them with the dominant way
    wrong. Returns (open edges, forks) or None. Each fork is
    (route index, dead-end cells, is_trap)."""
    used = set(route)
    edges = {edge(a, b) for a, b in zip(route, route[1:])}
    kinds = [True] * traps + [False] * (CHOICES - traps)
    rng.shuffle(kinds)
    # Spread forks evenly along the route, each in its own slice.
    usable = list(range(2, len(route) - 2))
    slices = [usable[round(j * len(usable) / CHOICES):round((j + 1) * len(usable) / CHOICES)]
              for j in range(CHOICES)]
    forks = []
    for kind, idxs in zip(kinds, slices):
        rng.shuffle(idxs)
        made = None
        for i in idxs:
            cell, nxt = route[i], route[i + 1]
            for nb in neighbours(cell):
                if nb in used:
                    continue
                dominant_wrong = pull(cell, nb) > pull(cell, nxt)
                if dominant_wrong != kind:
                    continue
                if kind and pull(cell, nb) <= (0, 0):   # a trap must head for the exit
                    continue
                cells = dead_end(cell, nb, used, rng.choice((2, 3)), toward_exit=kind)
                if cells:
                    made = (i, cells, kind)
                    break
            if made:
                break
        if not made:
            return None
        i, cells, _ = made
        used.update(cells)
        edges.add(edge(route[i], cells[0]))
        edges.update(edge(a, b) for a, b in zip(cells, cells[1:]))
        forks.append(made)
    # Fill the rest of the grid by growing it off the wrong ways, so each
    # wrong turn leads into its own dead-end section and no new forks appear
    # on the route. Non-trap sections can grow from anywhere along them; trap
    # sections only from their far end, so the tempting first squares stay a
    # clean corridor toward the exit.
    rest = {(c, r) for c in range(N) for r in range(N)} - used
    seeds = [c for _, cells, trap in forks for c in (cells[-1:] if trap else cells)]
    edges = grow(rng, rest, seeds, edges)
    reached = {c for e in edges for c in e}
    rest -= reached
    # Anything still unreachable (boxed in by the route) becomes sealed maze.
    while rest:
        seed = min(rest)
        region, frontier = {seed}, [seed]
        while frontier:
            cur = frontier.pop()
            for nb in neighbours(cur):
                if nb in rest and nb not in region:
                    region.add(nb)
                    frontier.append(nb)
        edges = grow(rng, region, [seed], edges)
        rest -= region
    return edges, sorted(forks)


# --- the marker trace -------------------------------------------------------

def follow_lure(cell, first, edges):
    """Follow a wrong way for as long as it keeps heading for the exit
    (right, or toward the exit's row), taking the most tempting way at any
    fork. Stop at a dead end or where the only ways on turn back or away."""
    path, prev, cur = [first], cell, first
    while True:
        ahead = [x for x in neighbours(cur) if x != prev and edge(cur, x) in edges
                 and pull(cur, x) > (0, 0)]
        if not ahead:
            return path
        prev, cur = cur, max(ahead, key=lambda x: pull(cur, x))
        path.append(cur)


def walk_with_false_starts(route, forks, edges):
    """The route as drawn by someone who always takes the dominant way: at
    every trap, along the wrong way until it stops heading for the exit, then
    back. Returns (cell, backtracking) pairs."""
    traps = {i: cells[0] for i, cells, trap in forks if trap}
    walk = []
    for i, cell in enumerate(route):
        walk.append((cell, False))
        if i in traps:
            cells = follow_lure(cell, traps[i], edges)
            walk += [(c, False) for c in cells]
            walk += [(c, True) for c in reversed(cells[:-1])] + [(cell, True)]
    return walk


def reachable(edges):
    seen, stack = {START}, [START]
    while stack:
        cur = stack.pop()
        for nb in neighbours(cur):
            if nb not in seen and edge(cur, nb) in edges:
                seen.add(nb)
                stack.append(nb)
    return seen


def zones(route):
    """How many of the 9 regions (a 3 x 3 grid over the maze) the route enters."""
    return len({(c * 3 // N, r * 3 // N) for c, r in route})


def centre(cell, size):
    c, r = cell
    return PADX + (c + 0.5) * size, PADY + (r + 0.5) * size


def route_d(walk, size, rng):
    """Smoothed marker line through the cell centres, with a little wobble.
    Backtracking runs alongside the way in rather than on top of it."""
    off = size * 0.24
    pts = [(x + off * b, y + off * b) for ((x, y), b) in ((centre(c, size), b) for c, b in walk)]
    y_mid = centre(START, size)[1]
    pts = [(PADX - 30, y_mid)] + pts + [(PADX + SIZE + 30, y_mid)]
    wob = min(size * 0.08, 1.5)
    pts = [(x + rng.uniform(-wob, wob), y + rng.uniform(-wob, wob)) if 0 < i < len(pts) - 1 else (x, y)
           for i, (x, y) in enumerate(pts)]
    d = [f"M{pts[0][0]:.1f} {pts[0][1]:.1f}"]
    for i in range(len(pts) - 1):
        p0, p1, p2, p3 = pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, len(pts) - 1)]
        k = 0.18
        c1 = (p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k)
        c2 = (p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k)
        d.append(f"C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}")
    length = sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
    return " ".join(d), length


# --- drawing ----------------------------------------------------------------

def wall_path(edges, size):
    """Wall segments as one SVG path, merging collinear runs."""
    segs = []
    for r in range(N + 1):            # horizontal walls along y = r
        run = None
        for c in range(N + 1):
            wall = c < N and not (0 < r < N and edge((c, r - 1), (c, r)) in edges)
            if wall and run is None:
                run = c
            elif not wall and run is not None:
                segs.append(((run, r), (c, r)))
                run = None
    for c in range(N + 1):            # vertical walls along x = c
        run = None
        for r in range(N + 1):
            wall = r < N and not (
                (c == 0 and r == MID) or (c == N and r == MID) or   # openings
                (0 < c < N and edge((c - 1, r), (c, r)) in edges))
            if wall and run is None:
                run = r
            elif not wall and run is not None:
                segs.append(((c, run), (c, r)))
                run = None
    fx = lambda v: f"{PADX + v * size:g}"
    fy = lambda v: f"{PADY + v * size:g}"
    return " ".join(f"M{fx(a)} {fy(b)}H{fx(x)}" if b == y else f"M{fx(a)} {fy(b)}V{fy(y)}"
                    for (a, b), (x, y) in segs)


def svg(name, label, edges, walk, desc, data=""):
    size = SIZE / N
    d, length = route_d(walk, size, random.Random(N))
    draw_seconds = round(length / SPEED, 1)
    print(f"  {name}: trace {length:.0f} px, draws in {draw_seconds} s")
    dash = math.ceil(length * 1.1)
    width, height = SIZE + 2 * PADX, SIZE + 2 * PADY + 26
    y_mid = centre(START, size)[1]
    wall_w = max(2.5, min(5, size * 0.14))
    cls = f"sfs-maze-{name}"
    # The route is drawn in full by default (no JS, print, reduced motion).
    # The script hides it, draws it once when the maze scrolls into view, and
    # leaves it there; a click (or Enter/Space) fades it out and draws it again.
    # The script sits in SVG foreign content, so it must not contain "<" or "&".
    return f"""<svg xmlns="http://www.w3.org/2000/svg" class="sfs-maze {cls}" viewBox="0 0 {width:g} {height:g}" role="img" tabindex="0" aria-labelledby="{cls}-title {cls}-desc" data-maze='{data}' style="display:block;width:100%;max-width:22rem;height:auto;margin:0 auto;">
  <title id="{cls}-title">{label} maze (select to replay)</title>
  <desc id="{cls}-desc">{desc}</desc>
  <style>
    .{cls} .sfs-maze-route {{ stroke-dasharray: {dash}; stroke-dashoffset: 0; }}
    .{cls}.is-animated {{ cursor: pointer; }}
    .{cls}.is-waiting .sfs-maze-route {{ stroke-dashoffset: {dash}; }}
    .{cls}.is-drawing .sfs-maze-route {{ animation: {cls}-draw {draw_seconds}s linear both; }}
    .{cls}.is-fading .sfs-maze-route {{ opacity: 0; transition: opacity 0.4s ease; }}
    @keyframes {cls}-draw {{
      from {{ stroke-dashoffset: {dash}; }}
      to {{ stroke-dashoffset: 0; }}
    }}
  </style>
  <script>
    (function () {{
      var svg = document.currentScript ? document.currentScript.closest("svg") : null;
      if (!svg || !window.matchMedia) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      svg.classList.add("is-animated", "is-waiting");
      function draw() {{
        svg.classList.remove("is-waiting", "is-fading", "is-drawing");
        void svg.getBoundingClientRect();
        svg.classList.add("is-drawing");
      }}
      function replay() {{
        if (svg.classList.contains("is-waiting") || svg.classList.contains("is-fading")) return;
        svg.classList.add("is-fading");
        setTimeout(draw, 450);
      }}
      if ("IntersectionObserver" in window) {{
        var io = new IntersectionObserver(function (entries) {{
          entries.forEach(function (e) {{ if (e.isIntersecting) {{ io.disconnect(); draw(); }} }});
        }}, {{ threshold: 0.6 }});
        io.observe(svg);
      }} else {{
        draw();
      }}
      svg.addEventListener("click", replay);
      svg.addEventListener("keydown", function (e) {{
        if (e.key === "Enter" || e.key === " ") {{ e.preventDefault(); replay(); }}
      }});
    }})();
  </script>
  <path class="sfs-maze-route" d="{d}" fill="none" stroke="{ROUTE}" stroke-width="{min(7, max(3.5, size * 0.22)):.1f}" stroke-linecap="round" stroke-linejoin="round" opacity="0.9" />
  <path class="sfs-maze-walls" d="{wall_path(edges, size)}" fill="none" stroke="{WALL}" stroke-width="{wall_w:.1f}" stroke-linecap="square" />
  <g fill="{WALL}" font-size="15" font-weight="700" font-family="inherit">
    <text x="{PADX - 6}" y="{y_mid - 12:.1f}" text-anchor="end">Start</text>
    <text x="{PADX + SIZE + 6}" y="{y_mid - 12:.1f}" text-anchor="start">Finish</text>
  </g>
  <text x="{width / 2:g}" y="{height - 6:g}" text-anchor="middle" font-size="17" font-weight="600" fill="{WALL}">{label}</text>
</svg>
"""


# --- choosing the mazes -------------------------------------------------------

def check(route, edges, forks, traps):
    """Every fork is a real fork, the counts are right, and the route is the
    only way through."""
    assert solve(edges) == route
    assert len(forks) == CHOICES
    assert sum(t for _, _, t in forks) == traps
    for i, cells, trap in forks:
        assert (pull(route[i], cells[0]) > pull(route[i], route[i + 1])) == trap


def build(route, traps, seeds=range(400), tries=12):
    """Lay forks on the route several ways; keep the one with the fewest
    sealed squares (then, for hard mazes, the longest false starts)."""
    best = None
    made_count = 0
    for s in seeds:
        made = add_forks(route, random.Random(s), traps)
        if not made:
            continue
        edges, forks = made
        check(route, edges, forks, traps)
        sealed = N * N - len(reachable(edges))
        detour = sum(len(follow_lure(route[i], cells[0], edges)) for i, cells, t in forks if t)
        key = (-sealed, detour)
        if best is None or key > best[0]:
            best = (key, edges, forks, sealed, detour, s)
        made_count += 1
        if made_count >= tries:
            break
    if best is None:
        raise SystemExit(f"couldn't fit {CHOICES} forks ({traps} traps) on this route")
    _, edges, forks, sealed, detour, fork_seed = best
    return edges, forks, {"sealed": sealed, "zones": zones(route), "detour": 2 * detour,
                          "fork_seed": fork_seed}


LENGTH = 47         # route length in squares, both mazes

# The mazes in the book, chosen 2026-11-12 from the contact sheet (Easy 4 and
# Hard 4). Stored as seeds, not sheet numbers, so they don't change if the
# ranking or candidate pool does. To choose again: make a sheet with --sheet,
# then run with --easy K / --hard K, which prints the seeds to paste here.
LOCKED = {
    "easy": {"route_seed": 594, "fork_seed": 1},
    "hard": {"route_seed": 19949, "fork_seed": 3},
}


def from_seeds(kind, route_seed, fork_seed):
    """Rebuild one maze exactly from its two seeds."""
    hard = kind == "hard"
    route = (random_route if hard else easy_route)(random.Random(route_seed))
    made = add_forks(route, random.Random(fork_seed), TRAPS if hard else 0)
    assert made, f"seeds {route_seed}/{fork_seed} no longer build a {kind} maze"
    edges, forks = made
    check(route, edges, forks, TRAPS if hard else 0)
    m = {"route_seed": route_seed, "fork_seed": fork_seed,
         "sealed": N * N - len(reachable(edges)), "zones": zones(route)}
    return route, edges, forks, m


def maze_data(option):
    """The maze as data, embedded in each SVG as data-maze, for anything
    interactive later (a draw-your-own-line mode, a new-maze button). JSON:
      size      grid is size x size; cells are [column, row] from top left
      entrance  cell with the opening in the left wall
      exit      cell with the opening in the right wall
      open      one hex digit per cell, row by row: bit 1 = open to the east,
                bit 2 = open to the south (west/north are the neighbour's bits)
      route     the solution, cell by cell
      forks     for each fork on the route: index into route, the first cell
                of the wrong way, and whether that wrong way is a trap (heads
                for the exit, so the dominant response is wrong there)
      seeds     to rebuild it with this script"""
    import json
    route, edges, forks, m = option
    bits = "".join(f"{(edge((c, r), (c + 1, r)) in edges) | 2 * (edge((c, r), (c, r + 1)) in edges):x}"
                   for r in range(N) for c in range(N))
    return json.dumps({
        "size": N, "entrance": list(START), "exit": list(GOAL), "open": bits,
        "route": [list(c) for c in route],
        "forks": [{"at": i, "wrong": list(cells[0]), "trap": trap} for i, cells, trap in forks],
        "seeds": {"route": m["route_seed"], "forks": m["fork_seed"]},
    }, separators=(",", ":"))


POOL = 60          # candidates of each kind to build and rank


def score(m, hard):
    """Rank: no sealed squares first, then a route that ranges over more of
    the maze, then (hard only) longer false starts."""
    return (-m["sealed"], m["zones"], m["detour"] if hard else 0)


def ranked(builds, hard):
    out = sorted(builds, key=lambda b: score(b[3], hard), reverse=True)
    return out


def hard_options():
    """Hard mazes, best first. Route: winding, has to go left at least 8
    squares in at least 3 stretches (one starting in the right half)."""
    builds = []
    for seed in range(20000):
        p = random_route(random.Random(seed))
        stretches = left_stretches(p)
        if not (len(p) == LENGTH and sum(n for _, n in stretches) >= 8 and len(stretches) >= 3
                and any(col > MID and n >= 3 for col, n in stretches)):
            continue
        try:
            edges, forks, m = build(p, TRAPS)
        except SystemExit:
            continue
        m["route_seed"] = seed
        builds.append((p, edges, forks, m))
        if len(builds) >= POOL:
            break
    return ranked(builds, True)


def easy_options():
    """Easy mazes, best first. Route never goes left."""
    builds = []
    for s in range(200000):
        route = easy_route(random.Random(s))
        if len(route) != LENGTH:
            continue
        try:
            edges, forks, m = build(route, 0)
        except SystemExit:
            continue
        m["route_seed"] = s
        builds.append((route, edges, forks, m))
        if len(builds) >= POOL:
            break
    return ranked(builds, False)


def nth(gen, k):
    for i, item in enumerate(gen, 1):
        if i == k:
            return item
    raise SystemExit(f"only {i} options available")


COMMON = ("The entrance is in the middle of the left side and the exit is straight across "
          f"on the right. The route has {CHOICES} places where it forks.")


def walk_for(option, hard):
    route, edges, forks, _ = option
    return walk_with_false_starts(route, forks, edges) if hard else [(c, False) for c in route]


def easy_svg(name, label, option):
    edges = option[1]
    return svg(name, label, edges, walk_for(option, False), data=maze_data(option), desc=
               f"The easy maze. {COMMON} At every fork, the wrong way leads left or away from the "
               f"exit, so heading toward the exit is always right. A red marker line traces the "
               f"route straight through.")


def hard_svg(name, label, option):
    edges = option[1]
    return svg(name, label, edges, walk_for(option, True), data=maze_data(option), desc=
               f"The hard maze. {COMMON} The route is the same length as the easy one, but at "
               f"{TRAPS} of the forks the way that heads toward the exit is a short dead end, and "
               f"the real route turns up, down or back. A red marker line traces the route at the "
               f"same speed, but it goes into each of those dead ends and backs out, so it takes "
               f"longer to finish.")


def contact_sheet(path, count):
    """An HTML page of `count` numbered options of each maze, to pick from."""
    def row(kind, gen, make):
        cells = []
        hard = kind == "hard"
        for k, option in zip(range(1, count + 1), gen):
            m = option[3]
            _, length = route_d(walk_for(option, hard), SIZE / N, random.Random(N))
            facts = [f"route in {m['zones']}/9 regions",
                     f"{m['sealed']} sealed squares" if m["sealed"] else "nothing sealed"]
            if hard:
                facts.append(f"false starts +{m['detour']} squares")
            facts.append(f"{length / SPEED:.1f} s")
            cells.append(f'<figure>{make(f"{kind}-{k}", f"{kind.title()} {k}", option)}'
                         f'<figcaption>{" · ".join(facts)}</figcaption></figure>')
        return "\n".join(cells)
    page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Maze options</title>
<style>
  :root {{ --sfs-text: #212529; --sfs-critical-color: #c63f3f; color-scheme: light; }}
  body {{ margin: 0; padding: 24px 16px; background: #fff; color: #212529; font-family: system-ui, sans-serif; }}
  h1 {{ font-size: 1.4rem; margin: 0 0 4px; }} h2 {{ font-size: 1.15rem; margin: 32px 0 8px; }}
  p {{ margin: 0 0 8px; max-width: 46rem; color: #444; }}
  .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }}
  figure {{ margin: 0; border: 1px solid #ddd; border-radius: 8px; padding: 10px 6px 8px; }}
  figcaption {{ font-size: 0.8rem; color: #555; text-align: center; margin-top: 4px; }}
</style></head><body>
<h1>Maze options</h1>
<p>Ranked best first: nothing sealed off, then the route ranging over more of the maze, then (hard) longer false starts. Every option has a {LENGTH}-square route and {CHOICES} forks. Easy: heading for the exit is right at all {CHOICES}. Hard: it's right at {CHOICES - TRAPS}; the other {TRAPS} are traps. Any easy pairs with any hard. Click a maze to replay its line.</p>
<p>To use a pair, run <code>python3 scripts/generate-mazes.py --easy 3 --hard 5</code>, then paste the seeds it prints into <code>LOCKED</code> in <code>scripts/generate-mazes.py</code>.</p>
<h2>Easy</h2>
<div class="grid">{row("easy", easy_options(), easy_svg)}</div>
<h2>Hard</h2>
<div class="grid">{row("hard", hard_options(), hard_svg)}</div>
</body></html>
"""
    Path(path).write_text(page)
    print(f"wrote {path}")


def main():
    import argparse
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--easy", type=int, metavar="K", help="use Easy K from the contact sheet instead of LOCKED")
    ap.add_argument("--hard", type=int, metavar="K", help="use Hard K from the contact sheet instead of LOCKED")
    ap.add_argument("--sheet", metavar="HTML", help="write a contact sheet of options here instead")
    ap.add_argument("--count", type=int, default=8, help="options of each kind on the sheet")
    args = ap.parse_args()

    if args.sheet:
        contact_sheet(args.sheet, args.count)
        return
    easy = nth(easy_options(), args.easy) if args.easy else from_seeds("easy", **LOCKED["easy"])
    hard = nth(hard_options(), args.hard) if args.hard else from_seeds("hard", **LOCKED["hard"])
    for kind, option in (("easy", easy), ("hard", hard)):
        m = option[3]
        print(f'{kind}: {{"route_seed": {m["route_seed"]}, "fork_seed": {m["fork_seed"]}}}')
    (OUT / "maze-easy.svg").write_text(easy_svg("easy", "Easy", easy))
    (OUT / "maze-hard.svg").write_text(hard_svg("hard", "Hard", hard))


if __name__ == "__main__":
    main()
