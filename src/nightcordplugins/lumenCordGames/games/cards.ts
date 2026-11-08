/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Card, cardEl, GameDef, isRed, newDeck, pick, RANKS, shuffle } from "./core";

// ───────────────────────── Blackjack ─────────────────────────
const blackjack: GameDef = {
    id: "blackjack", name: "Blackjack", icon: "🃏", color: "#22c55e", category: "Cards",
    description: "Beat the dealer to 21 without going bust. Start with 100 chips; cash out when you're ahead.",
    controls: "Pick a bet, then Hit, Stand or Double",
    start(api) {
        let chips = 100, bet = 10, deck: Card[] = [], you: Card[] = [], dealer: Card[] = [], phase: "bet" | "play" | "done" = "bet", msg = "Place your bet";
        const wrap = api.el("div", "lcg-table");
        const dealerRow = api.el("div", "lcg-hand", undefined, wrap);
        const dealerLbl = api.el("div", "lcg-hand-label", "", wrap);
        const msgEl = api.el("div", "lcg-msg", "", wrap);
        const youRow = api.el("div", "lcg-hand", undefined, wrap);
        const youLbl = api.el("div", "lcg-hand-label", "", wrap);
        const controls = api.el("div", "lcg-controls", undefined, wrap);

        const value = (h: Card[]) => {
            let v = 0, aces = 0;
            for (const c of h) { if (!c.up) continue; v += c.rank === 1 ? 11 : Math.min(c.rank, 10); if (c.rank === 1) aces++; }
            while (v > 21 && aces--) v -= 10;
            return v;
        };
        const draw = (up = true) => {
            if (deck.length < 15) deck = [...newDeck(), ...newDeck()];
            const c = deck.pop()!; c.up = up; return c;
        };
        const btn = (text: string, fn: () => void, kind = "", disabled = false) => {
            const b = api.el("button", `lcg-btn ${kind}`, text, controls);
            b.disabled = disabled;
            b.onclick = fn;
        };
        function render() {
            dealerRow.innerHTML = ""; youRow.innerHTML = "";
            dealer.forEach(c => dealerRow.appendChild(cardEl(c)));
            you.forEach(c => youRow.appendChild(cardEl(c)));
            dealerLbl.textContent = dealer.length ? `Dealer: ${value(dealer)}${dealer.some(c => !c.up) ? " + ?" : ""}` : "Dealer";
            youLbl.textContent = you.length ? `You: ${value(you)}  ·  Bet ${bet}` : `Chips: ${chips}`;
            msgEl.textContent = msg;
            api.setScore(chips);
            api.setStatus(`Chips ${chips}`);
            controls.innerHTML = "";
            if (phase === "bet" || phase === "done") {
                for (const b of [10, 25, 50, 100]) btn(`Bet ${b}`, () => deal(b), b === bet ? "primary" : "", b > chips);
                btn("Cash out", () => api.end(chips, chips >= 100 ? "Cashed out 💰" : "Cashed out", `You walked away with ${chips} chips.`), "ghost");
            } else {
                btn("Hit", hit, "primary");
                btn("Stand", stand);
                btn("Double", double, "", you.length !== 2 || chips < bet);
            }
        }
        function deal(b: number) {
            if (b > chips) return;
            bet = b; chips -= b;
            you = [draw(), draw()];
            dealer = [draw(), draw(false)];
            phase = "play"; msg = "Hit or stand?";
            if (value(you) === 21) return finish();
            render();
        }
        function hit() { you.push(draw()); if (value(you) > 21) return finish(); if (value(you) === 21) return stand(); render(); }
        function double() { chips -= bet; bet *= 2; you.push(draw()); if (value(you) > 21) return finish(); stand(); }
        function stand() {
            dealer[1].up = true;
            while (value(dealer) < 17) dealer.push(draw());
            finish();
        }
        function finish() {
            dealer.forEach(c => c.up = true);
            const y = value(you), d = value(dealer), bj = y === 21 && you.length === 2;
            if (y > 21) msg = "Bust! You lose.";
            else if (bj && !(d === 21 && dealer.length === 2)) { chips += Math.floor(bet * 2.5); msg = "Blackjack! 🎉 Pays 3 to 2."; }
            else if (d > 21 || y > d) { chips += bet * 2; msg = d > 21 ? "Dealer busts, you win!" : "You win!"; }
            else if (y === d) { chips += bet; msg = "Push, bet returned."; }
            else msg = "Dealer wins.";
            phase = "done";
            render();
            if (chips <= 0) api.later(() => api.end(0, "Out of chips", "The house wins this time."), 900);
        }
        render();
    }
};

