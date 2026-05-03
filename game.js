let animationFrameId = null;
// ─── GOOGLE SHEETS CONFIG ─────────────────────────────────────────────────────
const SHEET_TABS = {
    path: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRLux8wUWBie8iABrxq8JzZnOE3UqbfIjr2VnpzR0g-QDhGd2hBoF1rLKwsZY9bSU-cv8Piycw2v_i1/pub?gid=0&single=true&output=csv",
    slots: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRLux8wUWBie8iABrxq8JzZnOE3UqbfIjr2VnpzR0g-QDhGd2hBoF1rLKwsZY9bSU-cv8Piycw2v_i1/pub?gid=1667184741&single=true&output=csv",
    enemies: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRLux8wUWBie8iABrxq8JzZnOE3UqbfIjr2VnpzR0g-QDhGd2hBoF1rLKwsZY9bSU-cv8Piycw2v_i1/pub?gid=1237640164&single=true&output=csv",
    towers: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRLux8wUWBie8iABrxq8JzZnOE3UqbfIjr2VnpzR0g-QDhGd2hBoF1rLKwsZY9bSU-cv8Piycw2v_i1/pub?gid=1295348356&single=true&output=csv",
    waves: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRLux8wUWBie8iABrxq8JzZnOE3UqbfIjr2VnpzR0g-QDhGd2hBoF1rLKwsZY9bSU-cv8Piycw2v_i1/pub?gid=767042368&single=true&output=csv",
    activeSkills: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRLux8wUWBie8iABrxq8JzZnOE3UqbfIjr2VnpzR0g-QDhGd2hBoF1rLKwsZY9bSU-cv8Piycw2v_i1/pub?gid=725712595&single=true&output=csv",
};
function sheetURL(tab) {
    return SHEET_TABS[tab];
}
function parseCSV(text) {
    const lines = text.trim().split("\n").map(l => l.trim()).filter(l => l.length);
    const headers = lines[0].split(",").map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = line.split(",").map(v => v.trim());
        const obj = {};
        headers.forEach((h, i) => obj[h] = values[i]);
        return obj;
    });
}

