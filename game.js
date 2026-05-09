let animationFrameId = null;
let lastFrameTime = null;
// ─── GOOGLE SHEETS CONFIG ─────────────────────────────────────────────────────
const SHEET_TABS = {
    path: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRLux8wUWBie8iABrxq8JzZnOE3UqbfIjr2VnpzR0g-QDhGd2hBoF1rLKwsZY9bSU-cv8Piycw2v_i1/pub?gid=0&single=true&output=csv",
    slots: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRLux8wUWBie8iABrxq8JzZnOE3UqbfIjr2VnpzR0g-QDhGd2hBoF1rLKwsZY9bSU-cv8Piycw2v_i1/pub?gid=1667184741&single=true&output=csv",
    enemies: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRLux8wUWBie8iABrxq8JzZnOE3UqbfIjr2VnpzR0g-QDhGd2hBoF1rLKwsZY9bSU-cv8Piycw2v_i1/pub?gid=1237640164&single=true&output=csv",
    towers: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRLux8wUWBie8iABrxq8JzZnOE3UqbfIjr2VnpzR0g-QDhGd2hBoF1rLKwsZY9bSU-cv8Piycw2v_i1/pub?gid=1295348356&single=true&output=csv",
    waves: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRLux8wUWBie8iABrxq8JzZnOE3UqbfIjr2VnpzR0g-QDhGd2hBoF1rLKwsZY9bSU-cv8Piycw2v_i1/pub?gid=767042368&single=true&output=csv",
    activeSkills: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRLux8wUWBie8iABrxq8JzZnOE3UqbfIjr2VnpzR0g-QDhGd2hBoF1rLKwsZY9bSU-cv8Piycw2v_i1/pub?gid=725712595&single=true&output=csv",
    workshops: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRLux8wUWBie8iABrxq8JzZnOE3UqbfIjr2VnpzR0g-QDhGd2hBoF1rLKwsZY9bSU-cv8Piycw2v_i1/pub?gid=1398188100&single=true&output=csv",
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

const CACHE_KEY = "fpd_levelData_v3";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function loadLevelData() {
    const tabs = ["path", "slots", "enemies", "towers", "waves", "activeSkills", "workshops"];

    // Try cache first
    try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
        if (cached && Date.now() - cached.ts < CACHE_TTL) {
            return applyLevelData(cached.byTab);
        }
    } catch (_) {}

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

    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), byTab })); } catch (_) {}

    return applyLevelData(byTab);
}

function applyLevelData(byTab) {
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
                speed:    parseFloat(row.speed),
                hp:       parseFloat(row.hp),
                damage:   parseFloat(row.damage),
                drops:    parseDrops(row.drops)
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
            const type = row.type;
            const tier = parseInt(row.tier);
            if (!towerDefs[type]) towerDefs[type] = { maxTier: 0 };
            towerDefs[type][tier] = {
                cost:              parseCosts(row.cost),
                damage:            parseFloat(row.damage) || 0,
                fireRate:          parseFloat(row.fireRate) || 0,
                range:             parseFloat(row.range) || 0,
                aoeRadius:         parseFloat(row.aoeRadius) || 0,
                aoeDuration:       parseFloat(row.aoeDuration) || 0,
                aoeDamageInterval: parseFloat(row.aoeDamageInterval) || 0,
                cooldown:          parseFloat(row.cooldown) || 0
            };
            if (tier > towerDefs[type].maxTier) towerDefs[type].maxTier = tier;
        }
    } catch(e) {
        showLoadError("Error parsing towers tab: " + e.message);
        return false;
    }

    // ── Waves ──
    try {
        waveDefs = byTab.waves.map(row => {
            const pulses = row.array.split("|").map(pulse =>
                pulse.split(":").map(code => code.trim())
            );
            return {
                wave:          parseInt(row.wave),
                unitInterval:  parseInt(row.unitInterval),
                pulseInterval: parseInt(row.pulseInterval),
                pulses
            };
        });
    } catch(e) {
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

    // ── Workshops ──
    try {
        workshopDefs = {};
        for (const row of byTab.workshops) {
            const type = row.type;
            const tier = parseInt(row.tier);
            if (!workshopDefs[type]) workshopDefs[type] = { maxTier: 0 };
            workshopDefs[type][tier] = {
                cost:           parseCosts(row.cost),
                product:        row.product.trim(),
                productAmount:  parseInt(row.productAmount),
                productionTime: parseInt(row.productionTime)
            };
            if (tier > workshopDefs[type].maxTier) workshopDefs[type].maxTier = tier;
        }
    } catch(e) {
        showLoadError("Error parsing workshops tab: " + e.message);
        return false;
    }

    return true;
}
// ─── HEX GRID SETUP ───────────────────────────────────────────────────────────
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 840;
canvas.height = 540;
const gameScreen = document.getElementById("gameScreen");
const farmScreen = document.getElementById("farmScreen");
const farmCanvas = document.getElementById("farmCanvas");
const farmCtx = farmCanvas.getContext("2d");

const HEX_SIZE = 20;
const HEX_W = Math.sqrt(3) * HEX_SIZE;
const HEX_H = 2 * HEX_SIZE;
const COL_STEP = HEX_W;
const ROW_STEP = HEX_H * 0.75;

const GRID_COLS = 21;
const GRID_ROWS = 17;

// Hex-shaped playfield: cube radius from center tile
const HEX_GRID_RADIUS = 8;
const HEX_GRID_CENTER_COL = 10;
const HEX_GRID_CENTER_ROW = 8;

// Center the grid on the canvas
const ORIGIN_X = canvas.width  / 2 - HEX_GRID_CENTER_COL * HEX_W;
const ORIGIN_Y = canvas.height / 2 - HEX_GRID_CENTER_ROW * ROW_STEP;

// Elias stands on a fixed tile adjacent to the fence
const ELIAS_COL = 18;
const ELIAS_ROW = 8;

const MAX_FENCE_ATTACKERS = 3;
const LUMBERJACK_ATTACK_INTERVAL = 2500;
const WARDEN_ATTACK_INTERVAL = 3000;

const restartBtn = { x: 0, y: 0, w: 160, h: 40 };
const farmBtn = { x: 0, y: 0, w: 160, h: 40 };

// ─── IMAGES ───────────────────────────────────────────────────────────────────
const lumberjackImage = new Image();
lumberjackImage.src = "images/lumberjack.png";
const catapultImage = new Image();
catapultImage.src = "images/catapult.png";
const wardenImage = new Image();
wardenImage.src = "images/warden.png";
const carriageImage = new Image();
carriageImage.src = "images/carriage.png";
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
const sporecapImage = new Image();
sporecapImage.src = "images/sporecap.png";
const goldIcon = new Image();
goldIcon.src = "images/goldIcon.png";
const rocksIcon = new Image();
rocksIcon.src = "images/rocksIcon.png";
const woodIcon = new Image();
woodIcon.src = "images/woodIcon.png";
const metalIcon = new Image();
metalIcon.src = "images/metalIcon.png";
const ropeIcon = new Image();
ropeIcon.src = "images/ropeIcon.png";
const milkIcon = new Image();
milkIcon.src = "images/milk.png";
const resourceIcons = {
    gold: goldIcon,
    rock: rocksIcon,
    wood: woodIcon,
    steel: metalIcon,
    rope: ropeIcon,
    milk: milkIcon
};
const roperyImage = new Image();
roperyImage.src = "images/ropery.png";
const goatImage = new Image();
goatImage.src = "images/goat.png";
const farmhouseImage = new Image();
farmhouseImage.src = "images/farmhouse.png";
// Anchor offsets — raise sprite by this many px to compensate for transparent padding
const LUMBERJACK_ANCHOR_OFFSET = 8;
const CARRIAGE_ANCHOR_OFFSET = 10;
const CATAPULT_ANCHOR_OFFSET = 12;  
const WARDEN_ANCHOR_OFFSET = 12; 
const CROSSBOW_ANCHOR_OFFSET = 12; 
const ELIAS_ANCHOR_OFFSET = 60;
const FENCE_ANCHOR_OFFSET = -6;
const SPORECAP_ANCHOR_OFFSET = 6;
const ANCHOR_RANDOM_RANGE = 8;

const lumberjackSheet = new Image();
lumberjackSheet.src = "images/lumberjack_walk.png";

const SPRITE_CONFIGS = {
    lumberjack: {
        sheet: null,        // will be set to lumberjackSheet once loaded
        frameWidth: 134,     // ← set this to your frame width in pixels
        frameHeight: 180,    // ← set this to your frame height in pixels
        frameCount: 6,      // ← number of frames
        fps: 8              // ← animation speed in frames per second
    }
};

lumberjackSheet.onload = () => {
    SPRITE_CONFIGS.lumberjack.sheet = lumberjackSheet;
};

//const wardenSheet = new Image();
//wardenSheet.src = "images/warden_walk.png";

//SPRITE_CONFIGS.warden = {
//    sheet: null,
//    frameWidth: 80,
//    frameHeight: 110,
//    frameCount: 6,
//    fps: 6
//};

//wardenSheet.onload = () => {
//    SPRITE_CONFIGS.warden.sheet = wardenSheet;
//};

