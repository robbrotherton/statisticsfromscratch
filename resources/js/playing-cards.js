/* Shared card artwork. Faces stay in their final geometry during a reveal:
   only visibility and the frame's shadow change, never the glyphs' scale. */
(function (global) {
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const suits = ['spades', 'hearts', 'diamonds', 'clubs'];
  const symbols = ['♠', '♥', '♦', '♣'];
  const paths = [
    'M0-10C-3-6-9-2-9 3C-9 8-3 9 0 5C3 9 9 8 9 3C9-2 3-6 0-10ZM-1 4L-5 11H5L1 4Z',
    'M0 10C-7 4-10 0-10-4C-10-10-3-12 0-6C3-12 10-10 10-4C10 0 7 4 0 10Z',
    'M0-11L8 0L0 11L-8 0Z',
    'M0-10C-5-10-7-4-3-1C-9-4-13 2-9 6C-6 9-2 7-1 4C-1 7-3 9-5 11H5C3 9 1 7 1 4C2 7 6 9 9 6C13 2 9-4 3-1C7-4 5-10 0-10Z'
  ];
  const columns = (ys) => ys.flatMap(y => [[32, y], [68, y]]);
  const pips = {
    1: [[50, 70]], 2: [[50, 36], [50, 104]],
    3: [[50, 36], [50, 70], [50, 104]],
    4: columns([36, 104]), 5: [...columns([36, 104]), [50, 70]],
    6: columns([36, 70, 104]), 7: [...columns([36, 70, 104]), [50, 53]],
    8: [...columns([36, 70, 104]), [50, 53], [50, 87]],
    9: [...columns([31, 57, 83, 109]), [50, 70]],
    10: [...columns([31, 57, 83, 109]), [50, 44], [50, 96]]
  };

  function validate(rank, suit) {
    if (!Number.isInteger(rank) || rank < 1 || rank > 13 ||
        !Number.isInteger(suit) || suit < 0 || suit > 3) {
      throw new RangeError('A playing card needs rank 1–13 and suit 0–3.');
    }
  }

  function face(rank, suit) {
    validate(rank, suit);
    const pip = (x, y, scale = 1, rotate = 0) =>
      `<path d="${paths[suit]}" transform="translate(${x} ${y}) rotate(${rotate}) scale(${scale})"/>`;
    const index = `<text x="12" y="22" font-size="${rank === 10 ? 17 : 20}">${ranks[rank - 1]}</text>${pip(12, 33, 0.48)}`;
    const center = rank <= 10
      ? pips[rank].map(([x, y]) => pip(x, y, rank === 1 ? 1.8 : 0.84, y > 70 ? 180 : 0)).join('')
      : `<rect x="27" y="28" width="46" height="84" rx="21" fill="none" stroke="currentColor" stroke-opacity=".2"/>
         <path d="M36 49L34 38L44 43L50 33L56 43L66 38L64 49Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
         <text x="50" y="79" font-size="30" font-family="Georgia, serif">${ranks[rank - 1]}</text>${pip(50, 96, 0.65)}`;
    return `<svg class="sfs-card-art" viewBox="0 0 100 140" aria-hidden="true" focusable="false" fill="currentColor" text-anchor="middle" font-family="'Source Sans 3', system-ui, sans-serif" font-weight="600">${index}<g transform="rotate(180 50 70)">${index}</g><g class="sfs-card-pips">${center}</g></svg>`;
  }

  function label(rank, suit) {
    validate(rank, suit);
    return `${({1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King'})[rank] || rank} of ${suits[suit]}`;
  }

  function create(rank, suit, compact = false) {
    validate(rank, suit);
    const card = document.createElement('div');
    card.className = `sfs-card${compact ? ' sfs-card-compact' : ''}${suit === 1 || suit === 2 ? ' is-red' : ''}`;
    card.setAttribute('aria-hidden', 'true');
    card.innerHTML = compact
      ? `<span class="cie-card-rank">${ranks[rank - 1]}</span><span class="cie-card-suit">${symbols[suit]}</span>`
      : face(rank, suit);
    return card;
  }

  global.SFSPlayingCards = { face, label, create };

  global.makePlayingCardHand = function (opts = {}) {
    const values = opts.ranks || [];
    const suitValues = opts.suits || [];
    if (!values.length || values.length !== suitValues.length || values.length > 50) {
      throw new RangeError('A hand needs 1–50 ranks and matching suits.');
    }
    const hidden = new Set(opts.hidden || []); // zero-based positions, not ranks
    const compact = opts.compact === true || values.length > 10;
    const hand = document.createElement('div');
    hand.className = 'sfs-card-hand sfs-figure';
    hand.style.setProperty('--card-columns', Math.min(values.length, compact ? 10 : 5));
    hand.classList.toggle('sfs-card-hand-compact', compact);
    hand.setAttribute('role', 'img');
    hand.setAttribute('aria-label', values.map((rank, i) => hidden.has(i) ? 'Face-down card' : label(rank, suitValues[i])).join(', '));
    values.forEach((rank, i) => {
      const card = create(rank, suitValues[i], compact);
      card.classList.toggle('is-face-down', hidden.has(i));
      card.style.setProperty('--card-delay', `${i * Math.min(opts.stagger ?? 75, 600 / values.length)}ms`);
      hand.appendChild(card);
    });
    const reduced = () => document.documentElement.dataset.motion === 'reduced' ||
      global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (opts.animate !== false && !reduced() && typeof global.onVisible === 'function') {
      hand.classList.add('is-pending');
      global.onVisible(hand, () => {
        hand.classList.remove('is-pending');
        if (!reduced()) hand.classList.add('is-dealt');
      }, 0.35);
    }
    return hand;
  };
})(window);