function showLoadError(message) {
    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#1a2a1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ff6060";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Failed to load level data!", canvas.width / 2, canvas.height / 2 - 20);
    ctx.fillStyle = "#f0f0d8";
    ctx.font = "13px Arial";
    ctx.fillText(message, canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillText("Check your Google Sheet is published and tab names are correct.", canvas.width / 2, canvas.height / 2 + 35);
}

async function loadLevelData() {
    const tabs = ["path", "slots", "enemies", "towers", "waves", "activeSkills"];

    let results;
    try {
        results = await Promise.all(tabs.map(tab =>
            fetch(sheetURL(tab))
                .then(r => {
                    if (!r.ok) throw new Error(`Tab "${tab}" returned ${r.status}`);
                    return r.text();
                })
                .then(text => ({ tab, data: parseCSV(text) }))
        ));
    } catch (err) {
        showLoadError(err.message);
        return false;
    }

    const byTab = {};
    for (const { tab, data } of results) {
        if (!data || data.length === 0) {
            showLoadError(`Tab "${tab}" is empty or missing.`);
            return false;
        }
        byTab[tab] = data;

    }
    console.log("byTab.activeSkills:", byTab.activeSkills);
    console.log("skillDefs after parse:", skillDefs);
    // ── Path ──
    try {
        path.length = 0;
        for (const row of byTab.path) {
            const id = parseInt(row.id);
            path.push({ col: id % GRID_COLS, row: Math.floor(id / GRID_COLS) });
        }
    } catch (e) {
        showLoadError("Error parsing path tab: " + e.message);
        return false;
    }

    // ── Slots ──
    try {
        towerSlots.length = 0;
        for (const row of byTab.slots) {
            const id = parseInt(row.id);
            towerSlots.push({ col: id % GRID_COLS, row: Math.floor(id / GRID_COLS) });
        }
    } catch (e) {
        showLoadError("Error parsing slots tab: " + e.message);
        return false;
    }

    // ── Enemies ──
    try {
        enemyDefs = {};
        for (const row of byTab.enemies) {
            enemyDefs[row.type] = {
                speed: parseFloat(row.speed),
                hp: parseFloat(row.hp),
                damage: parseFloat(row.damage),
                goldDrop: parseFloat(row.goldDrop)
            };
        }
    } catch (e) {
        showLoadError("Error parsing enemies tab: " + e.message);
        return false;
    }

    // ── Towers ──
    try {
        towerDefs = {};
        for (const row of byTab.towers) {
            towerDefs[row.type] = {
                cost: parseFloat(row.cost),
                damage: parseFloat(row.damage),
                fireRate: parseFloat(row.fireRate),
                range: parseFloat(row.range),
                upgradeCost: parseFloat(row.upgradeCost),
                upgradeDamage: parseFloat(row.upgradeDamage),
                upgradeRange: parseFloat(row.upgradeRange)
            };
        }
    } catch (e) {
        showLoadError("Error parsing towers tab: " + e.message);
        return false;
    }

    // ── Waves ──
    try {
        waveDefs = byTab.waves.map(row => ({
            wave: parseInt(row.wave),
            enemyCount: parseInt(row.enemyCount),
            spawnDelay: parseInt(row.spawnDelay),
            wardenEveryN: parseInt(row.wardenEveryN)
        }));
    } catch (e) {
        showLoadError("Error parsing waves tab: " + e.message);
        return false;
    }

    // ── Active Skills ──
    try {
        skillDefs = {};
        for (const row of byTab.activeSkills) {
            skillDefs[row.name] = {
                damage: parseFloat(row.damage),
                cooldown: parseFloat(row.cooldown),
                radius: parseFloat(row.radius)
            };
        }
    } catch (e) {
        showLoadError("Error parsing activeSkills tab: " + e.message);
        return false;
    }

    return true;
}
// ─── HEX GRID SETUP ───────────────────────────────────────────────────────────
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 840;
canvas.height = 540;

const HEX_SIZE = 24;
const HEX_W = Math.sqrt(3) * HEX_SIZE;
const HEX_H = 2 * HEX_SIZE;
const COL_STEP = HEX_W;
const ROW_STEP = HEX_H * 0.75;

const GRID_COLS = 19;
const GRID_ROWS = 13;

const ORIGIN_X = HEX_W / 2;
const ORIGIN_Y = HEX_SIZE;

// Elias stands on a fixed tile adjacent to the fence
const ELIAS_COL = 18; // adjust if needed to sit next to your fence
const ELIAS_ROW = 9;

const MAX_FENCE_ATTACKERS = 3;
const LUMBERJACK_ATTACK_INTERVAL = 2500;
const WARDEN_ATTACK_INTERVAL = 3000;

const restartBtn = { x: 0, y: 0, w: 160, h: 40 };

// ─── IMAGES ───────────────────────────────────────────────────────────────────
const lumberjackImage = new Image();
lumberjackImage.src = "images/lumberjack.png";
const catapultImage = new Image();
catapultImage.src = "images/catapult.png";
const wardenImage = new Image();
wardenImage.src = "images/warden.png";
const crossbowImage = new Image();
crossbowImage.src = "images/crossbowTower.png";
const fenceImage = new Image();
fenceImage.src = "images/fence.png";
const eliasImage = new Image();
eliasImage.src = "images/elias.png";
const molotovIcon = new Image();
molotovIcon.src = "images/molotov.png";
const acidIcon = new Image();
acidIcon.src = "images/acid.png";
// Anchor offsets — raise sprite by this many px to compensate for transparent padding
const LUMBERJACK_ANCHOR_OFFSET = 12;  // tweak this per sprite
const CATAPULT_ANCHOR_OFFSET = 12;  // tweak this per sprite
const WARDEN_ANCHOR_OFFSET = 12; // tweak as needed
const CROSSBOW_ANCHOR_OFFSET = 12; // tweak as needed

crossbowImage.onload = () => console.log("Crossbow image loaded!");
crossbowImage.onerror = () => console.error("Crossbow image FAILED to load!");

// ─── UI ELEMENTS ──────────────────────────────────────────────────────────────
const livesDisplay = document.getElementById("lives");
const goldDisplay = document.getElementById("gold");
const waveDisplay = document.getElementById("wave");
const messageDisplay = document.getElementById("message");

const MENU_W = 140;
const MENU_ROW1 = 24; // info text
const MENU_ROW2 = 52; // upgrade text  
const MENU_ROW3 = 80; // scrap text
const MENU_H_TOWER = 95;
const MENU_H_SLOT = 80;
const MAX_FENCE_HP = 30;


// ─── GAME STATE ───────────────────────────────────────────────────────────────
let fence = {
    hp: MAX_FENCE_HP,
    maxHp: MAX_FENCE_HP,
    attackers: [] // enemies currently attacking the fence
};
let fenceFlicker = { active: false, start: 0 };
let gameOver = false;
let gameWon = false;
let gold = 100;
let wave = 1;
let bullets = [];
let activeMenu = null; // { col, row, mode } mode = "slot" or "tower"

let enemies = [];
let towers = [];
let splashes = [];
let enemiesToSpawn = 0;
let spawnTimer = 0;
let spawnDelay = 60;
let spawnCount = 0; // tracks total enemies spawned this wave
let betweenWaves = true;
let waveTimer = 180;

let path = [];
let towerSlots = [];
let enemyDefs = {};
let towerDefs = {};
let waveDefs = [];
let floatingNumbers = [];

let skillDefs = {};
let activeSkills = {
    molotov: { cooldownStart: -Infinity, ready: false },
    acid: { cooldownStart: -Infinity, ready: false }
};
let pendingSkill = null; // "molotov" or "acid" — waiting for click on canvas

// ─── HEX MATH ─────────────────────────────────────────────────────────────────
function hexToPixel(col, row) {
    const x = ORIGIN_X + col * COL_STEP + (row % 2 === 1 ? HEX_W / 2 : 0);
    const y = ORIGIN_Y + row * ROW_STEP;
    return { x, y };
}
// Returns the 6 valid neighbours of a hex in offset coordinates
function hexNeighbours(col, row) {
    const isOdd = row % 2 === 1;
    return [
        { col: col + 1, row: row },       // right
        { col: col - 1, row: row },       // left
        { col: col, row: row - 1 },   // top-right (even) / top-left (odd) — same col
        { col: col, row: row + 1 },   // bottom
        { col: col + (isOdd ? 1 : -1), row: row - 1 }, // diagonal up
        { col: col + (isOdd ? 1 : -1), row: row + 1 }, // diagonal down
    ].filter(n => n.col >= 0 && n.col < GRID_COLS && n.row >= 0 && n.row < GRID_ROWS);
}

function areNeighbours(a, b) {
    return hexNeighbours(a.col, a.row).some(n => n.col === b.col && n.row === b.row);
}

function hexCorners(cx, cy) {
    const corners = [];
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i - 30);
        corners.push({
            x: cx + HEX_SIZE * Math.cos(angle),
            y: cy + HEX_SIZE * Math.sin(angle)
        });
    }
    return corners;
}

function drawHex(cx, cy, fillColor, strokeColor = "#ffffff22") {
    const corners = hexCorners(cx, cy);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();
}

function pixelToHex(px, py) {
    let bestCol = 0, bestRow = 0, bestDist = Infinity;
    for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
            const { x, y } = hexToPixel(col, row);
            const d = Math.hypot(px - x, py - y);
            if (d < bestDist) {
                bestDist = d;
                bestCol = col;
                bestRow = row;
            }
        }
    }
    return { col: bestCol, row: bestRow };
}

function isPathHex(col, row) {
    return path.some(h => h.col === col && h.row === row);
}