// ─── UI ELEMENTS ──────────────────────────────────────────────────────────────
const livesDisplay = document.getElementById("lives");
const goldDisplay = document.getElementById("gold");
const waveDisplay = document.getElementById("wave");
const messageDisplay = document.getElementById("message");

const MENU_W = 165;
const MENU_ROW1 = 24;  // info text
const MENU_ROW2 = 52;  // upgrade text
const MENU_ROW3 = 106; // scrap text (was 80 — needs room for cost list + stat preview)
const MENU_H_TOWER = 125;
const MENU_H_SLOT = 150;
const MAX_FENCE_HP = 30;

// Target Y for drop animations — middle of the sidebar
// We'll calculate this dynamically from the sidebar element
function getSidebarMidY() {
    const panel = document.getElementById("sidePanel");
    const rect = panel.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    return (rect.top + rect.height / 2) - canvasRect.top;
}
const DROP_ANIM_TARGET_Y_OFFSET = -100;
// Farm building positions — computed from tile IDs after hexToPixel is available
let ROPERY_X, ROPERY_Y;
const ROPERY_W = 70;
const ROPERY_H = 70;

let GOAT_X, GOAT_Y;
const GOAT_W = 70;
const GOAT_H = 70;

let FARM_FENCE_X, FARM_FENCE_Y;
let DEFEND_BTN_X, DEFEND_BTN_Y;
const DEFEND_BTN_W = 180;
const DEFEND_BTN_H = 44;

const FARMHOUSE_X = 400;
const FARMHOUSE_Y = 200;
const FARMHOUSE_W = 100;
const FARMHOUSE_H = 100;

// ─── GAME STATE ───────────────────────────────────────────────────────────────
let fence = {
    hp: MAX_FENCE_HP,
    maxHp: MAX_FENCE_HP,
    attackers: [] // enemies currently attacking the fence
};
let fenceFlicker = { active: false, start: 0 };
let gameOver = false;
let gameWon = false;
let resources = {
    gold: 100,
    rope: 0,
    wood: 0,
    rock: 0,
    steel: 0,
    milk: 0
};
let currentScreen = "farm"; // start on "farm" or "game" for TD map

let wave = 1;
let betweenWaves = true;
let waveTimer = 180;
let currentPulseIndex = 0;
let currentUnitIndex = 0;
let unitTimer = 0;
let pulseTimer = 0;
let waitingForPulse = false; // true = between pulses, false = spawning units
let bullets = [];
let activeMenu = null; // { col, row, mode } mode = "slot" or "tower"
let mousePos = { x: 0, y: 0 };


let enemies = [];
let towers = [];
let projectiles = [];
let splashes = [];

let path = [];
let towerSlots = [];
let enemyDefs = {};
let towerDefs = {};
let waveDefs = [];
let floatingNumbers = [];
let sporeClouds = [];
let dropAnimations = [];

let skillDefs = {};
let activeSkills = {
    molotov: { cooldownStart: -Infinity, ready: false },
    acid: { cooldownStart: -Infinity, ready: false }
};
let pendingSkill = null; // "molotov" or "acid" — waiting for click on canvas

let workshopDefs = {};

// Workshop instances on the farm
let workshops = {
    ropery: {
        type: "ropery",
        tier: 2,
        productionStart: null,
        stored: 0
    },
    goat: {
        type: "goat",
        tier: 1,
        productionStart: null,
        stored: 0
    }
};
let farmAnimationId = null;
let farmActiveMenu = null; // { type: "ropery" }

function farmLoop() {
    if (currentScreen !== "farm") return;
    updateFarm();
    drawFarmScreen();
    farmAnimationId = requestAnimationFrame(farmLoop);
}

// ─── HEX MATH ─────────────────────────────────────────────────────────────────
function hexToPixel(col, row) {
    const x = ORIGIN_X + col * COL_STEP + (row % 2 === 1 ? HEX_W / 2 : 0);
    const y = ORIGIN_Y + row * ROW_STEP;
    return { x, y };
}

// Farm tile positions (tile ID → col/row via GRID_COLS)
{
    const _fenceTile  = hexToPixel(130 % GRID_COLS, Math.floor(130 / GRID_COLS));
    FARM_FENCE_X  = _fenceTile.x;
    FARM_FENCE_Y  = _fenceTile.y;
    DEFEND_BTN_X  = _fenceTile.x;
    DEFEND_BTN_Y  = _fenceTile.y + HEX_SIZE + 6;

    const _roperyTile = hexToPixel(280 % GRID_COLS, Math.floor(280 / GRID_COLS));
    ROPERY_X = _roperyTile.x;
    ROPERY_Y = _roperyTile.y + ROPERY_H / 2;

    const _goatTile = hexToPixel(265 % GRID_COLS, Math.floor(265 / GRID_COLS));
    GOAT_X = _goatTile.x;
    GOAT_Y = _goatTile.y + GOAT_H / 2;
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

function offsetToCube(col, row) {
    const q = col - (row - (row & 1)) / 2;
    return { q, r: row, s: -q - row };
}

const _centerCube = offsetToCube(HEX_GRID_CENTER_COL, HEX_GRID_CENTER_ROW);

function isInHexGrid(col, row) {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return false;
    const { q, r, s } = offsetToCube(col, row);
    return Math.max(
        Math.abs(q - _centerCube.q),
        Math.abs(r - _centerCube.r),
        Math.abs(s - _centerCube.s)
    ) <= HEX_GRID_RADIUS;
}

function pixelToHex(px, py) {
    let bestCol = 0, bestRow = 0, bestDist = Infinity;
    for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
            if (!isInHexGrid(col, row)) continue;
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
    // Find the actual pixel extent of all in-grid hex tile corners
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
            if (!isInHexGrid(col, row)) continue;
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
            if (!isInHexGrid(col, row)) continue;
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
    ctx.drawImage(eliasImage, cx - ew / 2, cy - eh + ELIAS_ANCHOR_OFFSET, ew, eh);
}
// ─── WAVES ────────────────────────────────────────────────────────────────────
function updateWaves() {
    if (gameOver || gameWon) return;

    // Between waves
    if (betweenWaves) {
        if (--waveTimer <= 0) startWave();
        return;
    }

    const waveDef = waveDefs[wave - 1];
    if (!waveDef) return;

    const pulses = waveDef.pulses;

    // All pulses done — check if wave is complete
    if (currentPulseIndex >= pulses.length) {
        if (enemies.length === 0) {
            if (wave >= waveDefs.length) {
                gameWon = true;
                return;
            }
            betweenWaves = true;
            wave++;
            waveTimer = Math.round(waveDef.pulseInterval / (1000 / 60));
            updateUI();
        }
        return;
    }

    // Waiting between pulses
    if (waitingForPulse) {
        if (--pulseTimer <= 0) {
            waitingForPulse = false;
            currentUnitIndex = 0;
        }
        return;
    }

    const currentPulse = pulses[currentPulseIndex];

    // All units in this pulse spawned — move to next pulse
    if (currentUnitIndex >= currentPulse.length) {
        currentPulseIndex++;
        if (currentPulseIndex < pulses.length) {
            waitingForPulse = true;
            pulseTimer = Math.round(waveDef.pulseInterval / (1000 / 60));
        }
        return;
    }

    // Spawn next unit
    if (--unitTimer <= 0) {
        const code = currentPulse[currentUnitIndex];
        spawnEnemy(code);
        currentUnitIndex++;
        unitTimer = Math.round(waveDef.unitInterval / (1000 / 60));
    }
}

function startWave() {
    betweenWaves = false;
    currentPulseIndex = 0;
    currentUnitIndex = 0;
    unitTimer = 0;
    pulseTimer = 0;
    waitingForPulse = false;
    updateUI();
}


// ─── ENEMIES ──────────────────────────────────────────────────────────────────
function spawnEnemy(code) {
    const typeMap = {
        "lu": "lumberjack",
        "wa": "warden",
        "ca": "carriage"
    };
    const type = typeMap[code];
    if (!type || !enemyDefs[type]) return;

    const def = enemyDefs[type];
    const start = hexToPixel(path[0].col, path[0].row);
    const anchorOffset = (Math.random() * ANCHOR_RANDOM_RANGE * 2) - ANCHOR_RANDOM_RANGE;

    enemies.push({
        pathIndex: 0,
        x: start.x,
        y: start.y,
        speed: def.speed,
        hp: def.hp,
        maxHp: def.hp,
        damage: def.damage,
        drops: def.drops,
        type,
        dead: false,
        dying: false,
        dirX: 1,
        anchorOffset
    });
}

function updateEnemies(dt) {
    const now = performance.now();
    const lastTile = path[path.length - 1];
    const fencePixel = hexToPixel(lastTile.col, lastTile.row);

    for (let enemy of enemies) {
        // Skip already-dead or dying enemies
        if (enemy.dead) continue;
        if (enemy.dying) {
            if (performance.now() - enemy.dyingStart >= enemy.dyingDuration) {
                enemy.dead = true;
            }
            continue;
        }

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
        if (dist < enemy.speed * dt) {
            enemy.pathIndex++;
        } else {
            enemy.x += (dx / dist) * enemy.speed * dt;
            enemy.y += (dy / dist) * enemy.speed * dt;
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
        const isCarriage = enemy.type === "carriage";
        const sw = isWarden ? 52 : isCarriage ? 56 : 40;
        const sh = isWarden ? 56 : isCarriage ? 48 : 48;
        const offset = (isWarden ? WARDEN_ANCHOR_OFFSET : isCarriage ? CARRIAGE_ANCHOR_OFFSET : LUMBERJACK_ANCHOR_OFFSET) + (enemy.anchorOffset || 0);
        const sprite = isWarden ? wardenImage : isCarriage ? carriageImage : lumberjackImage;

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
                    ctx.fillStyle = isWarden ? "orange" : isCarriage ? "cyan" : "lime";
                    ctx.fillRect(drawX, drawY - 6, sw * (enemy.hp / enemy.maxHp), 4);
                    continue;
                }
            }
        }
        if (enemy.dying) {
            const elapsed = performance.now() - enemy.dyingStart;
            const progress = elapsed / enemy.dyingDuration; // 0 → 1

            // Scale: 1 → 1.5 in first 30%, then 1.5 → 0 in remaining 70%
            let scale;
            if (progress < 0.3) {
                scale = 1 + (progress / 0.3) * 0.5; // 1 → 1.5
            } else {
                scale = 1.5 * (1 - (progress - 0.3) / 0.7); // 1.5 → 0
            }

            const centerX = enemy.x;
            const centerY = enemy.y - sh / 2 + offset;

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.scale(scale, scale);
            if (enemy.dirX < 0) {
                ctx.scale(-1, 1);
                ctx.drawImage(sprite, -sw / 2, -sh / 2, sw, sh);
            } else {
                ctx.drawImage(sprite, -sw / 2, -sh / 2, sw, sh);
            }
            ctx.restore(); // inner (translate/scale)
            ctx.restore(); // outer (from line 646)
            continue;
        }

        const frameData = getSpriteFrame(enemy);

        if (frameData && !isWarden) {
            const { config, frameIndex } = frameData;
            const sx = frameIndex * config.frameWidth;
            if (enemy.dirX < 0) {
                ctx.scale(-1, 1);
                ctx.drawImage(config.sheet, sx, 0, config.frameWidth, config.frameHeight, -drawX - sw, drawY, sw, sh);
            } else {
                ctx.drawImage(config.sheet, sx, 0, config.frameWidth, config.frameHeight, drawX, drawY, sw, sh);
            }
        } else {
            if (enemy.dirX < 0) {
                ctx.scale(-1, 1);
                ctx.drawImage(sprite, -drawX - sw, drawY, sw, sh);
            } else {
                ctx.drawImage(sprite, drawX, drawY, sw, sh);
            }
        }
        ctx.restore();

        // HP bar
        ctx.fillStyle = "red";
        ctx.fillRect(drawX, drawY - 6, sw, 4);
        ctx.fillStyle = isWarden ? "orange" : "lime";
        ctx.fillRect(drawX, drawY - 6, sw * (enemy.hp / enemy.maxHp), 4);
    }
}
function getSpriteFrame(enemy) {
    const config = SPRITE_CONFIGS[enemy.type];
    if (!config || !config.sheet) return null;
    const now = performance.now();
    const frameIndex = Math.floor((now / (1000 / config.fps))) % config.frameCount;
    return { config, frameIndex };
}
function parseDrops(dropsStr) {
    if (!dropsStr) return [];
    return dropsStr.split("|").map(entry => {
        const parts = entry.trim().split(":");
        const type = parts[0].trim();
        const chance = parseFloat(parts[1]) / 100;
        const rangeParts = parts[2].split("-");
        const min = parseInt(rangeParts[0]);
        const max = parseInt(rangeParts[1] !== undefined ? rangeParts[1] : rangeParts[0]);
        return { type, chance, min, max };
    });
}
function parseCosts(costStr) {
    if (!costStr) return {};
    const result = {};
    costStr.split("|").forEach(entry => {
        const parts = entry.trim().split(":");
        const resource = parts[0].trim();
        const amount = parseFloat(parts[1]);
        if (resource && !isNaN(amount)) result[resource] = amount;
    });
    return result;
}