// ───────────────────────── Go Fish ─────────────────────────
const goFish: GameDef = {
    id: "gofish", name: "Go Fish", icon: "🐟", color: "#38bdf8", category: "Cards",
    description: "Collect sets of four. Ask the computer for a rank you hold. If they don't have it, go fish!",
    controls: "Click one of your cards to ask for that rank",
    start(api) {
        const deck = newDeck();
        const hands: Card[][] = [deck.splice(0, 7), deck.splice(0, 7)];
        const books = [0, 0];
        const cpuMemory = new Set<number>();
        let turn = 0, busy = false;
        const wrap = api.el("div", "lcg-table");
        const cpuRow = api.el("div", "lcg-hand", undefined, wrap);
        const cpuLbl = api.el("div", "lcg-hand-label", "", wrap);
        const msgEl = api.el("div", "lcg-msg", "Your turn: click a card to ask for that rank.", wrap);
        const youRow = api.el("div", "lcg-hand fan", undefined, wrap);
        const youLbl = api.el("div", "lcg-hand-label", "", wrap);
        const say = (t: string) => msgEl.textContent = t;
        const name = (r: number) => (RANKS[r] === "A" ? "Aces" : RANKS[r] === "J" ? "Jacks" : RANKS[r] === "Q" ? "Queens" : RANKS[r] === "K" ? "Kings" : `${RANKS[r]}s`);

        function checkBooks(p: number) {
            const counts = new Map<number, number>();
            for (const c of hands[p]) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
            for (const [r, n] of counts) if (n === 4) { hands[p] = hands[p].filter(c => c.rank !== r); books[p]++; if (p === 1) cpuMemory.delete(r); }
        }
        function refill(p: number) { if (!hands[p].length && deck.length) hands[p].push(deck.pop()!); }
        function over() {
            return books[0] + books[1] === 13 || (!deck.length && (!hands[0].length || !hands[1].length));
        }
        function render() {
            cpuRow.innerHTML = ""; youRow.innerHTML = "";
            hands[1].forEach(() => cpuRow.appendChild(cardEl({ rank: 1, suit: "♠", up: false }, true)));
            hands[0].sort((a, b) => a.rank - b.rank).forEach(c => {
                const e = cardEl(c);
                e.classList.add("clickable");
                e.onclick = () => ask(c.rank);
                youRow.appendChild(e);
            });
            cpuLbl.textContent = `Computer · ${hands[1].length} cards · ${books[1]} sets`;
            youLbl.textContent = `You · ${books[0]} sets · Deck: ${deck.length}`;
            api.setScore(books[0]);
        }
        function finishIfOver() {
            if (!over()) return false;
            const win = books[0] > books[1];
            api.end(books[0], win ? "You win! 🐟" : books[0] === books[1] ? "It's a tie" : "Computer wins", `Sets: you ${books[0]}, computer ${books[1]}.`);
            return true;
        }
        function ask(rank: number) {
            if (turn !== 0 || busy) return;
            cpuMemory.add(rank);
            const got = hands[1].filter(c => c.rank === rank);
            if (got.length) {
                hands[1] = hands[1].filter(c => c.rank !== rank);
                hands[0].push(...got);
                say(`The computer had ${got.length} ${name(rank)}. Go again!`);
            } else {
                const c = deck.pop();
                if (c) { hands[0].push(c); say(c.rank === rank ? `Go fish… you drew a ${RANKS[rank]}! Go again!` : `Go fish! You drew a ${RANKS[c.rank]}${c.suit}.`); }
                else say("Go fish… the deck is empty.");
                if (!c || c.rank !== rank) turn = 1;
            }
            checkBooks(0); refill(0); refill(1);
            render();
            if (finishIfOver()) return;
            if (turn === 1) { busy = true; api.later(cpuTurn, 1100); }
            else if (!hands[0].length) { turn = 1; busy = true; api.later(cpuTurn, 900); }
        }
        function cpuTurn() {
            busy = false;
            if (finishIfOver()) return;
            if (!hands[1].length) { turn = 0; say("Your turn."); render(); return; }
            const remembered = hands[1].filter(c => cpuMemory.has(c.rank));
            const rank = (remembered.length ? pick(remembered) : pick(hands[1])).rank;
            const got = hands[0].filter(c => c.rank === rank);
            let again = false;
            if (got.length) {
                hands[0] = hands[0].filter(c => c.rank !== rank);
                hands[1].push(...got);
                say(`Computer asked for ${name(rank)}. You gave ${got.length}.`);
                again = true;
            } else {
                const c = deck.pop();
                if (c) hands[1].push(c);
                say(`Computer asked for ${name(rank)}. Go fish! Your turn.`);
                again = !!c && c.rank === rank;
            }
            checkBooks(1); refill(0); refill(1);
            render();
            if (finishIfOver()) return;
            if (again) { busy = true; api.later(cpuTurn, 1100); }
            else turn = 0;
        }
        checkBooks(0); checkBooks(1);
        render();
    }
};

