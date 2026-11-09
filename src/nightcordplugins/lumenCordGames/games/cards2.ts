/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/* Crazy Eights */

import { Card, cardEl, GameDef, newDeck, Suit, SUITS } from "./core";

export const crazyEights: GameDef = {
    id: "crazy8", name: "Crazy Eights", icon: "🎴", color: "#8b5cf6", category: "Cards",
    description: "Match the top card by suit or number. 8s are wild! First to get rid of all their cards wins.",
    controls: "Click a card to play it · click the deck to draw",
    start(api) {
        let deck = newDeck(), pile: Card[] = [], wins = 0;
        const hands: Card[][] = [[], [], []];
        let suit: Suit = "♠", turn = 0, busy = false, choosing = false;
        const NAMES = ["You", "Nova", "Comet"];
        const table = api.el("div", "lcg-table");
        const top = api.el("div", "lcg-c8-opps", undefined, table);
        const opp = [1, 2].map(i => { const box = api.el("div", "lcg-c8-opp", undefined, top); const label = api.el("div", "lcg-hand-label", NAMES[i], box); const hand = api.el("div", "lcg-hand fan", undefined, box); return { label, hand }; });
        const mid = api.el("div", "lcg-c8-mid", undefined, table);
        const deckEl = api.el("div", "lcg-c8-deck", undefined, mid);
        const pileEl = api.el("div", "", undefined, mid);
        const suitEl = api.el("div", "lcg-c8-suit", undefined, mid);
        const msg = api.el("div", "lcg-msg", "", table);
        const picker = api.el("div", "lcg-controls", undefined, table);
        const myHand = api.el("div", "lcg-hand fan", undefined, table);
        api.el("div", "lcg-hand-label", "Your hand", table);
        deckEl.onclick = () => { if (turn === 0 && !busy && !choosing) humanDraw(); };

        const draw = (p: number) => {
            if (!deck.length) { const keep = pile.pop()!; deck = pile.map(c => ({ ...c, up: true })).sort(() => Math.random() - .5); pile = [keep]; }
            const c = deck.pop();
            if (c) hands[p].push(c);
            return c;
        };
        const canPlay = (c: Card) => c.rank === 8 || c.suit === suit || c.rank === pile[pile.length - 1].rank;
        function deal() {
            deck = newDeck(); pile = []; hands.forEach(h => h.length = 0);
            for (let i = 0; i < 7; i++) for (let p = 0; p < 3; p++) draw(p);
            let first = deck.pop()!;
            while (first.rank === 8) { deck.unshift(first); first = deck.pop()!; }
            pile.push(first); suit = first.suit; turn = 0; busy = false; choosing = false;
            msg.textContent = "Your turn: match the suit or number. 8s are wild!";
            render();
        }
        function render() {
            opp.forEach((o, i) => {
                o.hand.innerHTML = "";
                hands[i + 1].forEach(() => o.hand.appendChild(cardEl({ rank: 1, suit: "♠", up: false }, true)));
                o.label.textContent = `${NAMES[i + 1]} · ${hands[i + 1].length} cards${turn === i + 1 ? " · thinking…" : ""}`;
            });
            deckEl.innerHTML = "";
            const back = cardEl({ rank: 1, suit: "♠", up: false });
            back.classList.add("clickable");
            deckEl.appendChild(back);
            api.el("div", "lcg-hand-label", `${deck.length} left`, deckEl);
            pileEl.innerHTML = "";
            pileEl.appendChild(cardEl(pile[pile.length - 1]));
            suitEl.textContent = `Suit: ${suit}`;
            suitEl.className = `lcg-c8-suit${suit === "♥" || suit === "♦" ? " red" : ""}`;
            myHand.innerHTML = "";
            hands[0].sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || a.rank - b.rank).forEach(c => {
                const e = cardEl(c);
                if (turn === 0 && !busy && !choosing && canPlay(c)) { e.classList.add("clickable"); e.onclick = () => humanPlay(c); }
                else e.style.filter = "brightness(.72)";
                myHand.appendChild(e);
            });
            api.setScore(wins);
        }
        function afterPlay(p: number) {
            if (!hands[p].length) {
                if (p === 0) { wins++; msg.textContent = "You won the round! 🎉 Next round…"; render(); busy = true; api.later(deal, 1600); }
                else { render(); api.end(wins, `${NAMES[p]} went out first`, `Rounds you won: ${wins}`); }
                return true;
            }
            return false;
        }
        function humanPlay(c: Card) {
            hands[0].splice(hands[0].indexOf(c), 1);
            pile.push(c);
            if (afterPlay(0)) return;
            if (c.rank === 8) {
                choosing = true;
                msg.textContent = "Wild 8! Pick the new suit:";
                picker.innerHTML = "";
                for (const s of SUITS) {
                    const b = api.el("button", "lcg-btn" + (s === "♥" || s === "♦" ? " red" : ""), s, picker);
                    b.onclick = () => { suit = s; choosing = false; picker.innerHTML = ""; next(); };
                }
                render();
                return;
            }
            suit = c.suit;
            next();
        }
        function humanDraw() {
            const c = draw(0);
            msg.textContent = c && canPlay(c) ? "You drew a card you can play!" : "You drew a card.";
            render();
            if (!hands[0].some(canPlay)) { msg.textContent = "Nothing to play, turn passes."; next(); }
        }
        function next() {
            turn = (turn + 1) % 3;
            render();
            if (turn !== 0) { busy = true; api.later(cpu, 750); }
            else { busy = false; msg.textContent = hands[0].some(canPlay) ? "Your turn." : "No playable cards: click the deck to draw."; render(); }
        }
        function cpu() {
            const p = turn, hand = hands[p];
            let play = hand.filter(c => canPlay(c) && c.rank !== 8)
                .sort((a, b) => hand.filter(x => x.suit === b.suit).length - hand.filter(x => x.suit === a.suit).length)[0]
                ?? hand.find(c => c.rank === 8);
            let tries = 0;
            while (!play && tries++ < 3) { const c = draw(p); if (c && canPlay(c)) play = c; }
            if (play) {
                hand.splice(hand.indexOf(play), 1);
                pile.push(play);
                if (play.rank === 8) {
                    const counts = SUITS.map(s => hand.filter(c => c.suit === s).length);
                    suit = SUITS[counts.indexOf(Math.max(...counts))];
                    msg.textContent = `${NAMES[p]} played a wild 8 and picked ${suit}!`;
                } else { suit = play.suit; msg.textContent = `${NAMES[p]} played a card.`; }
                if (hand.length === 1) msg.textContent += ` ${NAMES[p]} has ONE card left!`;
                if (afterPlay(p)) return;
            } else msg.textContent = `${NAMES[p]} couldn't play.`;
            next();
        }
        deal();
    }
};