function rollDrops(drops) {
    const result = {};
    for (let drop of drops) {
        if (Math.random() < drop.chance) {
            const amount = drop.min + Math.floor(Math.random() * (drop.max - drop.min + 1));
            result[drop.type] = (result[drop.type] || 0) + amount;
        }
    }
    return result;
}
function grantDrops(drops) {
    for (let [type, amount] of Object.entries(drops)) {
        if (resources.hasOwnProperty(type)) {
            resources[type] += amount;
        }
    }
    updateUI();
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
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (event.clientX - rect.left) * scaleX;
    const py = (event.clientY - rect.top) * scaleY;
    // Check if clicking a plus upgrade icon
    
    for (let tower of towers) {
        const maxTier = towerDefs[tower.type] ? towerDefs[tower.type].maxTier : 1;
        if (tower.tier >= maxTier) continue;
        const { x: cx, y: cy } = hexToPixel(tower.col, tower.row);
        const plusX = cx + HEX_SIZE * 0.6;
        const plusY = cy - HEX_SIZE * 0.8;
        if (Math.hypot(px - plusX, py - plusY) <= 10) {
            const nextDef = towerDefs[tower.type][tower.tier + 1];
            const upgradeCost = nextDef.cost;
            if (canAfford(upgradeCost)) {
                spendResources(upgradeCost);
                tower.tier++;
                tower.damage   = nextDef.damage;
                tower.range    = nextDef.range;
                tower.fireRate = nextDef.fireRate;
                messageDisplay.innerText = `${tower.type} upgraded to T${tower.tier}!`;
                updateUI();
            } else {
                messageDisplay.innerText = "Not enough resources!";
            }
            return;
        }
    }
    if (pendingSkill) {
        const def = skillDefs[pendingSkill];
        const eliasPixel = hexToPixel(ELIAS_COL, ELIAS_ROW);
        const ELIAS_THROW_OFFSET_X = -10;
        const ELIAS_THROW_OFFSET_Y = 40;

        const startX = eliasPixel.x + ELIAS_THROW_OFFSET_X;
        const startY = eliasPixel.y + ELIAS_THROW_OFFSET_Y;

        const PROJECTILE_SPEED = 400; // pixels per second
        const dist = Math.hypot(px - startX, py - startY);
        const duration = (dist / PROJECTILE_SPEED) * 1000;

        projectiles.push({
            skill: pendingSkill,
            sx: startX,
            sy: startY,
            tx: px,
            ty: py,
            x: startX,
            y: startY,
            startTime: performance.now(),
            duration,
            arcHeight: Math.min(dist * 0.3, 120)
        });

        activeSkills[pendingSkill].cooldownStart = performance.now();
        pendingSkill = null;
        skillMessage.innerText = "";
        return;
    }
      
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
        dropAnimations = [];
        sporeClouds = [];
        bullets = [];
        splashes = [];
        projectiles = [];
        resources = { gold: 200, rope: 0, wood: 0, rock: 0, steel: 0, milk: 0 };
        wave = 1;
        betweenWaves = true;
        waveTimer = 180;
        currentPulseIndex = 0;
        currentUnitIndex = 0;
        unitTimer = 0;
        pulseTimer = 0;
        waitingForPulse = false;
        activeMenu = null;
        activeSkills = {
            molotov: { cooldownStart: performance.now(), ready: false },
            acid: { cooldownStart: performance.now(), ready: false }
        };
        pendingSkill = null;
        floatingNumbers = [];
        fenceFlicker = { active: false, start: 0 };
        lastFrameTime = null;
        farmActiveMenu = null;
        updateUI();
        requestAnimationFrame(gameLoop);
        return;
    }
    if ((gameOver || gameWon) &&
    px >= farmBtn.x && px <= farmBtn.x + farmBtn.w &&
    py >= farmBtn.y && py <= farmBtn.y + farmBtn.h) {
    showFarm();
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
                let type, extraProps = {};
                if (relY < MENU_H_SLOT / 3) {
                    type = "catapult";
                } else if (relY < (MENU_H_SLOT / 3) * 2) {
                    type = "crossbow";
                } else {
                    type = "sporecap";
                    extraProps = { activeCloud: null, sporeOnCooldown: false };
                }
                const def = towerDefs[type][1];
                if (canAfford(def.cost)) {
                    towers.push({ type, col: activeMenu.col, row: activeMenu.row,
                        range: def.range, damage: def.damage, fireRate: def.fireRate,
                        cooldown: 0, tier: 1, target: null, ...extraProps });
                    spendResources(def.cost);
                    messageDisplay.innerText = `${type.charAt(0).toUpperCase() + type.slice(1)} placed!`;
                    updateUI();
                } else {
                    messageDisplay.innerText = "Not enough resources!";
                }
            }
            activeMenu = null;
            return;
        }

        if (activeMenu.mode === "tower") {
            const tower = towers.find(t => t.col === activeMenu.col && t.row === activeMenu.row);
            if (tower) {
                const menuH = MENU_ROW3 + 15;
                const menuY = cy - menuH - HEX_SIZE;
                if (px >= menuX && px <= menuX + MENU_W && py >= menuY && py <= menuY + menuH) {
                    const relY = py - menuY;
                    if (relY >= (MENU_ROW1 + MENU_ROW2) / 2 && relY < (MENU_ROW2 + MENU_ROW3) / 2) {
                        const maxTier = towerDefs[tower.type].maxTier;
                        if (tower.tier >= maxTier) {
                            messageDisplay.innerText = "Already max tier!";
                        } else {
                            const nextDef = towerDefs[tower.type][tower.tier + 1];
                            if (canAfford(nextDef.cost)) {
                                spendResources(nextDef.cost);
                                tower.tier++;
                                tower.damage   = nextDef.damage;
                                tower.range    = nextDef.range;
                                tower.fireRate = nextDef.fireRate;
                                messageDisplay.innerText = `${tower.type} upgraded to T${tower.tier}!`;
                                updateUI();
                            } else {
                                messageDisplay.innerText = "Not enough resources!";
                            }
                        }
                    } else if (relY >= (MENU_ROW2 + MENU_ROW3) / 2) {
                       const placementCost = towerDefs[tower.type][1].cost;
                        const refund = Math.floor((placementCost.gold || 0) * 0.3);
                        resources.gold += refund;
                        towers = towers.filter(t => t !== tower);
                        messageDisplay.innerText = `Scrapped! (+${refund}g)`;
                        updateUI();
                    }
                }
            }
            activeMenu = null;
            return;
        }

        activeMenu = null;
        return;
    }

    // No menu open
    const { col, row } = pixelToHex(px, py);
    if (!isInHexGrid(col, row)) return;
    const existingTower = towers.find(t => t.col === col && t.row === row);
    if (existingTower) {
        activeMenu = { col, row, mode: "tower", scrapConfirm: false };
        return;
    }
    if (isSlotHex(col, row)) {
        activeMenu = { col, row, mode: "slot" };
    }
});
canvas.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mousePos.x = (event.clientX - rect.left) * scaleX;
    mousePos.y = (event.clientY - rect.top) * scaleY;
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
farmCanvas.addEventListener("click", (event) => {
    const rect = farmCanvas.getBoundingClientRect();
    const scaleX = farmCanvas.width / rect.width;
    const scaleY = farmCanvas.height / rect.height;
    const px = (event.clientX - rect.left) * scaleX;
    const py = (event.clientY - rect.top) * scaleY;

    // Ropery — check open menu first (it floats above the building)
    if (farmActiveMenu && farmActiveMenu.type === "ropery") {
        const ropery = workshops.ropery;
        if (!workshopDefs["ropery"]) { farmActiveMenu = null; return; }
        const maxTier = workshopDefs["ropery"].maxTier;
        const isMaxTier = ropery.tier >= maxTier;
        const menuW = 160;
        const menuH = isMaxTier ? 80 : 120;
        const menuX = ROPERY_X - menuW / 2;
        const menuY = ROPERY_Y - ROPERY_H - menuH - 10;

        if (px >= menuX && px <= menuX + menuW &&
            py >= menuY && py <= menuY + menuH) {
            const relY = py - menuY;
            if (!isMaxTier && relY > 30 && relY < 95) {
                const nextDef = workshopDefs["ropery"][ropery.tier + 1];
                if (canAfford(nextDef.cost)) {
                    spendResources(nextDef.cost);
                    ropery.tier++;
                    ropery.productionStart = performance.now();
                    updateFarmUI();
                    updateUI();
                }
            }
            farmActiveMenu = null;
            return;
        }
    }

    // Ropery building / hex ring click
    const _roperyCx = ROPERY_X;
    const _roperyCy = ROPERY_Y - ROPERY_H / 2;
    const _inRoperyBuilding = px >= ROPERY_X - ROPERY_W / 2 && px <= ROPERY_X + ROPERY_W / 2 &&
                              py >= ROPERY_Y - ROPERY_H && py <= ROPERY_Y + 30;
    const _inRoperyHex = workshops.ropery.tier >= 2 &&
                         Math.hypot(px - _roperyCx, py - _roperyCy) <= 46;
    if (_inRoperyBuilding || _inRoperyHex) {
        // Collect stored ropes if any
        const ropery = workshops.ropery;
        if (ropery.stored > 0) {
            resources.rope += ropery.stored;
            ropery.stored = 0;
            updateFarmUI();
            updateUI();
            farmActiveMenu = null;
            return;
        }

        // Open menu
        farmActiveMenu = { type: "ropery" };
        return;
    }

    // Goat — check open menu first
    if (farmActiveMenu && farmActiveMenu.type === "goat") {
        const goat = workshops.goat;
        if (!workshopDefs["goat"]) { farmActiveMenu = null; return; }
        const maxTier = workshopDefs["goat"].maxTier;
        const isMaxTier = goat.tier >= maxTier;
        const menuW = 160;
        const menuH = isMaxTier ? 80 : 120;
        const menuX = GOAT_X - menuW / 2;
        const menuY = GOAT_Y - GOAT_H - menuH - 10;

        if (px >= menuX && px <= menuX + menuW &&
            py >= menuY && py <= menuY + menuH) {
            const relY = py - menuY;
            if (!isMaxTier && relY > 30 && relY < 95) {
                const nextDef = workshopDefs["goat"][goat.tier + 1];
                if (canAfford(nextDef.cost)) {
                    spendResources(nextDef.cost);
                    goat.tier++;
                    goat.productionStart = performance.now();
                    updateFarmUI();
                    updateUI();
                }
            }
            farmActiveMenu = null;
            return;
        }
    }

    // Goat building click
    const _goatCx = GOAT_X;
    const _goatCy = GOAT_Y - GOAT_H / 2;
    const _inGoatBuilding = px >= GOAT_X - GOAT_W / 2 && px <= GOAT_X + GOAT_W / 2 &&
                            py >= GOAT_Y - GOAT_H && py <= GOAT_Y + 30;
    const _inGoatHex = workshops.goat.tier >= 2 &&
                       Math.hypot(px - _goatCx, py - _goatCy) <= 46;
    if (_inGoatBuilding || _inGoatHex) {
        const goat = workshops.goat;
        if (goat.stored > 0) {
            resources.milk += goat.stored;
            goat.stored = 0;
            updateFarmUI();
            updateUI();
            farmActiveMenu = null;
            return;
        }
        farmActiveMenu = { type: "goat" };
        return;
    }

    // Click outside menu — close it
    if (farmActiveMenu) {
        farmActiveMenu = null;
        return;
    }

    // Defend button click
    if (px >= DEFEND_BTN_X - DEFEND_BTN_W / 2 &&
        px <= DEFEND_BTN_X + DEFEND_BTN_W / 2 &&
        py >= DEFEND_BTN_Y &&
        py <= DEFEND_BTN_Y + DEFEND_BTN_H) {
        showGame();
        cancelAnimationFrame(animationFrameId);
        // reset game state
        fence = { hp: MAX_FENCE_HP, maxHp: MAX_FENCE_HP, attackers: [] };
        gameOver = false;
        gameWon = false;
        enemies = [];
        towers = [];
        bullets = [];
        splashes = [];
        projectiles = [];
        sporeClouds = [];
        dropAnimations = [];
        floatingDmgNumbers = [];
        wave = 1;
        betweenWaves = true;
        waveTimer = 180;
        currentPulseIndex = 0;
        currentUnitIndex = 0;
        unitTimer = 0;
        pulseTimer = 0;
        waitingForPulse = false;
        activeMenu = null;
        activeSkills = {
            molotov: { cooldownStart: performance.now(), ready: false },
            acid: { cooldownStart: performance.now(), ready: false }
        };
        pendingSkill = null;
        updateUI();
        gameLoop();
        return;
    }
});
function updateProjectiles() {
    const now = performance.now();
    for (let p of projectiles) {
        const elapsed = now - p.startTime;
        const t = Math.min(elapsed / p.duration, 1); // 0 → 1

        // Linear interpolation for x
        p.x = p.sx + (p.tx - p.sx) * t;
        // Arc: parabola on y axis
        p.y = p.sy + (p.ty - p.sy) * t - p.arcHeight * 4 * t * (1 - t);

        if (t >= 1) {
            p.arrived = true;
            // Trigger the actual damage and splash when projectile lands
            const def = skillDefs[p.skill];
            for (let enemy of enemies) {
                const d = Math.hypot(enemy.x - p.tx, enemy.y - p.ty);
                if (d <= def.radius) {
                    enemy.hp -= def.damage;
                    triggerFlicker(enemy);
                    spawnHitFeedback(enemy.x, enemy.y - 20, def.damage, "#ffd700");
                    if (enemy.hp <= 0) {
                killEnemy(enemy);
                        grantDrops(rollDrops(enemyDefs[enemy.type].drops));
                        updateUI();
                    }
                }
            }
            enemies = enemies.filter(e => !e.dead);

            // Splash animation on landing
            const color = p.skill === "molotov" ? "255,120,30" : "120,255,60";
            splashes.push({
                x: p.tx, y: p.ty,
                maxRadius: def.radius,
                startTime: performance.now(),
                duration: 600,
                color
            });
        }
    }
    projectiles = projectiles.filter(p => !p.arrived);
}