// ───────────────────────── Solitaire (Klondike) ─────────────────────────
const solitaire: GameDef = {
    id: "solitaire", name: "Solitaire", icon: "♠️", color: "#a78bfa", category: "Cards",
    description: "Classic Klondike. Build the four suit piles from Ace to King.",
    controls: "Click a card, then click where it goes. Double-click sends it to the top piles.",
    start(api) {
        const deck = newDeck();
        const tab: Card[][] = [];
        for (let i = 0; i < 7; i++) { tab.push(deck.splice(0, i + 1)); tab[i].forEach((c, j) => c.up = j === i); }
        const stock = deck.map(c => ({ ...c, up: false })), waste: Card[] = [], found: Card[][] = [[], [], [], []];
        let sel: { from: "tab" | "waste" | "found"; pile: number; index: number; } | null = null, score = 0, moves = 0;

        const board = api.el("div", "lcg-sol");
        const top = api.el("div", "lcg-sol-top", undefined, board);
        const cols = api.el("div", "lcg-sol-cols", undefined, board);

        const canFound = (c: Card, f: Card[]) => f.length ? f[f.length - 1].suit === c.suit && f[f.length - 1].rank === c.rank - 1 : c.rank === 1;
        const canTab = (c: Card, t: Card[]) => {
            if (!t.length) return c.rank === 13;
            const last = t[t.length - 1];
            return last.up && isRed(last.suit) !== isRed(c.suit) && last.rank === c.rank + 1;
        };
        const selected = (): Card[] => {
            if (!sel) return [];
            if (sel.from === "waste") return waste.length ? [waste[waste.length - 1]] : [];
            if (sel.from === "found") return found[sel.pile].length ? [found[sel.pile][found[sel.pile].length - 1]] : [];
            return tab[sel.pile].slice(sel.index);
        };
        const removeSel = () => {
            if (!sel) return;
            if (sel.from === "waste") waste.pop();
            else if (sel.from === "found") found[sel.pile].pop();
            else {
                tab[sel.pile].splice(sel.index);
                const t = tab[sel.pile];
                if (t.length && !t[t.length - 1].up) { t[t.length - 1].up = true; score += 5; }
            }
        };
        function tryMove(to: "tab" | "found", pile: number) {
            const cards = selected();
            if (!cards.length || !sel) return false;
            if (to === "found") {
                if (cards.length !== 1 || !canFound(cards[0], found[pile])) return false;
                if (sel.from !== "found") score += 10;
                removeSel(); found[pile].push(cards[0]);
            } else {
                if (sel.from === "tab" && sel.pile === pile) return false;
                if (!canTab(cards[0], tab[pile])) return false;
                if (sel.from === "found") score = Math.max(0, score - 15);
                if (sel.from === "waste") score += 5;
                removeSel(); tab[pile].push(...cards);
            }
            moves++;
            sel = null;
            return true;
        }
        function autoFound(from: "tab" | "waste", pile: number, index: number) {
            sel = { from, pile, index };
            const cards = selected();
            if (cards.length === 1) for (let f = 0; f < 4; f++) if (tryMove("found", f)) return render();
            sel = null; render();
        }
        function render() {
            top.innerHTML = ""; cols.innerHTML = "";
            // stock
            const st = cardEl(stock.length ? stock[stock.length - 1] : null);
            st.classList.add("clickable");
            if (!stock.length) st.textContent = "↻";
            st.onclick = () => {
                sel = null;
                if (stock.length) { const c = stock.pop()!; c.up = true; waste.push(c); }
                else { while (waste.length) { const c = waste.pop()!; c.up = false; stock.push(c); } score = Math.max(0, score - 20); }
                render();
            };
            top.appendChild(st);
            const w = cardEl(waste.length ? waste[waste.length - 1] : null);
            if (waste.length) {
                w.classList.add("clickable");
                if (sel?.from === "waste") w.classList.add("sel");
                w.onclick = () => { sel = sel?.from === "waste" ? null : { from: "waste", pile: 0, index: 0 }; render(); };
                w.ondblclick = () => autoFound("waste", 0, 0);
            }
            top.appendChild(w);
            api.el("div", "lcg-sol-gap", undefined, top);
            found.forEach((f, i) => {
                const e = cardEl(f.length ? f[f.length - 1] : null);
                e.classList.add("clickable");
                if (!f.length) e.textContent = "A";
                if (sel?.from === "found" && sel.pile === i) e.classList.add("sel");
                e.onclick = () => {
                    if (sel && tryMove("found", i)) return render();
                    sel = f.length ? { from: "found", pile: i, index: f.length - 1 } : null;
                    render();
                };
                top.appendChild(e);
            });
            tab.forEach((t, i) => {
                const col = api.el("div", "lcg-sol-col", undefined, cols);
                col.onclick = e => { if (e.target === col && sel && tryMove("tab", i)) render(); };
                if (!t.length) {
                    const s = cardEl(null);
                    s.classList.add("clickable");
                    s.onclick = () => { if (sel && tryMove("tab", i)) render(); };
                    col.appendChild(s);
                }
                let off = 0;
                t.forEach((c, j) => {
                    const e = cardEl(c);
                    e.style.top = `${off}px`;
                    off += c.up ? 17 : 6;
                    if (sel?.from === "tab" && sel.pile === i && j >= sel.index) e.classList.add("sel");
                    if (c.up) {
                        e.classList.add("clickable");
                        e.onclick = () => {
                            if (sel && !(sel.from === "tab" && sel.pile === i) && tryMove("tab", i)) return render();
                            sel = sel?.from === "tab" && sel.pile === i && sel.index === j ? null : { from: "tab", pile: i, index: j };
                            render();
                        };
                        if (j === t.length - 1) e.ondblclick = () => autoFound("tab", i, j);
                    }
                    col.appendChild(e);
                });
                col.style.height = `${off + 72}px`;
            });
            api.setScore(score);
            api.setStatus(`Moves ${moves}`);
            if (found.every(f => f.length === 13)) api.end(score + 200, "You win! 🎉", `Solved in ${moves} moves.`);
        }
        render();
    }
};

