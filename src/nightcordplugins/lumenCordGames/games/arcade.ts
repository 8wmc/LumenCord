/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { jetDash, retroSnake, stackTower } from "./arcade3";
import { blobArena } from "./blob";
import { bricks } from "./bricks";
import type { GameDef } from "./core";
import { flappy } from "./flappy";
import { fruitSlice } from "./fruit";
import { hopper } from "./hopper";
import { muncher } from "./muncher";
import { orbRoll } from "./orbroll";
import { pong } from "./pong";
import { rocks } from "./rocks";
import { runner } from "./runner";
import { shooter } from "./shooter";
import { skyHop } from "./skyhop";
import { glowSnake } from "./slither";

export const ARCADE: GameDef[] = [glowSnake, blobArena, muncher, flappy, orbRoll, hopper, runner, skyHop, jetDash, fruitSlice, shooter, rocks, bricks, stackTower, retroSnake, pong];