function drawProjectiles() {
    for (let p of projectiles) {
        const color = p.skill === "molotov" ? "#ffd700" : "#80ff40";
        const glowColor = p.skill === "molotov" ? "rgba(255,200,0,0.3)" : "rgba(100,255,50,0.3)";
        const radius = 5;

        // Glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius + 3, 0, Math.PI * 2);
        ctx.fillStyle = glowColor;
        ctx.fill();

        // Main circle
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}
function updateSporeClouds() {
    const now = performance.now();
    for (let cloud of sporeClouds) {
        const elapsed = now - cloud.startTime;
        if (elapsed >= cloud.duration) continue; // will be filtered out

        // Damage enemies inside the cloud
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            const d = Math.hypot(enemy.x - cloud.x, enemy.y - cloud.y);
            if (d <= cloud.radius) {
                const lastHit = cloud.lastDamageTime[i] || 0;
                if (now - lastHit >= cloud.damageInterval) {
                    enemy.hp -= cloud.damage;
                    cloud.lastDamageTime[i] = now;
                    triggerFlicker(enemy);
                    spawnHitFeedback(enemy.x, enemy.y - 20, cloud.damage, "#80ff40");
                    if (enemy.hp <= 0) {
                        killEnemy(enemy);
                        grantDrops(rollDrops(enemyDefs[enemy.type].drops));
                        updateUI();
                    }
                }
            }
        }
    }
    enemies = enemies.filter(e => !e.dead);
    sporeClouds = sporeClouds.filter(c => performance.now() - c.startTime < c.duration);
}