// ───────────────────────── Memory Match ─────────────────────────
const memory: GameDef = {
    id: "memory", name: "Memory Match", icon: "🧠", color: "#f472b6", category: "Puzzle", scoreKind: "time",
    description: "Flip two cards at a time and find all 10 pairs as fast as you can.",
    controls: "Click cards to flip them",
    start(api) {
        const faces = shuffle(["🌙", "⭐", "🪐", "☄️", "🔮", "💎", "🌌", "🚀", "👾", "🌠", "🍋", "🌭", "🎮", "👑"]).slice(0, 10);
        const cards = shuffle([...faces, ...faces].map((f, i) => ({ f, i, open: false, done: false })));
        let first: typeof cards[0] | null = null, lock = false, found = 0, start = 0, moves = 0;
        const grid = api.el("div", "lcg-memory");
        const timer = setInterval(() => { if (start) api.setScore((Date.now() - start) / 1000); }, 250);
        api.cleanup(() => clearInterval(timer));
        const els = cards.map(c => {
            const e = api.el("button", "lcg-mem", "", grid);
            e.onclick = () => flip(c, e);
            return e;
        });
        function flip(c: typeof cards[0], e: HTMLElement) {
            if (lock || c.open || c.done) return;
            if (!start) start = Date.now();
            c.open = true; e.textContent = c.f; e.classList.add("open");
            if (!first) { first = c; return; }
            moves++;
            api.setStatus(`Moves ${moves}`);
            const a = first; first = null;
            if (a.f === c.f) {
                a.done = c.done = true;
                els[cards.indexOf(a)].classList.add("done"); e.classList.add("done");
                if (++found === faces.length) api.end((Date.now() - start) / 1000, "All pairs found! 🧠", `${moves} moves.`);
            } else {
                lock = true;
                api.later(() => {
                    a.open = c.open = false;
                    for (const x of [a, c]) { const el = els[cards.indexOf(x)]; el.textContent = ""; el.classList.remove("open"); }
                    lock = false;
                }, 700);
            }
        }
    }
};

export const CARDS: GameDef[] = [blackjack, goFish, solitaire, memory];