// ─── CANVAS HEX MASK ──────────────────────────────────────────────────────────
// Clips the entire canvas to a large hexagon shape, hiding the corners.
function applyHexMask() {
    // Find the actual pixel extent of all hex tile corners
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
            const { x, y } = hexToPixel(col, row);
            for (const c of hexCorners(x, y)) {
                minX = Math.min(minX, c.x);
                minY = Math.min(minY, c.y);
                maxX = Math.max(maxX, c.x);
                maxY = Math.max(maxY, c.y);
            }
        }
    }

    const gridCx = (minX + maxX) / 2;
    const gridCy = (minY + maxY) / 2;

    // Use identical radius for both axes — true regular hexagon
    // Take the larger of the two half-extents so all tiles fit inside
    const rx = (maxX - minX) / 2;
    const ry = (maxY - minY) / 2;
    // A regular hex with circumradius R has width = R*√3 and height = R*2
    // Solve for R that fits both: R = max(rx / (√3/2), ry)
    const radius = Math.max(rx / (Math.sqrt(3) / 2), ry) + 4;

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6; // pointy-top orientation
        const px = gridCx + radius * Math.cos(angle);
        const py = gridCy + radius * Math.sin(angle);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.clip();
}

// ─── PATH (~-shape, left → right) ────────────────────────────────────────────
// A tilde-like wave: rises, peaks, dips, troughs, rises again across the grid.

function drawTileIDs() {
    ctx.font = "8px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
            const { x, y } = hexToPixel(col, row);
            const id = row * GRID_COLS + col;
            ctx.fillStyle = "rgba(255,255,255,0.7)";
            ctx.fillText(id, x, y);
        }
    }
}

function isSlotHex(col, row) {
    return towerSlots.some(s => s.col === col && s.row === row);
}

function getSlot(col, row) {
    return towerSlots.find(s => s.col === col && s.row === row);
}
function drawElias() {
    const { x: cx, y: cy } = hexToPixel(ELIAS_COL, ELIAS_ROW);
    const ew = HEX_SIZE * 2;
    const eh = HEX_SIZE * 2.5;
    // Highlight tile
    drawHex(cx, cy, "rgba(255,220,100,0.15)");
    // Sprite — center bottom anchored
    ctx.drawImage(eliasImage, cx - ew / 2, cy - eh, ew, eh);
}
// ─── WAVES ────────────────────────────────────────────────────────────────────
function updateWaves() {
    if (gameOver) return;

    if (betweenWaves) {
        if (--waveTimer <= 0) startWave();
        return;
    }
    if (enemiesToSpawn > 0) {
        if (--spawnTimer <= 0) {
            spawnEnemy();
            enemiesToSpawn--;
            spawnTimer = spawnDelay;
        }
    }
    if (enemiesToSpawn === 0 && enemies.length === 0) {
        if (wave >= waveDefs.length) {
            gameWon = true;
            return;
        }
        betweenWaves = true;
        wave++;
        waveTimer = 180;
        updateUI();
    }
}

function startWave() {
    betweenWaves = false;
    const def = waveDefs[Math.min(wave - 1, waveDefs.length - 1)];
    enemiesToSpawn = def.enemyCount;
    spawnDelay = def.spawnDelay;
    spawnTimer = 0;
    spawnCount = 0;
    updateUI();
}


// ─── ENEMIES ──────────────────────────────────────────────────────────────────
function spawnEnemy() {
    spawnCount++;
    const currentWaveDef = waveDefs[Math.min(wave - 1, waveDefs.length - 1)];
    const isWarden = spawnCount % currentWaveDef.wardenEveryN === 0;
    const def = isWarden ? enemyDefs["warden"] : enemyDefs["lumberjack"];
    const start = hexToPixel(path[0].col, path[0].row);
    enemies.push({
        pathIndex: 0,
        x: start.x,
        y: start.y,
        speed: def.speed,
        hp: def.hp,
        maxHp: def.hp,
        damage: def.damage,
        goldDrop: def.goldDrop,
        type: isWarden ? "warden" : "lumberjack",
        dead: false,
        dirX: 1
    });
}

function updateEnemies() {
    const now = performance.now();
    const lastTile = path[path.length - 1];
    const fencePixel = hexToPixel(lastTile.col, lastTile.row);

    for (let enemy of enemies) {
        // Skip already-dead enemies
        if (enemy.dead) continue;

        // If already attacking fence, handle attack logic
        if (enemy.attackingFence) {
            if (!enemy.nextAttackTime) {
                const interval = enemy.type === "warden" ? WARDEN_ATTACK_INTERVAL : LUMBERJACK_ATTACK_INTERVAL;
                enemy.nextAttackTime = now + interval;
            }
            if (now >= enemy.nextAttackTime) {
                fence.hp -= enemy.damage;
                fenceFlicker = { active: true, start: performance.now() };
                spawnHitFeedback(hexToPixel(path[path.length - 1].col, path[path.length - 1].row).x,
                    hexToPixel(path[path.length - 1].col, path[path.length - 1].row).y - 30,
                    enemy.damage, "#ff4444");
                const interval = enemy.type === "warden" ? WARDEN_ATTACK_INTERVAL : LUMBERJACK_ATTACK_INTERVAL;
                enemy.nextAttackTime = now + interval;
                updateUI();
                if (fence.hp <= 0) {
                    fence.hp = 0;
                    gameOver = true;
                }
            }
            continue;
        }

        // Move along path
        const next = path[enemy.pathIndex + 1];
        if (!next) {
            // Reached the fence tile
            const attackerCount = enemies.filter(e => e.attackingFence).length;
            if (attackerCount < MAX_FENCE_ATTACKERS) {
                enemy.attackingFence = true;
                enemy.x = fencePixel.x;
                enemy.y = fencePixel.y;
            } else {
                // Wait in place — queue behind attackers
                enemy.waiting = true;
            }
            continue;
        }

        // If waiting, check if a spot opened up
        if (enemy.waiting) {
            const attackerCount = enemies.filter(e => e.attackingFence).length;
            if (attackerCount < MAX_FENCE_ATTACKERS) {
                enemy.attackingFence = true;
                enemy.waiting = false;
                enemy.x = fencePixel.x;
                enemy.y = fencePixel.y;
            }
            continue;
        }

        const target = hexToPixel(next.col, next.row);
        const dx = target.x - enemy.x;
        const dy = target.y - enemy.y;
        const dist = Math.hypot(dx, dy);
        enemy.dirX = Math.sign(dx);
        if (dist < enemy.speed) {
            enemy.pathIndex++;
        } else {
            enemy.x += (dx / dist) * enemy.speed;
            enemy.y += (dy / dist) * enemy.speed;
        }
    }

    // When an attacker dies, remove from attackers so waiting enemies can move up
    enemies = enemies.filter(e => !e.dead);
    // Let waiting enemies move up if attacker slots opened
    const attackerCount = enemies.filter(e => e.attackingFence).length;
    if (attackerCount < MAX_FENCE_ATTACKERS) {
        const fencePixel = hexToPixel(lastTile.col, lastTile.row);
        for (let enemy of enemies) {
            if (enemy.waiting && enemies.filter(e => e.attackingFence).length < MAX_FENCE_ATTACKERS) {
                enemy.attackingFence = true;
                enemy.waiting = false;
                enemy.x = fencePixel.x;
                enemy.y = fencePixel.y;
            }
        }
    }
}