function drawSporeClouds() {
    const now = performance.now();
    for (let cloud of sporeClouds) {
        const elapsed = now - cloud.startTime;
        const progress = elapsed / cloud.duration;
        const alpha = (1 - progress) * 0.45;

        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100, 220, 80, ${alpha})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(80, 200, 60, ${alpha * 1.5})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}
function canAfford(cost) {
    for (let [resource, amount] of Object.entries(cost)) {
        if ((resources[resource] || 0) < amount) return false;
    }
    return true;
}

function spendResources(cost) {
    for (let [resource, amount] of Object.entries(cost)) {
        resources[resource] = (resources[resource] || 0) - amount;
    }
    updateUI();
}
function drawCostList(cost, x, y) {
    let offsetX = 0;
    for (let [resource, amount] of Object.entries(cost)) {
        const canPay = (resources[resource] || 0) >= amount;
        const icon = resourceIcons[resource];
        if (icon) {
            ctx.drawImage(icon, x + offsetX, y - 10, 14, 14);
            offsetX += 16;
        }
        ctx.fillStyle = canPay ? "#80ff40" : "#ff4444";
        ctx.font = "10px Arial";
        ctx.textAlign = "left";
        ctx.fillText(`${amount}`, x + offsetX, y);
        offsetX += 20;
    }
}

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
        // Catapult
        ctx.fillStyle = "#f0f0d8";
        ctx.font = "bold 11px Arial";
        ctx.fillText("⚙ Catapult", menuX + 10, menuY + MENU_ROW1);
        drawCostList(towerDefs["catapult"][1].cost, menuX + 10, menuY + MENU_ROW1 + 14);

        // Crossbow
        ctx.fillStyle = "#f0f0d8";
        ctx.fillText("🏹 Crossbow", menuX + 10, menuY + MENU_ROW2);
        drawCostList(towerDefs["crossbow"][1].cost, menuX + 10, menuY + MENU_ROW2 + 14);

        // Sporecap
        ctx.fillStyle = "#f0f0d8";
        ctx.fillText("🍄 Sporecap", menuX + 10, menuY + MENU_ROW3);
        drawCostList(towerDefs["sporecap"][1].cost, menuX + 10, menuY + MENU_ROW3 + 14);

   } else {
        const tower = towers.find(t => t.col === activeMenu.col && t.row === activeMenu.row);
        if (!tower) return;
        const menuH = MENU_ROW3 + 15;
        const menuY = cy - menuH - HEX_SIZE;
        ctx.fillStyle = "#1a2a1a";
        ctx.strokeStyle = "#8b6f47";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(menuX, menuY, MENU_W, menuH, 6);
        ctx.fill();
        ctx.stroke();

        const def = towerDefs[tower.type][tower.tier];
        const maxTier = towerDefs[tower.type].maxTier;
        const isMaxTier = tower.tier >= maxTier;
        const nextDef = !isMaxTier ? towerDefs[tower.type][tower.tier + 1] : null;
        const canUpgrade = !isMaxTier && canAfford(nextDef.cost);
        const refund = Math.floor((towerDefs[tower.type][1].cost.gold || 0) * 0.3);

        ctx.font = "bold 11px Arial";
        ctx.textAlign = "left";

        // Row 1: info
        ctx.fillStyle = "#aaa";
        ctx.fillText(`${tower.type} T${tower.tier}  DMG:${tower.damage} RNG:${tower.range}`, menuX + 10, menuY + MENU_ROW1);

        // Divider
        ctx.strokeStyle = "#444";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(menuX + 8, menuY + MENU_ROW1 + 8);
        ctx.lineTo(menuX + MENU_W - 8, menuY + MENU_ROW1 + 8);
        ctx.stroke();

        // Row 2: upgrade with preview
        if (isMaxTier) {
            ctx.fillStyle = "#555";
            ctx.fillText("⬆ Max tier", menuX + 10, menuY + MENU_ROW2);
        } else {
            ctx.fillStyle = canUpgrade ? "#f0f0d8" : "#888";
            ctx.fillText(`⬆ T${tower.tier + 1}`, menuX + 10, menuY + MENU_ROW2);
            // Resource cost indicators
            drawCostList(nextDef.cost, menuX + 10, menuY + MENU_ROW2 + 14);
            // Stat preview
            ctx.font = "10px Arial";
            ctx.fillStyle = "#80ff40";
            ctx.fillText(`DMG:${nextDef.damage} RNG:${nextDef.range}`, menuX + 10, menuY + MENU_ROW2 + 26);
            ctx.font = "bold 11px Arial";
        }

        // Divider
        ctx.strokeStyle = "#444";
        ctx.beginPath();
        ctx.moveTo(menuX + 8, menuY + MENU_ROW2 + 40);
        ctx.lineTo(menuX + MENU_W - 8, menuY + MENU_ROW2 + 40);
        ctx.stroke();

        // Row 3: scrap
        ctx.fillStyle = "#ff9060";
        ctx.fillText(`🗑 Scrap (+${refund}g)`, menuX + 10, menuY + MENU_ROW3);
    }
}