function drawEnemies() {
    const now = performance.now();
    for (let enemy of enemies) {
        const isWarden = enemy.type === "warden";
        const sw = isWarden ? 52 : 40;
        const sh = isWarden ? 56 : 48;
        const offset = isWarden ? WARDEN_ANCHOR_OFFSET : LUMBERJACK_ANCHOR_OFFSET;
        const sprite = isWarden ? wardenImage : lumberjackImage;

        const drawX = enemy.x - sw / 2;
        const drawY = enemy.y - sh + offset;

        ctx.save();

        // Flicker effect — red tint blinks twice over 400ms
        if (enemy.flicker) {
            const flickerElapsed = now - enemy.flickerStart;
            const flickerDuration = 400;
            if (flickerElapsed > flickerDuration) {
                enemy.flicker = false;
            } else {
                // Two blinks: sin wave at 2x frequency
                const blink = Math.sin((flickerElapsed / flickerDuration) * Math.PI * 4);
                if (blink > 0) {
                    // Draw to offscreen canvas first
                    const offscreen = document.createElement("canvas");
                    offscreen.width = sw;
                    offscreen.height = sh;
                    const offCtx = offscreen.getContext("2d");

                    // Draw sprite onto offscreen
                    if (enemy.dirX < 0) {
                        offCtx.save();
                        offCtx.translate(sw, 0);
                        offCtx.scale(-1, 1);
                        offCtx.drawImage(sprite, 0, 0, sw, sh);
                        offCtx.restore();
                    } else {
                        offCtx.drawImage(sprite, 0, 0, sw, sh);
                    }

                    // Apply red tint only to non-transparent pixels
                    offCtx.globalCompositeOperation = "source-atop";
                    offCtx.fillStyle = "rgba(255, 0, 0, 0.6)";
                    offCtx.fillRect(0, 0, sw, sh);

                    // Draw tinted result onto main canvas
                    ctx.drawImage(offscreen, drawX, drawY);
                    ctx.restore();

                    // HP bar
                    ctx.fillStyle = "red";
                    ctx.fillRect(drawX, drawY - 6, sw, 4);
                    ctx.fillStyle = isWarden ? "orange" : "lime";
                    ctx.fillRect(drawX, drawY - 6, sw * (enemy.hp / enemy.maxHp), 4);
                    continue;
                }
            }
        }

        if (enemy.dirX < 0) {
            ctx.scale(-1, 1);
            ctx.drawImage(sprite, -drawX - sw, drawY, sw, sh);
        } else {
            ctx.drawImage(sprite, drawX, drawY, sw, sh);
        }
        ctx.restore();

        // HP bar
        ctx.fillStyle = "red";
        ctx.fillRect(drawX, drawY - 6, sw, 4);
        ctx.fillStyle = isWarden ? "orange" : "lime";
        ctx.fillRect(drawX, drawY - 6, sw * (enemy.hp / enemy.maxHp), 4);
    }
}
//---------- floating damage numbers and hit feedback ----------
function spawnHitFeedback(x, y, amount, color) {
    floatingNumbers.push({
        x,
        y,
        text: `-${amount}`,
        color,
        startTime: performance.now(),
        duration: 900 // ms
    });
}

function triggerFlicker(enemy) {
    enemy.flicker = true;
    enemy.flickerStart = performance.now();
}
function updateFloatingNumbers() {
    const now = performance.now();
    floatingNumbers = floatingNumbers.filter(n => now - n.startTime < n.duration);
}

function drawFloatingNumbers() {
    const now = performance.now();
    for (let n of floatingNumbers) {
        const elapsed = now - n.startTime;
        const progress = elapsed / n.duration; // 0 → 1
        const alpha = 1 - progress;
        const floatY = n.y - 30 * progress; // floats upward 30px

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.fillStyle = n.color;
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth = 3;
        ctx.strokeText(n.text, n.x, floatY);
        ctx.fillText(n.text, n.x, floatY);
        ctx.restore();
    }
}

// ─── TOWERS ───────────────────────────────────────────────────────────────────


canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;

    // Active skill targeting
    if (pendingSkill) {
        const def = skillDefs[pendingSkill];
        // Deal damage to all enemies in radius
        for (let enemy of enemies) {
            const d = Math.hypot(enemy.x - px, enemy.y - py);
            if (d <= def.radius) {
                enemy.hp -= def.damage;
                triggerFlicker(enemy);
                spawnHitFeedback(enemy.x, enemy.y - 20, def.damage, "#ffd700");
                if (enemy.hp <= 0) {
                    enemy.dead = true;
                    gold += enemy.goldDrop;
                    updateUI();
                }
            }
        }
        enemies = enemies.filter(e => !e.dead);

        // Spawn splash animation
        const color = pendingSkill === "molotov" ? "255,120,30" : "120,255,60";
        splashes.push({
            x: px,
            y: py,
            maxRadius: def.radius,
            startTime: performance.now(),
            duration: 600,
            color
        });

        // Start cooldown
        activeSkills[pendingSkill].cooldownStart = performance.now();
        pendingSkill = null;
        skillMessage.innerText = "";
        return;
    }

    const { col, row } = pixelToHex(px, py);
    // Restart button
    if ((gameOver || gameWon) &&
        px >= restartBtn.x && px <= restartBtn.x + restartBtn.w &&
        py >= restartBtn.y && py <= restartBtn.y + restartBtn.h) {
        cancelAnimationFrame(animationFrameId);
        fence = { hp: MAX_FENCE_HP, maxHp: MAX_FENCE_HP, attackers: [] };
        gameOver = false;
        gameWon = false;
        enemies = [];
        towers = [];
        bullets = [];
        splashes = [];
        wave = 1;
        enemiesToSpawn = 0;
        spawnTimer = 0;
        spawnCount = 0;
        betweenWaves = true;
        waveTimer = 180;
        gold = 100;
        activeMenu = null;
        activeSkills = {
            molotov: { cooldownStart: performance.now(), ready: false },
            acid: { cooldownStart: performance.now(), ready: false }
        };
        pendingSkill = null;
        floatingNumbers = [];
        fenceFlicker = { active: false, start: 0 };
        updateUI();
        gameLoop();
        return;
    }
    // If a menu is open, check if click is inside it
    if (activeMenu) {
        const { x: cx, y: cy } = hexToPixel(activeMenu.col, activeMenu.row);
        const menuX = cx - MENU_W / 2;

        if (activeMenu.mode === "slot") {
            const menuY = cy - MENU_H_SLOT - HEX_SIZE;
            if (px >= menuX && px <= menuX + MENU_W && py >= menuY && py <= menuY + MENU_H_SLOT) {
                const relY = py - menuY;
                // Catapult row: text at MENU_ROW1, clickable up to midpoint between row1 and row2
                if (relY < (MENU_ROW1 + MENU_ROW2) / 2) {
                    const catDef = towerDefs["catapult"];
                    if (gold >= catDef.cost) {
                        towers.push({
                            type: "catapult", col: activeMenu.col, row: activeMenu.row,
                            range: catDef.range, damage: catDef.damage, fireRate: catDef.fireRate,
                            cooldown: 0, tier: 1, target: null
                        });
                        gold -= catDef.cost;
                        messageDisplay.innerText = "Catapult placed!";
                        updateUI();
                    } else { messageDisplay.innerText = "Not enough gold!"; }
                } else {
                    const bowDef = towerDefs["crossbow"];
                    if (gold >= bowDef.cost) {
                        towers.push({
                            type: "crossbow", col: activeMenu.col, row: activeMenu.row,
                            range: bowDef.range, damage: bowDef.damage, fireRate: bowDef.fireRate,
                            cooldown: 0, tier: 1, target: null
                        });
                        gold -= bowDef.cost;
                        messageDisplay.innerText = "Crossbow placed!";
                        updateUI();
                    } else { messageDisplay.innerText = "Not enough gold!"; }
                }
                activeMenu = null;
                return;
            }

        } else if (activeMenu.mode === "tower") {
            if (activeMenu.scrapConfirm) {
                const menuH = 60;
                const menuY = cy - menuH - HEX_SIZE;
                if (px >= menuX && px <= menuX + MENU_W && py >= menuY && py <= menuY + menuH) {
                    const relY = py - menuY;
                    if (relY < 35) {
                        const tower = towers.find(t => t.col === activeMenu.col && t.row === activeMenu.row);
                        const refund = Math.floor((tower.type === "catapult" ? 50 : 30) * 0.3);
                        towers = towers.filter(t => !(t.col === activeMenu.col && t.row === activeMenu.row));
                        gold += refund;
                        messageDisplay.innerText = `Scrapped! +${refund}g refunded.`;
                        updateUI();
                    }
                    activeMenu = null;
                    return;
                }
            } else {
                const menuY = cy - MENU_H_TOWER - HEX_SIZE;
                if (px >= menuX && px <= menuX + MENU_W && py >= menuY && py <= menuY + MENU_H_TOWER) {
                    const relY = py - menuY;
                    const upgradeZone = (MENU_ROW2 + MENU_ROW3) / 2; // midpoint between upgrade and scrap
                    if (relY < upgradeZone) {
                        // Upgrade zone
                        const tower = towers.find(t => t.col === activeMenu.col && t.row === activeMenu.row);
                        if (tower.tier >= 2) {
                            messageDisplay.innerText = "Already max tier!";
                            activeMenu = null;
                            return;
                        }
                        const def = towerDefs[tower.type];
                        const upgradeCost = def.upgradeCost;
                        if (gold >= upgradeCost) {
                            gold -= upgradeCost;
                            tower.damage += def.upgradeDamage;
                            tower.range += def.upgradeRange;
                            tower.tier = 2;
                            messageDisplay.innerText = `${tower.type === "catapult" ? "Catapult" : "Crossbow"} upgraded!`;
                            updateUI();
                        } else {
                            messageDisplay.innerText = "Not enough gold!";
                        }
                    } else {
                        // Scrap zone
                        activeMenu = { ...activeMenu, scrapConfirm: true };
                        return;
                    }
                    activeMenu = null;
                    return;
                }
            }
        }

        activeMenu = null;
        return;
    }

    // No menu open
    const existingTower = towers.find(t => t.col === col && t.row === row);
    if (existingTower) {
        activeMenu = { col, row, mode: "tower", scrapConfirm: false };
        return;
    }
    if (isSlotHex(col, row)) {
        activeMenu = { col, row, mode: "slot" };
    }
});
window.addEventListener("keydown", (e) => {
    if (gameOver || gameWon) return;

    if (e.key === "1") {
        const skill = activeSkills["molotov"];
        const def = skillDefs["molotov"];
        if (!def) return;
        const ready = performance.now() - skill.cooldownStart >= def.cooldown;
        if (ready) {
            pendingSkill = "molotov";
            skillMessage.innerText = "Molotov ready — click on the canvas to throw!";
        } else {
            skillMessage.innerText = "Molotov is on cooldown!";
        }
    }

    if (e.key === "2") {
        const skill = activeSkills["acid"];
        const def = skillDefs["acid"];
        if (!def) return;
        const ready = performance.now() - skill.cooldownStart >= def.cooldown;
        if (ready) {
            pendingSkill = "acid";
            skillMessage.innerText = "Acid ready — click on the canvas to throw!";
        } else {
            skillMessage.innerText = "Acid is on cooldown!";
        }
    }
});
function drawMenu() {
    if (!activeMenu) return;

    const { x: cx, y: cy } = hexToPixel(activeMenu.col, activeMenu.row);
    const menuX = cx - MENU_W / 2;

    if (activeMenu.mode === "slot") {
        const menuY = cy - MENU_H_SLOT - HEX_SIZE;
        ctx.fillStyle = "#1a2a1a";
        ctx.strokeStyle = "#8b6f47";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(menuX, menuY, MENU_W, MENU_H_SLOT, 6);
        ctx.fill();
        ctx.stroke();

        ctx.font = "bold 11px Arial";
        ctx.textAlign = "left";
        ctx.fillStyle = gold >= 50 ? "#f0f0d8" : "#888";
        ctx.fillText("⚙ Catapult - 50g", menuX + 10, menuY + MENU_ROW1);
        ctx.fillStyle = gold >= 30 ? "#f0f0d8" : "#888";
        ctx.fillText("🏹 Crossbow - 30g", menuX + 10, menuY + MENU_ROW2);

    } else if (activeMenu.mode === "tower") {
        const tower = towers.find(t => t.col === activeMenu.col && t.row === activeMenu.row);
        if (!tower) return;

        if (activeMenu.scrapConfirm) {
            const menuH = 60;
            const menuY = cy - menuH - HEX_SIZE;
            ctx.fillStyle = "#1a2a1a";
            ctx.strokeStyle = "#8b6f47";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(menuX, menuY, MENU_W, menuH, 6);
            ctx.fill();
            ctx.stroke();

            ctx.font = "bold 11px Arial";
            ctx.textAlign = "left";
            ctx.fillStyle = "#ff6060";
            ctx.fillText("✓ Confirm scrap", menuX + 10, menuY + 24);
            ctx.fillStyle = "#666";
            ctx.fillText("click elsewhere to cancel", menuX + 10, menuY + 44);

        } else {
            const menuY = cy - MENU_H_TOWER - HEX_SIZE;
            ctx.fillStyle = "#1a2a1a";
            ctx.strokeStyle = "#8b6f47";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(menuX, menuY, MENU_W, MENU_H_TOWER, 6);
            ctx.fill();
            ctx.stroke();

            const isCrossbow = tower.type === "crossbow";
            const upgradeCost = isCrossbow ? 20 : 35;
            const canUpgrade = tower.tier < 2 && gold >= upgradeCost;
            const maxTier = tower.tier >= 2;
            const refund = Math.floor((isCrossbow ? 30 : 50) * 0.3);

            ctx.font = "bold 11px Arial";
            ctx.textAlign = "left";

            // Row 1: info
            ctx.fillStyle = "#aaa";
            ctx.fillText(`${isCrossbow ? "Crossbow" : "Catapult"} T${tower.tier}  DMG:${tower.damage}`, menuX + 10, menuY + MENU_ROW1);

            // Divider
            ctx.strokeStyle = "#444";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(menuX + 8, menuY + MENU_ROW1 + 8);
            ctx.lineTo(menuX + MENU_W - 8, menuY + MENU_ROW1 + 8);
            ctx.stroke();

            // Row 2: upgrade
            ctx.fillStyle = maxTier ? "#555" : canUpgrade ? "#f0f0d8" : "#888";
            ctx.fillText(maxTier ? "⬆ Max tier" : `⬆ Upgrade - ${upgradeCost}g`, menuX + 10, menuY + MENU_ROW2);

            // Divider
            ctx.strokeStyle = "#444";
            ctx.beginPath();
            ctx.moveTo(menuX + 8, menuY + MENU_ROW2 + 8);
            ctx.lineTo(menuX + MENU_W - 8, menuY + MENU_ROW2 + 8);
            ctx.stroke();

            // Row 3: scrap
            ctx.fillStyle = "#ff9060";
            ctx.fillText(`🗑 Scrap (+${refund}g)`, menuX + 10, menuY + MENU_ROW3);
        }
    }
}

function drawFence() {
    const last = path[path.length - 1];
    const { x: cx, y: cy } = hexToPixel(last.col, last.row);
    const fw = HEX_SIZE * 2;
    const fh = HEX_SIZE * 2;
    const now = performance.now();

    ctx.save();
    ctx.drawImage(fenceImage, cx - fw / 2, cy - fh, fw, fh);

    // Flicker
    if (fenceFlicker.active) {
        const elapsed = now - fenceFlicker.start;
        if (elapsed > 400) {
            fenceFlicker.active = false;
        } else {
            const blink = Math.sin((elapsed / 400) * Math.PI * 4);
            if (blink > 0) {
                ctx.globalCompositeOperation = "source-atop";
                ctx.fillStyle = "rgba(255,0,0,0.5)";
                ctx.fillRect(cx - fw / 2, cy - fh, fw, fh);
            }
        }
    }
    ctx.restore();

    // HP bar
    const barW = HEX_SIZE * 2;
    const barH = 6;
    const barX = cx - barW / 2;
    const barY = cy - fh - 10;
    ctx.fillStyle = "#333";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = fence.hp > fence.maxHp * 0.5 ? "lime" : fence.hp > fence.maxHp * 0.25 ? "orange" : "red";
    ctx.fillRect(barX, barY, barW * (fence.hp / fence.maxHp), barH);
    ctx.fillStyle = "#f0f0d8";
    ctx.font = "bold 9px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${fence.hp}/${fence.maxHp}`, cx, barY - 2);
}
function updateTowers() {
    for (let tower of towers) {
        if (tower.cooldown > 0) { tower.cooldown--; tower.target = null; continue; }

        const { x: tx, y: ty } = hexToPixel(tower.col, tower.row);
        let closest = null, closestDist = Infinity;

        for (let enemy of enemies) {
            const d = Math.hypot(enemy.x - tx, enemy.y - ty);
            if (d <= tower.range && d < closestDist) {
                closest = enemy;
                closestDist = d;
            }
        }

        if (closest) {
            closest.hp -= tower.damage;
            tower.cooldown = tower.fireRate;
            tower.target = null;
            triggerFlicker(closest);

            const isSplashTower = tower.type === "catapult";

            // Direct hit feedback
            spawnHitFeedback(closest.x, closest.y - 20, tower.damage, "#ff4444");

            if (isSplashTower) {
                // Splash damage
                for (let other of enemies) {
                    if (other === closest) continue;
                    const d = Math.hypot(other.x - closest.x, other.y - closest.y);
                    if (d <= 50) {
                        const splashDmg = tower.damage * 0.5;
                        other.hp -= splashDmg;
                        triggerFlicker(other);
                        spawnHitFeedback(other.x, other.y - 20, splashDmg, "#ff8800");
                        if (other.hp <= 0) {
                            other.dead = true;
                            gold += other.goldDrop;
                            updateUI();
                        }
                    }
                }
                splashes.push({
                    x: closest.x, y: closest.y,
                    maxRadius: 50,
                    startTime: performance.now(),
                    duration: 600
                });
            }

            // Bullet
            const { x: tx, y: ty } = hexToPixel(tower.col, tower.row);
            bullets.push({
                x: tx, y: ty, sx: tx, sy: ty,
                tx: closest.x, ty: closest.y,
                speed: tower.type === "crossbow" ? 10 : 6,
                color: tower.type === "crossbow" ? "#7de8ff" : "#f5c842",
                done: false
            });

             if (closest.hp <= 0) {
                closest.dead = true;
                gold += closest.goldDrop;
                updateUI();
            }
        } 
    } 
    enemies = enemies.filter(e => !e.dead);
} 

        function drawTowers() {
            for (let tower of towers) {
                const { x: cx, y: cy } = hexToPixel(tower.col, tower.row);
                const isCrossbow = tower.type === "crossbow";
                const iw = isCrossbow ? 64 : 64;
                const ih = isCrossbow ? 64 : 94;
                const offset = isCrossbow ? CROSSBOW_ANCHOR_OFFSET : CATAPULT_ANCHOR_OFFSET;
                const sprite = isCrossbow ? crossbowImage : catapultImage;

                ctx.drawImage(sprite, cx - iw / 2, cy - ih + offset, iw, ih);
                // Tier 2 outline
                if (tower.tier === 2) {
                    const outlineColor = isCrossbow ? "#4488ff" : "#88ccff";
                    ctx.strokeStyle = outlineColor;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    const corners = hexCorners(cx, cy);
                    ctx.moveTo(corners[0].x, corners[0].y);
                    for (let i = 1; i < 6; i++) ctx.lineTo(corners[i].x, corners[i].y);
                    ctx.closePath();
                    ctx.stroke();
                }
                // Range ring
                ctx.strokeStyle = isCrossbow
                    ? "rgba(100, 200, 255, 0.15)"
                    : "rgba(255, 255, 255, 0.12)";
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(cx, cy, tower.range, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        function updateBullets() {
            for (let bullet of bullets) {
                const dx = bullet.tx - bullet.x;
                const dy = bullet.ty - bullet.y;
                const dist = Math.hypot(dx, dy);
                if (dist < bullet.speed) {
                    bullet.done = true;
                } else {
                    bullet.x += (dx / dist) * bullet.speed;
                    bullet.y += (dy / dist) * bullet.speed;
                }
            }
            bullets = bullets.filter(b => !b.done);
        }

        function drawBullets() {
            for (let bullet of bullets) {
                ctx.save();
                const angle = Math.atan2(bullet.ty - bullet.sy, bullet.tx - bullet.sx);
                ctx.translate(bullet.x, bullet.y);
                ctx.rotate(angle);

                ctx.beginPath();
                ctx.ellipse(0, 0, 5, 2.5, 0, 0, Math.PI * 2);
                ctx.fillStyle = bullet.color;
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(-5, 0);
                ctx.lineTo(-12, 0);
                ctx.strokeStyle = bullet.color.replace(")", ", 0.4)").replace("rgb", "rgba");
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.restore();
            }
        }
        function updateSplashes() {
            const now = performance.now();
            splashes = splashes.filter(s => now - s.startTime < s.duration);
        }

        function drawSplashes() {
            const now = performance.now();
            for (let splash of splashes) {
                const elapsed = now - splash.startTime;
                const growDuration = 150;
                const shrinkDuration = 450;
                let radius;
                if (elapsed < growDuration) {
                    radius = (elapsed / growDuration) * splash.maxRadius;
                } else {
                    radius = ((shrinkDuration - (elapsed - growDuration)) / shrinkDuration) * splash.maxRadius;
                }
                radius = Math.max(0, radius);
                const color = splash.color || "255,60,60"; // default red for catapult
                const alpha = 0.15 + 0.25 * (radius / splash.maxRadius);

                ctx.beginPath();
                ctx.arc(splash.x, splash.y, radius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(${color}, ${alpha})`;
                ctx.fillStyle = `rgba(${color}, ${alpha * 0.4})`;
                ctx.lineWidth = 2;
                ctx.fill();
                ctx.stroke();
            }
        }
        function drawRestartButton() {
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            restartBtn.x = cx - restartBtn.w / 2;
            restartBtn.y = cy + 60;

            ctx.fillStyle = "#2d3f2d";
            ctx.strokeStyle = "#8b6f47";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(restartBtn.x, restartBtn.y, restartBtn.w, restartBtn.h, 6);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#f0f0d8";
            ctx.font = "bold 16px Arial";
            ctx.textAlign = "center";
            ctx.fillText("↺ Restart", cx, restartBtn.y + 26);
        }
        function drawGameOver() {
            ctx.fillStyle = "rgba(0,0,0,0.7)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#ff4444";
            ctx.font = "bold 36px Arial";
            ctx.textAlign = "center";
            ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 20);
            ctx.fillStyle = "#f0f0d8";
            ctx.font = "16px Arial";
            ctx.fillText("The fence was destroyed!", canvas.width / 2, canvas.height / 2 + 20);
            drawRestartButton();
        }
        function drawGameWon() {
            ctx.fillStyle = "rgba(0,0,0,0.7)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#ffd700";
            ctx.font = "bold 36px Arial";
            ctx.textAlign = "center";
            ctx.fillText("YOU WIN!", canvas.width / 2, canvas.height / 2 - 20);
            ctx.fillStyle = "#f0f0d8";
            ctx.font = "16px Arial";
            ctx.fillText("All waves defeated!", canvas.width / 2, canvas.height / 2 + 20);
            drawRestartButton();
        }
        // ─── GRID ─────────────────────────────────────────────────────────────────────
        function drawGrid() {
            for (let row = 0; row < GRID_ROWS; row++) {
                for (let col = 0; col < GRID_COLS; col++) {
                    const { x, y } = hexToPixel(col, row);
                    let color = "#355e3b"; // forest
                    if (isPathHex(col, row)) color = "#9b7653"; // path
                    else if (isSlotHex(col, row) &&
                        !towers.some(t => t.col === col && t.row === row)) color = "#6a3d8f"; // empty slot
                    drawHex(x, y, color);
                }
            }
        }

        // ─── UI ───────────────────────────────────────────────────────────────────────
        function updateUI() {
            livesDisplay.innerText = fence.hp;
            goldDisplay.innerText = gold;
            waveDisplay.innerText = `${wave}/${waveDefs.length}`;
        }
        const molotovCanvas = document.getElementById("molotovTimer");
        const acidCanvas = document.getElementById("acidTimer");
        const skillMessage = document.getElementById("skillMessage");

        function updateSkillUI() {
            drawSkillTimer(molotovCanvas, "molotov", molotovIcon);
            drawSkillTimer(acidCanvas, "acid", acidIcon);
            console.log("skillDefs:", skillDefs);
        }

        function drawSkillTimer(timerCanvas, skillName, icon) {
            if (!skillDefs[skillName]) return;
            const tc = timerCanvas.getContext("2d");
            const w = timerCanvas.width;
            const h = timerCanvas.height;
            const def = skillDefs[skillName];
            if (!def) return;

            const now = performance.now();
            const elapsed = now - activeSkills[skillName].cooldownStart;
            const progress = Math.min(elapsed / def.cooldown, 1); // 0 = just used, 1 = ready
            const ready = progress >= 1;

            tc.clearRect(0, 0, w, h);

            // Draw icon
            tc.drawImage(icon, 0, 0, w, h);

            // Dark overlay that shrinks downward as cooldown completes
            if (!ready) {
                const overlayH = h * (1 - progress);
                tc.fillStyle = "rgba(0,0,0,0.65)";
                tc.fillRect(0, 0, w, overlayH);

                // Cooldown text
                const remaining = ((def.cooldown - elapsed) / 1000).toFixed(1);
                tc.fillStyle = "#fff";
                tc.font = "bold 13px Arial";
                tc.textAlign = "center";
                tc.fillText(remaining + "s", w / 2, h / 2);
            } else {
                // Ready glow border
                tc.strokeStyle = pendingSkill === skillName ? "#fff" : "#ffd700";
                tc.lineWidth = 3;
                tc.strokeRect(1, 1, w - 2, h - 2);

                tc.fillStyle = pendingSkill === skillName ? "#fff" : "#ffd700";
                tc.font = "bold 12px Arial";
                tc.textAlign = "center";

            }
        }
        // ─── GAME LOOP ────────────────────────────────────────────────────────────────
        function gameLoop() {
            ctx.save();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            applyHexMask();

            if (gameOver || gameWon) {
                drawGrid();
                drawFence();
                ctx.restore();
                if (gameOver) drawGameOver();
                else drawGameWon();
                return;
            }

            updateWaves();
            updateEnemies();
            updateTowers();
            updateBullets();
            updateSplashes();
            updateFloatingNumbers();

            drawGrid();
            drawElias();
            drawFence();
            drawTowers();
            drawSplashes();
            drawBullets();
            drawEnemies();
            drawMenu();
            drawFloatingNumbers();

            ctx.restore();
            updateUI();
            if (Object.keys(skillDefs).length > 0) {
                updateSkillUI();
            }
            animationFrameId = requestAnimationFrame(gameLoop);
        }
        // Show loading screen then start
        const loadingCtx = canvas.getContext("2d");
        loadingCtx.fillStyle = "#1a2a1a";
        loadingCtx.fillRect(0, 0, canvas.width, canvas.height);
        loadingCtx.fillStyle = "#f0f0d8";
        loadingCtx.font = "bold 16px Arial";
        loadingCtx.textAlign = "center";
        loadingCtx.fillText("Loading level data...", canvas.width / 2, canvas.height / 2);

        loadLevelData().then(success => {
            if (success) {
                updateUI();
                gameLoop();
            }
        });