function drawUpgradeIndicators() {
    for (let tower of towers) {
        const maxTier = towerDefs[tower.type] ? towerDefs[tower.type].maxTier : 1;
        if (tower.tier >= maxTier) continue;
        const nextDef = towerDefs[tower.type][tower.tier + 1];
        if (!canAfford(nextDef.cost)) continue;

        const { x: cx, y: cy } = hexToPixel(tower.col, tower.row);
        const plusX = cx + HEX_SIZE * 0.6;
        const plusY = cy - HEX_SIZE * 0.8;
        const radius = 6;

        // Transparent circle with white outline
        ctx.beginPath();
        ctx.arc(plusX, plusY, radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Plus sign
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(plusX - 3, plusY);
        ctx.lineTo(plusX + 3, plusY);
        ctx.moveTo(plusX, plusY - 3);
        ctx.lineTo(plusX, plusY + 3);
        ctx.stroke();

        // Tooltip on hover
        const dx = mousePos.x - plusX;
        const dy = mousePos.y - plusY;
        if (Math.hypot(dx, dy) <= radius + 4) {
            const tipText = "Click to upgrade tower";
            ctx.font = "11px Arial";
            const tipW = ctx.measureText(tipText).width + 16;
            const tipH = 22;
            const tipX = plusX - tipW / 2;
            const tipY = plusY - tipH - 6;

            ctx.fillStyle = "#1a2a1a";
            ctx.strokeStyle = "#8b6f47";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(tipX, tipY, tipW, tipH, 4);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#f0f0d8";
            ctx.textAlign = "center";
            ctx.fillText(tipText, plusX, tipY + 15);
        }
    }
}
function drawCostList(cost, x, y) {
    let offsetX = 0;
    for (let [resource, amount] of Object.entries(cost)) {
        const canPay = (resources[resource] || 0) >= amount;
        const icon = resourceIcons[resource];
        if (icon) {
            ctx.drawImage(icon, x + offsetX, y - 10, 14, 14);
            offsetX += 16;
        }
        ctx.fillStyle = canPay ? "#80ff40" : "#ff4444";
        ctx.font = "10px Arial";
        ctx.textAlign = "left";
        ctx.fillText(`${amount}`, x + offsetX, y);
        offsetX += 20;
    }
}

function drawFence() {
    const last = path[path.length - 1];
    const { x: cx, y: cy } = hexToPixel(last.col, last.row);
    const fw = HEX_SIZE * 2;
    const fh = HEX_SIZE * 2;
    const now = performance.now();

    ctx.save();
    ctx.drawImage(fenceImage, cx - fw / 2, cy - fh + FENCE_ANCHOR_OFFSET, fw, fh);


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
function updateTowers(dt) {
    for (let tower of towers) {
         // ── Sporecap ──
        if (tower.type === "sporecap") {
            const { x: tx, y: ty } = hexToPixel(tower.col, tower.row);
            const def = towerDefs["sporecap"][tower.tier];

            if (tower.sporeOnCooldown) {
                if (performance.now() - tower.sporeCooldownStart >= def.cooldown) {
                    tower.sporeOnCooldown = false;
                }
                continue;
            }

            if (tower.activeCloud) {
                const elapsed = performance.now() - tower.activeCloud.startTime;
                if (elapsed >= def.aoeDuration) {
                    tower.activeCloud = null;
                    tower.sporeOnCooldown = true;
                    tower.sporeCooldownStart = performance.now();
                }
                continue;
            }

            const enemyInRange = enemies.some(e => Math.hypot(e.x - tx, e.y - ty) <= tower.range);
            if (enemyInRange) {
                const cloud = {
                    x: tx, y: ty,
                    radius: def.aoeRadius,
                    startTime: performance.now(),
                    duration: def.aoeDuration,
                    damage: def.damage,
                    damageInterval: def.aoeDamageInterval,
                    lastDamageTime: {}
                };
                sporeClouds.push(cloud);
                tower.activeCloud = cloud;
            }
            continue;
        }
        if (tower.cooldown > 0) { tower.cooldown -= dt; tower.target = null; continue; }

        const { x: tx, y: ty } = hexToPixel(tower.col, tower.row);
        let closest = null, closestDist = Infinity;

        for (let enemy of enemies) {
            if (enemy.dying) continue; // ← add this
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
                            killEnemy(other);
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
                killEnemy(closest);
            }
        } 
    } 
    enemies = enemies.filter(e => !e.dead);
} 

        function drawTowers() {
    for (let tower of towers) {
        const { x: cx, y: cy } = hexToPixel(tower.col, tower.row);
        const isCrossbow = tower.type === "crossbow";
        const isSporecap = tower.type === "sporecap";

        let sprite, iw, ih, offset;
        if (isSporecap) {
            sprite = sporecapImage;
            iw = HEX_SIZE * 1.4;
            ih = HEX_SIZE * 1.6;
            offset = SPORECAP_ANCHOR_OFFSET;
        } else if (isCrossbow) {
            sprite = crossbowImage;
            iw = HEX_SIZE * 1.3;
            ih = HEX_SIZE * 1.5;
            offset = CROSSBOW_ANCHOR_OFFSET;
        } else {
            sprite = catapultImage;
            iw = HEX_SIZE * 1.5;
            ih = HEX_SIZE * 1.8;
            offset = CATAPULT_ANCHOR_OFFSET;
        }

        ctx.drawImage(sprite, cx - iw / 2, cy - ih + offset, iw, ih);

        // Tier outline + digit (tier > 1)
        if (tower.tier > 1) {
            const tierColors = ["", "#88ccff", "#4488ff", "#ff8800", "#ffd700"];
            const outlineColor = tierColors[tower.tier] || "#ffd700";
            ctx.strokeStyle = outlineColor;
            ctx.lineWidth = 2;
            const corners = hexCorners(cx, cy);
            ctx.beginPath();
            ctx.moveTo(corners[0].x, corners[0].y);
            for (let i = 1; i < 6; i++) ctx.lineTo(corners[i].x, corners[i].y);
            ctx.closePath();
            ctx.stroke();

            ctx.font = "bold 9px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = outlineColor;
            ctx.fillText(tower.tier, cx, cy + HEX_SIZE * 0.62);
        }

        // Range ring — only for non-sporecap or show spore range differently
        if (isSporecap) {
            ctx.strokeStyle = "rgba(100,220,80,0.15)";
        } else {
            ctx.strokeStyle = isCrossbow ? "rgba(100,200,255,0.15)" : "rgba(255,255,255,0.12)";
        }
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, tower.range, 0, Math.PI * 2);
        ctx.stroke();

        // Shot line for catapult/crossbow only
        if (!isSporecap && tower.target && !tower.target.dead) {
            ctx.strokeStyle = "yellow";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(tower.target.x, tower.target.y);
            ctx.stroke();
            ctx.lineWidth = 1;
        }
    }
}
        function updateBullets(dt) {
            for (let bullet of bullets) {
                const dx = bullet.tx - bullet.x;
                const dy = bullet.ty - bullet.y;
                const dist = Math.hypot(dx, dy);
                if (dist < bullet.speed * dt) {
                    bullet.done = true;
                } else {
                    bullet.x += (dx / dist) * bullet.speed * dt;
                    bullet.y += (dy / dist) * bullet.speed * dt;
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
        function killEnemy(enemy) {
            if (enemy.dying || enemy.dead) return;
            enemy.dying = true;
            enemy.dyingStart = performance.now();
            enemy.dyingDuration = 400;

            const drops = rollDrops(enemyDefs[enemy.type].drops);
            grantDrops(drops);
            updateUI();

            // Spawn drop animations
            const startX = enemy.x;
            const startY = enemy.y + 20;
            let delay = 0;
            let offsetIndex = 0;
            for (let [type, amount] of Object.entries(drops)) {
                if (amount > 0 && resourceIcons[type]) {
                    const spreadX = (offsetIndex - Object.keys(drops).length / 2) * 28; // spread horizontally
                    dropAnimations.push({
                        type,
                        amount,
                        x: startX + spreadX,
                        y: startY,
                        startX: startX + spreadX,
                        startY,
                        startTime: performance.now() + delay,
                        duration: 600,
                        done: false
                    });
                    delay += 80;
                    offsetIndex++;
                }
            }
        }
        function updateDropAnimations() {
            const now = performance.now();
            dropAnimations = dropAnimations.filter(d => !d.done);
            for (let anim of dropAnimations) {
                if (now < anim.startTime) continue; // not started yet
                const elapsed = now - anim.startTime;
                if (elapsed >= anim.duration) {
                    anim.done = true;
                    continue;
                }
                const t = elapsed / anim.duration;
                // Ease out — fast at start, slow at end
                const eased = t * t;
                const targetY = getSidebarMidY() + DROP_ANIM_TARGET_Y_OFFSET;
                const targetX = canvas.width + 20;
                anim.x = anim.startX + (targetX - anim.startX) * eased;
                anim.y = anim.startY + (targetY - anim.startY) * eased;
            }
        }

        function drawDropAnimations() {
            const now = performance.now();
            for (let anim of dropAnimations) {
                if (now < anim.startTime) continue;
                const elapsed = now - anim.startTime;
                const t = Math.min(elapsed / anim.duration, 1);
                const alpha = t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2; // fade out last 20%

                const icon = resourceIcons[anim.type];
                const size = 48;

                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.drawImage(icon, anim.x - size / 2, anim.y - size / 2, size, size);

                // Amount label
                ctx.font = "bold 10px Arial";
                ctx.textAlign = "left";
                ctx.fillStyle = "#fff";
                ctx.strokeStyle = "rgba(0,0,0,0.6)";
                ctx.lineWidth = 2;
                ctx.strokeText(`+${anim.amount}`, anim.x + size / 2 - 2, anim.y + 4);
                ctx.fillText(`+${anim.amount}`, anim.x + size / 2 - 2, anim.y + 4);
                ctx.restore();
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
        function drawHomeButton() {
            const cx = canvas.width / 2;
            restartBtn.x = cx - restartBtn.w / 2 - 90;
            restartBtn.y = canvas.height / 2 + 60;

            // Restart button
            farmBtn.x = cx + 10;
            farmBtn.y = canvas.height / 2 + 60;

            ctx.fillStyle = "#2d3f2d";
            ctx.strokeStyle = "#8b6f47";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(restartBtn.x, restartBtn.y, restartBtn.w, restartBtn.h, 6);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#f0f0d8";
            ctx.font = "bold 14px Arial";
            ctx.textAlign = "center";
            ctx.fillText("↺ Restart", restartBtn.x + restartBtn.w / 2, restartBtn.y + 26);

            // Home button
            ctx.fillStyle = "#2d3f2d";
            ctx.strokeStyle = "#8b6f47";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(farmBtn.x, farmBtn.y, farmBtn.w, farmBtn.h, 6);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#f0f0d8";
            ctx.fillText("🏡 Home", farmBtn.x + farmBtn.w / 2, farmBtn.y + 26);
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
            drawHomeButton();
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
            drawHomeButton();
        }
        // ─── GRID ─────────────────────────────────────────────────────────────────────
        function drawGrid() {
            for (let row = 0; row < GRID_ROWS; row++) {
                for (let col = 0; col < GRID_COLS; col++) {
                    if (!isInHexGrid(col, row)) continue;
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
            goldDisplay.innerText  = resources.gold;
            waveDisplay.innerText  = `${wave}/${waveDefs.length}`;
            document.getElementById("res-rock").innerText  = resources.rock;
            document.getElementById("res-wood").innerText  = resources.wood;
            document.getElementById("res-rope").innerText  = resources.rope;
            document.getElementById("res-steel").innerText = resources.steel;
            document.getElementById("res-milk").innerText  = resources.milk;
        }
        const molotovCanvas = document.getElementById("molotovTimer");
        const acidCanvas = document.getElementById("acidTimer");
        const skillMessage = document.getElementById("skillMessage");

        function updateSkillUI() {
            drawSkillTimer(molotovCanvas, "molotov", molotovIcon);
            drawSkillTimer(acidCanvas, "acid", acidIcon);
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
        function drawFarmScreen() {
            farmCtx.clearRect(0, 0, farmCanvas.width, farmCanvas.height);

            // Background (outside the hex grid)
            farmCtx.fillStyle = "#1f2f1f";
            farmCtx.fillRect(0, 0, farmCanvas.width, farmCanvas.height);

            // Hex grid — same shape and size as the game grid
            for (let row = 0; row < GRID_ROWS; row++) {
                for (let col = 0; col < GRID_COLS; col++) {
                    if (!isInHexGrid(col, row)) continue;
                    const { x, y } = hexToPixel(col, row);
                    const corners = hexCorners(x, y);
                    farmCtx.beginPath();
                    farmCtx.moveTo(corners[0].x, corners[0].y);
                    for (let i = 1; i < 6; i++) farmCtx.lineTo(corners[i].x, corners[i].y);
                    farmCtx.closePath();
                    farmCtx.fillStyle = "#355e3b";
                    farmCtx.fill();
                    farmCtx.strokeStyle = "#ffffff11";
                    farmCtx.lineWidth = 1;
                    farmCtx.stroke();
                }
            }

            // Farmhouse
            farmCtx.drawImage(farmhouseImage,
                FARMHOUSE_X - FARMHOUSE_W / 2,
                FARMHOUSE_Y - FARMHOUSE_H,
                FARMHOUSE_W, FARMHOUSE_H);

            // Fence icon on tile 130
            farmCtx.drawImage(fenceImage, FARM_FENCE_X - 30, FARM_FENCE_Y - 60, 60, 60);
            farmCtx.fillStyle = "#f0f0d8";
            farmCtx.font = "bold 13px Arial";
            farmCtx.textAlign = "center";
            farmCtx.fillText("West Field", FARM_FENCE_X, FARM_FENCE_Y + 14);

            // Defend button — near west fence
            farmCtx.fillStyle = "#2d3f2d";
            farmCtx.strokeStyle = "#4a8f4a";
            farmCtx.lineWidth = 2;
            farmCtx.beginPath();
            farmCtx.roundRect(DEFEND_BTN_X - DEFEND_BTN_W / 2, DEFEND_BTN_Y,
                DEFEND_BTN_W, DEFEND_BTN_H, 6);
            farmCtx.fill();
            farmCtx.stroke();
            farmCtx.fillStyle = "#f0f0d8";
            farmCtx.font = "bold 14px Arial";
            farmCtx.textAlign = "center";
            farmCtx.fillText("⚔ Defend West Field",
                DEFEND_BTN_X, DEFEND_BTN_Y + 28);

            // Workshops
            drawRopery();
            drawGoat();
            drawFarmMenu();

            updateFarmUI();
        }
        function updateFarmUI() {
            document.getElementById("farm-gold").innerText  = resources.gold;
            document.getElementById("farm-rock").innerText  = resources.rock;
            document.getElementById("farm-wood").innerText  = resources.wood;
            document.getElementById("farm-rope").innerText  = resources.rope;
            document.getElementById("farm-steel").innerText = resources.steel;
            document.getElementById("farm-milk").innerText  = resources.milk;
        }
        function updateWorkshop(key) {
            const now = performance.now();
            const w = workshops[key];
            const def = workshopDefs[key] ? workshopDefs[key][w.tier] : null;
            if (!def) return;
            if (w.productionStart === null) {
                w.productionStart = now;
            } else {
                const elapsed = now - w.productionStart;
                if (elapsed >= def.productionTime * 1000) {
                    w.stored += def.productAmount;
                    w.productionStart = now;
                }
            }
        }
        function updateFarm() {
            updateWorkshop("ropery");
            updateWorkshop("goat");
        }
        function drawFarmMenu() {
            if (!farmActiveMenu) return;

            if (farmActiveMenu.type === "ropery") {
                const ropery = workshops.ropery;
                if (!workshopDefs["ropery"]) return;
                const maxTier = workshopDefs["ropery"].maxTier;
                const isMaxTier = ropery.tier >= maxTier;
                const nextDef = !isMaxTier ? workshopDefs["ropery"][ropery.tier + 1] : null;
                const canUpgrade = !isMaxTier && canAfford(nextDef.cost);

                const menuW = 160;
                const menuH = isMaxTier ? 80 : 120;
                const menuX = ROPERY_X - menuW / 2;
                const menuY = ROPERY_Y - ROPERY_H - menuH - 10;

                // Background
                farmCtx.fillStyle = "#1a2a1a";
                farmCtx.strokeStyle = "#8b6f47";
                farmCtx.lineWidth = 2;
                farmCtx.beginPath();
                farmCtx.roundRect(menuX, menuY, menuW, menuH, 6);
                farmCtx.fill();
                farmCtx.stroke();

                farmCtx.font = "bold 11px Arial";
                farmCtx.textAlign = "left";

                // Row 1: info
                farmCtx.fillStyle = "#aaa";
                const def = workshopDefs["ropery"][ropery.tier];
                farmCtx.fillText(`Ropery T${ropery.tier}  +${def.productAmount} rope/${def.productionTime}s`,
                    menuX + 10, menuY + 20);

                // Divider
                farmCtx.strokeStyle = "#444";
                farmCtx.lineWidth = 1;
                farmCtx.beginPath();
                farmCtx.moveTo(menuX + 8, menuY + 28);
                farmCtx.lineTo(menuX + menuW - 8, menuY + 28);
                farmCtx.stroke();

                if (isMaxTier) {
                    farmCtx.fillStyle = "#555";
                    farmCtx.fillText("⬆ Max tier", menuX + 10, menuY + 50);
                } else {
                    // Upgrade option
                    farmCtx.fillStyle = canUpgrade ? "#f0f0d8" : "#888";
                    farmCtx.fillText(`⬆ T${ropery.tier + 1}`, menuX + 10, menuY + 50);
                    // Cost indicators
                    drawFarmCostList(nextDef.cost, menuX + 10, menuY + 65);
                    // Stat preview
                    farmCtx.font = "10px Arial";
                    farmCtx.fillStyle = "#80ff40";
                    farmCtx.fillText(`+${nextDef.productAmount} rope/${nextDef.productionTime}s`,
                        menuX + 10, menuY + 85);
                    farmCtx.font = "bold 11px Arial";

                    // Divider
                    farmCtx.strokeStyle = "#444";
                    farmCtx.lineWidth = 1;
                    farmCtx.beginPath();
                    farmCtx.moveTo(menuX + 8, menuY + 93);
                    farmCtx.lineTo(menuX + menuW - 8, menuY + 93);
                    farmCtx.stroke();

                    farmCtx.fillStyle = "#aaa";
                    farmCtx.fillText("Click building to collect", menuX + 10, menuY + 110);
                }
            }

            if (farmActiveMenu.type === "goat") {
                const goat = workshops.goat;
                if (!workshopDefs["goat"]) return;
                const maxTier = workshopDefs["goat"].maxTier;
                const isMaxTier = goat.tier >= maxTier;
                const nextDef = !isMaxTier ? workshopDefs["goat"][goat.tier + 1] : null;
                const canUpgrade = !isMaxTier && canAfford(nextDef.cost);
                const def = workshopDefs["goat"][goat.tier];

                const menuW = 160;
                const menuH = isMaxTier ? 80 : 120;
                const menuX = GOAT_X - menuW / 2;
                const menuY = GOAT_Y - GOAT_H - menuH - 10;

                farmCtx.fillStyle = "#1a2a1a";
                farmCtx.strokeStyle = "#8b6f47";
                farmCtx.lineWidth = 2;
                farmCtx.beginPath();
                farmCtx.roundRect(menuX, menuY, menuW, menuH, 6);
                farmCtx.fill();
                farmCtx.stroke();

                farmCtx.font = "bold 11px Arial";
                farmCtx.textAlign = "left";
                farmCtx.fillStyle = "#aaa";
                farmCtx.fillText(`Goat T${goat.tier}  +${def.productAmount} milk/${def.productionTime}s`,
                    menuX + 10, menuY + 20);

                farmCtx.strokeStyle = "#444";
                farmCtx.lineWidth = 1;
                farmCtx.beginPath();
                farmCtx.moveTo(menuX + 8, menuY + 28);
                farmCtx.lineTo(menuX + menuW - 8, menuY + 28);
                farmCtx.stroke();

                if (isMaxTier) {
                    farmCtx.fillStyle = "#555";
                    farmCtx.fillText("⬆ Max tier", menuX + 10, menuY + 50);
                } else {
                    farmCtx.fillStyle = canUpgrade ? "#f0f0d8" : "#888";
                    farmCtx.fillText(`⬆ T${goat.tier + 1}`, menuX + 10, menuY + 50);
                    drawFarmCostList(nextDef.cost, menuX + 10, menuY + 65);
                    farmCtx.font = "10px Arial";
                    farmCtx.fillStyle = "#80ff40";
                    farmCtx.fillText(`+${nextDef.productAmount} milk/${nextDef.productionTime}s`,
                        menuX + 10, menuY + 85);
                    farmCtx.font = "bold 11px Arial";
                    farmCtx.strokeStyle = "#444";
                    farmCtx.lineWidth = 1;
                    farmCtx.beginPath();
                    farmCtx.moveTo(menuX + 8, menuY + 93);
                    farmCtx.lineTo(menuX + menuW - 8, menuY + 93);
                    farmCtx.stroke();
                    farmCtx.fillStyle = "#aaa";
                    farmCtx.fillText("Click building to collect", menuX + 10, menuY + 110);
                }
            }
        }
        function drawFarmCostList(cost, x, y) {
            let offsetX = 0;
            for (let [resource, amount] of Object.entries(cost)) {
                const canPay = (resources[resource] || 0) >= amount;
                const icon = resourceIcons[resource];
                if (icon) {
                    farmCtx.drawImage(icon, x + offsetX, y - 10, 14, 14);
                    offsetX += 16;
                }
                farmCtx.fillStyle = canPay ? "#80ff40" : "#ff4444";
                farmCtx.font = "10px Arial";
                farmCtx.textAlign = "left";
                farmCtx.fillText(`${amount}`, x + offsetX, y);
                offsetX += 20;
            }
        }
        const TIER_HEX_COLORS = ["", "", "#4fc94f", "#4a8fff", "#c04aff", "#ffd700"];

        function drawRopery() {
            const now = performance.now();
            const ropery = workshops.ropery;
            const def = workshopDefs["ropery"] ? workshopDefs["ropery"][ropery.tier] : null;

            // Tier hex ring (tier 2+)
            if (ropery.tier >= 2) {
                const cx = ROPERY_X;
                const cy = ROPERY_Y - ROPERY_H / 2;
                const r = 46;
                const color = TIER_HEX_COLORS[ropery.tier] || "#ffd700";
                farmCtx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i - Math.PI / 6;
                    const hx = cx + r * Math.cos(angle);
                    const hy = cy + r * Math.sin(angle);
                    i === 0 ? farmCtx.moveTo(hx, hy) : farmCtx.lineTo(hx, hy);
                }
                farmCtx.closePath();
                farmCtx.fillStyle = color + "22";
                farmCtx.fill();
                farmCtx.strokeStyle = color;
                farmCtx.lineWidth = 2.5;
                farmCtx.stroke();

                // Tier digit — same style as tower hexes
                farmCtx.font = "bold 13px Arial";
                farmCtx.textAlign = "center";
                farmCtx.textBaseline = "middle";
                farmCtx.fillStyle = color;
                farmCtx.fillText(ropery.tier, cx, cy + r * 0.62);
                farmCtx.textBaseline = "alphabetic";
            }

            // Building sprite
            farmCtx.drawImage(roperyImage,
                ROPERY_X - ROPERY_W / 2,
                ROPERY_Y - ROPERY_H,
                ROPERY_W, ROPERY_H);

            // Label
            farmCtx.fillStyle = "#f0f0d8";
            farmCtx.font = "bold 11px Arial";
            farmCtx.textAlign = "center";
            farmCtx.fillText("Ropery", ROPERY_X, ROPERY_Y + 14);

            if (!def) return;

            // Progress bar
            const barW = 70;
            const barH = 6;
            const barX = ROPERY_X - barW / 2;
            const barY = ROPERY_Y + 20;

            let progress = 0;
            if (ropery.productionStart !== null) {
                const elapsed = now - ropery.productionStart;
                progress = Math.min(elapsed / (def.productionTime * 1000), 1);
            }

            farmCtx.fillStyle = "#333";
            farmCtx.fillRect(barX, barY, barW, barH);
            farmCtx.fillStyle = "#80ff40";
            farmCtx.fillRect(barX, barY, barW * progress, barH);
            farmCtx.strokeStyle = "#555";
            farmCtx.lineWidth = 1;
            farmCtx.strokeRect(barX, barY, barW, barH);

            // Stored counter
            if (ropery.stored > 0) {
                farmCtx.fillStyle = "#ffd700";
                farmCtx.font = "bold 12px Arial";
                farmCtx.textAlign = "center";
                farmCtx.fillText(`🧵 ${ropery.stored}`, ROPERY_X, barY + 20);
            }
        }
        function drawGoat() {
            const now = performance.now();
            const goat = workshops.goat;
            const def = workshopDefs["goat"] ? workshopDefs["goat"][goat.tier] : null;

            // Tier hex ring (tier 2+)
            if (goat.tier >= 2) {
                const cx = GOAT_X;
                const cy = GOAT_Y - GOAT_H / 2;
                const r = 46;
                const color = TIER_HEX_COLORS[goat.tier] || "#ffd700";
                farmCtx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i - Math.PI / 6;
                    const hx = cx + r * Math.cos(angle);
                    const hy = cy + r * Math.sin(angle);
                    i === 0 ? farmCtx.moveTo(hx, hy) : farmCtx.lineTo(hx, hy);
                }
                farmCtx.closePath();
                farmCtx.fillStyle = color + "22";
                farmCtx.fill();
                farmCtx.strokeStyle = color;
                farmCtx.lineWidth = 2.5;
                farmCtx.stroke();
                farmCtx.font = "bold 13px Arial";
                farmCtx.textAlign = "center";
                farmCtx.textBaseline = "middle";
                farmCtx.fillStyle = color;
                farmCtx.fillText(goat.tier, cx, cy + r * 0.62);
                farmCtx.textBaseline = "alphabetic";
            }

            // Sprite
            farmCtx.drawImage(goatImage,
                GOAT_X - GOAT_W / 2,
                GOAT_Y - GOAT_H,
                GOAT_W, GOAT_H);

            // Label
            farmCtx.fillStyle = "#f0f0d8";
            farmCtx.font = "bold 11px Arial";
            farmCtx.textAlign = "center";
            farmCtx.fillText("Goat", GOAT_X, GOAT_Y + 14);

            if (!def) return;

            // Progress bar
            const barW = 70;
            const barH = 6;
            const barX = GOAT_X - barW / 2;
            const barY = GOAT_Y + 20;
            let progress = 0;
            if (goat.productionStart !== null) {
                const elapsed = now - goat.productionStart;
                progress = Math.min(elapsed / (def.productionTime * 1000), 1);
            }
            farmCtx.fillStyle = "#333";
            farmCtx.fillRect(barX, barY, barW, barH);
            farmCtx.fillStyle = "#80d4ff";
            farmCtx.fillRect(barX, barY, barW * progress, barH);
            farmCtx.strokeStyle = "#555";
            farmCtx.lineWidth = 1;
            farmCtx.strokeRect(barX, barY, barW, barH);

            if (goat.stored > 0) {
                farmCtx.fillStyle = "#ffd700";
                farmCtx.font = "bold 12px Arial";
                farmCtx.textAlign = "center";
                farmCtx.fillText(`🥛 ${goat.stored}`, GOAT_X, barY + 20);
            }
        }

        // ─── GAME LOOP ────────────────────────────────────────────────────────────────
        function gameLoop(timestamp) {
            const dt = lastFrameTime === null ? 1 : Math.min((timestamp - lastFrameTime) / (1000 / 60), 3);
            lastFrameTime = timestamp;

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

            updateWaves(dt);
            updateEnemies(dt);
            updateTowers(dt);
            updateBullets(dt);
            updateSplashes();
            updateSporeClouds();
            updateProjectiles();
            updateFloatingNumbers();
            updateDropAnimations();

            drawGrid();
            drawTileIDs();
            drawElias();
            drawFence();
            drawSporeClouds();
            drawTowers();
            drawUpgradeIndicators();
            drawSplashes();
            drawBullets();
            drawProjectiles();
            drawEnemies();
            drawMenu();
            drawFloatingNumbers();

            ctx.restore();
            updateUI();
            drawDropAnimations();
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
                showFarm(); // ← start on farm instead of gameLoop()
            }
        });


        function fadeTransition(callback) {
            const overlay = document.createElement("div");
            overlay.style.cssText = `
                position: fixed;
                top: 0; left: 0;
                width: 100%; height: 100%;
                background: #000;
                opacity: 0;
                transition: opacity 0.4s;
                z-index: 9999;
                pointer-events: none;
            `;
            document.body.appendChild(overlay);
            
            // Fade in
            requestAnimationFrame(() => {
                overlay.style.opacity = "1";
                setTimeout(() => {
                    callback();
                    // Fade out
                    overlay.style.opacity = "0";
                    setTimeout(() => {
                        document.body.removeChild(overlay);
                    }, 400);
                }, 400);
            });
        }

       function showFarm() {
            fadeTransition(() => {
                currentScreen = "farm";
                gameScreen.style.display = "none";
                farmScreen.style.display = "block";
                cancelAnimationFrame(farmAnimationId);
                farmLoop();
                updateFarmUI();
            });
        }

        function showGame() {
            fadeTransition(() => {
                currentScreen = "game";
                cancelAnimationFrame(farmAnimationId);
                farmScreen.style.display = "none";
                gameScreen.style.display = "block";
            });
        }
